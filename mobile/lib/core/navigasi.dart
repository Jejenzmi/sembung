import 'dart:math' as math;

/// Perhitungan arah dan jarak antar dua titik di permukaan bumi.
class Navigasi {
  static const double _jariBumiM = 6371000;

  static double _rad(double d) => d * math.pi / 180.0;
  static double _deg(double r) => r * 180.0 / math.pi;

  /// Arah dari titik asal ke tujuan, derajat dari utara sejati searah jarum jam.
  static double bearing(double lat1, double lon1, double lat2, double lon2) {
    final dLon = _rad(lon2 - lon1);
    final y = math.sin(dLon) * math.cos(_rad(lat2));
    final x = math.cos(_rad(lat1)) * math.sin(_rad(lat2)) -
        math.sin(_rad(lat1)) * math.cos(_rad(lat2)) * math.cos(dLon);
    return (_deg(math.atan2(y, x)) + 360) % 360;
  }

  /// Jarak haversine dalam meter.
  static double jarakMeter(double lat1, double lon1, double lat2, double lon2) {
    final dLat = _rad(lat2 - lat1);
    final dLon = _rad(lon2 - lon1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_rad(lat1)) * math.cos(_rad(lat2)) * math.sin(dLon / 2) * math.sin(dLon / 2);
    return _jariBumiM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  /// Selisih sudut terkecil (-180..180), dipakai memutar jarum kompas.
  static double selisihSudut(double dari, double ke) {
    final d = (ke - dari + 540) % 360 - 180;
    return d;
  }

  /// Delapan mata angin dalam bahasa Indonesia.
  static String mataAngin(double derajat) {
    const arah = [
      'Utara', 'Timur Laut', 'Timur', 'Tenggara',
      'Selatan', 'Barat Daya', 'Barat', 'Barat Laut',
    ];
    return arah[(((derajat % 360) + 22.5) ~/ 45) % 8];
  }

  static String jarakTerbaca(double meter) =>
      meter < 1000 ? '${meter.round()} m' : '${(meter / 1000).toStringAsFixed(2)} km';

  /// Deklinasi magnetik Jawa Barat sekitar +0,7° pada 2026 (WMM). Kecil, tetapi
  /// disertakan agar arah kiblat dan bearing mengacu ke utara SEJATI.
  static const double deklinasiJawaBarat = 0.7;

  /// Mengubah arah baca kompas (magnetik) menjadi arah terhadap utara sejati.
  static double keUtaraSejati(double headingMagnetik,
          [double deklinasi = deklinasiJawaBarat]) =>
      (headingMagnetik + deklinasi + 360) % 360;
}
