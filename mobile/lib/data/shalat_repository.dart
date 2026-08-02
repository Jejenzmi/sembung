import 'dart:convert';

import '../core/api_client.dart';
import '../core/jadwal_shalat.dart';

enum SumberJadwal { resmi, tersimpan, hitungLokal }

class JadwalHari {
  final String tanggal;
  final Map<String, String> waktu;
  final String lokasi;
  final SumberJadwal sumber;

  const JadwalHari({
    required this.tanggal,
    required this.waktu,
    required this.lokasi,
    required this.sumber,
  });

  String get labelSumber => switch (sumber) {
        SumberJadwal.resmi => 'Kemenag RI',
        SumberJadwal.tersimpan => 'Kemenag RI (tersimpan)',
        SumberJadwal.hitungLokal => 'Hitung lokal — tanpa jaringan',
      };
}

/// Jadwal salat memakai data resmi Kemenag, disimpan sebulan penuh agar tetap
/// tersedia di jalur tanpa sinyal. Perhitungan lokal hanya dipakai sebagai
/// jaring pengaman terakhir bila belum ada satu pun jadwal tersimpan.
class ShalatRepository {
  ShalatRepository(this.api);
  final ApiClient api;

  static const _urutan = ['Imsak', 'Subuh', 'Terbit', 'Zuhur', 'Asar', 'Magrib', 'Isya'];

  String _kunci(int tahun, int bulan) =>
      'shalat_${tahun}_${bulan.toString().padLeft(2, '0')}';

  Map<String, String> _dariEntri(Map<String, dynamic> e) => {
        'Imsak': e['imsak'] as String,
        'Subuh': e['subuh'] as String,
        'Terbit': e['terbit'] as String,
        'Zuhur': e['zuhur'] as String,
        'Asar': e['asar'] as String,
        'Magrib': e['magrib'] as String,
        'Isya': e['isya'] as String,
      };

  /// Mengunduh sebulan penuh dan menyimpannya. Dipanggil saat aplikasi terbuka
  /// dan lewat tombol "siapkan bekal offline".
  Future<bool> unduhBulan(int tahun, int bulan) async {
    try {
      final data = await api.get('/shalat', query: {'tahun': tahun, 'bulan': bulan})
          as Map<String, dynamic>;
      await api.prefs.setString(_kunci(tahun, bulan), jsonEncode(data));
      return true;
    } on ApiException {
      return false;
    }
  }

  Map<String, dynamic>? _bulanTersimpan(int tahun, int bulan) {
    final mentah = api.prefs.getString(_kunci(tahun, bulan));
    if (mentah == null) return null;
    return jsonDecode(mentah) as Map<String, dynamic>;
  }

  bool punyaBulan(int tahun, int bulan) => _bulanTersimpan(tahun, bulan) != null;

  /// Jadwal satu hari. Urutan sumber: jaringan → simpanan → hitung lokal.
  Future<JadwalHari> hari(
    DateTime tanggal, {
    required double lintang,
    required double bujur,
    double mdpl = 0,
  }) async {
    final kunciTanggal =
        '${tanggal.year}-${tanggal.month.toString().padLeft(2, '0')}-${tanggal.day.toString().padLeft(2, '0')}';

    var tersimpan = _bulanTersimpan(tanggal.year, tanggal.month);
    var baruDiunduh = false;
    if (tersimpan == null) {
      baruDiunduh = await unduhBulan(tanggal.year, tanggal.month);
      tersimpan = _bulanTersimpan(tanggal.year, tanggal.month);
    }

    if (tersimpan != null) {
      final daftar = (tersimpan['jadwal'] as List).cast<Map<String, dynamic>>();
      for (final e in daftar) {
        if (e['tanggal'] == kunciTanggal) {
          return JadwalHari(
            tanggal: kunciTanggal,
            waktu: _dariEntri(e),
            lokasi: (tersimpan['lokasi'] as String?) ?? '-',
            sumber: baruDiunduh ? SumberJadwal.resmi : SumberJadwal.tersimpan,
          );
        }
      }
    }

    // Jaring pengaman: tetap memberi jadwal alih-alih layar kosong di gunung.
    final lokal = JadwalShalat(
      lintang: lintang, bujur: bujur, ketinggianMdpl: mdpl, tanggal: tanggal,
    ).hitung();
    return JadwalHari(
      tanggal: kunciTanggal,
      waktu: {
        for (final n in _urutan)
          n: lokal[n] == null
              ? '-'
              : '${lokal[n]!.hour.toString().padLeft(2, '0')}:${lokal[n]!.minute.toString().padLeft(2, '0')}',
      },
      lokasi: 'Posisi Anda',
      sumber: SumberJadwal.hitungLokal,
    );
  }
}
