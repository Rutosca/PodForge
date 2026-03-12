FROM node:20-alpine

WORKDIR /app

# Copiar package files primero para cachear deps
COPY package.json package-lock.json* ./
RUN npm install

# Copiar el resto del código
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Exponer puerto 3000
EXPOSE 3000

# Dev server (hot reload)
CMD ["npm", "run", "dev"]
