@echo off
echo Iniciando PodForge...

:: Secuencia Docker: Apaga el antiguo, reconstruye la imagen y levanta el nuevo
start "PodForge Backend" cmd /c "docker compose down && docker compose build --no-cache && docker compose up -d"

:: Espera 3 segundos para darle tiempo a Flask a respirar
timeout /t 30 /nobreak > NUL

:: Levanta el frontend en otra ventana
start "PodForge Frontend" cmd /k "cd podforge-frontend && npm run dev"

echo Entorno desplegado. Cierra esta ventana.
exit