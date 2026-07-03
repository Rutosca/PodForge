import subprocess
import os
import uuid
from config import Settings

def compress_audio(path: str):
    output = os.path.join(
        Settings.TEMP_DIR,
        f"{uuid.uuid4()}_lite.mp3"
    )

    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", path,
                "-vn", "-ar", "16000",
                "-ac", "1", "-b:a", "32k",
                output
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=120  # 🔥 evita bloqueos
        )
        return output
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Audio compression failed, using original: {e}")
        return path
