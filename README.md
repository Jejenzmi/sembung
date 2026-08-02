# 🏔️ Sembung Explorer

Platform digital pendaki & wisatawan **Gunung Sembung, Purwakarta** — dari pemesanan
E-Pass sampai penanganan sinyal darurat di jalur.

> **LIVE — https://sembung.gokar.id**
> Back office di `/`, API di `/api`, APK pendaki di `dist/SembungExplorer.apk`.

## Produksi

| | |
|---|---|
| Domain | `https://sembung.gokar.id` (TLS Let's Encrypt, perpanjangan otomatis) |
| Server | VPS `76.13.197.249`, kunci `~/.ssh/gokar_prod` |
| Lokasi | `/root/sembung`, compose project **`sembung`** |
| Kontainer | `postgres` · `backend` · `web` (→ `127.0.0.1:8106`) · `backup` |
| Backup | Dump harian ke `deploy/backups/`, disimpan 14 hari |

```bash
# perbarui produksi
rsync -az --exclude node_modules --exclude dist --exclude build \
  -e "ssh -i ~/.ssh/gokar_prod" backend web deploy \
  root@76.13.197.249:/root/sembung/
ssh -i ~/.ssh/gokar_prod root@76.13.197.249 \
  'cd /root/sembung/deploy && docker compose up -d --build'
```

Rahasia produksi (JWT, sandi DB, webhook secret) ada di `deploy/.env` **di server saja** —
berkas itu di-`.gitignore` dan tidak pernah ikut repositori. Seed hanya berjalan bila
database masih kosong, jadi data operasional tidak akan tertimpa saat deploy ulang.

> ⚠️ **Mode pembayaran saat ini `simulation`** agar alur pemesanan bisa dicoba tanpa
> gateway. Selama mode ini aktif, pemesan bisa menandai pesanannya sendiri lunas.
> **Ubah `PAYMENT_MODE=live` di `deploy/.env` sebelum uang sungguhan mengalir**, lalu
> daftarkan `https://sembung.gokar.id/api/bookings/payments/webhook` di Midtrans/Xendit
> dengan `PAYMENT_WEBHOOK_SECRET` yang sama.

| Komponen | Teknologi | Port |
|---|---|---|
| Backend API | Node.js + TypeScript, Express, Prisma, Socket.IO | `5022` |
| Database | PostgreSQL (`sembung_db`) | `5432` |
| Back office | React 19 + Vite + TypeScript, Tailwind, Recharts, Leaflet | `5186` |
| Mobile | Flutter + **Bloc**, flutter_map, geolocator, qr_flutter | — |

```bash
./start-dev.sh --seed --mobile     # backend + back office + data demo
cd mobile && flutter run           # aplikasi pendaki
```

## Akun

| Akun | Kata sandi | Peran |
|---|---|---|
| `admin` | `admin123` | Administrator — semua modul |
| `petugas` | `petugas123` | Petugas pos gerbang — scanner E-Pass |
| `ranger` | `ranger123` | Jagawana / tim SAR |
| `demo@sembung.id` | `demo123` | Pendaki (aplikasi mobile) |
| `dewi@sembung.id` | `demo123` | Pendaki kedua |

---

## Modul

### 📱 Aplikasi Pendaki (Flutter + Bloc)

* **Smart Ticketing & E-Permit** — pilih jalur, tanggal, anggota rombongan, tiket
  masuk/berkemah/parkir/asuransi, sewa alat, dan pemandu; harga dihitung server
  secara *live* (`/bookings/quote`) sebelum pesanan dibuat.
* **Pembayaran** — QRIS (payload + QR), Virtual Account BCA/BNI, e-wallet.
* **E-Pass QR** — terbit otomatis setelah lunas, tampil sebagai boarding pass.
* **Peta Jalur & Offline** — jalur, pos, sumber air, camping ground, spot foto,
  dan titik bahaya disimpan di perangkat (`OfflineBundle`), tetap terbaca tanpa sinyal.
* **Tombol SOS** — tekan-tahan, kirim koordinat + ketinggian + data rombongan ke
  pos pemantau; ada tombol bagikan lokasi dan telepon SAR. **Tahan hilang sinyal:**
  SOS dan ping lokasi yang gagal terkirim disimpan di antrean dan dikirim ulang
  otomatis begitu jaringan kembali — aplikasi menyatakan terus terang bahwa
  permintaan masih mengantre, bukan seolah-olah sudah sampai.
* **Berbagi lokasi otomatis** — sakelar di layar SOS mengirim posisi tiap 5 menit
  selama aplikasi terbuka, sehingga pos pemantau punya jejak terakhir.
* **E-Pass tetap terbaca offline** — salinan terakhir disimpan di perangkat, karena
  justru di pos gerbang sinyal sering lemah.
* **Perjalanan** — booking aktif & riwayat, pembatalan, ulasan setelah selesai.
* **Informasi** — sejarah lokal Sanggabuana, tata tertib, cuaca, agenda event.

Bloc yang dipakai: `AuthBloc`, `HomeBloc`, `BookingBloc`, `TripsBloc`, `SosBloc`, `MapBloc`.
Setiap bloc memakai event/state ber-`Equatable` dan repository terpisah
(`AuthRepository`, `CatalogRepository`, `BookingRepository`, `SosRepository`).

### 🖥️ Back Office (React)

* **Dashboard** — pendaki di gunung *real-time*, SOS aktif, pendapatan harian &
  bulanan, tren 14 hari, komposisi pendapatan, okupansi per jalur.
* **Scanner Pos Gerbang** — pindai token QR, lihat rombongan + kontak darurat,
  catat check-in / check-out dengan jumlah orang aktual (selisih ditandai).
* **Pendaki di Gunung** — daftar rombongan aktif, jejak lokasi di peta topografi,
  penanda rombongan yang melewati jadwal turun.
* **Pusat Darurat SOS** — antrean sinyal darurat, peta titik + jejak terakhir,
  alur status Tanggapi → Evakuasi → Selesai / Alarm Palsu.
* **Booking & Tiket**, **Jalur & Titik Peta**, **Katalog** (tiket/sewa/guide/gerbang),
  **Konten**, **Pengguna**.
* **Pengaturan & Notifikasi** — ubah biaya layanan, batas waktu pembayaran, toleransi
  telat turun, nomor SAR; plus jejak seluruh notifikasi keluar beserta statusnya.
* **Laporan & Ekspor** — retribusi harian, penerimaan per jenis, kunjungan per jalur,
  rekap pos gerbang (termasuk sampah turun), dan buku booking. Semua bisa diunduh CSV.
* **Pengembalian Dana** — alur pengajuan → setujui/tolak → tandai dibayarkan.

Scanner pos gerbang mendukung **kamera browser** lewat `BarcodeDetector` bawaan
(Chrome/Edge). Bila browser tidak mendukung, komponennya menyatakan itu terang-terangan
dan petugas tetap memakai kolom manual atau pemindai genggam.

Notifikasi *real-time* via Socket.IO: `sos:new`, `sos:updated`, `gate:check-in`,
`gate:check-out`, `capacity:changed`, `booking:paid`.

---

## Keamanan pembayaran

Pelunasan **tidak bisa** dipicu sembarang pihak:

* `POST /api/bookings/payments/webhook` — jalur resmi dari payment gateway. Wajib
  header `X-Signature: sha256=<hmac>` atas *raw body* memakai `PAYMENT_WEBHOOK_SECRET`,
  diverifikasi `timingSafeEqual`. Tanpa signature yang cocok → `401`.
* `POST /api/bookings/:id/simulate-payment` — hanya untuk demo/pembayaran di loket.
  Butuh login, hanya pemilik booking atau petugas, dan mati total bila
  `PAYMENT_MODE=live`.

```bash
PAYMENT_MODE=live                      # matikan jalur simulasi di produksi
PAYMENT_WEBHOOK_SECRET=<dari Midtrans/Xendit>
```

## Tugas terjadwal

Scheduler in-process berjalan tiap menit (`src/services/scheduler.ts`):

* **Kedaluwarsa booking** — `PENDING_PAYMENT` yang melewati `expiresAt`
  (`BOOKING_HOLD_MINUTES`, bawaan 120) diubah jadi `EXPIRED`, stok sewa dikembalikan,
  dan kuota dilepas. Tanpa ini satu checkout terbengkalai mengunci slot selamanya.
* **Rombongan belum turun** — masih `CHECKED_IN` lebih dari `OVERDUE_GRACE_HOURS`
  setelah jadwal turun → peringatan ke seluruh petugas + kontak darurat, sekali saja
  per rombongan.

Admin bisa memicu manual lewat tombol **Jalankan Sapuan** atau
`POST /api/settings/run-sweep`.

## Notifikasi keluar

`src/services/notify.ts` menyebarkan SOS dan peringatan telat turun ke seluruh
ADMIN/RANGER/OFFICER aktif plus kontak darurat pendaki. Kanal:

| Kanal | Aktif bila | Bila belum diset |
|---|---|---|
| WhatsApp (Fonnte) | `FONNTE_TOKEN` | tercatat `SKIPPED` dengan alasannya |
| Webhook | `SOS_WEBHOOK_URL` | dilewati |
| Socket.IO | selalu | `notification:new` ke back office |

Setiap percobaan tersimpan di tabel `Notification` dan tampil di halaman
**Pengaturan & Notifikasi** serta di detail SOS — jadi pengelola selalu tahu apakah
peringatan benar-benar sampai.

## Laporan & pertanggungjawaban

| Endpoint | Isi |
|---|---|
| `/api/reports/revenue-daily` | Penerimaan kas per tanggal & metode bayar |
| `/api/reports/revenue-by-item` | Rincian tiket, sewa alat, jasa pemandu |
| `/api/reports/visitors-by-trail` | Rombongan & pendaki per jalur |
| `/api/reports/gate-recap` | Kinerja petugas + sampah dibawa turun (kg) |
| `/api/reports/bookings` | Buku booking lengkap untuk arsip |
| `/api/reports/summary` | Kotor, refund, **bersih**, pendaki, sampah |

Tambahkan `?format=csv` pada endpoint mana pun untuk mengunduh berkas dengan
pemisah titik koma dan BOM UTF-8 — langsung rapi di Excel berbahasa Indonesia.
Rentang default adalah bulan berjalan; atur dengan `?from=&to=`.

> **Catatan implementasi.** Agregasi dilakukan di JavaScript, bukan SQL mentah.
> Kolom `DateTime` Prisma bertipe `timestamp` tanpa zona, sehingga membandingkannya
> dengan parameter bertimezone menggeser hasil sebesar offset server — bug ini sempat
> membuat laporan harian kosong padahal ringkasannya berisi.

## Tata kelola

* **Refund** — membatalkan booking yang sudah lunas otomatis membuka pengajuan
  pengembalian dana; uang tidak pernah hangus diam-diam. Persetujuan hanya oleh
  administrator, dan menyetujui refund sekaligus membatalkan booking serta
  mengembalikan stok alat.
* **Audit log** — setiap `POST/PUT/PATCH/DELETE` dicatat (siapa, peran, jalur, status,
  IP, payload). Dipasang di level aplikasi agar route baru tidak bisa lupa diaudit;
  field kata sandi disamarkan sebelum disimpan.
* **Pembatas percobaan masuk** — 8 kali per IP + identitas per 10 menit, dan
  penghitungnya direset begitu login berhasil.
* **Penimbangan sampah** — dicatat saat check-out sesuai tata tertib butir 2, lalu
  direkap di laporan pos gerbang.

## Aturan bisnis yang ditegakkan server

* **Kuota harian per jalur** — dihitung untuk **setiap hari menginap**, bukan hanya
  tanggal berangkat: rombongan 3 hari memakai slot di ketiga harinya. Booking ditolak
  bila salah satu hari kurang kuota. Status `PENDING_PAYMENT`, `PAID`, dan
  `CHECKED_IN` sama-sama memakai slot.
* **Stok alat sewa** — dikurangi saat booking dibuat (dengan `updateMany` bersyarat
  agar dua rombongan tidak merebut tenda terakhir), dikembalikan saat dibatalkan
  atau saat check-out.
* **Tarif berkemah** dihitung per orang per malam; tiket lain sekali bayar.
* **Biaya layanan** dibaca dari tabel `Setting` (bukan hardcode) dengan cache 30 detik,
  jadi bisa diubah dari back office tanpa deploy ulang.
* **E-Pass** hanya terbit setelah pembayaran lunas; check-in hanya dari status
  `PAID`, check-out hanya dari `CHECKED_IN`.
* **Selisih orang saat check-out** dilaporkan agar petugas memverifikasi manual.
* **Ulasan** hanya bisa diberikan setelah pendakian berstatus `COMPLETED`.

---

## Struktur

```
backend/
  prisma/schema.prisma     18 model, enum lengkap
  prisma/seed.ts           2 jalur + 19 titik koordinat asli, tiket, sewa, guide,
                           konten sejarah/tata tertib, booking contoh
  src/routes/              auth, trails, catalog, bookings, gate, sos, dashboard,
                           content, users
  src/services/            quota.ts (kuota & okupansi), booking.ts (pricing & stok)
web/
  src/pages/               Dashboard, GateScanner, OnMountain, SosCenter, Bookings,
                           Trails, Catalog, ContentPage, Users, Login
mobile/
  lib/blocs/               auth, home, booking, trips, sos, map
  lib/data/                models.dart, repositories.dart
  lib/ui/screens/          shell, home, trail_detail, booking, payment, epass,
                           trips, map, sos, profile, content_detail, login, register
```

## Konfigurasi mobile

Emulator Android memakai `http://10.0.2.2:5022` secara bawaan. Untuk perangkat fisik:

```bash
flutter run --dart-define=API_URL=http://192.168.x.x:5022
```

## Build APK

```bash
./build-apk.sh                          # API http://192.168.1.4:5022 (LAN Mac)
./build-apk.sh https://api.sembung.id   # API kustom
```

Hasil: `dist/SembungExplorer.apk` — package `id.sembung.sembung_explorer`,
compileSdk 34, **minSdk 21, targetSdk 34**, ±23 MB, **ditandatangani kunci rilis**
(`android/sembung-release.jks`, berlaku 30 tahun).

Kunci dan sandinya ada di `android/key.properties`; keduanya di-`.gitignore`.
**Simpan cadangannya** — kehilangan keystore berarti aplikasi tidak bisa diperbarui
di Play Store selamanya.

Build dijalankan di VPS lewat Docker `ghcr.io/cirruslabs/flutter:3.19.6`, bukan di Mac,
karena SDK Flutter di `~/Documents/flutter` ter-sync iCloud (isinya placeholder) sehingga
Gradle menggantung berjam-jam saat mengevaluasi `settings.gradle`. Efek samping yang sama
membuat `flutter analyze` tidak selesai — pakai `dart analyze lib` untuk analisis lokal.

Dua hal yang wajib ada agar build berhasil dan sudah diterapkan:

* `android/settings.gradle` memakai **Kotlin 1.9.22 + AGP 7.4.2**. Versi bawaan Flutter 3.19
  (Kotlin 1.7.10) gagal di `:app:compileReleaseKotlin` karena `geolocator_android`
  membawa `kotlin-stdlib` 1.9.x.
* Volume `.pub-cache` dan `.gradle` di-mount ke container. Tanpa itu, `docker run --rm`
  membuang cache setiap selesai sehingga kompilasi Dart gagal menemukan paket.

## Emulator Android

Butuh ruang disk ±6 GB untuk satu system image (`system-images;android-34;google_apis;arm64-v8a`).
Setelah tersedia:

```bash
export ANDROID_HOME=~/Library/Android/sdk
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "system-images;android-34;google_apis;arm64-v8a"
$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd -n sembung -k "system-images;android-34;google_apis;arm64-v8a" -d pixel_7
$ANDROID_HOME/emulator/emulator -avd sembung &
adb install -r dist/SembungExplorer.apk
```

Di emulator, APK harus dibangun dengan `./build-apk.sh http://10.0.2.2:5022`.
