import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/config.dart';
import '../../core/formatters.dart';
import '../../core/jadwal_shalat.dart';
import '../../core/pengingat.dart';
import '../../data/shalat_repository.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/navigasi.dart';
import '../../core/theme.dart';
import '../widgets/common.dart';

/// Jadwal salat yang dihitung di perangkat — tetap akurat tanpa sinyal,
/// dan menyesuaikan ketinggian tempat saat pendaki berada di atas.
class ShalatScreen extends StatefulWidget {
  const ShalatScreen({super.key});

  @override
  State<ShalatScreen> createState() => _ShalatScreenState();
}

class _ShalatScreenState extends State<ShalatScreen> {
  double _lintang = kBasecampLat;
  double _bujur = kBasecampLng;
  double _mdpl = 420;
  bool _dariGps = false;
  DateTime _tanggal = DateTime.now();
  JadwalHari? _jadwalHari;
  bool _memuat = true;
  bool _menyiapkanBekal = false;
  bool _pengingatAktif = false;
  int _jumlahTerjadwal = 0;

  @override
  void initState() {
    super.initState();
    _ambilPosisi().then((_) => _muatJadwal());
  }

  Future<void> _muatJadwal() async {
    setState(() => _memuat = true);
    final hasil = await context.read<ShalatRepository>().hari(
          _tanggal,
          lintang: _lintang,
          bujur: _bujur,
          mdpl: _mdpl,
        );
    if (mounted) setState(() { _jadwalHari = hasil; _memuat = false; });
  }

  Future<void> _siapkanBekalOffline() async {
    setState(() => _menyiapkanBekal = true);
    final repo = context.read<ShalatRepository>();
    var berhasil = 0;
    // Bulan ini dan dua bulan berikutnya — cukup untuk musim pendakian.
    for (var i = 0; i < 3; i++) {
      final t = DateTime(_tanggal.year, _tanggal.month + i, 1);
      if (await repo.unduhBulan(t.year, t.month)) berhasil++;
    }
    if (!mounted) return;
    setState(() => _menyiapkanBekal = false);
    showSnack(context,
        berhasil > 0
            ? '$berhasil bulan jadwal tersimpan — siap dipakai tanpa sinyal'
            : 'Gagal mengunduh. Coba lagi saat jaringan tersedia',
        error: berhasil == 0);
    _muatJadwal();
  }

  /// Menjadwalkan azan tujuh hari ke depan sekaligus, supaya tetap berbunyi
  /// walau aplikasi tidak dibuka selama di jalur.
  Future<void> _aturPengingat(bool aktif) async {
    if (!aktif) {
      await Pengingat.batalkanRentang(1000, 2000);
      if (!mounted) return;
      setState(() { _pengingatAktif = false; _jumlahTerjadwal = 0; });
      showSnack(context, 'Pengingat salat dimatikan');
      return;
    }

    // Diambil sebelum await agar context tidak dipakai setelah jeda asinkron.
    final repo = context.read<ShalatRepository>();

    final diizinkan = await Pengingat.mintaIzin();
    if (!diizinkan) {
      if (mounted) {
        showSnack(context, 'Izin notifikasi ditolak — aktifkan lewat pengaturan HP',
            error: true);
      }
      return;
    }

    final peta = <DateTime, Map<String, String>>{};
    for (var i = 0; i < 7; i++) {
      final hari = DateTime.now().add(Duration(days: i));
      final j = await repo.hari(hari, lintang: _lintang, bujur: _bujur, mdpl: _mdpl);
      peta[DateTime(hari.year, hari.month, hari.day)] = j.waktu;
    }

    final n = await Pengingat.jadwalkanSalat(peta);
    if (!mounted) return;
    setState(() { _pengingatAktif = true; _jumlahTerjadwal = n; });
    showSnack(context, '$n pengingat salat dijadwalkan untuk 7 hari ke depan');
  }

  void _gantiTanggal(DateTime baru) {
    setState(() => _tanggal = baru);
    _muatJadwal();
  }

  Future<void> _ambilPosisi() async {
    try {
      var izin = await Geolocator.checkPermission();
      if (izin == LocationPermission.denied) izin = await Geolocator.requestPermission();
      if (izin == LocationPermission.denied || izin == LocationPermission.deniedForever) return;
      final p = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 12),
      );
      if (!mounted) return;
      setState(() {
        _lintang = p.latitude;
        _bujur = p.longitude;
        _mdpl = p.altitude > 0 ? p.altitude : _mdpl;
        _dariGps = true;
      });
    } catch (_) {
      // Tetap memakai koordinat basecamp; jadwal tetap terhitung.
    }
  }

  /// Jam "HH:mm" dari sumber resmi diubah menjadi DateTime hari itu.
  Map<String, DateTime?> get _jadwal {
    final h = _jadwalHari;
    if (h == null) return const {};
    return {
      for (final e in h.waktu.entries)
        e.key: e.value == '-'
            ? null
            : DateTime(_tanggal.year, _tanggal.month, _tanggal.day,
                int.parse(e.value.split(':')[0]), int.parse(e.value.split(':')[1])),
    };
  }

  /// Waktu salat berikutnya hari ini, dipakai untuk hitung mundur.
  ({String nama, DateTime waktu})? get _berikutnya {
    final sekarang = DateTime.now();
    if (!_hariIni) return null;
    for (final e in _jadwal.entries) {
      if (e.key == 'Imsak' || e.key == 'Terbit') continue;
      if (e.value != null && e.value!.isAfter(sekarang)) {
        return (nama: e.key, waktu: e.value!);
      }
    }
    return null;
  }

  bool get _hariIni {
    final n = DateTime.now();
    return _tanggal.year == n.year && _tanggal.month == n.month && _tanggal.day == n.day;
  }

  String _sisa(DateTime target) {
    final d = target.difference(DateTime.now());
    if (d.isNegative) return '-';
    final jam = d.inHours;
    final menit = d.inMinutes % 60;
    return jam > 0 ? '$jam jam $menit menit lagi' : '$menit menit lagi';
  }

  static const _ikon = {
    'Imsak': '🌌', 'Subuh': '🌄', 'Terbit': '🌅',
    'Zuhur': '☀️', 'Asar': '🌤️', 'Magrib': '🌇', 'Isya': '🌙',
  };

  @override
  Widget build(BuildContext context) {
    final jadwal = _jadwal;
    final berikut = _berikutnya;
    final kiblat = JadwalShalat.arahKiblat(_lintang, _bujur);

    if (_memuat && _jadwalHari == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Jadwal Salat')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Jadwal Salat'),
        actions: [
          IconButton(
            tooltip: 'Perbarui lokasi',
            onPressed: () => _ambilPosisi().then((_) => _muatJadwal()),
            icon: const Icon(Icons.my_location),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          _HeroWaktu(
            tanggal: _tanggal,
            berikut: berikut,
            sisa: berikut == null ? '' : _sisa(berikut.waktu),
            lokasi: _dariGps
                ? 'Posisi Anda · ${_mdpl.round()} mdpl'
                : 'Basecamp Pasanggrahan · ${_mdpl.round()} mdpl',
          ),

          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _gantiTanggal(_tanggal.subtract(const Duration(days: 1))),
                  icon: const Icon(Icons.chevron_left, size: 18),
                  label: const Text('Kemarin'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _gantiTanggal(DateTime.now()),
                  icon: const Icon(Icons.today, size: 18),
                  label: const Text('Hari ini'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _gantiTanggal(_tanggal.add(const Duration(days: 1))),
                  icon: const Icon(Icons.chevron_right, size: 18),
                  label: const Text('Besok'),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),
          AppCard(
            child: Column(
              children: jadwal.entries.map((e) {
                final aktif = berikut?.nama == e.key;
                final lewat = e.value != null &&
                    _hariIni &&
                    e.value!.isBefore(DateTime.now());
                final terakhir = e.key == jadwal.keys.last;
                return _BarisWaktu(
                  ikon: _ikon[e.key] ?? '🕌',
                  nama: e.key,
                  jam: e.value == null
                      ? '-'
                      : '${e.value!.hour.toString().padLeft(2, '0')}:${e.value!.minute.toString().padLeft(2, '0')}',
                  aktif: aktif,
                  lewat: lewat,
                  terakhir: terakhir,
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 6),
          AppCard(
            child: Row(
              children: [
                const Text('🕋', style: TextStyle(fontSize: 24)),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Arah Kiblat',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text(
                        '${kiblat.round()}° ${Navigasi.mataAngin(kiblat)} dari utara sejati',
                        style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.muted),
              ],
            ),
          ),

          const SizedBox(height: 14),
          AppCard(
            child: SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              value: _pengingatAktif,
              activeColor: AppColors.moss,
              onChanged: _aturPengingat,
              title: const Text('Pengingat Waktu Salat',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
              subtitle: Text(
                _pengingatAktif
                    ? '$_jumlahTerjadwal pengingat terjadwal — tetap berbunyi tanpa sinyal'
                    : 'Jadwalkan azan 7 hari ke depan langsung di perangkat',
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ),
          ),

          const SizedBox(height: 14),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      _jadwalHari?.sumber == SumberJadwal.hitungLokal
                          ? Icons.calculate_outlined
                          : Icons.verified_outlined,
                      size: 18,
                      color: _jadwalHari?.sumber == SumberJadwal.hitungLokal
                          ? AppColors.ember
                          : AppColors.moss,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Sumber: ${_jadwalHari?.labelSumber ?? '—'}'
                        '${_jadwalHari != null && _jadwalHari!.sumber != SumberJadwal.hitungLokal ? ' · ${_jadwalHari!.lokasi}' : ''}',
                        style: const TextStyle(
                            fontSize: 12.5, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  _jadwalHari?.sumber == SumberJadwal.hitungLokal
                      ? 'Jadwal resmi belum tersimpan dan jaringan tidak tersedia, '
                        'sehingga ditampilkan hasil perhitungan posisi matahari '
                        '(selisih terhadap jadwal Kemenag di bawah 2 menit).'
                      : 'Jadwal resmi Kementerian Agama RI. Simpan untuk dipakai '
                        'di jalur pendakian yang tanpa sinyal.',
                  style: const TextStyle(
                      fontSize: 11.5, color: AppColors.muted, height: 1.5),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _menyiapkanBekal ? null : _siapkanBekalOffline,
                  icon: _menyiapkanBekal
                      ? const SizedBox(
                          height: 16, width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.download_for_offline_outlined, size: 18),
                  label: Text(_menyiapkanBekal
                      ? 'Mengunduh…'
                      : 'Simpan 3 Bulan untuk Offline'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}


/// Hero gelap bergaya langit malam: waktu berikutnya dibuat sebesar mungkin
/// karena itulah satu-satunya angka yang dicari pengguna saat membuka layar ini.
class _HeroWaktu extends StatelessWidget {
  const _HeroWaktu({
    required this.tanggal,
    required this.berikut,
    required this.sisa,
    required this.lokasi,
  });

  final DateTime tanggal;
  final ({String nama, DateTime waktu})? berikut;
  final String sisa;
  final String lokasi;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 24, 22, 24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1B3A5C), Color(0xFF2F5D7C)],
        ),
      ),
      child: Stack(
        children: [
          const Positioned(
            right: -6,
            top: -10,
            child: Opacity(
              opacity: 0.16,
              child: Text('🌙', style: TextStyle(fontSize: 96)),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(hariTanggal(tanggal),
                  style: const TextStyle(
                      color: Color(0xFFBFD6E8),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 18),
              if (berikut != null) ...[
                Text('Menuju ${berikut!.nama}',
                    style: const TextStyle(
                        color: Colors.white70, fontSize: 13.5)),
                const SizedBox(height: 2),
                Text(
                  '${berikut!.waktu.hour.toString().padLeft(2, '0')}:'
                  '${berikut!.waktu.minute.toString().padLeft(2, '0')}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 52,
                    fontWeight: FontWeight.w800,
                    height: 1.05,
                    letterSpacing: -1.5,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.16),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Text(sisa,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700)),
                ),
              ] else
                const Text('Seluruh waktu salat hari ini telah berlalu',
                    style: TextStyle(
                        color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 18),
              Row(
                children: [
                  const Icon(Icons.place_outlined,
                      size: 14, color: Color(0xFFBFD6E8)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(lokasi,
                        style: const TextStyle(
                            color: Color(0xFFBFD6E8), fontSize: 11.5)),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Satu baris pada garis waktu salat. Titik dan garis penghubung membuat urutan
/// waktu terbaca sekilas, dan yang sudah lewat sengaja diredupkan.
class _BarisWaktu extends StatelessWidget {
  const _BarisWaktu({
    required this.ikon,
    required this.nama,
    required this.jam,
    required this.aktif,
    required this.lewat,
    required this.terakhir,
  });

  final String ikon;
  final String nama;
  final String jam;
  final bool aktif;
  final bool lewat;
  final bool terakhir;

  @override
  Widget build(BuildContext context) {
    final warnaTeks = aktif
        ? AppColors.mossDark
        : lewat
            ? AppColors.muted
            : AppColors.ink;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Container(
                height: 11,
                width: 11,
                margin: const EdgeInsets.only(top: 13),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: aktif
                      ? AppColors.moss
                      : lewat
                          ? const Color(0xFFCBD5E1)
                          : Colors.white,
                  border: Border.all(
                    color: aktif ? AppColors.moss : const Color(0xFFCBD5E1),
                    width: 2,
                  ),
                ),
              ),
              if (!terakhir)
                Expanded(
                  child: Container(width: 2, color: const Color(0xFFE2E8F0)),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Container(
              margin: EdgeInsets.only(bottom: terakhir ? 0 : 4),
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
              decoration: BoxDecoration(
                color: aktif ? AppColors.mossLight : Colors.transparent,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Opacity(
                    opacity: lewat ? 0.45 : 1,
                    child: Text(ikon, style: const TextStyle(fontSize: 19)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(nama,
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight:
                              aktif ? FontWeight.w800 : FontWeight.w600,
                          color: warnaTeks,
                        )),
                  ),
                  Text(jam,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: warnaTeks,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      )),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
