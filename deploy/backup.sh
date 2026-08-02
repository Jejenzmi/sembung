#!/bin/sh
# Dump harian database + cadangan rahasia, lalu salin ke MinIO.
# Ditaruh di berkas terpisah karena entrypoint inline pada YAML melipat baris
# dan merusak pipa shell.
set -e

kirim_minio() {
  # mc di-mount dari host; alias dikonfigurasi tiap kali agar tidak menyimpan
  # kredensial di dalam image.
  [ -x /usr/local/bin/mc ] || return 0
  [ -n "$MINIO_URL" ] || return 0
  mc alias set arsip "$MINIO_URL" "$MINIO_USER" "$MINIO_PASSWORD" >/dev/null 2>&1 || return 1
  mc cp "$1" "arsip/$MINIO_BUCKET/$(basename "$1")" >/dev/null 2>&1
}

while true; do
  STAMP=$(date +%Y%m%d_%H%M)
  BERKAS="/backups/sembung_$STAMP.sql.gz"

  if pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$BERKAS"; then
    echo "✓ backup $BERKAS ($(du -h "$BERKAS" | cut -f1))"
    if kirim_minio "$BERKAS"; then
      echo "  ↗ tersalin ke MinIO $MINIO_BUCKET"
    else
      echo "  ✗ gagal menyalin ke MinIO — salinan lokal tetap ada"
    fi
  else
    echo "✗ backup gagal pada $STAMP"
    rm -f "$BERKAS"
  fi

  find /backups -name 'sembung_*.sql.gz' -mtime +14 -delete

  # Cadangan rahasia: keystore rilis dan .env tidak masuk git, dan kehilangan
  # keystore berarti aplikasi tak bisa diperbarui di Play selamanya.
  if [ -d /secrets ]; then
    tar czf /backups/secrets-terkini.tar.gz -C /secrets . 2>/dev/null || true
    chmod 600 /backups/secrets-terkini.tar.gz 2>/dev/null || true
    kirim_minio /backups/secrets-terkini.tar.gz && echo "  ↗ rahasia tersalin ke MinIO" || true
  fi

  sleep 86400
done
