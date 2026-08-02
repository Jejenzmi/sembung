import 'package:flutter_test/flutter_test.dart';
import 'package:sembung_explorer/core/jadwal_shalat.dart';

/// Basecamp Pasanggrahan, kaki Gunung Sembung.
const lintangSembung = -6.5312;
const bujurSembung = 107.3585;

JadwalShalat jadwal({double mdpl = 0, DateTime? tanggal}) => JadwalShalat(
      lintang: lintangSembung,
      bujur: bujurSembung,
      ketinggianMdpl: mdpl,
      tanggal: tanggal ?? DateTime(2026, 8, 2),
    );

int menit(DateTime t) => t.hour * 60 + t.minute;

void main() {
  group('Urutan dan kewajaran waktu', () {
    test('seluruh waktu terdefinisi dan berurutan', () {
      final w = jadwal().hitung();
      for (final nama in ['Imsak', 'Subuh', 'Terbit', 'Zuhur', 'Asar', 'Magrib', 'Isya']) {
        expect(w[nama], isNotNull, reason: '$nama harus terhitung di Indonesia');
      }
      final urut = ['Imsak', 'Subuh', 'Terbit', 'Zuhur', 'Asar', 'Magrib', 'Isya']
          .map((n) => menit(w[n]!))
          .toList();
      for (var i = 1; i < urut.length; i++) {
        expect(urut[i], greaterThan(urut[i - 1]),
            reason: 'waktu ke-$i harus setelah sebelumnya');
      }
    });

    test('zuhur jatuh sekitar tengah hari matahari', () {
      final z = menit(jadwal().hitung()['Zuhur']!);
      // Bujur 107,36° pada UTC+7 menggeser tengah hari ke sekitar 11.50–12.10.
      expect(z, inInclusiveRange(11 * 60 + 40, 12 * 60 + 15));
    });

    test('waktu berada pada rentang wajar untuk Jawa Barat', () {
      final w = jadwal().hitung();
      expect(menit(w['Subuh']!), inInclusiveRange(4 * 60, 5 * 60));
      expect(menit(w['Terbit']!), inInclusiveRange(5 * 60, 6 * 60 + 30));
      expect(menit(w['Asar']!), inInclusiveRange(14 * 60 + 30, 16 * 60));
      expect(menit(w['Magrib']!), inInclusiveRange(17 * 60, 18 * 60 + 30));
      expect(menit(w['Isya']!), inInclusiveRange(18 * 60, 20 * 60));
    });

    test('imsak sepuluh menit sebelum subuh', () {
      final w = jadwal().hitung();
      expect(menit(w['Subuh']!) - menit(w['Imsak']!), 10);
    });
  });

  group('Pengaruh ketinggian', () {
    test('di puncak matahari terbit lebih awal dan terbenam lebih lambat', () {
      final bawah = jadwal(mdpl: 0).hitung();
      final puncak = jadwal(mdpl: 1180).hitung();

      expect(menit(puncak['Terbit']!), lessThan(menit(bawah['Terbit']!)),
          reason: 'ufuk lebih rendah dari puncak, matahari tampak lebih awal');
      expect(menit(puncak['Magrib']!), greaterThan(menit(bawah['Magrib']!)),
          reason: 'matahari tampak terbenam lebih lambat dari puncak');
    });

    test('selisihnya beberapa menit, bukan jam', () {
      final selisih = menit(jadwal(mdpl: 1180).hitung()['Magrib']!) -
          menit(jadwal(mdpl: 0).hitung()['Magrib']!);
      expect(selisih, inInclusiveRange(2, 10));
    });

    test('zuhur tidak terpengaruh ketinggian', () {
      expect(menit(jadwal(mdpl: 1180).hitung()['Zuhur']!),
          menit(jadwal(mdpl: 0).hitung()['Zuhur']!));
    });
  });

  group('Perubahan sepanjang tahun', () {
    test('waktu bergeser antara Juni dan Desember', () {
      final juni = menit(jadwal(tanggal: DateTime(2026, 6, 21)).hitung()['Magrib']!);
      final desember = menit(jadwal(tanggal: DateTime(2026, 12, 21)).hitung()['Magrib']!);
      expect((juni - desember).abs(), greaterThan(10),
          reason: 'deklinasi matahari berubah, magrib tidak boleh statis');
    });

    test('tetap terhitung untuk seluruh bulan tanpa nilai kosong', () {
      for (var bulan = 1; bulan <= 12; bulan++) {
        final w = jadwal(tanggal: DateTime(2026, bulan, 15)).hitung();
        expect(w.values.any((v) => v == null), isFalse,
            reason: 'bulan $bulan menghasilkan waktu kosong');
      }
    });
  });

  group('Kecocokan dengan rujukan Kemenag', () {
    // Nilai pembanding diambil dari Aladhan metode 20 (Kemenag RI) untuk
    // 2 Agustus 2026 di titik yang sama. Sistem ini sengaja menambahkan
    // ihtiyath 2 menit, dan mengurangi 2 menit untuk terbit — selisih itulah
    // yang diharapkan, bukan angka yang persis sama.
    const rujukan = {
      'Imsak': '04:31', 'Subuh': '04:41', 'Terbit': '06:02',
      'Zuhur': '11:57', 'Asar': '15:18', 'Magrib': '17:52', 'Isya': '19:04',
    };

    int keMenit(String jam) =>
        int.parse(jam.split(':')[0]) * 60 + int.parse(jam.split(':')[1]);

    test('selisih terhadap rujukan hanya sebesar ihtiyath', () {
      final w = jadwal(tanggal: DateTime(2026, 8, 2)).hitung();
      rujukan.forEach((nama, jam) {
        final selisih = menit(w[nama]!) - keMenit(jam);
        final diharapkan = nama == 'Terbit' ? -2 : 2;
        expect(selisih, inInclusiveRange(diharapkan - 1, diharapkan + 1),
            reason: '\$nama menyimpang \$selisih menit dari rujukan Kemenag');
      });
    });
  });

  group('Arah kiblat', () {
    test('dari Gunung Sembung mengarah barat laut', () {
      final arah = JadwalShalat.arahKiblat(lintangSembung, bujurSembung);
      // Kiblat dari Jawa Barat berada di kisaran 294–296° dari utara sejati.
      expect(arah, inInclusiveRange(293.0, 297.0));
    });

    test('dari Makkah sendiri tidak menghasilkan nilai tak wajar', () {
      final arah = JadwalShalat.arahKiblat(21.4225, 39.8262);
      expect(arah, inInclusiveRange(0.0, 360.0));
    });

    test('dari Jakarta hampir sama dengan dari Purwakarta', () {
      final jakarta = JadwalShalat.arahKiblat(-6.2088, 106.8456);
      final purwakarta = JadwalShalat.arahKiblat(lintangSembung, bujurSembung);
      expect((jakarta - purwakarta).abs(), lessThan(1.0));
    });
  });
}
