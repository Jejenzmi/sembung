import 'package:intl/intl.dart';

final _rupiah = NumberFormat.currency(
  locale: 'id_ID',
  symbol: 'Rp ',
  decimalDigits: 0,
);

String rupiah(num value) => _rupiah.format(value);

String tanggal(DateTime d) => DateFormat('d MMM yyyy', 'id_ID').format(d);

String tanggalJam(DateTime d) =>
    DateFormat('d MMM yyyy · HH:mm', 'id_ID').format(d);

String hariTanggal(DateTime d) =>
    DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(d);

String isoDate(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

/// "3 hari lagi" / "hari ini" — used on booking cards.
String relatif(DateTime target) {
  final now = DateTime.now();
  final days = DateTime(target.year, target.month, target.day)
      .difference(DateTime(now.year, now.month, now.day))
      .inDays;
  if (days == 0) return 'Hari ini';
  if (days == 1) return 'Besok';
  if (days > 1) return '$days hari lagi';
  return '${-days} hari lalu';
}
