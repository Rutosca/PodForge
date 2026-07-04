from flask import Flask, request, jsonify, send_from_directory
import threading
from rq import Worker
from flask_cors import CORS
from tasks import queue, process_youtube, process_file, process_clip_video
from rq.job import Job # type: ignore
from redis import Redis # pyright: ignore[reportMissingImports]
from config import Settings
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.utils import secure_filename
import os
import uuid
from supabase import create_client, Client # type: ignore
from functools import wraps
from utils.validators import is_valid_youtube_url

import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# Inicializar Supabase con la llave maestra (Service Role)
supabase: Client = create_client(Settings.SUPABASE_URL, Settings.SUPABASE_SERVICE_KEY)

redis_conn = Redis.from_url(Settings.REDIS_URL)

app = Flask(__name__)

# CORS: orígenes permitidos
# Flask-CORS soporta regex nativamente en la lista de orígenes
ALLOWED_ORIGINS = [
    r"https://.*\.vercel\.app",  # Todas las previews y prod de Vercel
    r"http://localhost:3000",
    r"http://localhost:5000"
]

# Añadir orígenes extra de la variable de entorno
extra_origins = os.getenv("ALLOWED_ORIGINS")
if extra_origins:
    ALLOWED_ORIGINS.extend([o.strip() for o in extra_origins.split(",")])

CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}}, supports_credentials=True)

limiter = Limiter(get_remote_address, app=app, storage_uri=Settings.REDIS_URL, default_limits=["30 per minute"])
app.config.from_object(Settings)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB máximo

os.makedirs(Settings.TEMP_DIR, exist_ok=True)

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", 500))

def check_file_size(f):
    @wraps(f)
    def decorador(*args, **kwargs):
        content_length = request.content_length
        if content_length is not None:
            max_bytes = MAX_UPLOAD_MB * 1024 * 1024
            if content_length > max_bytes:
                return jsonify({
                    "error": f"El archivo supera el límite de {MAX_UPLOAD_MB}MB.",
                    "size_limit_exceeded": True,
                }), 413
        return f(*args, **kwargs)
    return decorador


def manejar_accesos(f=None, *, cobrar=True):
    """
    Decorador de autenticación y control de acceso.

    Uso:
        @manejar_accesos          → autentica Y cobra crédito
        @manejar_accesos(cobrar=False) → solo autentica (el cobro se hace manualmente después)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get('Authorization')

            if auth_header and auth_header not in ("Bearer null", "Bearer undefined"):
                token = auth_header.replace("Bearer ", "")
                try:
                    user_response = supabase.auth.get_user(token)
                    user_id = user_response.user.id
                except Exception:
                    return jsonify({"error": "Token inválido o expirado. Inicia sesión de nuevo."}), 401

                if cobrar:
                    try:
                        resultado = supabase.rpc('incrementar_uso_si_posible', {'p_usuario_id': user_id}).execute()
                    except Exception as rpc_err:
                        log.error(f"Error en RPC incrementar_uso: {rpc_err}")
                        return jsonify({"error": "Error interno al verificar créditos. Inténtalo de nuevo."}), 500
                    if not resultado.data:
                        return jsonify({"error": "Límite de usos alcanzado. Mejora tu plan."}), 402

                return func(user_id=user_id, es_anonimo=False, *args, **kwargs)

            else:
                client_ip = request.remote_addr

                if cobrar:
                    redis_key = f"free_trial:{client_ip}"
                    usos_actuales = redis_conn.incr(redis_key)
                    if usos_actuales == 1:
                        redis_conn.expire(redis_key, 2592000)

                    LIMITE_ANONIMO = 3
                    if usos_actuales > LIMITE_ANONIMO:
                        redis_conn.decr(redis_key)
                        return jsonify({
                            "error": "¡Has visto el potencial! Regístrate gratis para seguir creando.",
                            "needs_login": True
                        }), 402

                return func(user_id=client_ip, es_anonimo=True, *args, **kwargs)

        return wrapper

    if f is not None:
        # Called as @manejar_accesos (without parentheses) — backwards compatible
        return decorator(f)
    # Called as @manejar_accesos(cobrar=False)
    return decorator


def _cobrar_credito(user_id, es_anonimo):
    """
    Cobra 1 crédito. Se llama DESPUÉS de validar el archivo
    para evitar gastar créditos en subidas fallidas.
    Retorna (None, None) si OK, o (response, code) si debe bloquearse.
    """
    if not es_anonimo:
        try:
            resultado = supabase.rpc('incrementar_uso_si_posible', {'p_usuario_id': user_id}).execute()
        except Exception as rpc_err:
            log.error(f"Error en RPC incrementar_uso: {rpc_err}")
            return jsonify({"error": "Error interno al verificar créditos. Inténtalo de nuevo."}), 500
        if not resultado.data:
            return jsonify({"error": "Límite de usos alcanzado. Mejora tu plan."}), 402
        return None, None

    redis_key = f"free_trial:{user_id}"
    usos_actuales = redis_conn.incr(redis_key)
    if usos_actuales == 1:
        redis_conn.expire(redis_key, 2592000)

    LIMITE_ANONIMO = 3
    if usos_actuales > LIMITE_ANONIMO:
        redis_conn.decr(redis_key)
        return jsonify({
            "error": "¡Has visto el potencial! Regístrate gratis para seguir creando.",
            "needs_login": True
        }), 402

    return None, None


@app.route("/transformar", methods=["POST"])
@limiter.limit("3 per minute")
@manejar_accesos
def transformar(user_id, es_anonimo):
    url = request.form.get("url")
    if not url:
        return jsonify({"error": "Falta la URL"}), 400
    if not is_valid_youtube_url(url):
        return jsonify({"error": "URL de YouTube no válida"}), 400

    job = queue.enqueue(process_youtube, url, user_id, es_anonimo, job_timeout=600)

    return jsonify({
        "job_id": job.id,
        "status": "queued",
        "message": "Procesando video YouTube..."
    })


@app.route("/subir", methods=["POST"])
@limiter.limit("3 per minute")
@check_file_size
@manejar_accesos(cobrar=False)
def subir(user_id, es_anonimo):
    # Paso 1: validar archivo ANTES de cobrar crédito
    if 'file' not in request.files:
        return jsonify({"error": "No hay archivo"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Nombre vacío"}), 400

    # Paso 2: cobrar crédito solo si el archivo llegó
    err_response, err_code = _cobrar_credito(user_id, es_anonimo)
    if err_response is not None:
        return err_response, err_code

    # Paso 3: guardar y encolar
    filename = secure_filename(file.filename)
    unique_name = f"{uuid.uuid4()}_{filename}"
    file_path = os.path.join(Settings.TEMP_DIR, unique_name)
    language = request.form.get("language", "es")

    try:
        file.save(file_path)
        job = queue.enqueue(
            process_file,
            file_path,
            user_id,
            es_anonimo,
            language,
            original_filename=filename,
            job_timeout='1h'
        )
        return jsonify({
            "job_id": job.id,
            "status": "queued",
            "message": "Procesando archivo subido..."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- FASE 2: GENERACIÓN DE COPY BAJO DEMANDA ---

MAX_REGEN_PER_CLIP = 3

@app.route("/generar-copy", methods=["POST"])
@limiter.limit("5 per minute")
@manejar_accesos
def generar_copy(user_id, es_anonimo):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Se requiere JSON con 'clip' y 'transcripcion'"}), 400

    clip = data.get("clip")
    transcripcion = data.get("transcripcion", "")
    resumen_contexto = data.get("resumen_contexto", "")

    if not clip:
        return jsonify({"error": "Falta el campo 'clip'"}), 400
    if not transcripcion:
        return jsonify({"error": "Falta el campo 'transcripcion'"}), 400

    import hashlib
    clip_id = hashlib.md5(
        f"{clip.get('start','')}{clip.get('end','')}{clip.get('topic','')}".encode()
    ).hexdigest()[:12]
    regen_key = f"regen:{user_id}:{clip_id}"

    regen_count = redis_conn.incr(regen_key)
    if regen_count == 1:
        redis_conn.expire(regen_key, 86400)

    if regen_count > MAX_REGEN_PER_CLIP:
        redis_conn.decr(regen_key)
        return jsonify({
            "error": f"Has alcanzado el límite de {MAX_REGEN_PER_CLIP} generaciones para este clip.",
            "needs_login": True
        }), 429

    try:
        from services.llm_service import generate_copy
        result = generate_copy(clip, transcripcion, resumen_contexto=resumen_contexto)

        # Guardar el copy generado en la tabla copy_generado
        if not es_anonimo and "error" not in result:
            try:
                # El frontend puede enviar el clip_id de Supabase si lo tiene
                clip_id_supabase = data.get("clip_id")

                # Si no lo tiene, intentar buscarlo por start_time + topic
                if not clip_id_supabase:
                    clip_lookup = supabase.table('clips') \
                        .select('id') \
                        .eq('id_usuario', user_id) \
                        .eq('start_time', clip.get('start', '')) \
                        .eq('topic', clip.get('topic', '')) \
                        .limit(1) \
                        .execute()
                    if clip_lookup.data:
                        clip_id_supabase = clip_lookup.data[0]['id']

                if clip_id_supabase:
                    supabase.table('copy_generado').insert({
                        "clip_id": clip_id_supabase,
                        "id_usuario": user_id,
                        "titulo": result.get("titulo"),
                        "caption": result.get("caption"),
                        "hooks": result.get("hooks", []),
                        "formato_recomendado": result.get("formato_recomendado"),
                        "estructura_clip": result.get("estructura_clip", []),
                    }).execute()
                    log.info(f"Copy guardado en DB para clip {clip_id_supabase}")
            except Exception as copy_err:
                log.warning(f"No se pudo guardar copy en DB (no crítico): {copy_err}")

        return jsonify(result)
    except Exception as e:
        redis_conn.decr(regen_key)
        return jsonify({"error": str(e)}), 500


@app.route("/extraer-ideas", methods=["POST"])
@limiter.limit("3 per minute")
@manejar_accesos
def extraer_ideas(user_id, es_anonimo):
    if not es_anonimo and user_id:
        try:
            plan_result = supabase.table('usage').select('plan_id').eq('user_id', user_id).single().execute()
            plan_id = plan_result.data.get('plan_id', 'free') if plan_result.data else 'free'
        except Exception:
            plan_id = 'free'

        PLANS_WITH_IDEAS = {'studio', 'agency', 'pro_plus'}
        if plan_id not in PLANS_WITH_IDEAS:
            return jsonify({
                "error": "UPGRADE_REQUIRED",
                "feature": "idea_extraction",
                "message": "El Idea Extraction Engine está disponible en el plan Studio o superior."
            }), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Se requiere JSON con 'transcripcion'"}), 400

    transcripcion = data.get("transcripcion", "")
    resumen_contexto = data.get("resumen_contexto", "")

    if not transcripcion:
        return jsonify({"error": "Falta el campo 'transcripcion'"}), 400

    import hashlib
    transcript_id = hashlib.md5(transcripcion[:500].encode()).hexdigest()[:12]
    ideas_key = f"ideas:{user_id}:{transcript_id}"

    call_count = redis_conn.incr(ideas_key)
    if call_count == 1:
        redis_conn.expire(ideas_key, 86400)

    if call_count > 10:
        redis_conn.decr(ideas_key)
        return jsonify({"error": "Límite de extracciones para esta transcripción alcanzado."}), 429

    try:
        from services.llm_service import extract_ideas
        result = extract_ideas(transcripcion, resumen_contexto=resumen_contexto)

        if result.get("error"):
            redis_conn.decr(ideas_key)
            return jsonify(result), 500

        return jsonify(result)
    except Exception as e:
        redis_conn.decr(ideas_key)
        return jsonify({"error": str(e)}), 500


# --- POLLING DE ESTADO ---

@app.route("/status/<job_id>", methods=["GET"])
@limiter.limit("60 per minute")
def job_status(job_id):
    try:
        job = queue.fetch_job(job_id)
    except Exception:
        return jsonify({"error": "Error de conexión"}), 500

    if not job:
        return jsonify({"error": "Trabajo no encontrado"}), 404

    if job.is_failed:
        error_msg = str(job.exc_info) if job.exc_info else "Error desconocido"
        return jsonify({"status": "failed", "error": error_msg}), 500

    if job.is_finished:
        return jsonify({"status": "finished", "result": job.result})

    return jsonify({"status": "processing"})


# --- HISTORIAL ---

@app.route("/historial", methods=["GET"])
@limiter.limit("30 per minute")
def consultar_historial():
    auth_header = request.headers.get('Authorization')

    if not auth_header or auth_header in ("Bearer null", "Bearer undefined"):
        return jsonify({"historial": []}), 200

    token = auth_header.replace("Bearer ", "")
    try:
        try:
            user_response = supabase.auth.get_user(token)
            user_id = user_response.user.id
        except Exception as auth_err:
            log.warning(f"Token inválido en /historial: {auth_err}")
            return jsonify({"error": "Token inválido", "historial": []}), 401

        # Paso 1: obtener transcripciones del usuario
        trans_result = supabase.table('transcripciones') \
            .select('id, creado_en, tipo_fuente, url_o_nombre, resultado_json') \
            .eq('id_usuario', user_id) \
            .order('creado_en', desc=True) \
            .limit(20) \
            .execute()

        trans_rows = trans_result.data or []
        if not trans_rows:
            return jsonify({"historial": []})

        # Paso 2: obtener clips normalizados para esas transcripciones
        trans_ids = [row['id'] for row in trans_rows]
        clips_result = supabase.table('clips') \
            .select('transcripcion_id, topic, viral_score, clip_tipo') \
            .in_('transcripcion_id', trans_ids) \
            .execute()

        # Agrupar clips por transcripcion_id
        clips_by_trans: dict = {}
        for clip in (clips_result.data or []):
            tid = clip['transcripcion_id']
            clips_by_trans.setdefault(tid, []).append(clip)

        historial = []
        for row in trans_rows:
            tid = row['id']
            clips_norm = clips_by_trans.get(tid, [])
            radar = row.get('resultado_json') or {}

            if clips_norm:
                best_clip = max(clips_norm, key=lambda c: c.get('viral_score', 0))
                title = best_clip.get('topic') or row.get('url_o_nombre') or 'Análisis sin título'
                count = len(clips_norm)
            else:
                # Fallback a blob JSON para registros anteriores
                clips_json = radar.get('clips', [])
                title = clips_json[0].get('topic') if clips_json else None
                title = title or row.get('url_o_nombre') or 'Análisis sin título'
                count = len(clips_json)

            historial.append({
                "id": str(tid),
                "title": title,
                "date": row['creado_en'],
                "status": "completed",
                "clipsCount": count,
                "videoUrl": row.get('url_o_nombre') if row.get('tipo_fuente') == 'youtube' else None,
                "resultado_json": radar,
            })

        return jsonify({"historial": historial})

    except Exception as e:
        log.error(f"Error en /historial: {e}")
        return jsonify({"error": str(e), "historial": []}), 500

@app.route("/historial", methods=["DELETE"])
@limiter.limit("5 per minute")
def borrar_historial():
    auth_header = request.headers.get('Authorization')
    if not auth_header or auth_header in ("Bearer null", "Bearer undefined"):
        return jsonify({"status": "success"}), 200

    token = auth_header.replace("Bearer ", "")
    try:
        user_response = supabase.auth.get_user(token)
        user_id = user_response.user.id
        
        supabase.table('transcripciones').delete().eq('id_usuario', user_id).execute()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        log.error(f"Error al borrar historial: {e}")
        return jsonify({"error": str(e)}), 500


# --- CRÉDITOS ---

@app.route("/creditos", methods=["GET"])
@limiter.limit("30 per minute")
def consultar_creditos():
    auth_header = request.headers.get('Authorization')

    if auth_header and auth_header not in ("Bearer null", "Bearer undefined"):
        token = auth_header.replace("Bearer ", "")
        
        # 1. Verificar auth primero
        try:
            user_response = supabase.auth.get_user(token)
            user_id = user_response.user.id
        except Exception as auth_err:
            return jsonify({"remaining": 0, "plan": "FREE", "unlimited": False}), 401

        # 2. Obtener usage
        try:
            result = supabase.table('usage') \
                .select('usos_totales, limite_plan, plan_id') \
                .eq('user_id', user_id) \
                .single() \
                .execute()

            if result.data:
                remaining = max(0, result.data['limite_plan'] - result.data['usos_totales'])
                
                plan_id = result.data.get('plan_id')
                plan_name = str(plan_id).upper() if plan_id else "FREE"

                return jsonify({
                    "remaining": remaining,
                    "plan": plan_name,
                    "unlimited": result.data['limite_plan'] >= 9999
                })
            else:
                return jsonify({"remaining": 5, "plan": "FREE", "unlimited": False})

        except Exception as db_err:
            log.warning(f"Error al obtener créditos (usuario {user_id}): {db_err}")
            # Si no hay fila en usage o falla la DB, devolver valores por defecto sin dar 401
            return jsonify({"remaining": 5, "plan": "FREE", "unlimited": False}), 200

    else:
        client_ip = request.remote_addr
        redis_key = f"free_trial:{client_ip}"
        usos = int(redis_conn.get(redis_key) or 0)
        LIMITE_ANONIMO = 3
        remaining = max(0, LIMITE_ANONIMO - usos)
        return jsonify({"remaining": remaining, "plan": "FREE", "unlimited": False})


# --- FASE 3: VÍDEO ---

@app.route("/generar-video-clip", methods=["POST"])
@limiter.limit("10 per minute")
@manejar_accesos
def generar_video_clip(user_id, es_anonimo):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON requerido"}), 400

    source_video_id = data.get("source_video_id")
    start_time = data.get("start_time")
    end_time = data.get("end_time")

    if not source_video_id or start_time is None or end_time is None:
        return jsonify({"error": "Faltan parámetros: source_video_id, start_time, end_time"}), 400

    try:
        start_time = float(start_time)
        end_time = float(end_time)
    except ValueError:
        return jsonify({"error": "start_time y end_time deben ser números."}), 400

    if end_time - start_time > 120:
        return jsonify({"error": "El clip no puede durar más de 2 minutos por seguridad."}), 400

    job = queue.enqueue(
        'tasks.process_clip_video',
        source_video_id, start_time, end_time, user_id,
        job_timeout=300
    )

    return jsonify({"job_id": job.id, "status": "queued", "message": "Recortando vídeo..."})


@app.route("/media/<filename>", methods=["GET"])
def serve_media(filename):
    safe_filename = secure_filename(filename)
    return send_from_directory(Settings.TEMP_DIR, safe_filename)


if Settings.ENV != "development":
    @app.route("/config")
    def disabled():
        return jsonify({"status": "disabled"}), 403



# --- ARRANQUE Y WORKER INTEGRADO ---

# IMPORTANTE: Para que funcione en un entorno monolítico (como Render Web Service sin Background Worker extra)
# levantamos un worker de RQ en un hilo en segundo plano dentro del mismo proceso de Flask.

import logging as _logging
_worker_log = _logging.getLogger("rq.worker")

class ThreadSafeWorker(Worker):
    def execute_job(self, job, queue):
        try:
            super().execute_job(job, queue)
        except Exception as e:
            _worker_log.error(f"Error en worker embebido ejecutando {job.id}: {e}")

def run_worker():
    with app.app_context():
        try:
            worker = ThreadSafeWorker([queue], connection=redis_conn)
            worker.work(with_scheduler=True, disable_default_signal_handlers=True)
        except Exception as e:
            _worker_log.error(f"Worker thread crashed: {e}")

worker_thread = threading.Thread(target=run_worker, daemon=True)
worker_thread.start()


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)