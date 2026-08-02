#!/bin/bash
# Menjalankan uji otomatis backend di kontainer sekali pakai, terhubung ke
# database UJI terpisah — bukan database produksi.
set -e

ROOT=/root/sembung
cd "$ROOT/deploy"
set -a; . ./.env; set +a

NET=$(docker inspect sembung-backend-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
TEST_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/sembung_test?schema=public"

echo "→ menyiapkan database uji"
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
  -c "SELECT 1 FROM pg_database WHERE datname='sembung_test'" | grep -q 1 || \
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE sembung_test;"

echo "→ menjalankan uji"
docker run --rm \
  --network "$NET" \
  -v "$ROOT/backend":/app \
  -w /app \
  -e DATABASE_URL="$TEST_URL" \
  -e NODE_ENV=test \
  -e CI=true \
  node:20-bookworm-slim \
  bash -lc "apt-get update -qq >/dev/null && apt-get install -y -qq openssl >/dev/null && npx prisma generate >/dev/null && npx prisma db push --skip-generate --accept-data-loss >/dev/null && npm test -- ${*}"
