import os
import uuid
import tempfile
import logging
import yt_dlp
import traceback
from config import Settings

log = logging.getLogger(__name__)

def get_ytdlp_config(cookie_path=None, video=False):
    # Límite muy estricto de duración: 2 horas (7200 segundos) para evitar ataques de videos infinitos
    MAX_DURATION_SECONDS = 7200

    def duration_filter(info, *, incomplete):
        duration = info.get('duration')
        if duration and duration > MAX_DURATION_SECONDS:
            return f"El vídeo es demasiado largo ({duration}s). Máximo permitido: {MAX_DURATION_SECONDS}s."
        return None

    config = {
        # Si pide vídeo, bajamos el MP4 más pequeño posible (max 720p) + audio. Si no, solo audio.
        'format': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' if video else 'bestaudio/best',
        'outtmpl': '%(id)s.%(ext)s',
        'quiet': False,          # IMPORTANTE: False para que los errores de yt-dlp sean visibles en logs
        'no_warnings': False,    # Mostrar warnings para diagnóstico
        'nocheckcertificate': True,
        # 'impersonate' ELIMINADO — curl-cffi falla silenciosamente en Docker python:slim
        # sin libcurl4-openssl-dev, provocando el error silencioso
        'socket_timeout': 30,
        # Aborta si la duración total excede el límite
        'match_filter': duration_filter,
        # Límite por tamaño
        'max_filesize': Settings.MAX_DOWNLOAD_MB * 1024 * 1024,
        'force_ipv4': True, 
        
        'extractor_args': {
            'youtube': {
                'player_client': ['android'],
                'player_skip': ['web', 'tv', 'ios']
            }
        }
    }

    if cookie_path:
        config['cookiefile'] = cookie_path

    return config


def _download_content(url: str, as_video: bool):
    file_id = str(uuid.uuid4())
    output_template = os.path.join(Settings.TEMP_DIR, f"{file_id}.%(ext)s")

    log.info(f"📥 Iniciando descarga yt-dlp: {url} (video={as_video})")

    cookie_path = None
    env_cookie_file = os.getenv("YT_COOKIES_FILE")
    
    # Prioridad: 1) variable de entorno, 2) ruta por defecto en Docker
    if env_cookie_file and os.path.exists(env_cookie_file):
        cookie_path = env_cookie_file
    elif os.path.exists("/app/cookies.txt"):
        cookie_path = "/app/cookies.txt"
    
    if cookie_path:
        log.info(f"Usando cookies: {cookie_path}")
    else:
        log.warning("No se encontró archivo de cookies — YouTube puede bloquear la descarga")

    opts = get_ytdlp_config(cookie_path, video=as_video)
    opts["outtmpl"] = output_template

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if not info:
                log.warning("⚠️ yt-dlp devolvió info=None")
                return None, "Video rechazado o no se pudo obtener información."

            filename = ydl.prepare_filename(info)

        if not os.path.exists(filename):
            log.error(f"❌ yt-dlp finalizó pero el archivo no existe: {filename}")
            return None, "Error: yt-dlp finalizó pero no hay archivo."

        log.info(f"✅ Descarga completada: {filename}")
        return filename, None

    except Exception as e:
        error_msg = str(e)
        traza_completa = traceback.format_exc()
        # IMPORTANTE: log.error va a stderr → visible en Docker logs
        # print() iba a stdout → capturado por RQ, invisible en docker logs
        log.error(f"❌ Error yt-dlp DETALLADO:\n{traza_completa}")
        
        if "demasiado largo" in error_msg:
            return None, "Video rechazado por protección anti-abuso: Es demasiado largo."
        return None, f"Error de yt-dlp: {error_msg}"


def download_audio(url: str):
    return _download_content(url, as_video=False)

def download_video_and_audio(url: str):
    """
    Nuevo: Descarga el video completo de YouTube con resoluciones protegidas.
    """
    return _download_content(url, as_video=True)
