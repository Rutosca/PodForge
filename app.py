from flask import Flask, request, jsonify, render_template
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

# Inicializar Supabase con la llave maestra (Service Role)

supabase: Client = create_client(Settings.SUPABASE_URL, Settings.SUPABASE_SERVICE_KEY)

redis_conn = Redis.from_url(Settings.REDIS_URL)

app = Flask(__name__)

# CORS: restringir a tu dominio en producción
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5000").split(",")
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})

limiter = Limiter(get_remote_address, app=app, default_limits=["30 per minute"])
app.config.from_object(Settings)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB máximo

os.makedirs(Settings.TEMP_DIR, exist_ok=True)

# --- EL CORTAFUEGOS (Middleware) ---
# Reemplaza el decorador @requiere_creditos actual por este:

def manejar_accesos(f):
    @wraps(f)
    def decorador(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        # --- RUTA A: USUARIO REGISTRADO (Supabase) ---
        # Verificamos si hay token válido (distinto de null o vacío)
        if auth_header and auth_header != "Bearer null" and auth_header != "Bearer undefined":
            token = auth_header.replace("Bearer ", "")
            try:
                user_response = supabase.auth.get_user(token)
                user_id = user_response.user.id
            except Exception:
                return jsonify({"error": "Token inválido o expirado. Inicia sesión de nuevo."}), 401

            # Cobro en Supabase
            resultado = supabase.rpc('incrementar_uso_si_posible', {'p_usuario_id': user_id}).execute()
            if not resultado.data:
                return jsonify({"error": "Límite de usos alcanzado. Mejora tu plan."}), 402

            # Pasa al worker: user_id real, es_anonimo=False
            return f(user_id=user_id, es_anonimo=False, *args, **kwargs)
        
        # --- RUTA B: USUARIO ANÓNIMO (Redis IP Tracking) ---
        else:
            client_ip = request.remote_addr 
            redis_key = f"free_trial:{client_ip}"
            
            # 1. Sumamos +1 al uso de esta IP (si no existe, Redis lo crea con valor 1)
            usos_actuales = redis_conn.incr(redis_key)
            
            # 2. Si es su primera vez, le ponemos la caducidad de 30 días para limpiar memoria
            if usos_actuales == 1:
                redis_conn.expire(redis_key, 2592000)
                
            # 3. EL LÍMITE MAESTRO (Cambia este número al que quieras)
            LIMITE_ANONIMO = 3
            
            # 4. Si ha superado el límite, le bloqueamos (OJO: restamos el intento fallido para que el contador no suba infinitamente)
            if usos_actuales > LIMITE_ANONIMO:
                redis_conn.decr(redis_key)
                return jsonify({
                    "error": "¡Has visto el potencial! Regístrate gratis para seguir creando.", 
                    "needs_login": True 
                }), 402 
            
            # Pasa al worker
            return f(user_id=client_ip, es_anonimo=True, *args, **kwargs)
            
    return decorador
    
@app.route("/transformar", methods=["POST"])
@limiter.limit("3 per minute")
@manejar_accesos
def transformar(user_id, es_anonimo):
    
    url = request.form.get("url")
    if not url:
        return jsonify({"error": "Falta la URL"}), 400
    if not is_valid_youtube_url(url):
        return jsonify({"error": "URL de YouTube no válida"}), 400

    # Ahora le pasa el user_id al worker
    job = queue.enqueue(process_youtube, url, user_id, es_anonimo, job_timeout=600)

    return jsonify({
        "job_id": job.id,
        "status": "queued",
        "message": "Procesando video YouTube..."
    })

@app.route("/subir", methods=["POST"])
@limiter.limit("3 per minute")
@manejar_accesos
def subir(user_id, es_anonimo):
    if 'file' not in request.files:
        return jsonify({"error": "No hay archivo"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Nombre vacío"}), 400

    if file:
        filename = secure_filename(file.filename)
        unique_name = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(Settings.TEMP_DIR, unique_name)
        
        try:
            file.save(file_path)
            # Pasa el user_id al worker
            job = queue.enqueue(process_file, file_path, user_id, es_anonimo, job_timeout=600)
            
            return jsonify({
                "job_id": job.id,
                "status": "queued",
                "message": "Procesando archivo subido..."
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

# --- FASE 2: GENERACIÓN DE COPY BAJO DEMANDA ---

MAX_REGEN_PER_CLIP = 3  # Máximo de regeneraciones por clip por IP

@app.route("/generar-copy", methods=["POST"])
@limiter.limit("5 per minute")
@manejar_accesos
def generar_copy(user_id, es_anonimo):
    """
    Fase 2 — Genera título viral, caption y hook para un clip específico.
    Protegido con: rate-limit (5/min), verificación de acceso (créditos/IP),
    y contador de regeneraciones por clip (máx 3 por clip).
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Se requiere JSON con 'clip' y 'transcripcion'"}), 400

    clip = data.get("clip")
    transcripcion = data.get("transcripcion", "")
    resumen_contexto = data.get("resumen_contexto", "")

    if not clip:
        return jsonify({"error": "Falta el campo 'clip'"}), 400

    if not transcripcion:
        return jsonify({"error": "Falta el campo 'transcripcion'"}), 400

    # --- Anti-abuso: contador de regeneraciones por clip por usuario ---
    import hashlib
    clip_id = hashlib.md5(
        f"{clip.get('start','')}{clip.get('end','')}{clip.get('topic','')}".encode()
    ).hexdigest()[:12]
    regen_key = f"regen:{user_id}:{clip_id}"

    regen_count = redis_conn.incr(regen_key)
    if regen_count == 1:
        redis_conn.expire(regen_key, 86400)  # TTL: 24 horas

    if regen_count > MAX_REGEN_PER_CLIP:
        redis_conn.decr(regen_key)
        return jsonify({
            "error": f"Has alcanzado el límite de {MAX_REGEN_PER_CLIP} generaciones para este clip. Regístrate para más.",
            "needs_login": True
        }), 429

    try:
        from services.llm_service import generate_copy
        result = generate_copy(clip, transcripcion, resumen_contexto=resumen_contexto)
        return jsonify(result)
    except Exception as e:
        redis_conn.decr(regen_key)  # Devolver el intento si falló por error interno
        return jsonify({"error": str(e)}), 500


@app.route("/extraer-ideas", methods=["POST"])
@limiter.limit("3 per minute")
@manejar_accesos
def extraer_ideas(user_id, es_anonimo):
    """
    Fase 3 — Idea Extraction Engine.
    Extrae ideas virales reutilizables de la transcripción completa
    y genera contenido multi-plataforma para cada una.
    Solo disponible para planes STUDIO y AGENCY.
    """
    # ── Control de plan ────────────────────────────────────────────
    if not es_anonimo and user_id:
        try:
            plan_result = supabase.table('usage').select('plan_id').eq('user_id', user_id).single().execute()
            plan_id = plan_result.data.get('plan_id', 'free') if plan_result.data else 'free'
        except Exception:
            plan_id = 'free'

        PLANS_WITH_IDEAS = {'studio', 'agency', 'pro_plus'}   # ajusta según tu nomenclatura final
        if plan_id not in PLANS_WITH_IDEAS:
            return jsonify({
                "error": "UPGRADE_REQUIRED",
                "feature": "idea_extraction",
                "message": "El Idea Extraction Engine está disponible en el plan Studio o superior."
            }), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "Se requiere JSON con 'transcripcion'"}), 400

    transcripcion = data.get("transcripcion", "")
    resumen_contexto = data.get("resumen_contexto", "")

    if not transcripcion:
        return jsonify({"error": "Falta el campo 'transcripcion'"}), 400

    # Anti-abuso: máx 10 extracciones por transcripción por usuario
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


# --- CRÉDITOS: CONSULTA DE SALDO ---

@app.route("/creditos", methods=["GET"])
@limiter.limit("30 per minute")
def consultar_creditos():
    """Devuelve cuántos créditos le quedan al usuario (registrado o anónimo)."""
    auth_header = request.headers.get('Authorization')

    # Registrado (Supabase)
    if auth_header and auth_header not in ("Bearer null", "Bearer undefined"):
        token = auth_header.replace("Bearer ", "")
        try:
            user_response = supabase.auth.get_user(token)
            user_id = user_response.user.id

            # Consultar uso actual en Supabase
            result = supabase.table('usage') \
                .select('usos_totales, limite_plan') \
                .eq('user_id', user_id) \
                .single() \
                .execute()

            if result.data:
                remaining = max(0, result.data['limite_plan'] - result.data['usos_totales'])
                return jsonify({
                    "remaining": remaining,
                    "plan": "PRO" if result.data['limite_plan'] > 10 else "FREE",
                    "unlimited": result.data['limite_plan'] >= 9999
                })
            else:
                return jsonify({"remaining": 5, "plan": "FREE", "unlimited": False})

        except Exception:
            return jsonify({"remaining": 0, "plan": "FREE", "unlimited": False}), 401

    # Anónimo (Redis)
    else:
        client_ip = request.remote_addr
        redis_key = f"free_trial:{client_ip}"
        usos = int(redis_conn.get(redis_key) or 0)
        LIMITE_ANONIMO = 3
        remaining = max(0, LIMITE_ANONIMO - usos)
        return jsonify({
            "remaining": remaining,
            "plan": "FREE",
            "unlimited": False
        })
# --- FASE 3: GENERACIÓN Y SERVICIO DE VÍDEO (RECORTE FFMPEG) ---

@app.route("/generar-video-clip", methods=["POST"])
@limiter.limit("10 per minute")
@manejar_accesos
def generar_video_clip(user_id, es_anonimo):
    """
    Ruta para solicitar el recorte de un vídeo.
    Encola un trabajo FFmpeg en RQ para no bloquear la web.
    """
    data = request.get_json()
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

    # Evitamos spam de generar clip, esto usa CPU. Timeout algo mayor (300s).
    job = queue.enqueue(
        'tasks.process_clip_video', 
        source_video_id, start_time, end_time, user_id, 
        job_timeout=300
    )

    return jsonify({
        "job_id": job.id,
        "status": "queued",
        "message": "Recortando vídeo..."
    })

from flask import send_from_directory
import werkzeug.utils

@app.route("/media/<filename>", methods=["GET"])
def serve_media(filename):
    """
    Ruta para servir los archivos de vídeo MP4 que han sido recortados.
    Limpia el filename para evitar Directory Traversal Attacks.
    """
    safe_filename = werkzeug.utils.secure_filename(filename)
    # Servir el archivo desde el TEMP_DIR donde guardamos los recortes
    return send_from_directory(Settings.TEMP_DIR, safe_filename)


if Settings.ENV != "development":
    @app.route("/config")
    def disabled():
        return jsonify({"status": "disabled"}), 403


# --- 3. ARRANQUE ---

if __name__ == "__main__":
    
    app.run(host='0.0.0.0', port=5000)