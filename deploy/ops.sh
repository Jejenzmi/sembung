#!/bin/bash
# Operasi harian Sembung Explorer dari VPS.
#   ./ops.sh deploy    bangun ulang & jalankan (setelah mengubah kode)
#   ./ops.sh status    kondisi kontainer + kesehatan situs
#   ./ops.sh logs [svc] ikuti log (backend/web/postgres/backup)
#   ./ops.sh restart   nyalakan ulang tanpa build
#   ./ops.sh backup    dump database sekarang juga
#   ./ops.sh apk [url] bangun ulang APK
#   ./ops.sh shell     psql ke database
#   ./ops.sh test      jalankan uji otomatis (database uji terpisah)
set -e

ROOT=/root/sembung
DEPLOY=$ROOT/deploy
cd "$DEPLOY"

# shellcheck disable=SC1091
set -a; . "$DEPLOY/.env"; set +a

case "${1:-status}" in
  deploy)
    docker compose up -d --build
    docker compose ps
    ;;
  status)
    docker compose ps --format 'table {{.Service}}\t{{.Status}}'
    echo
    echo -n "situs  : "; curl -s -o /dev/null -w 'HTTP %{http_code}\n' https://sembung.gokar.id/
    echo -n "API    : "; curl -s https://sembung.gokar.id/health; echo
    echo -n "backup : "; ls -1t "$DEPLOY/backups"/*.sql.gz 2>/dev/null | head -1 || echo 'belum ada'
    ;;
  logs)
    docker compose logs -f "${2:-backend}"
    ;;
  restart)
    docker compose restart
    ;;
  backup)
    STAMP=$(date +%Y%m%d_%H%M)
    docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      | gzip > "$DEPLOY/backups/sembung_manual_$STAMP.sql.gz"
    ls -lh "$DEPLOY/backups/sembung_manual_$STAMP.sql.gz"
    ;;
  apk)
    "$DEPLOY/build-apk-vps.sh" "${2:-https://sembung.gokar.id}"
    ;;
  test)
    "$DEPLOY/run-tests.sh" "${@:2}"
    ;;
  shell)
    docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
    ;;
  *)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
