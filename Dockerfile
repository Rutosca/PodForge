FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y ffmpeg curl libnss3 libcurl4-openssl-dev && \
    apt-get clean



COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Forzar la última versión de yt-dlp (la de PyPI suele ir detrás en parches de YouTube)
RUN pip install --no-cache-dir --upgrade yt-dlp

COPY . .

ENV PYTHONUNBUFFERED=1

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "app:app"]

