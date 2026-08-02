#!/bin/bash
# Build APK rilis di VPS lewat Docker Flutter.
#
# SDK Flutter lokal berada di ~/Documents/flutter yang ter-sync iCloud (file-nya
# placeholder), sehingga Gradle macet berjam-jam saat mengevaluasi settings.gradle.
# Build di VPS memotong masalah itu sekaligus tidak memakan disk Mac.
#
#   ./build-apk.sh                          → API produksi https://sembung.gokar.id
#   ./build-apk.sh http://192.168.1.4:5022  → API kustom (mis. backend lokal via LAN)
set -e

API_URL="${1:-https://sembung.gokar.id}"
VPS=root@76.13.197.249
KEY="$HOME/.ssh/gokar_prod"
REMOTE=/root/sembung
FLUTTER_IMAGE=ghcr.io/cirruslabs/flutter:3.19.6
ROOT="$(cd "$(dirname "$0")" && pwd)"

green() { printf "\033[0;32m%s\033[0m\n" "$1"; }

green "→ mengirim sumber mobile ke VPS"
ssh -i "$KEY" "$VPS" "mkdir -p $REMOTE/.pub-cache $REMOTE/.gradle"
# key.properties + .jks ikut dikirim agar APK ditandatangani kunci rilis, tapi
# tetap di luar repositori (lihat .gitignore).
rsync -az --delete \
  --exclude 'build/' --exclude '.dart_tool/' --exclude 'ios/Pods/' \
  --exclude '.flutter-plugins*' --exclude 'android/local.properties' \
  --exclude 'android/.gradle/' \
  -e "ssh -i $KEY -o StrictHostKeyChecking=no" \
  "$ROOT/mobile/" "$VPS:$REMOTE/mobile/"

green "→ build APK (API_URL=$API_URL)"
# pub-cache dan gradle di-mount agar tidak diunduh ulang tiap build; tanpa ini
# container --rm kehilangan seluruh cache dan kompilasi Dart gagal.
ssh -i "$KEY" "$VPS" "docker run --rm \
  -v $REMOTE/mobile:/app \
  -v $REMOTE/.pub-cache:/root/.pub-cache \
  -v $REMOTE/.gradle:/root/.gradle \
  -w /app $FLUTTER_IMAGE \
  bash -lc 'flutter pub get && flutter build apk --release --dart-define=API_URL=$API_URL'"

green "→ mengunduh APK"
mkdir -p "$ROOT/dist"
scp -i "$KEY" "$VPS:$REMOTE/mobile/build/app/outputs/flutter-apk/app-release.apk" \
  "$ROOT/dist/SembungExplorer.apk"

green "→ memasang APK ke situs produksi"
ssh -i "$KEY" "$VPS" "mkdir -p $REMOTE/deploy/public"
scp -i "$KEY" "$ROOT/dist/SembungExplorer.apk" "$VPS:$REMOTE/deploy/public/SembungExplorer.apk"

green "✅ $ROOT/dist/SembungExplorer.apk"
green "   Unduhan publik: https://sembung.gokar.id/SembungExplorer.apk"
ls -lh "$ROOT/dist/SembungExplorer.apk"
