# utils/cleanup.py

import os
import time
import logging
from config import Settings

log = logging.getLogger(__name__)

def safe_remove(path: str):
    """
    Elimina un archivo solo si está dentro del TEMP_DIR.
    Previene borrar cosas fuera por error.
    """
    if not path:
        return

    try:
        abs_path = os.path.abspath(path)
        temp_dir = os.path.abspath(Settings.TEMP_DIR)

        if not abs_path.startswith(temp_dir):
            log.warning(f"Intento de borrar fuera de TEMP_DIR: {abs_path}")
            return

        if os.path.exists(abs_path):
            os.remove(abs_path)
            log.info(f"🗑️ Archivo eliminado: {os.path.basename(abs_path)}")

    except Exception as e:
        log.warning(f"No se pudo eliminar {path}: {e}")


def cleanup_files(*paths):
    """
    Limpia múltiples archivos de forma segura.
    """
    for path in paths:
        safe_remove(path)


def cleanup_old_temp_files(max_age_minutes=60):
    """
    Elimina archivos antiguos del directorio temporal.
    Ideal para cron job cada X horas.
    """
    now = time.time()
    max_age_seconds = max_age_minutes * 60

    for filename in os.listdir(Settings.TEMP_DIR):
        file_path = os.path.join(Settings.TEMP_DIR, filename)

        try:
            if not os.path.isfile(file_path):
                continue

            file_age = now - os.path.getmtime(file_path)

            if file_age > max_age_seconds:
                safe_remove(file_path)

        except Exception as e:
            log.warning(f"No se pudo revisar {file_path}: {e}")
