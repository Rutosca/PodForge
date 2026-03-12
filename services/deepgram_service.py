# services/deepgram_service.py
import os
import httpx
import logging

log = logging.getLogger(__name__)


def transcribe_audio_deepgram(audio_path: str, language: str | None = "es") -> str:
    """
    Transcribe audio usando la API REST de Deepgram (Nova-2) vía httpx.
    Inyecta marcas de tiempo [MM:SS] al inicio de cada utterance.

    Args:
        audio_path: Ruta al archivo de audio local.
        language:   Código BCP-47 (ej. 'es', 'en', 'fr', 'pt').
                    Pasa None para que Deepgram detecte el idioma automáticamente.
    """
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        return "Error: Falta la DEEPGRAM_API_KEY en el entorno."

    if not os.path.exists(audio_path):
        return f"Error: No se encontró el archivo de audio: {audio_path}"

    # Construimos los query params — language es opcional
    params = {
        "model": "nova-2",
        "smart_format": "true",
        "utterances": "true",
    }
    if language:
        params["language"] = language
    # Si language es None → Deepgram activa detección automática del idioma

    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "audio/mp3",
    }

    try:
        log.info(f"🎙️ Transcribiendo con Deepgram Nova-2 (idioma: {language or 'auto'})...")

        with open(audio_path, "rb") as audio_file:
            response = httpx.post(
                "https://api.deepgram.com/v1/listen",
                headers=headers,
                params=params,
                content=audio_file,
                timeout=600.0,
            )

        if response.status_code == 200:
            data = response.json()
            utterances = data.get("results", {}).get("utterances", [])

            if not utterances:
                log.warning("No se detectaron utterances, cayendo en texto plano.")
                return data["results"]["channels"][0]["alternatives"][0]["transcript"]

            # Construimos el texto con balizas de tiempo [MM:SS]
            lines = []
            for u in utterances:
                start_seconds = int(u["start"])
                minutes, seconds = divmod(start_seconds, 60)
                timestamp_str = f"[{minutes:02d}:{seconds:02d}]"
                lines.append(f"{timestamp_str} {u['transcript']}")

            log.info("✅ Transcripción con timestamps completada.")
            return "\n".join(lines)

        else:
            error_msg = f"Deepgram devolvió status {response.status_code}: {response.text}"
            log.error(error_msg)
            return f"Error: {error_msg}"

    except Exception as e:
        log.error(f"Fallo de conexión con Deepgram: {e}")
        return f"Error: Fallo de conexión - {str(e)}"