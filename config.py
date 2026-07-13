import os
import tempfile
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # --- 1. DIRECTORIOS (Lógica del Volumen Compartido) ---
    # Si existe la carpeta /app/data (Docker), la usamos. Si no, temporal del sistema.
    if os.path.exists('/app/data'):
        TEMP_DIR = '/app/data'
    else:
        # Fallback para cuando lo ejecutas en local sin Docker
        TEMP_DIR = os.path.join(tempfile.gettempdir(), 'ai_content_factory')
        os.makedirs(TEMP_DIR, exist_ok=True)

    # --- 2. ENTORNO (Lo que te faltaba) ---
    # Lee la variable ENV del archivo .env (default: development)
    ENV = os.getenv("ENV", "development")

    # --- 3. RED Y YOUTUBE ---
    FORCE_IPV4 = os.getenv("FORCE_IPV4", "false").lower() == "true"
    YTDLP_MODE = os.getenv("YTDLP_MODE", "safe")
    
    # --- 4. LIMITES Y FLASK ---
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500 MB de subida
    # Recuperamos estos límites que también usabas en tasks.py
    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", 500))
    MAX_DOWNLOAD_MB = int(os.getenv("MAX_DOWNLOAD_MB", 300))
    
    PORT = int(os.getenv("PORT", 5000))
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY= os.getenv("SUPABASE_SERVICE_KEY")
    # --- MÉTODOS DE AYUDA ---
    @staticmethod
    def get_temp_path(filename: str) -> str:
        """Genera una ruta absoluta dentro del directorio temporal configurado"""
        return os.path.join(Settings.TEMP_DIR, filename)