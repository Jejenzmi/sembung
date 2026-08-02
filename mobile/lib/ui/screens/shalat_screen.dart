import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/config.dart';
import '../../core/formatters.dart';
import '../../core/jadwal_shalat.dart';
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

  @override
  void initState() {
    super.initState();
    _ambilPosisi();
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

  Map<String, DateTime?> get _jadwal => JadwalShalat(
        lintang: _lintang,
        bujur: _bujur,
        ketinggianMdpl: _mdpl,
        tanggal: _tanggal,
      ).hitung();

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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Jadwal Salat'),
        actions: [
          IconButton(
            tooltip: 'Perbarui lokasi',
            onPressed: _ambilPosisi,
            icon: const Icon(Icons.my_location),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          AppCard(
            color: AppColors.mossLight,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(hariTanggal(_tanggal),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 4),
                Text(
                  _dariGps
                      ? 'Posisi Anda · ${_lintang.toStringAsFixed(4)}, ${_bujur.toStringAsFixed(4)} · ${_mdpl.round()} mdpl'
                      : 'Basecamp Pasanggrahan · ${_mdpl.round()} mdpl (GPS belum aktif)',
                  style: const TextStyle(fontSize: 12, color: AppColors.mossDark),
                ),
                if (berikut != null) ...[
                  const SizedBox(height: 14),
                  Text('${berikut.nama} · ${DateTime.now().isBefore(berikut.waktu) ? _sisa(berikut.waktu) : ''}',
                      style: const TextStyle(fontSize: 13, color: AppColors.mossDark)),
                  Text(
                    '${berikut.waktu.hour.toString().padLeft(2, '0')}:${berikut.waktu.minute.toString().padLeft(2, '0')}',
                    style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => setState(
                      () => _tanggal = _tanggal.subtract(const Duration(days: 1))),
                  icon: const Icon(Icons.chevron_left, size: 18),
                  label: const Text('Kemarin'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => setState(() => _tanggal = DateTime.now()),
                  icon: const Icon(Icons.today, size: 18),
                  label: const Text('Hari ini'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () =>
                      setState(() => _tanggal = _tanggal.add(const Duration(days: 1))),
                  icon: const Icon(Icons.chevron_right, size: 18),
                  label: const Text('Besok'),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),
          ...jadwal.entries.map((e) {
            final aktif = berikut?.nama == e.key;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: AppCard(
                color: aktif ? AppColors.mossLight : Colors.white,
                child: Row(
                  children: [
                    Text(_ikon[e.key] ?? '🕌', style: const TextStyle(fontSize: 22)),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        e.key,
                        style: TextStyle(
                          fontWeight: aktif ? FontWeight.w800 : FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    Text(
                      e.value == null
                          ? '-'
                          : '${e.value!.hour.toString().padLeft(2, '0')}:${e.value!.minute.toString().padLeft(2, '0')}',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: aktif ? AppColors.mossDark : AppColors.ink,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

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
          const Text(
            'Dihitung di perangkat dari posisi matahari — tetap berfungsi tanpa sinyal. '
            'Sudut fajar 20° dan isya 18° mengikuti ketetapan Kementerian Agama, '
            'dengan ihtiyath 2 menit. Ketinggian tempat diperhitungkan, sehingga di '
            'puncak magrib tampak beberapa menit lebih lambat daripada di basecamp.',
            style: TextStyle(fontSize: 11.5, color: AppColors.muted, height: 1.5),
          ),
        ],
      ),
    );
  }
}
