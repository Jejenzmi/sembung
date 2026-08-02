import 'package:flutter_test/flutter_test.dart';
import 'package:sembung_explorer/core/kisi.dart';

void main() {
  group('Pembagian kisi', () {
    test('membagi rata bila jumlahnya kelipatan', () {
      expect(bagiPerBaris([1, 2, 3, 4, 5, 6], 3), [
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });

    test('baris terakhir boleh tidak penuh — inilah kasus yang dulu merusak', () {
      // 8 item pada kisi 3 kolom: baris ketiga hanya berisi 2.
      final baris = bagiPerBaris([1, 2, 3, 4, 5, 6, 7, 8], 3);
      expect(baris.length, 3);
      expect(baris.last, [7, 8]);
    });

    test('tidak pernah melewati batas untuk jumlah item berapa pun', () {
      for (var n = 0; n <= 40; n++) {
        for (var kolom = 1; kolom <= 5; kolom++) {
          final items = List<int>.generate(n, (i) => i);
          final baris = bagiPerBaris(items, kolom);

          // Seluruh item harus terwakili tepat sekali, tanpa yang hilang.
          expect(baris.expand((b) => b).toList(), items,
              reason: 'n=$n kolom=$kolom');
          expect(baris.length, (n / kolom).ceil(), reason: 'n=$n kolom=$kolom');
          for (final b in baris) {
            expect(b.length, lessThanOrEqualTo(kolom));
            expect(b, isNotEmpty);
          }
        }
      }
    });

    test('daftar kosong menghasilkan nol baris, bukan galat', () {
      expect(bagiPerBaris<int>([], 3), isEmpty);
    });

    test('menolak jumlah kolom yang tidak masuk akal', () {
      expect(() => bagiPerBaris([1, 2], 0), throwsArgumentError);
      expect(() => bagiPerBaris([1, 2], -1), throwsArgumentError);
    });
  });
}
