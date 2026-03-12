import os
import random
from groq import Groq

def get_client():
    """
    Devuelve un cliente Groq usando rotación aleatoria entre las keys disponibles.
    Prioriza GROQ_KEYS_LIST (coma-separada); si no existe, usa GROQ_API_KEY.
    Filtra cualquier valor None o vacío antes de intentar.
    """
    keys = [
        k.strip() for k in
        os.getenv("GROQ_KEYS_LIST", "").split(",")
        if k.strip()
    ]

    # Fallback: key suelta, solo si no está ya en la lista
    single_key = os.getenv("GROQ_API_KEY", "").strip()
    if not keys and single_key:
        keys = [single_key]

    if not keys:
        raise Exception(
            "No se encontró ninguna API key de Groq. "
            "Define GROQ_KEYS_LIST o GROQ_API_KEY en el .env"
        )

    random.shuffle(keys)

    last_error = None
    for key in keys:
        try:
            return Groq(api_key=key)
        except Exception as e:
            last_error = e
            continue

    raise Exception(f"Todas las API keys de Groq fallaron. Último error: {last_error}")


def transcribe_audio(file_path: str, language: str = "es") -> str:
    """
    Transcribe el audio usando Whisper-large-v3-turbo a través de Groq.

    Args:
        file_path: Ruta al archivo de audio.
        language: Código de idioma BCP-47 (ej. 'es', 'en', 'fr').
                  None → detección automática de idioma por Whisper.
    """
    if not file_path or not os.path.exists(file_path):
        return "Error: Archivo de audio no encontrado."

    try:
        client = get_client()

        with open(file_path, "rb") as file:
            kwargs = {
                "file": (os.path.basename(file_path), file.read()),
                "model": "whisper-large-v3-turbo",
                "response_format": "text",
            }
            if language:
                kwargs["language"] = language

            transcription = client.audio.transcriptions.create(**kwargs)

        return transcription

    except Exception as e:
        return f"Error en transcripción: {str(e)}"
