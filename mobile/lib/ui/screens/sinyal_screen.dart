import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../widgets/common.dart';

/// Peta kuat sinyal seluler sepanjang jalur. Bukan sekadar kenyamanan: ini
/// menentukan di titik mana pendaki masih bisa mengabari keluarga, dan di mana
/// tombol SOS hanya akan mengantre sampai sinyal kembali.
class SinyalScreen extends StatefulWidget {
  const SinyalScreen({super.key, this.slug = 'pasanggrahan'});
  final String slug;

  @override
  State<SinyalScreen> createState() => _SinyalScreenState();
}

class _SinyalScreenState extends State<SinyalScreen> {
  PetaSinyal? _peta;
  bool _memuat = true;
  String? _galat;

  @override
  void initState() {
    super.initState();
    _muat();
  }

  Future<void> _muat() async {
    try {
      final data = await context.read<CatalogRepository>().sinyal(widget.slug);
      if (mounted) {
        setState(() {
          _peta = data;
          _memuat = false;
          _galat = data == null ? 'Data sinyal belum tersedia' : null;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _galat = e.toString(); _memuat = false; });
    }
  }

  static const _warna = {
    'BAIK': AppColors.moss,
    'SEDANG': Color(0xFF84B37A),
    'LEMAH': AppColors.ember,
    'KOSONG': Color(0xFFCBD5E1),
  };

  static const _batang = {'BAIK': 3, 'SEDANG': 2, 'LEMAH': 1, 'KOSONG': 0};

  @override
  Widget build(BuildContext context) {
    final peta = _peta;
    return Scaffold(
      appBar: AppBar(title: const Text('Sinyal Seluler')),
      body: _memuat
          ? const Center(child: CircularProgressIndicator())
          : peta == null
              ? ErrorView(message: _galat ?? 'Gagal memuat', onRetry: _muat)
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 30),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.emberLight,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Text('📶', style: TextStyle(fontSize: 20)),
                              SizedBox(width: 10),
                              Expanded(
                                child: Text('Sebelum kehilangan sinyal',
                                    style: TextStyle(
                                        fontWeight: FontWeight.w800, fontSize: 14)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            peta.titikTerakhirNama == null
                                ? 'Belum ada titik dengan sinyal terdata.'
                                : 'Kabari keluarga selagi masih di ${peta.titikTerakhirNama} '
                                  '(${peta.titikTerakhirElevasi} mdpl) — di atas itu sinyal '
                                  'terputus-putus. Unduh peta offline dan simpan jadwal salat '
                                  'sebelum berangkat.',
                            style: const TextStyle(fontSize: 12.5, height: 1.55),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        const Text('Kekuatan:',
                            style: TextStyle(
                                fontSize: 11.5, color: AppColors.muted)),
                        const SizedBox(width: 10),
                        ...['BAIK', 'SEDANG', 'LEMAH', 'KOSONG'].map(
                          (k) => Padding(
                            padding: const EdgeInsets.only(right: 10),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _Batang(kuat: k, kecil: true),
                                const SizedBox(width: 4),
                                Text(k[0] + k.substring(1).toLowerCase(),
                                    style: const TextStyle(
                                        fontSize: 10.5, color: AppColors.muted)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    AppCard(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              const SizedBox(width: 130),
                              ...peta.operator.map((o) => Expanded(
                                    child: Text(
                                      o.length > 6 ? o.substring(0, 5) : o,
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.muted,
                                      ),
                                    ),
                                  )),
                            ],
                          ),
                          const Divider(height: 16),
                          ...peta.titik.map((t) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Row(
                                  children: [
                                    SizedBox(
                                      width: 130,
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(t.nama,
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600,
                                                  height: 1.3)),
                                          Text('${t.elevasi} mdpl',
                                              style: const TextStyle(
                                                  fontSize: 10.5,
                                                  color: AppColors.muted)),
                                        ],
                                      ),
                                    ),
                                    ...peta.operator.map((o) => Expanded(
                                          child: Center(
                                            child: _Batang(
                                                kuat: t.operator[o] ?? 'KOSONG'),
                                          ),
                                        )),
                                  ],
                                ),
                              )),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Data dikumpulkan petugas di lapangan dan bisa berubah sewaktu-waktu '
                      'mengikuti cuaca serta kondisi menara pemancar. Jangan menjadikannya '
                      'satu-satunya andalan: tetap beri tahu rencana pendakian Anda kepada '
                      'orang di rumah sebelum berangkat.',
                      style: TextStyle(
                          fontSize: 11.5, color: AppColors.muted, height: 1.55),
                    ),
                  ],
                ),
    );
  }
}

/// Tiga batang bertingkat, lambang kuat sinyal yang langsung dikenali.
class _Batang extends StatelessWidget {
  const _Batang({required this.kuat, this.kecil = false});
  final String kuat;
  final bool kecil;

  @override
  Widget build(BuildContext context) {
    final aktif = _SinyalScreenState._batang[kuat] ?? 0;
    final warna = _SinyalScreenState._warna[kuat] ?? const Color(0xFFCBD5E1);
    final lebar = kecil ? 2.5 : 3.5;

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: List.generate(3, (i) {
        final tinggi = (kecil ? 5.0 : 7.0) + i * (kecil ? 2.5 : 4.0);
        return Container(
          margin: EdgeInsets.only(right: i < 2 ? 2 : 0),
          height: tinggi,
          width: lebar,
          decoration: BoxDecoration(
            color: i < aktif ? warna : const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(1.5),
          ),
        );
      }),
    );
  }
}
