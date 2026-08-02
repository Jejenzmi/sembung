import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../widgets/common.dart';

/// Warung dan tempat makan di area basecamp. Menu bertanda "pra-pesan" dapat
/// dipesan lebih dulu bersama E-Pass; sisanya dibeli langsung di tempat.
class WarungScreen extends StatefulWidget {
  const WarungScreen({super.key});

  @override
  State<WarungScreen> createState() => _WarungScreenState();
}

class _WarungScreenState extends State<WarungScreen> {
  List<Warung> _daftar = const [];
  bool _memuat = true;
  String? _galat;

  @override
  void initState() {
    super.initState();
    _muat();
  }

  Future<void> _muat() async {
    try {
      final data = await context.read<CatalogRepository>().warung();
      if (mounted) setState(() { _daftar = data; _memuat = false; });
    } catch (e) {
      if (mounted) setState(() { _galat = e.toString(); _memuat = false; });
    }
  }

  Future<void> _pesanWa(Warung w) async {
    final nomor = w.whatsapp ?? w.phone;
    if (nomor == null) return;
    final pesan = Uri.encodeComponent(
      'Halo ${w.name}, saya pendaki Gunung Sembung. Saya ingin memesan makanan.',
    );
    final wa = Uri.parse('https://wa.me/$nomor?text=$pesan');
    if (!await launchUrl(wa, mode: LaunchMode.externalApplication)) {
      if (mounted) showSnack(context, 'WhatsApp tidak dapat dibuka', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Makan & Minum')),
      body: _memuat
          ? const Center(child: CircularProgressIndicator())
          : _galat != null
              ? ErrorView(message: _galat!, onRetry: _muat)
              : _daftar.isEmpty
                  ? const EmptyState(
                      emoji: '🍜', text: 'Belum ada warung terdaftar di area ini')
                  : RefreshIndicator(
                      onRefresh: _muat,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 30),
                        children: [
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.mossLight,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('🍽️', style: TextStyle(fontSize: 22)),
                                SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'Menu bertanda "Bisa pra-pesan" dapat ditambahkan saat '
                                    'memesan E-Pass, sehingga porsinya sudah siap begitu '
                                    'Anda tiba. Menu lain dibeli langsung di warung.',
                                    style: TextStyle(fontSize: 12.5, height: 1.5),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          ..._daftar.map((w) => Padding(
                                padding: const EdgeInsets.only(bottom: 16),
                                child: _KartuWarung(warung: w, onPesan: () => _pesanWa(w)),
                              )),
                        ],
                      ),
                    ),
    );
  }
}

class _KartuWarung extends StatelessWidget {
  const _KartuWarung({required this.warung, required this.onPesan});
  final Warung warung;
  final VoidCallback onPesan;

  @override
  Widget build(BuildContext context) {
    final perKategori = <String, List<MenuWarung>>{};
    for (final m in warung.menu) {
      perKategori.putIfAbsent(m.category, () => []).add(m);
    }

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              NetImage(warung.imageUrl, height: 140, width: double.infinity, radius: 20),
              Positioned(
                top: 12,
                left: 12,
                child: Pill('⭐ ${warung.rating}',
                    background: Colors.white, color: const Color(0xFFB45309)),
              ),
              if (warung.distanceKm != null)
                Positioned(
                  top: 12,
                  right: 12,
                  child: Pill('${warung.distanceKm} km', background: Colors.white),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(warung.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 16.5)),
                if (warung.jamBuka != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.schedule,
                          size: 14, color: AppColors.muted),
                      const SizedBox(width: 5),
                      Text(warung.jamBuka!,
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.muted)),
                    ],
                  ),
                ],
                if (warung.description != null) ...[
                  const SizedBox(height: 9),
                  Text(warung.description!,
                      style: const TextStyle(fontSize: 13, height: 1.55)),
                ],
                const SizedBox(height: 14),
                ...perKategori.entries.map((k) => Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(k.key.toUpperCase(),
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.6,
                              color: AppColors.muted,
                            )),
                        const SizedBox(height: 7),
                        ...k.value.map((m) => Padding(
                              padding: const EdgeInsets.only(bottom: 9),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Flexible(
                                              child: Text(m.name,
                                                  style: const TextStyle(
                                                      fontSize: 13.5,
                                                      fontWeight: FontWeight.w600)),
                                            ),
                                            if (m.bisaPraPesan) ...[
                                              const SizedBox(width: 7),
                                              const Pill('Bisa pra-pesan',
                                                  color: AppColors.moss,
                                                  background: AppColors.mossLight),
                                            ],
                                          ],
                                        ),
                                        if (m.description != null)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 2),
                                            child: Text(m.description!,
                                                style: const TextStyle(
                                                    fontSize: 11.5,
                                                    color: AppColors.muted,
                                                    height: 1.4)),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(rupiah(m.price),
                                      style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w800)),
                                ],
                              ),
                            )),
                        const SizedBox(height: 6),
                      ],
                    )),
                if (warung.whatsapp != null || warung.phone != null)
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: onPesan,
                      icon: const Icon(Icons.chat_outlined, size: 18),
                      label: const Text('Pesan lewat WhatsApp'),
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
