import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/pengingat.dart';
import '../../core/theme.dart';

/// Perkenalan singkat, lalu dua permintaan izin. Setiap izin dijelaskan
/// alasannya lebih dulu — pengguna gunung berhak tahu untuk apa datanya dipakai,
/// dan izin yang dipahami jauh lebih mungkin diberikan.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onSelesai});
  final VoidCallback onSelesai;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _Halaman {
  const _Halaman(this.lambang, this.judul, this.isi);
  final String lambang;
  final String judul;
  final String isi;
}

const _halaman = [
  _Halaman('🎫', 'Pesan E-Pass dari rumah',
      'Tiket masuk, izin berkemah, sewa alat, sampai pemandu — semuanya dalam '
      'satu kali bayar. Tunjukkan QR di pos gerbang, tak perlu antre menulis manual.'),
  _Halaman('🗺️', 'Peta jalur yang tetap hidup tanpa sinyal',
      'Pos pendakian, sumber air, camping ground, dan titik bahaya tersimpan di '
      'ponsel Anda. Kompas dan jadwal salat pun tetap berjalan di atas gunung.'),
  _Halaman('🚨', 'Bantuan satu tekan saat darurat',
      'Tombol SOS mengirim koordinat dan data rombongan ke pos pemantau. '
      'Tanpa sinyal pun permintaan disimpan dan dikirim otomatis begitu jaringan kembali.'),
];

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pengendali = PageController();
  int _indeks = 0;
  bool _sedangProses = false;

  // Tiga halaman perkenalan + izin lokasi + izin notifikasi.
  int get _total => _halaman.length + 2;

  @override
  void dispose() {
    _pengendali.dispose();
    super.dispose();
  }

  void _lanjut() {
    if (_indeks < _total - 1) {
      _pengendali.nextPage(
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
    } else {
      widget.onSelesai();
    }
  }

  Future<void> _mintaLokasi() async {
    setState(() => _sedangProses = true);
    try {
      var izin = await Geolocator.checkPermission();
      if (izin == LocationPermission.denied) {
        izin = await Geolocator.requestPermission();
      }
      if (!mounted) return;
      final diberi = izin == LocationPermission.always ||
          izin == LocationPermission.whileInUse;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(diberi
              ? 'Izin lokasi diberikan — peta dan SOS siap dipakai'
              : 'Tanpa izin lokasi, SOS memakai titik basecamp dan peta tidak menunjukkan posisi Anda'),
          backgroundColor: diberi ? AppColors.mossDark : AppColors.ember,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(14),
        ),
      );
    } finally {
      if (mounted) setState(() => _sedangProses = false);
    }
    _lanjut();
  }

  Future<void> _mintaNotifikasi() async {
    setState(() => _sedangProses = true);
    try {
      final diberi = await Pengingat.mintaIzin();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(diberi
              ? 'Izin notifikasi diberikan — pengingat azan dan pendakian aktif'
              : 'Notifikasi dimatikan. Anda masih bisa menyalakannya lewat pengaturan HP'),
          backgroundColor: diberi ? AppColors.mossDark : AppColors.ember,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(14),
        ),
      );
    } finally {
      if (mounted) setState(() => _sedangProses = false);
    }
    widget.onSelesai();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: widget.onSelesai,
                child: const Text('Lewati'),
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pengendali,
                onPageChanged: (i) => setState(() => _indeks = i),
                children: [
                  ..._halaman.map((h) => _Kartu(
                        lambang: h.lambang,
                        judul: h.judul,
                        isi: h.isi,
                      )),
                  const _Kartu(
                    lambang: '📍',
                    judul: 'Izinkan akses lokasi',
                    isi: 'Dipakai untuk menampilkan posisi Anda di peta jalur, '
                        'menghitung arah ke puncak, dan yang terpenting: mengirim '
                        'koordinat tepat ke tim SAR ketika Anda menekan tombol darurat.\n\n'
                        'Lokasi hanya dikirim saat Anda menekan SOS atau menyalakan '
                        'berbagi lokasi — tidak dilacak diam-diam.',
                  ),
                  const _Kartu(
                    lambang: '🔔',
                    judul: 'Izinkan notifikasi',
                    isi: 'Untuk pengingat waktu salat yang tetap berbunyi tanpa sinyal, '
                        'pengingat H-1 sebelum mendaki beserta daftar barang wajib, '
                        'serta kabar dari pos pemantau saat Anda meminta bantuan.',
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      _total,
                      (i) => AnimatedContainer(
                        duration: const Duration(milliseconds: 260),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        height: 7,
                        width: i == _indeks ? 22 : 7,
                        decoration: BoxDecoration(
                          color: i == _indeks
                              ? AppColors.moss
                              : const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  FilledButton(
                    onPressed: _sedangProses
                        ? null
                        : switch (_indeks) {
                            3 => _mintaLokasi,
                            4 => _mintaNotifikasi,
                            _ => _lanjut,
                          },
                    child: _sedangProses
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : Text(switch (_indeks) {
                            3 => 'Izinkan Lokasi',
                            4 => 'Izinkan Notifikasi',
                            _ => 'Lanjut',
                          }),
                  ),
                  if (_indeks >= 3) ...[
                    const SizedBox(height: 6),
                    TextButton(
                      onPressed: _sedangProses
                          ? null
                          : (_indeks == 3 ? _lanjut : widget.onSelesai),
                      child: const Text('Nanti saja'),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Kartu extends StatelessWidget {
  const _Kartu({required this.lambang, required this.judul, required this.isi});
  final String lambang;
  final String judul;
  final String isi;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            height: 132,
            width: 132,
            decoration: BoxDecoration(
              color: AppColors.mossLight,
              borderRadius: BorderRadius.circular(40),
            ),
            alignment: Alignment.center,
            child: Text(lambang, style: const TextStyle(fontSize: 62)),
          ),
          const SizedBox(height: 34),
          Text(
            judul,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 23, fontWeight: FontWeight.w800, height: 1.25),
          ),
          const SizedBox(height: 14),
          Text(
            isi,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 14, color: AppColors.muted, height: 1.6),
          ),
        ],
      ),
    );
  }
}
