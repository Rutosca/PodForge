# services/storage_service.py
"""
Persistencia de archivos fuente (vídeo / audio) en Supabase Storage.

El bucket 'source-media' es **privado** (no público).  Como usamos
la clave de servicio (service role), se salta RLS automáticamente.

Flujo:
  1. Tras un análisis exitoso → upload_source_file() sube el original.
  2. Al recortar un clip, si el archivo ya no está en disco local
     → download_source_file() lo recupera de Storage.
"""

import os
import logging
from supabase import create_client, Client  # type: ignore
from config import Settings

log = logging.getLogger(__name__)

BUCKET = "source-media"

_supabase: Client = create_client(
    Settings.SUPABASE_URL, Settings.SUPABASE_SERVICE_KEY
)


def upload_source_file(local_path: str, source_video_id: str) -> None:
    """
    Sube el archivo fuente al bucket de Storage.
    La clave en el bucket es  <source_video_id>.<ext>  (p.ej. abc123.mp4).
    Si ya existe un archivo con ese nombre, lo sobreescribe sin error.
    """
    if not os.path.isfile(local_path):
        log.warning(f"upload_source_file: el archivo no existe → {local_path}")
        return

    ext = os.path.splitext(local_path)[1]          # ".mp4", ".m4a", etc.
    remote_name = f"{source_video_id}{ext}"

    try:
        with open(local_path, "rb") as f:
            _supabase.storage.from_(BUCKET).upload(
                path=remote_name,
                file=f,
                file_options={"upsert": "true"},    # sobreescribir si existe
            )
        log.info(f"✅ Archivo subido a Storage: {BUCKET}/{remote_name}")
    except Exception as e:
        # No es fatal: si falla el respaldo, el análisis ya está hecho.
        log.error(f"⚠️ Fallo al subir a Storage: {e}")


def download_source_file(
    source_video_id: str,
    extensions: list[str],
) -> str | None:
    """
    Intenta descargar el archivo fuente de Storage probando cada extensión.
    Devuelve la ruta local si lo encuentra, o None si no existe en el bucket.
    """
    for ext in extensions:
        remote_name = f"{source_video_id}.{ext}"
        local_path = os.path.join(Settings.TEMP_DIR, remote_name)

        try:
            data = _supabase.storage.from_(BUCKET).download(remote_name)
            with open(local_path, "wb") as f:
                f.write(data)
            log.info(f"✅ Recuperado de Storage: {BUCKET}/{remote_name} → {local_path}")
            return local_path
        except Exception:
            # La extensión no existe en el bucket → probar la siguiente
            continue

    log.warning(f"No se encontró {source_video_id} en Storage con ninguna extensión.")
    return None


CLIPS_BUCKET = "clip-previews"


def upload_clip_file(local_path: str) -> str | None:
    """
    Sube un clip ya recortado (pequeño, cabe en el límite de 50MB) a su propio
    bucket de Storage. A diferencia de upload_source_file, aquí la clave remota
    es directamente el nombre de archivo del clip (ya es único: incluye su
    propio uuid, p.ej. clip_<uuid>.mp4 / audioclip_<uuid>.mp3).
    Devuelve el nombre remoto si tiene éxito, o None si falla.
    """
    if not os.path.isfile(local_path):
        log.warning(f"upload_clip_file: el archivo no existe → {local_path}")
        return None

    remote_name = os.path.basename(local_path)

    try:
        with open(local_path, "rb") as f:
            _supabase.storage.from_(CLIPS_BUCKET).upload(
                path=remote_name,
                file=f,
                file_options={"upsert": "true"},
            )
        log.info(f"✅ Clip subido a Storage: {CLIPS_BUCKET}/{remote_name}")
        return remote_name
    except Exception as e:
        # No es fatal: el clip ya se generó en disco, esto es solo respaldo.
        log.error(f"⚠️ Fallo al subir clip a Storage: {e}")
        return None


def download_clip_file(clip_filename: str) -> str | None:
    """
    Descarga un clip ya recortado desde Storage a TEMP_DIR.
    Se usa como fallback en /media/<filename> cuando el archivo ya
    no está en disco local (p.ej. tras un redeploy).
    Devuelve la ruta local si lo encuentra, o None si no existe en el bucket.
    """
    local_path = os.path.join(Settings.TEMP_DIR, clip_filename)

    try:
        data = _supabase.storage.from_(CLIPS_BUCKET).download(clip_filename)
        with open(local_path, "wb") as f:
            f.write(data)
        log.info(f"✅ Clip recuperado de Storage: {CLIPS_BUCKET}/{clip_filename} → {local_path}")
        return local_path
    except Exception as e:
        log.warning(f"No se encontró el clip {clip_filename} en Storage: {e}")
        return None
