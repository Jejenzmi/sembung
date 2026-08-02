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
