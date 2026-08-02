import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

/// Pengingat yang dijadwalkan di perangkat: waktu salat dan H-1 pendakian.
/// Tidak memerlukan layanan pihak ketiga, sehingga tetap berbunyi di jalur
/// pendakian yang tanpa sinyal — justru di sanalah paling dibutuhkan.
class Pengingat {
  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _siap = false;

  /// Rentang id agar penjadwalan salat tidak bertabrakan dengan pengingat trip.
  static const _idSalatAwal = 1000;
  static const _idTripAwal = 2000;

  static Future<void> siapkan() async {
    if (_siap) return;
    tzdata.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation('Asia/Jakarta'));

    await _plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
    );
    _siap = true;
  }

  /// Meminta izin notifikasi (Android 13+ mewajibkannya).
  static Future<bool> mintaIzin() async {
    await siapkan();
    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    final diberi = await android?.requestNotificationsPermission();
    return diberi ?? true;
  }

  static const _salat = AndroidNotificationDetails(
    'sembung_salat',
    'Pengingat Salat',
    channelDescription: 'Pemberitahuan masuknya waktu salat',
    importance: Importance.high,
    priority: Priority.high,
  );

  static const _penting = AndroidNotificationDetails(
    'sembung_penting',
    'Pemberitahuan Penting',
    channelDescription: 'Pengingat pendakian dan kabar dari pos pemantau',
    importance: Importance.max,
    priority: Priority.high,
  );

  /// Menjadwalkan pengingat salat untuk beberapa hari ke depan sekaligus,
  /// supaya tetap berbunyi walau aplikasi tidak dibuka di gunung.
  static Future<int> jadwalkanSalat(
    Map<DateTime, Map<String, String>> jadwalPerHari, {
    Set<String> waktuDipilih = const {'Subuh', 'Zuhur', 'Asar', 'Magrib', 'Isya'},
  }) async {
    await siapkan();
    await batalkanRentang(_idSalatAwal, _idTripAwal);

    var id = _idSalatAwal;
    var terjadwal = 0;
    final sekarang = tz.TZDateTime.now(tz.local);

    for (final hari in jadwalPerHari.entries) {
      for (final w in hari.value.entries) {
        if (!waktuDipilih.contains(w.key) || w.value == '-') continue;
        final bagian = w.value.split(':');
        final waktu = tz.TZDateTime(
          tz.local,
          hari.key.year, hari.key.month, hari.key.day,
          int.parse(bagian[0]), int.parse(bagian[1]),
        );
        if (!waktu.isAfter(sekarang)) continue;
        if (id >= _idTripAwal) break; // jangan menabrak rentang pengingat trip

        await _plugin.zonedSchedule(
          id++,
          'Waktu ${w.key}',
          'Telah masuk waktu ${w.key} untuk kawasan Gunung Sembung.',
          waktu,
          const NotificationDetails(android: _salat),
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          uiLocalNotificationDateInterpretation:
              UILocalNotificationDateInterpretation.absoluteTime,
        );
        terjadwal++;
      }
    }
    return terjadwal;
  }

  /// Pengingat H-1 sebelum pendakian: barang wajib dan batas jam naik.
  static Future<void> jadwalkanPendakian({
    required String kodeBooking,
    required String namaJalur,
    required DateTime tanggalMulai,
  }) async {
    await siapkan();
    final waktu = tz.TZDateTime(
      tz.local, tanggalMulai.year, tanggalMulai.month, tanggalMulai.day, 19, 0,
    ).subtract(const Duration(days: 1));
    if (!waktu.isAfter(tz.TZDateTime.now(tz.local))) return;

    await _plugin.zonedSchedule(
      _idTripAwal + kodeBooking.hashCode.abs() % 900,
      'Besok mendaki $namaJalur',
      'Booking $kodeBooking. Siapkan jas hujan, headlamp, air 3 liter/orang, dan P3K. '
      'Batas naik terakhir pukul 16.00 WIB.',
      waktu,
      const NotificationDetails(android: _penting),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
    );
  }

  /// Menampilkan pemberitahuan seketika (dipakai saat pesan masuk dari pos).
  static Future<void> tampilkanSekarang(String judul, String pesan) async {
    await siapkan();
    await _plugin.show(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      judul,
      pesan,
      const NotificationDetails(android: _penting),
    );
  }

  static Future<void> batalkanRentang(int dari, int sampai) async {
    for (var i = dari; i < sampai; i++) {
      await _plugin.cancel(i);
    }
  }

  static Future<List<PendingNotificationRequest>> terjadwal() async {
    await siapkan();
    return _plugin.pendingNotificationRequests();
  }
}
