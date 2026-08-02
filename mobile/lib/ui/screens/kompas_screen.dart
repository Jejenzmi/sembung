import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_compass/flutter_compass.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/jadwal_shalat.dart';
import '../../core/navigasi.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../widgets/common.dart';

/// Kompas jalur: arah utara, arah kiblat, dan penunjuk ke titik penting jalur.
class KompasScreen extends StatefulWidget {
  const KompasScreen({super.key, this.slug = 'pasanggrahan'});
  final String slug;

  @override
  State<KompasScreen> createState() => _KompasScreenState();
}

class _KompasScreenState extends State<KompasScreen> {
  double? _heading;
  double? _akurasi;
  Position? _posisi;
  List<TrailPoint> _titik = const [];
  TrailPoint? _tujuan;
  bool _kiblat = false;
  String? _pesanSensor;

  @override
  void initState() {
    super.initState();
    _mulaiKompas();
    _ambilPosisi();
    _muatTitik();
  }

  void _mulaiKompas() {
    final aliran = FlutterCompass.events;
    if (aliran == null) {
      setState(() => _pesanSensor = 'Perangkat ini tidak memiliki sensor kompas.');
      return;
    }
    aliran.listen((peristiwa) {
      if (!mounted) return;
      setState(() {
        _heading = peristiwa.heading;
        _akurasi = peristiwa.accuracy;
        _pesanSensor = peristiwa.heading == null
            ? 'Sensor kompas tidak memberi pembacaan. Jauhkan dari benda logam dan magnet.'
            : null;
      });
    });
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
      if (mounted) setState(() => _posisi = p);
    } catch (_) {
      // Kompas tetap berguna tanpa GPS; hanya penunjuk tujuan yang nonaktif.
    }
  }

  Future<void> _muatTitik() async {
    try {
      final bundel = await context.read<CatalogRepository>().bundle(widget.slug);
      if (mounted) setState(() => _titik = bundel.points);
    } catch (_) {}
  }

  /// Arah baca kompas dikoreksi ke utara sejati agar sejalan dengan peta.
  double? get _headingSejati =>
      _heading == null ? null : Navigasi.keUtaraSejati(_heading!);

  /// Kualitas kalibrasi: pada Android nilai accuracy adalah simpangan derajat.
  ({String label, Color warna, bool perluKalibrasi}) get _kualitas {
    final a = _akurasi;
    if (a == null) return (label: 'Tidak diketahui', warna: AppColors.muted, perluKalibrasi: false);
    if (a < 0) return (label: 'Tidak dapat dipercaya', warna: AppColors.danger, perluKalibrasi: true);
    if (a <= 5) return (label: 'Baik', warna: AppColors.moss, perluKalibrasi: false);
    if (a <= 15) return (label: 'Cukup', warna: AppColors.ember, perluKalibrasi: true);
    return (label: 'Buruk', warna: AppColors.danger, perluKalibrasi: true);
  }

  double? get _sasaran {
    if (_kiblat) {
      final p = _posisi;
      if (p == null) return null;
      return JadwalShalat.arahKiblat(p.latitude, p.longitude);
    }
    final t = _tujuan;
    final p = _posisi;
    if (t == null || p == null) return null;
    return Navigasi.bearing(p.latitude, p.longitude, t.lat, t.lng);
  }

  String? get _jarakSasaran {
    final t = _tujuan;
    final p = _posisi;
    if (_kiblat || t == null || p == null) return null;
    return Navigasi.jarakTerbaca(
        Navigasi.jarakMeter(p.latitude, p.longitude, t.lat, t.lng));
  }

  @override
  Widget build(BuildContext context) {
    final heading = _headingSejati;
    final kualitas = _kualitas;
    final sasaran = _sasaran;

    return Scaffold(
      appBar: AppBar(title: const Text('Kompas Jalur')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          if (_pesanSensor != null)
            AppCard(
              color: AppColors.emberLight,
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: AppColors.ember),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(_pesanSensor!,
                        style: const TextStyle(fontSize: 12.5, height: 1.4)),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 8),
          Center(
            child: SizedBox(
              height: 300,
              width: 300,
              child: heading == null
                  ? const Center(child: CircularProgressIndicator())
                  : CustomPaint(
                      painter: _PiringanKompas(
                        heading: heading,
                        sasaran: sasaran,
                        warnaSasaran: _kiblat ? AppColors.ember : AppColors.sky,
                      ),
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('${heading.round()}°',
                                style: const TextStyle(
                                    fontSize: 40, fontWeight: FontWeight.w800)),
                            Text(Navigasi.mataAngin(heading),
                                style: const TextStyle(
                                    fontSize: 14, color: AppColors.muted)),
                          ],
                        ),
                      ),
                    ),
            ),
          ),

          const SizedBox(height: 18),
          AppCard(
            child: Column(
              children: [
                Row(
                  children: [
                    Icon(Icons.explore_outlined, color: kualitas.warna),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Kalibrasi Sensor',
                              style: TextStyle(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 2),
                          Text(
                            _akurasi == null
                                ? 'Perangkat tidak melaporkan tingkat akurasi'
                                : 'Akurasi ${kualitas.label} · simpangan ±${_akurasi!.abs().round()}°',
                            style: TextStyle(fontSize: 12.5, color: kualitas.warna),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (kualitas.perluKalibrasi) ...[
                  const Divider(height: 22),
                  const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('∞', style: TextStyle(fontSize: 26, color: AppColors.ember)),
                      SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          'Gerakkan ponsel membentuk angka delapan di udara beberapa kali, '
                          'sambil memutar pergelangan tangan. Jauhkan dari carabiner, '
                          'headlamp, powerbank, dan benda logam lain.',
                          style: TextStyle(fontSize: 12.5, height: 1.5),
                        ),
                      ),
                    ],
                  ),
                ],
                const Divider(height: 22),
                const Text(
                  'Arah sudah dikoreksi ke utara sejati (deklinasi Jawa Barat +0,7°), '
                  'sehingga sejalan dengan peta jalur.',
                  style: TextStyle(fontSize: 11.5, color: AppColors.muted, height: 1.4),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Tunjuk Ke', style: TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(
                      selected: _kiblat,
                      onSelected: (v) => setState(() { _kiblat = v; if (v) _tujuan = null; }),
                      label: const Text('🕋 Kiblat'),
                      selectedColor: AppColors.emberLight,
                      backgroundColor: const Color(0xFFF1F5F9),
                    ),
                    ..._titik.map(
                      (t) => ChoiceChip(
                        selected: !_kiblat && _tujuan?.id == t.id,
                        onSelected: (v) => setState(() {
                          _kiblat = false;
                          _tujuan = v ? t : null;
                        }),
                        label: Text('${t.icon} ${t.name}'),
                        selectedColor: AppColors.mossLight,
                        backgroundColor: const Color(0xFFF1F5F9),
                      ),
                    ),
                  ],
                ),
                if (_posisi == null) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'Lokasi belum tersedia — penunjuk arah tujuan aktif setelah GPS terkunci.',
                    style: TextStyle(fontSize: 12, color: AppColors.muted),
                  ),
                ],
                if (sasaran != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: _kiblat ? AppColors.emberLight : AppColors.mossLight,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _kiblat ? 'Arah Kiblat' : 'Menuju ${_tujuan!.name}',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${sasaran.round()}° ${Navigasi.mataAngin(sasaran)}'
                          '${_jarakSasaran != null ? ' · ${_jarakSasaran!}' : ''}',
                          style: const TextStyle(fontSize: 12.5),
                        ),
                        if (heading != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            _petunjukPutar(Navigasi.selisihSudut(heading, sasaran)),
                            style: const TextStyle(
                                fontSize: 12.5, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _petunjukPutar(double selisih) {
    if (selisih.abs() < 5) return '✅ Anda sudah menghadap ke arah tujuan';
    final arah = selisih > 0 ? 'kanan' : 'kiri';
    return 'Putar ${selisih.abs().round()}° ke $arah';
  }
}

/// Piringan kompas: mawar arah berputar berlawanan dengan heading, jarum tetap.
class _PiringanKompas extends CustomPainter {
  _PiringanKompas({required this.heading, this.sasaran, required this.warnaSasaran});

  final double heading;
  final double? sasaran;
  final Color warnaSasaran;

  @override
  void paint(Canvas canvas, Size size) {
    final pusat = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2 - 8;

    canvas.drawCircle(pusat, r, Paint()..color = const Color(0xFFF1F5F9));
    canvas.drawCircle(
      pusat, r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = const Color(0xFFCBD5E1),
    );

    canvas.save();
    canvas.translate(pusat.dx, pusat.dy);
    canvas.rotate(-heading * math.pi / 180);

    // Garis skala tiap 15°, garis tebal tiap 45°.
    for (var d = 0; d < 360; d += 15) {
      final utama = d % 45 == 0;
      final p = Paint()
        ..color = utama ? AppColors.ink : const Color(0xFFCBD5E1)
        ..strokeWidth = utama ? 2 : 1;
      final a = (d - 90) * math.pi / 180;
      final luar = Offset(math.cos(a) * r, math.sin(a) * r);
      final dalam = Offset(math.cos(a) * (r - (utama ? 16 : 9)), math.sin(a) * (r - (utama ? 16 : 9)));
      canvas.drawLine(luar, dalam, p);
    }

    for (final entri in {0: 'U', 90: 'T', 180: 'S', 270: 'B'}.entries) {
      final a = (entri.key - 90) * math.pi / 180;
      final tp = TextPainter(
        text: TextSpan(
          text: entri.value,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: entri.key == 0 ? AppColors.danger : AppColors.ink,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final pos = Offset(math.cos(a) * (r - 34), math.sin(a) * (r - 34));
      tp.paint(canvas, pos - Offset(tp.width / 2, tp.height / 2));
    }

    // Penanda sasaran ikut berputar bersama mawar arah.
    if (sasaran != null) {
      final a = (sasaran! - 90) * math.pi / 180;
      final ujung = Offset(math.cos(a) * (r - 4), math.sin(a) * (r - 4));
      canvas.drawCircle(ujung, 9, Paint()..color = warnaSasaran);
      canvas.drawLine(
        Offset.zero, ujung,
        Paint()
          ..color = warnaSasaran.withOpacity(0.45)
          ..strokeWidth = 3,
      );
    }
    canvas.restore();

    // Jarum tetap menunjuk ke atas = arah yang sedang dihadapi pengguna.
    final jarum = Path()
      ..moveTo(pusat.dx, pusat.dy - r + 14)
      ..lineTo(pusat.dx - 9, pusat.dy + 8)
      ..lineTo(pusat.dx + 9, pusat.dy + 8)
      ..close();
    canvas.drawPath(jarum, Paint()..color = AppColors.danger);
  }

  @override
  bool shouldRepaint(_PiringanKompas old) =>
      old.heading != heading || old.sasaran != sasaran;
}
