#!/bin/bash
# Sembung Explorer — one-command local development.
#   ./start-dev.sh          start backend + web admin
#   ./start-dev.sh --seed   reset the database with demo data first
#   ./start-dev.sh --mobile also print the Flutter run command
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
DB_NAME="sembung_db"
BACKEND_PORT=5022
WEB_PORT=5186

SEED=0
MOBILE=0
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=1 ;;
    --mobile) MOBILE=1 ;;
  esac
done

green() { printf "\033[0;32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[0;33m%s\033[0m\n" "$1"; }

green "🏔️  Sembung Explorer — menyiapkan lingkungan pengembangan"

# ---------------------------------------------------------------- PostgreSQL
if ! pg_isready -q 2>/dev/null; then
  yellow "PostgreSQL belum berjalan, mencoba menyalakan lewat Homebrew…"
  brew services start postgresql@16 >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do pg_isready -q 2>/dev/null && break; sleep 1; done
fi
pg_isready -q || { echo "❌ PostgreSQL tidak dapat dijangkau"; exit 1; }

if ! psql -U postgres -h localhost -lqt | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
  green "→ membuat database $DB_NAME"
  createdb -U postgres -h localhost "$DB_NAME"
fi

# ------------------------------------------------------------------- backend
cd "$ROOT/backend"
[ -d node_modules ] || { green "→ npm install (backend)"; npm install; }
green "→ sinkronisasi skema Prisma"
npx prisma db push --skip-generate >/dev/null
npx prisma generate >/dev/null

if [ "$SEED" = "1" ]; then
  green "→ mengisi data demo"
  npm run seed
fi

green "→ menjalankan API pada :$BACKEND_PORT"
npm run dev >"$ROOT/.backend.log" 2>&1 &
BACKEND_PID=$!

for _ in $(seq 1 40); do
  curl -sf "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1 && break
  sleep 1
done

# ----------------------------------------------------------------- back office
cd "$ROOT/web"
[ -d node_modules ] || { green "→ npm install (web)"; npm install; }
green "→ menjalankan back office pada :$WEB_PORT"
npm run dev >"$ROOT/.web.log" 2>&1 &
WEB_PID=$!

sleep 3
cat <<INFO

$(green "✅ Sembung Explorer siap")

   API            http://localhost:$BACKEND_PORT/health
   Back office    http://localhost:$WEB_PORT
   Database       postgresql://postgres@localhost:5432/$DB_NAME

   Akun:
     admin    / admin123      → Administrator (semua modul)
     petugas  / petugas123    → Petugas pos gerbang (scanner)
     ranger   / ranger123     → Jagawana / tim SAR
     demo@sembung.id / demo123 → Pendaki (aplikasi mobile)

   Log: .backend.log · .web.log
INFO

if [ "$MOBILE" = "1" ]; then
  cat <<'MOBILE'

   📱 Mobile (Flutter + Bloc):
      cd mobile && flutter run
      Emulator Android otomatis memakai http://10.0.2.2:5022
      Perangkat fisik:  flutter run --dart-define=API_URL=http://<IP-LAN>:5022
MOBILE
fi

trap 'kill $BACKEND_PID $WEB_PID 2>/dev/null; exit 0' INT TERM
wait
