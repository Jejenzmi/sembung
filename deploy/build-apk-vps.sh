#!/bin/bash
# Build APK rilis LANGSUNG di VPS — tidak butuh mesin lain.
# Jalankan dari server:  /root/sembung/deploy/build-apk-vps.sh [API_URL]
set -e

ROOT=/root/sembung
API_URL="${1:-https://sembung.gokar.id}"
FLUTTER_IMAGE=ghcr.io/cirruslabs/flutter:3.19.6

green() { printf "\033[0;32m%s\033[0m\n" "$1"; }

[ -f "$ROOT/mobile/android/key.properties" ] || {
  echo "✗ key.properties hilang — APK akan tertandatangani kunci debug. Batal."
  exit 1
}

mkdir -p "$ROOT/.pub-cache" "$ROOT/.gradle" "$ROOT/deploy/public"

green "→ membangun APK (API_URL=$API_URL)"
# Cache pub & gradle di-mount supaya build berikutnya cepat; tanpa ini
# `docker run --rm` membuang cache dan kompilasi Dart gagal menemukan paket.
docker run --rm \
  -v "$ROOT/mobile":/app \
  -v "$ROOT/.pub-cache":/root/.pub-cache \
  -v "$ROOT/.gradle":/root/.gradle \
  -w /app "$FLUTTER_IMAGE" \
  bash -lc "flutter pub get && flutter build apk --release --dart-define=API_URL=$API_URL"

green "→ memasang ke situs"
cp "$ROOT/mobile/build/app/outputs/flutter-apk/app-release.apk" \
   "$ROOT/deploy/public/SembungExplorer.apk"

green "✅ https://sembung.gokar.id/SembungExplorer.apk"
ls -lh "$ROOT/deploy/public/SembungExplorer.apk"
