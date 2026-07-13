#!/bin/bash
set -e

echo "Starting RQ Worker in background..."
# Usamos rq worker estándar apuntando a la cola 'default' (la que usa tu app por defecto)
rq worker default --url "${REDIS_URL:-redis://localhost:6379/0}" &

echo "Starting Gunicorn in foreground..."
# Ejecutamos Gunicorn tal como estaba
exec gunicorn -w 1 -b 0.0.0.0:8000 app:app
