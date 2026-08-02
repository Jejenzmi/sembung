# Debian, bukan Alpine: Prisma butuh OpenSSL yang lengkap.
FROM node:20-bookworm-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

COPY deploy/start-backend.sh ./start-backend.sh
RUN chmod +x ./start-backend.sh

EXPOSE 5022
CMD ["./start-backend.sh"]
