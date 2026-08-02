import 'package:flutter_test/flutter_test.dart';
import 'package:sembung_explorer/core/navigasi.dart';

// Titik nyata dari jalur Pasanggrahan.
const basecampLat = -6.5312, basecampLon = 107.3585;
const puncakLat = -6.5489, puncakLon = 107.3798;

void main() {
  group('Bearing', () {
    test('dari basecamp ke puncak mengarah tenggara', () {
      final b = Navigasi.bearing(basecampLat, basecampLon, puncakLat, puncakLon);
      expect(b, inInclusiveRange(120.0, 140.0));
      expect(Navigasi.mataAngin(b), 'Tenggara');
    });

    test('arah balik berselisih sekitar 180 derajat', () {
      final pergi = Navigasi.bearing(basecampLat, basecampLon, puncakLat, puncakLon);
      final pulang = Navigasi.bearing(puncakLat, puncakLon, basecampLat, basecampLon);
      expect((((pulang - pergi) + 360) % 360 - 180).abs(), lessThan(1.0));
    });

    test('tepat ke utara dan ke timur', () {
      expect(Navigasi.bearing(0, 0, 1, 0), closeTo(0, 0.01));
      expect(Navigasi.bearing(0, 0, 0, 1), closeTo(90, 0.01));
    });
  });

  group('Jarak', () {
    test('basecamp ke puncak sekitar 2,9 km garis lurus', () {
      final m = Navigasi.jarakMeter(basecampLat, basecampLon, puncakLat, puncakLon);
      expect(m, inInclusiveRange(2500.0, 3300.0));
    });

    test('satu derajat lintang mendekati 111 km', () {
      expect(Navigasi.jarakMeter(0, 0, 1, 0), closeTo(111195, 500));
    });

    test('titik yang sama berjarak nol', () {
      expect(Navigasi.jarakMeter(puncakLat, puncakLon, puncakLat, puncakLon), closeTo(0, 0.001));
    });

    test('format jarak berganti satuan pada 1 km', () {
      expect(Navigasi.jarakTerbaca(850), '850 m');
      expect(Navigasi.jarakTerbaca(2870), '2.87 km');
    });
  });

  group('Selisih sudut', () {
    test('memilih putaran terpendek melewati utara', () {
      expect(Navigasi.selisihSudut(350, 10), closeTo(20, 0.001));
      expect(Navigasi.selisihSudut(10, 350), closeTo(-20, 0.001));
    });

    test('tetap dalam rentang -180..180', () {
      for (var a = 0; a < 360; a += 37) {
        for (var b = 0; b < 360; b += 53) {
          final d = Navigasi.selisihSudut(a.toDouble(), b.toDouble());
          expect(d, inInclusiveRange(-180.0, 180.0));
        }
      }
    });
  });

  group('Mata angin & deklinasi', () {
    test('memetakan derajat ke nama arah', () {
      expect(Navigasi.mataAngin(0), 'Utara');
      expect(Navigasi.mataAngin(90), 'Timur');
      expect(Navigasi.mataAngin(180), 'Selatan');
      expect(Navigasi.mataAngin(270), 'Barat');
      expect(Navigasi.mataAngin(359), 'Utara');
    });

    test('koreksi deklinasi membawa ke utara sejati', () {
      expect(Navigasi.keUtaraSejati(0), closeTo(0.7, 0.001));
      expect(Navigasi.keUtaraSejati(359.8), closeTo(0.5, 0.001));
    });
  });
}
