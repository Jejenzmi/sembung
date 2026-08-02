import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../widgets/common.dart';

/// Daftar penginapan di sekitar basecamp. Pemesanannya menyatu dengan E-Pass
/// supaya pendaki tidak perlu dua kali bayar dan dua kali bukti.
class PenginapanScreen extends StatefulWidget {
  const PenginapanScreen({super.key, this.sorot});
  final String? sorot;

  @override
  State<PenginapanScreen> createState() => _PenginapanScreenState();
}

class _PenginapanScreenState extends State<PenginapanScreen> {
  List<Penginapan> _semua = const [];
  String _saring = 'SEMUA';
  bool _memuat = true;
  String? _galat;

  static const _jenis = [
    ('SEMUA', 'Semua'),
    ('HOMESTAY', '🏠 Homestay'),
    ('GLAMPING', '⛺ Glamping'),
    ('VILLA', '🏡 Vila'),
    ('CAMPGROUND', '🏕️ Lahan Kemah'),
  ];

  @override
  void initState() {
    super.initState();
    _muat();
  }

  Future<void> _muat() async {
    try {
      final data = await context.read<CatalogRepository>().penginapan();
      if (mounted) setState(() { _semua = data; _memuat = false; });
    } catch (e) {
      if (mounted) setState(() { _galat = e.toString(); _memuat = false; });
    }
  }

  List<Penginapan> get _tersaring {
    final list = _saring == 'SEMUA'
        ? [..._semua]
        : _semua.where((p) => p.type == _saring).toList();
    // Yang dipilih dari beranda diletakkan paling atas.
    if (widget.sorot != null) {
      final i = list.indexWhere((p) => p.id == widget.sorot);
      if (i > 0) list.insert(0, list.removeAt(i));
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Menginap di Sembung')),
      body: _memuat
          ? const Center(child: CircularProgressIndicator())
          : _galat != null
              ? ErrorView(message: _galat!, onRetry: _muat)
              : Column(
                  children: [
                    SizedBox(
                      height: 46,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        itemCount: _jenis.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final (kode, label) = _jenis[i];
                          return ChoiceChip(
                            selected: _saring == kode,
                            onSelected: (_) => setState(() => _saring = kode),
                            label: Text(label),
                            selectedColor: AppColors.mossLight,
                            backgroundColor: const Color(0xFFF1F5F9),
                            labelStyle: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 12.5,
                              color: _saring == kode
                                  ? AppColors.mossDark
                                  : Colors.black87,
                            ),
                          );
                        },
                      ),
                    ),
                    Expanded(
                      child: _tersaring.isEmpty
                          ? const EmptyState(
                              emoji: '🏠',
                              text: 'Belum ada penginapan pada kategori ini')
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(20, 10, 20, 28),
                              itemCount: _tersaring.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 14),
                              itemBuilder: (_, i) => _Kartu(item: _tersaring[i]),
                            ),
                    ),
                  ],
                ),
    );
  }
}

class _Kartu extends StatelessWidget {
  const _Kartu({required this.item});
  final Penginapan item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              NetImage(item.imageUrl, height: 158, width: double.infinity, radius: 20),
              Positioned(
                top: 12,
                left: 12,
                child: Pill('${item.lambang} ${item.labelJenis}',
                    background: Colors.white),
              ),
              Positioned(
                top: 12,
                right: 12,
                child: Pill('⭐ ${item.rating}',
                    background: Colors.white,
                    color: const Color(0xFFB45309)),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 16.5)),
                const SizedBox(height: 5),
                Text(
                  '${item.capacity} orang per unit · ${item.units} unit tersedia'
                  '${item.distanceKm != null ? ' · ${item.distanceKm} km dari basecamp' : ''}',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
                if (item.description != null) ...[
                  const SizedBox(height: 9),
                  Text(item.description!,
                      style: const TextStyle(fontSize: 13, height: 1.55)),
                ],
                if (item.facilities.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: item.facilities
                        .map((f) => Pill(f,
                            background: const Color(0xFFF1F5F9),
                            color: AppColors.muted))
                        .toList(),
                  ),
                ],
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(rupiah(item.pricePerNight),
                              style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.moss)),
                          const Text('per malam',
                              style: TextStyle(
                                  fontSize: 11, color: AppColors.muted)),
                        ],
                      ),
                    ),
                    if (item.phone != null)
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 42),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                        ),
                        onPressed: () =>
                            launchUrl(Uri.parse('tel:${item.phone}')),
                        icon: const Icon(Icons.call, size: 17),
                        label: const Text('Hubungi'),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(11),
                  decoration: BoxDecoration(
                    color: AppColors.mossLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    '💡 Tambahkan penginapan ini saat memesan E-Pass agar tiket, '
                    'sewa alat, dan menginap tergabung dalam satu pembayaran.',
                    style: TextStyle(fontSize: 11.5, height: 1.5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
