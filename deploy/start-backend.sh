#!/bin/sh
# Menyamakan skema lalu mengisi data awal hanya bila database masih kosong.
# Compose sudah menjamin PostgreSQL sehat lewat depends_on, tetapi push tetap
# diulang beberapa kali agar aman terhadap jeda kesiapan.
set -e

# Catatan: sengaja BUKAN --accept-data-loss. Bila Prisma menolak karena suatu
# perubahan berisiko (mis. menambah unique constraint pada kolom yang mungkin
# punya nilai ganda), biarkan gagal dan tangani manual lewat SQL setelah
# memeriksa datanya — jangan biarkan perubahan destruktif lolos diam-diam.
echo "→ sinkronisasi skema"
i=1
until npx prisma db push --skip-generate; do
  i=$((i + 1))
  if [ "$i" -gt 10 ]; then
    echo "✗ gagal menyambung ke database setelah 10 percobaan"
    exit 1
  fi
  echo "  percobaan ke-$i…"
  sleep 3
done

# Data operasional yang sudah berjalan tidak boleh tertimpa.
NEED_SEED=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count()
  .then((n) => { console.log(n === 0 ? 'yes' : 'no'); return p.\$disconnect(); })
  .catch(() => { console.log('yes'); });
")

if [ "$NEED_SEED" = "yes" ]; then
  echo "→ database kosong, mengisi data awal"
  npx tsx prisma/seed.ts
else
  echo "→ database sudah berisi, seed dilewati"
fi

echo "→ menjalankan API"
exec node dist/index.js
