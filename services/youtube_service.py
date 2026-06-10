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
        'quiet': False,
        'no_warnings': False,
        'nocheckcertificate': True,
        'socket_timeout': 30,
        'match_filter': duration_filter,
        'max_filesize': Settings.MAX_DOWNLOAD_MB * 1024 * 1024,
        'force_ipv4': True, 
        
        'extractor_args': {
            'youtube': {
                # Cadena de fallback: yt-dlp prueba cada uno hasta que funcione.
                # 'mweb' y 'mediaconnect' son los más resistentes a bloqueos de datacenter.
                'player_client': ['mweb', 'android', 'mediaconnect'],
            }
        }
    }

    # --- PROXY (Bright Data, Smartproxy, Oxylabs, etc.) ---
    # Formato: http://user:pass@host:port o socks5://user:pass@host:port
    proxy_url = os.getenv("PROXY_URL")
    if proxy_url:
        config['proxy'] = proxy_url
        log.info("🌐 Proxy configurado para yt-dlp")

    if cookie_path:
        config['cookiefile'] = cookie_path

    return config


def _sanitize_cookies_file(path: str) -> str | None:
    """
    Verifica y sanitiza el archivo de cookies.
    - Comprueba que existe y es un archivo (no un directorio vacío de Docker)
    - Convierte CRLF → LF (Windows → Linux)
    - Logea diagnóstico detallado
    Devuelve la ruta sanitizada o None si no es válido.
    """
    if not os.path.exists(path):
        log.warning(f"COOKIES: {path} no existe")
        return None
    
    if os.path.isdir(path):
        # Docker monta un directorio vacío cuando el archivo fuente no existe
        log.error(f"COOKIES: {path} es un DIRECTORIO, no un archivo. "
                  "Esto ocurre cuando cookies.txt no existe en el host y Docker lo monta como carpeta vacía.")
        return None
    
    size = os.path.getsize(path)
    if size == 0:
        log.error(f"COOKIES: {path} existe pero está vacío (0 bytes)")
        return None
    
    # Leer y diagnosticar contenido
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    cookie_lines = [l for l in content.splitlines() if l.strip() and not l.startswith('#')]
    has_crlf = '\r\n' in content
    
    log.info(f"COOKIES: {path} — {size} bytes, {len(cookie_lines)} cookies, CRLF={'SI' if has_crlf else 'NO'}")
    
    if len(cookie_lines) == 0:
        log.error("COOKIES: El archivo no contiene ninguna cookie válida")
        return None
    
    # Sanitizar CRLF → LF (yt-dlp en Linux puede fallar con CRLF)
    if has_crlf:
        log.info("COOKIES: Convirtiendo CRLF → LF para compatibilidad Linux")
        clean_content = content.replace('\r\n', '\n')
        sanitized_path = os.path.join(Settings.TEMP_DIR, 'cookies_sanitized.txt')
        with open(sanitized_path, 'w', encoding='utf-8') as f:
            f.write(clean_content)
        return sanitized_path
    
    return path


import base64

def _resolve_cookies_from_env() -> str | None:
    """
    Decodifica cookies desde la variable de entorno YT_COOKIES_BASE64.
    Esto permite inyectar cookies como secreto en plataformas cloud
    sin necesidad de montar archivos.
    """
    b64 = os.getenv("YT_COOKIES_BASE64")
    if not b64:
        return None
    
    try:
        content = base64.b64decode(b64).decode('utf-8')
        cookie_lines = [l for l in content.splitlines() if l.strip() and not l.startswith('#')]
        
        if len(cookie_lines) == 0:
            log.error("COOKIES (base64): La variable contiene datos pero ninguna cookie válida")
            return None
        
        # Guardar como archivo temporal (yt-dlp necesita un path)
        out_path = os.path.join(Settings.TEMP_DIR, 'cookies_from_env.txt')
        # Siempre LF, nunca CRLF
        clean = content.replace('\r\n', '\n')
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(clean)
        
        log.info(f"COOKIES (base64): Decodificadas {len(cookie_lines)} cookies → {out_path}")
        return out_path
    except Exception as e:
        log.error(f"COOKIES (base64): Error decodificando — {e}")
        return None


def _download_content(url: str, as_video: bool):
    file_id = str(uuid.uuid4())
    output_template = os.path.join(Settings.TEMP_DIR, f"{file_id}.%(ext)s")

    log.info(f"Iniciando descarga yt-dlp: {url} (video={as_video})")

    cookie_path = None
    
    # Prioridad de resolución de cookies:
    # 1) Archivo apuntado por variable de entorno
    env_cookie_file = os.getenv("YT_COOKIES_FILE")
    if env_cookie_file:
        cookie_path = _sanitize_cookies_file(env_cookie_file)
    
    # 2) Render Secret File (montado automáticamente en /etc/secrets/)
    if not cookie_path:
        cookie_path = _sanitize_cookies_file("/etc/secrets/cookies.txt")

    # 3) Variable base64 (alternativa para plataformas sin secret files)
    if not cookie_path:
        cookie_path = _resolve_cookies_from_env()
    
    # 4) Rutas por defecto (Docker volume mount / local)
    if not cookie_path:
        for candidate in ["/app/cookies.txt", "cookies.txt"]:
            result = _sanitize_cookies_file(candidate)
            if result:
                cookie_path = result
                break
    
    if not cookie_path:
        log.warning("COOKIES: Ninguna fuente de cookies encontrada — YouTube probablemente bloqueará")

    opts = get_ytdlp_config(cookie_path, video=as_video)
    opts["outtmpl"] = output_template

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if not info:
                log.warning("yt-dlp devolvió info=None")
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
