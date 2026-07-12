import os
import subprocess
import uuid
import logging
from config import Settings
from services.storage_service import download_source_file

log = logging.getLogger(__name__)

def trim_video_ffmpeg(source_video_id: str, start_time_sec: float, end_time_sec: float) -> str:
    """
    Usa FFmpeg para recortar un segmento exacto del video original.
    Devuelve la ruta (nombre) del archivo final generado.
    Por seguridad, evita generar archivos gigantescos limitando la duración de recorte a max 60 segundos.
    """
    
    # 1. Seguridad extra contra ataques en la API
    duration = end_time_sec - start_time_sec
    if duration > 120: # Límite máximo generoso: 2 minutos por clip
        raise ValueError("El clip supera el tiempo máximo permitido para recortar por seguridad (120s).")
    
    if start_time_sec < 0 or end_time_sec <= start_time_sec:
        raise ValueError("Tiempos de recorte inválidos.")

    # 2. Encontrar el archivo original
    # Porque desconocemos la extensión exacta (.mp4, .webm, .mkv) del source
    video_extensions = ['mp4', 'webm', 'mkv', 'm4a', 'ts', 'mov']
    source_path = None
    for ext in video_extensions:
        test_path = os.path.join(Settings.TEMP_DIR, f"{source_video_id}.{ext}")
        if os.path.exists(test_path):
            source_path = test_path
            break

    # Fallback: si el contenedor se redesplegó y el disco local se vació,
    # intenta recuperar el original desde el respaldo en Supabase Storage.
    if not source_path:
        log.info(f"No está en disco local, probando recuperar de Storage: {source_video_id}")
        source_path = download_source_file(source_video_id, video_extensions)

    if not source_path:
        raise FileNotFoundError("No se encontró el archivo de vídeo original en el servidor para recortarlo.")

    # 3. Preparar archivo de salida
    clip_id = str(uuid.uuid4())
    output_filename = f"clip_{clip_id}.mp4"
    output_path = os.path.join(Settings.TEMP_DIR, output_filename)

    # 4. Construir comando FFmpeg
    # Para evitar el desajuste de audio/vídeo (desync) que ocurre al usar "-c copy",
    # necesitamos re-codificar el fragmento usando libx264.
    command = [
        "ffmpeg", 
        "-y", # Sobrescribir sin preguntar
        "-ss", str(start_time_sec), # Start time (antes de -i para fast seek)
        "-i", source_path, # Input
        "-t", str(duration), # Duration to cut (después de -i)
        "-c:v", "libx264", # Re-encode video
        "-preset", "superfast", # Codificación rápida
        "-c:a", "aac", # Re-encode audio
        output_path
    ]

    log.info(f"🎬 Ejecutando FFmpeg: {' '.join(command)}")

    try:
        # Ejecutamos comando
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        log.info(f"✅ Clip generado en: {output_path}")
        return output_filename
        
    except subprocess.CalledProcessError as e:
        log.error(f"❌ Error en FFmpeg: {e.stderr}")
        raise RuntimeError(f"Fallo al recortar vídeo: {e.stderr}")



def trim_audio_ffmpeg(source_video_id: str, start_time_sec: float, end_time_sec: float) -> str:
    """
    Recorta un segmento de audio del archivo original.
    Devuelve el nombre del archivo MP3 generado.
    """
    duration = end_time_sec - start_time_sec
    if duration > 120:
        raise ValueError("El clip supera el tiempo máximo permitido (120s).")
    if start_time_sec < 0 or end_time_sec <= start_time_sec:
        raise ValueError("Tiempos de recorte inválidos.")

    # Buscar el archivo original (audio subido por el usuario)
    audio_extensions = ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'opus', 'weba', 'mp4', 'webm', 'mkv']
    source_path = None
    for ext in audio_extensions:
        test_path = os.path.join(Settings.TEMP_DIR, f"{source_video_id}.{ext}")
        if os.path.exists(test_path):
            source_path = test_path
            break

    if not source_path:
        log.info(f"No está en disco local, probando recuperar de Storage: {source_video_id}")
        source_path = download_source_file(source_video_id, audio_extensions)

    if not source_path:
        raise FileNotFoundError("No se encontró el archivo original en el servidor.")

    clip_id = str(uuid.uuid4())
    output_filename = f"audioclip_{clip_id}.mp3"
    output_path = os.path.join(Settings.TEMP_DIR, output_filename)

    command = [
        "ffmpeg",
        "-y",
        "-ss", str(start_time_sec),
        "-t", str(duration),
        "-i", source_path,
        "-vn",                      # sin vídeo
        "-ar", "44100",             # sample rate estándar
        "-ac", "2",                 # estéreo
        "-b:a", "192k",             # bitrate decente
        output_path
    ]

    log.info(f"🎵 Recortando audio: {' '.join(command)}")

    try:
        subprocess.run(command, capture_output=True, text=True, check=True)
        log.info(f"✅ Audio clip generado: {output_path}")
        return output_filename
    except subprocess.CalledProcessError as e:
        log.error(f"❌ Error FFmpeg (audio): {e.stderr}")
        raise RuntimeError(f"Fallo al recortar audio: {e.stderr}")