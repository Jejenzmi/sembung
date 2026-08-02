import 'dart:math' as math;

/// Perhitungan waktu salat dari posisi matahari — sepenuhnya lokal, tanpa
/// jaringan, sehingga tetap akurat di jalur pendakian yang tanpa sinyal.
///
/// Sudut fajar 20° dan isya 18° mengikuti ketetapan Kementerian Agama RI.
/// Ketinggian tempat diperhitungkan pada waktu terbit dan terbenam, karena
/// di puncak 1.180 mdpl matahari terlihat beberapa menit lebih awal.
class JadwalShalat {
  static const double sudutFajar = 20.0;
  static const double sudutIsya = 18.0;

  /// Ihtiyath: penambahan pengaman 2 menit seperti lazim dipakai di Indonesia,
  /// supaya waktu yang ditampilkan tidak mendahului waktu sebenarnya.
  static const int ihtiyathMenit = 2;

  final double lintang;
  final double bujur;
  final double ketinggianMdpl;
  final DateTime tanggal;
  final Duration zonaWaktu;

  const JadwalShalat({
    required this.lintang,
    required this.bujur,
    this.ketinggianMdpl = 0,
    required this.tanggal,
    this.zonaWaktu = const Duration(hours: 7),
  });

  static double _rad(double d) => d * math.pi / 180.0;
  static double _deg(double r) => r * 180.0 / math.pi;

  /// Julian Day untuk tengah malam tanggal setempat.
  double get _julianDay {
    var y = tanggal.year;
    var m = tanggal.month;
    final d = tanggal.day;
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    final a = (y / 100).floor();
    final b = 2 - a + (a / 4).floor();
    return (365.25 * (y + 4716)).floor() +
        (30.6001 * (m + 1)).floor() +
        d +
        b -
        1524.5;
  }

  /// Deklinasi matahari dan persamaan waktu (dalam jam).
  ({double deklinasi, double persamaanWaktu}) _matahari(double jd) {
    final d = jd - 2451545.0;
    final g = (357.529 + 0.98560028 * d) % 360;
    final q = (280.459 + 0.98564736 * d) % 360;
    final l = (q + 1.915 * math.sin(_rad(g)) + 0.020 * math.sin(_rad(2 * g))) % 360;
    final e = 23.439 - 0.00000036 * d;

    final deklinasi = _deg(math.asin(math.sin(_rad(e)) * math.sin(_rad(l))));
    var ra = _deg(math.atan2(math.cos(_rad(e)) * math.sin(_rad(l)), math.cos(_rad(l)))) / 15.0;
    ra = (ra + 24) % 24;
    final persamaanWaktu = q / 15.0 - ra;
    return (deklinasi: deklinasi, persamaanWaktu: persamaanWaktu);
  }

  /// Sudut jam untuk ketinggian matahari tertentu; null bila tidak pernah
  /// tercapai (fenomena lintang tinggi — tidak terjadi di Indonesia).
  double? _sudutJam(double sudutTinggi, double deklinasi) {
    final pembilang = math.sin(_rad(sudutTinggi)) -
        math.sin(_rad(lintang)) * math.sin(_rad(deklinasi));
    final penyebut = math.cos(_rad(lintang)) * math.cos(_rad(deklinasi));
    final nilai = pembilang / penyebut;
    if (nilai < -1 || nilai > 1) return null;
    return _deg(math.acos(nilai)) / 15.0;
  }

  /// Waktu zuhur dalam jam lokal (matahari melewati meridian).
  double _zuhurJam(double persamaanWaktu) =>
      12.0 + zonaWaktu.inMinutes / 60.0 - bujur / 15.0 - persamaanWaktu;

  /// Koreksi kerendahan ufuk akibat ketinggian tempat, dalam derajat.
  double get _kerendahanUfuk =>
      ketinggianMdpl <= 0 ? 0 : 0.0347 * math.sqrt(ketinggianMdpl);

  DateTime _keWaktu(double jam) {
    final total = (jam * 60).round() ;
    final hari = DateTime(tanggal.year, tanggal.month, tanggal.day);
    return hari.add(Duration(minutes: total));
  }

  DateTime _dengan(double jam, {bool ihtiyath = true}) =>
      _keWaktu(jam).add(Duration(minutes: ihtiyath ? ihtiyathMenit : 0));

  /// Seluruh waktu salat hari itu. Nilai null berarti tidak terdefinisi di
  /// lokasi tersebut — di Indonesia praktis tidak pernah terjadi.
  Map<String, DateTime?> hitung() {
    final jd = _julianDay;
    final m = _matahari(jd);
    final zuhur = _zuhurJam(m.persamaanWaktu);

    // -0.833° = jari-jari piringan matahari + refraksi atmosfer.
    final ufuk = -0.833 - _kerendahanUfuk;

    final hTerbit = _sudutJam(ufuk, m.deklinasi);
    final hFajar = _sudutJam(-sudutFajar, m.deklinasi);
    final hIsya = _sudutJam(-sudutIsya, m.deklinasi);

    // Asar mazhab Syafi'i: bayangan sepanjang benda + bayangan zawal.
    final sudutAsar = _deg(
      math.atan(1 / (1 + math.tan((_rad(lintang - m.deklinasi)).abs()))),
    );
    final hAsar = _sudutJam(sudutAsar, m.deklinasi);

    return {
      'Imsak': hFajar == null ? null : _dengan(zuhur - hFajar - 10 / 60.0),
      'Subuh': hFajar == null ? null : _dengan(zuhur - hFajar),
      'Terbit': hTerbit == null ? null : _keWaktu(zuhur - hTerbit).subtract(const Duration(minutes: ihtiyathMenit)),
      'Zuhur': _dengan(zuhur),
      'Asar': hAsar == null ? null : _dengan(zuhur + hAsar),
      'Magrib': hTerbit == null ? null : _dengan(zuhur + hTerbit),
      'Isya': hIsya == null ? null : _dengan(zuhur + hIsya),
    };
  }

  /// Arah kiblat dari lokasi ini, derajat dari utara sejati searah jarum jam.
  static double arahKiblat(double lintang, double bujur) {
    const latKabah = 21.4225;
    const lonKabah = 39.8262;
    final dLon = _rad(lonKabah - bujur);
    final y = math.sin(dLon);
    final x = math.cos(_rad(lintang)) * math.tan(_rad(latKabah)) -
        math.sin(_rad(lintang)) * math.cos(dLon);
    return (_deg(math.atan2(y, x)) + 360) % 360;
  }
}
