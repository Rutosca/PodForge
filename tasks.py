import logging
import gc
from rq import Queue # type: ignore
import os
import httpx
from redis import Redis # type: ignore
from config import Settings
from services.youtube_service import download_audio
from services.audio_service import compress_audio
from services.deepgram_service import transcribe_audio_deepgram
from services.llm_service import detect_clips 
from utils.cleanup import cleanup_files, cleanup_old_temp_files             
from supabase import create_client, Client # type: ignore
from services.video_service import trim_video_ffmpeg, trim_audio_ffmpeg
from services.storage_service import upload_clip_file

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

redis_conn = Redis.from_url(Settings.REDIS_URL)
queue = Queue(connection=redis_conn)

supabase: Client = create_client(Settings.SUPABASE_URL, Settings.SUPABASE_SERVICE_KEY)

from services.youtube_service import download_video_and_audio

def process_youtube(url, user_id, es_anonimo, language: str | None = "es"):
    #buscar en caché de bases de datos
    try:
        log.info(f"Buscar en Supabase: {url}")
        cache = supabase.table('transcripciones').select('resultado_json').eq('url_o_nombre', url).execute()
        
        if cache.data and len(cache.data) > 0:
            log.info("Video ya procesado.")
            radar = cache.data[0]['resultado_json']
            
            return {
                "status": "success",
                "transcripcion": "Transcripción recuperada de caché",
                "resumen_contexto": radar.get("resumen_global_contexto", ""),
                "clips": radar.get("clips", []),
                "source_video_id": url.split('v=')[-1].split('&')[0], 
                "source_type": "youtube"
            }
    except Exception as e:
        log.warning(f"Error buscando en caché: {e}")

    raw_video = None
    try:
        
        log.info(f"Descargando YouTube (Vídeo max 720p para recortes): {url}")
        # Descargamos video+audio. Pesa más pero es necesario para la Feature de Recorte
        raw_video, err = download_video_and_audio(url)
        if err:
            if es_anonimo:
                redis_conn.decr(f"free_trial:{user_id}")
            else:
                supabase.rpc('decrementar_uso_seguro', {'p_usuario_id': user_id}).execute()
            log.error(f"Fallo descarga: {err}")
            return {"error": err}

        # Extrae el ID del video del nombre del archivo (uuid)
        # El archivo queda en disco (TEMP_DIR) para que ffmpeg lo corte luego
        video_id = os.path.basename(raw_video).split('.')[0]
        
        # Procesa como siempre, pero pasa el ID del video original
        return _process_common(raw_video, user_id, "youtube", url, es_anonimo, language, source_video_id=video_id, source_type='video')
    except Exception as e:
        if es_anonimo:
            redis_conn.decr(f"free_trial:{user_id}")
        else:
            supabase.rpc('decrementar_uso_seguro', {'p_usuario_id': user_id}).execute()
        log.error(f"Error crítico YouTube: {e}")
        # Solo limpiamos si hubo error fatal. Si fue bien, se queda para ffmpeg
        if raw_video:
            cleanup_files(raw_video)
        return {"error": str(e)}

def process_file(file_path, user_id, es_anonimo, language: str | None = "es", original_filename: str | None = None):
    try:
        log.info(f"Procesando archivo local: {file_path}")
        video_id = os.path.basename(file_path).split('.')[0]

        # Detectar si es audio o vídeo por extensión
        ext = os.path.splitext(file_path)[1].lower()
        AUDIO_EXTENSIONS = {'.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac', '.opus', '.weba'}
        source_type = 'audio' if ext in AUDIO_EXTENSIONS else 'video'

        # Usar el nombre original si existe, sino el generado (que incluye uuid)
        cache_name = original_filename if original_filename else os.path.basename(file_path)

        # Buscar en caché SOLO para este usuario (para evitar conflictos si 2 usuarios suben 'video.mp4')
        if not es_anonimo:
            log.info(f"Buscar en caché archivo: {cache_name} para usuario {user_id}")
            cache = supabase.table('transcripciones').select('resultado_json').eq('id_usuario', user_id).eq('url_o_nombre', cache_name).execute()
            if cache.data and len(cache.data) > 0:
                log.info("✅ Caché encontrado en Supabase para el archivo.")
                # Limpiar el archivo subido porque no lo vamos a usar
                cleanup_files(file_path)
                return cache.data[0]['resultado_json']

        return _process_common(file_path, user_id, "archivo", cache_name, es_anonimo, language, source_video_id=video_id, source_type=source_type)
    except Exception as e:
        if es_anonimo:
            redis_conn.decr(f"free_trial:{user_id}")
        else:
            supabase.rpc('decrementar_uso_seguro', {'p_usuario_id': user_id}).execute()
        log.error(f"Error crítico Archivo: {e}")
        # Solo limpiar en caso de error fatal
        if os.path.exists(file_path):
            cleanup_files(file_path)
        return {"error": str(e)}

def _parse_time_to_seconds(ts: str) -> float:
    """
    Convierte un timestamp 'MM:SS' o 'H:MM:SS' (formato que usa detect_clips)
    a segundos, para poder pasarlo a trim_video_ffmpeg / trim_audio_ffmpeg.
    """
    try:
        parts = str(ts).strip().split(":")
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except (ValueError, IndexError):
        pass
    return 0.0


def _generate_clip_previews(clips: list, source_video_id: str, source_type: str) -> None:
    """
    Recorta automáticamente los clips con mayor viral_score (previsualización)
    justo después del análisis, y añade 'media_url' a cada dict de clip
    (in place; no hace falta reasignar radar["clips"] porque son los mismos objetos).

    Si falla el recorte de un clip puntual (timestamps inválidos, duración > 120s,
    etc.) se salta ese clip y se continúa con el resto: un solo fallo de FFmpeg
    no debe tirar abajo el análisis completo.
    """
    if not clips or not source_video_id:
        return

    TOP_N_PREVIEWS = 3
    top_clips = sorted(clips, key=lambda c: c.get("viral_score", 0), reverse=True)[:TOP_N_PREVIEWS]

    for clip in top_clips:
        try:
            start_sec = _parse_time_to_seconds(clip.get("start", "00:00"))
            end_sec = _parse_time_to_seconds(clip.get("end", "00:00"))

            if end_sec <= start_sec:
                log.warning(f"Preview omitido (tiempos inválidos): {clip.get('start')} → {clip.get('end')}")
                continue

            if source_type == "audio":
                clip_filename = trim_audio_ffmpeg(source_video_id, start_sec, end_sec)
            else:
                clip_filename = trim_video_ffmpeg(source_video_id, start_sec, end_sec)

            # Respaldo en Storage y luego borrar del disco local para liberar RAM/disco.
            clip_path = os.path.join(Settings.TEMP_DIR, clip_filename)
            upload_clip_file(clip_path)
            cleanup_files(clip_path)

            clip["media_url"] = f"/media/{clip_filename}"
            log.info(f"🎬 Preview generado para '{clip.get('topic', '?')}': {clip['media_url']}")

        except Exception as e:
            log.error(f"⚠️ No se pudo generar preview para clip '{clip.get('topic', '?')}': {e}")
            continue

    # Liberar memoria tras los re-encodes de FFmpeg
    gc.collect()


def _process_common(audio_path, user_id, tipo_fuente, url_o_nombre, es_anonimo, language: str | None = "es", source_video_id: str | None = None, source_type: str = 'video'):
    compressed_audio = None
    try:
        log.info("Comprimiendo audio...")
        compressed_audio = compress_audio(audio_path)

        log.info(f"Transcribiendo con Deepgram (idioma: {language or 'auto'})...")
        transcription = transcribe_audio_deepgram(compressed_audio, language=language)
        
        if transcription.startswith("Error"):
            if es_anonimo:
                redis_conn.decr(f"free_trial:{user_id}")
            else:
                supabase.rpc('decrementar_uso_seguro', {'p_usuario_id': user_id}).execute()
            log.error(f"Fallo transcripción: {transcription}")
            return {"error": transcription}

        log.info("Detectando clips virales (Fase 1)...")
        radar = detect_clips(transcription)

        log.info("Generando previews de los clips top (recorte automático)...")
        _generate_clip_previews(radar.get("clips", []), source_video_id, source_type)

        # Guardar en DB para usuarios registrados
        if not es_anonimo:
            try:
                # 1. Insertar transcripción y obtener su ID
                trans_result = supabase.table('transcripciones').insert({
                    "id_usuario": user_id,
                    "tipo_fuente": tipo_fuente,
                    "url_o_nombre": url_o_nombre,
                    "resultado_json": radar
                }).execute()

                transcripcion_id = trans_result.data[0]['id'] if trans_result.data else None
                log.info(f"Transcripción guardada con ID: {transcripcion_id}")

                # 2. Insertar cada clip detectado en la tabla normalizada
                if transcripcion_id:
                    clips_raw = radar.get("clips", [])
                    clips_to_insert = []
                    for clip in clips_raw:
                        factors = clip.get("factors", {})
                        pf = clip.get("platform_fit", {})
                        clips_to_insert.append({
                            "transcripcion_id": transcripcion_id,
                            "id_usuario": user_id,
                            "start_time": clip.get("start", "00:00"),
                            "end_time": clip.get("end", "00:00"),
                            "duracion_segundos": clip.get("duration_seconds", 0),
                            "topic": clip.get("topic", ""),
                            "type": clip.get("type"),
                            "clip_tipo": clip.get("clip_tipo"),
                            "frase_clave": clip.get("frase_clave"),
                            "viral_score": clip.get("viral_score", 0),
                            "intensidad_hook": clip.get("intensidad_hook", 3),
                            "factor_contradiction": factors.get("contradiction"),
                            "factor_controversy": factors.get("controversy"),
                            "factor_language": factors.get("language_intensity"),
                            "factor_hook_clarity": factors.get("hook_clarity"),
                            "factor_engagement": factors.get("engagement_potential"),
                            "fit_tiktok": pf.get("tiktok"),
                            "fit_instagram": pf.get("instagram"),
                            "fit_youtube_shorts": pf.get("youtube_shorts"),
                            "fit_twitter": pf.get("twitter"),
                        })

                    if clips_to_insert:
                        supabase.table('clips').insert(clips_to_insert).execute()
                        log.info(f"{len(clips_to_insert)} clips guardados en tabla 'clips'")

            except Exception as db_err:
                log.error(f"ALERTA: Fallo al guardar en Supabase. Error: {db_err}")
        else:
            log.info("¡Éxito anónimo! (No se guarda en DB)")



        return {
            "status": "success",
            "transcripcion": transcription,
            "resumen_contexto": radar.get("resumen_global_contexto", ""),
            "clips": radar.get("clips", []),
            "source_video_id": source_video_id,
            "source_type": source_type          # 'video' | 'audio'
        }
    except Exception as e:
        if es_anonimo:
                redis_conn.decr(f"free_trial:{user_id}")
        else:
            supabase.rpc('decrementar_uso_seguro', {'p_usuario_id': user_id}).execute()
        log.error(f"Error en process_common: {e}")
        return {"error": str(e)}
    finally:
        # Borramos el audio comprimido
        cleanup_files(compressed_audio)
        # VITAL: Borramos el archivo original siempre para que el disco de Render no colapse
        cleanup_files(audio_path)
        # Limpieza agresiva de temporales viejos (>30 min) para liberar disco
        cleanup_old_temp_files(max_age_minutes=30)

def process_clip_video(source_video_id: str, start_time: float, end_time: float, user_id: str):
    """
    Tarea de background asíncrona para que no bloquee el hilo de Flask.
    Usa el servicio de video para llamar a FFmpeg y devolver un nombre de archivo.
    """
    try:
        log.info(f"Generando clip de video desde: {source_video_id} ({start_time} - {end_time})")
        clip_filename = trim_video_ffmpeg(source_video_id, start_time, end_time)
        return {
            "status": "success",
            "media_url": f"/media/{clip_filename}",
            "media_type": "video"
        }
    except Exception as e:
        log.error(f"Error generando clip de vídeo: {e}")
        return {"error": str(e)}


def process_clip_audio(source_video_id: str, start_time: float, end_time: float, user_id: str):
    """
    Igual que process_clip_video pero para archivos de audio (mp3, m4a, etc.).
    """
    try:
        log.info(f"🎵 Generando clip de audio desde: {source_video_id} ({start_time} - {end_time})")
        clip_filename = trim_audio_ffmpeg(source_video_id, start_time, end_time)
        return {
            "status": "success",
            "media_url": f"/media/{clip_filename}",
            "media_type": "audio"
        }
    except Exception as e:
        log.error(f"Error generando clip de audio: {e}")
        return {"error": str(e)}


def process_copy_generation(clip, transcripcion, resumen_contexto, user_id, es_anonimo, clip_id_hint, regen_key):
    """
    Tarea de background: genera copy con Gemini y lo guarda en DB.
    Se ejecuta en el worker de RQ, no en el proceso de gunicorn.
    """
    try:
        from services.llm_service import generate_copy
        result = generate_copy(clip, transcripcion, resumen_contexto=resumen_contexto)

        # Guardar el copy generado en la tabla copy_generado
        if not es_anonimo and "error" not in result:
            try:
                clip_id_supabase = clip_id_hint

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

        return result

    except Exception as e:
        redis_conn.decr(regen_key)
        log.error(f"Error en process_copy_generation: {e}")
        return {"error": str(e)}