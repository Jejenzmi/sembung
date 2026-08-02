import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/navigasi.dart';
import '../../core/theme.dart';
import 'common.dart';

/// Menampilkan posisi pengguna saat ini beserta jarak dan arah ke puncak.
/// Lokasi diambil sekali saat diminta — tidak ada pelacakan berjalan di latar,
/// sehingga tidak membebani baterai.
class KartuPosisi extends StatefulWidget {
  const KartuPosisi({super.key});

  @override
  State<KartuPosisi> createState() => _KartuPosisiState();
}

class _KartuPosisiState extends State<KartuPosisi> {
  static const _puncakLat = -6.5489;
  static const _puncakLng = 107.3798;
  static const _basecampLat = -6.5312;
  static const _basecampLng = 107.3585;

  Position? _posisi;
  bool _memuat = false;
  String? _pesan;

  Future<void> _ambil() async {
    setState(() { _memuat = true; _pesan = null; });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        setState(() { _memuat = false; _pesan = 'Layanan lokasi perangkat belum aktif'; });
        return;
      }
      var izin = await Geolocator.checkPermission();
      if (izin == LocationPermission.denied) izin = await Geolocator.requestPermission();
      if (izin == LocationPermission.denied || izin == LocationPermission.deniedForever) {
        setState(() { _memuat = false; _pesan = 'Izin lokasi belum diberikan'; });
        return;
      }
      final p = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 15),
      );
      if (mounted) setState(() { _posisi = p; _memuat = false; });
    } catch (_) {
      if (mounted) {
        setState(() {
          _memuat = false;
          _pesan = 'GPS belum mengunci. Cari tempat terbuka lalu coba lagi.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _posisi;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.my_location, size: 19, color: AppColors.sky),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text('Posisi Saya Sekarang',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
                ),
                TextButton(
                  onPressed: _memuat ? null : _ambil,
                  child: Text(_memuat
                      ? 'Mencari…'
                      : p == null
                          ? 'Cek posisi'
                          : 'Perbarui'),
                ),
              ],
            ),
            if (p == null) ...[
              const SizedBox(height: 2),
              Text(
                _pesan ??
                    'Ketuk "Cek posisi" untuk melihat koordinat, ketinggian, '
                        'dan jarak Anda ke puncak.',
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.5,
                  color: _pesan == null ? AppColors.muted : AppColors.ember,
                ),
              ),
            ] else ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _Nilai(
                      label: 'Ketinggian',
                      nilai: '${p.altitude.round()} m',
                    ),
                  ),
                  Expanded(
                    child: _Nilai(
                      label: 'Akurasi',
                      nilai: '±${p.accuracy.round()} m',
                    ),
                  ),
                  Expanded(
                    child: _Nilai(
                      label: 'Ke puncak',
                      nilai: Navigasi.jarakTerbaca(Navigasi.jarakMeter(
                          p.latitude, p.longitude, _puncakLat, _puncakLng)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SelectableText(
                      '${p.latitude.toStringAsFixed(6)}, ${p.longitude.toStringAsFixed(6)}',
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Arah puncak ${Navigasi.bearing(p.latitude, p.longitude, _puncakLat, _puncakLng).round()}° '
                      '${Navigasi.mataAngin(Navigasi.bearing(p.latitude, p.longitude, _puncakLat, _puncakLng))} · '
                      'basecamp ${Navigasi.jarakTerbaca(Navigasi.jarakMeter(p.latitude, p.longitude, _basecampLat, _basecampLng))}',
                      style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Koordinat ini bisa disalin dan dikirim ke tim SAR bila diperlukan.',
                style: TextStyle(fontSize: 11, color: AppColors.muted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Nilai extends StatelessWidget {
  const _Nilai({required this.label, required this.nilai});
  final String label;
  final String nilai;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(nilai,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          Text(label,
              style: const TextStyle(fontSize: 11, color: AppColors.muted)),
        ],
      );
}
