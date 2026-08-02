#!/bin/sh
# Dump harian database, simpan 14 hari terakhir.
# Ditaruh di berkas terpisah karena entrypoint inline pada YAML melipat baris
# dan merusak pipa shell.
set -e

while true; do
  STAMP=$(date +%Y%m%d_%H%M)
  if pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "/backups/sembung_$STAMP.sql.gz"; then
    echo "✓ backup /backups/sembung_$STAMP.sql.gz ($(du -h "/backups/sembung_$STAMP.sql.gz" | cut -f1))"
  else
    echo "✗ backup gagal pada $STAMP"
    rm -f "/backups/sembung_$STAMP.sql.gz"
  fi
  find /backups -name 'sembung_*.sql.gz' -mtime +14 -delete

  # Cadangan rahasia: keystore rilis dan .env tidak masuk git, dan kehilangan
  # keystore berarti aplikasi tak bisa diperbarui di Play selamanya.
  if [ -d /secrets ]; then
    tar czf /backups/secrets-terkini.tar.gz -C /secrets . 2>/dev/null || true
    chmod 600 /backups/secrets-terkini.tar.gz 2>/dev/null || true
  fi

  sleep 86400
done
