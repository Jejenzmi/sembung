import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Lembar bawah yang bisa ditutup dengan menariknya ke bawah, muncul dengan
/// animasi meluncur + memudar. Dipakai untuk seluruh formulir CRUD dan
/// konfirmasi supaya perilakunya seragam di seluruh aplikasi.
Future<T?> lembarTarik<T>({
  required BuildContext context,
  required String judul,
  required Widget Function(BuildContext, void Function(void Function())) isi,
  String? keterangan,
  bool bisaDitutup = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    isDismissible: bisaDitutup,
    enableDrag: bisaDitutup,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withOpacity(0.45),
    // Kurva ini membuat lembar terasa "mendarat", bukan berhenti mendadak.
    transitionAnimationController: null,
    builder: (ctx) => _BingkaiLembar(
      judul: judul,
      keterangan: keterangan,
      bisaDitutup: bisaDitutup,
      isi: isi,
    ),
  );
}

class _BingkaiLembar extends StatefulWidget {
  const _BingkaiLembar({
    required this.judul,
    required this.isi,
    this.keterangan,
    this.bisaDitutup = true,
  });

  final String judul;
  final String? keterangan;
  final bool bisaDitutup;
  final Widget Function(BuildContext, void Function(void Function())) isi;

  @override
  State<_BingkaiLembar> createState() => _BingkaiLembarState();
}

class _BingkaiLembarState extends State<_BingkaiLembar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _kontrol = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  )..forward();

  @override
  void dispose() {
    _kontrol.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tinggiMaks = MediaQuery.of(context).size.height * 0.92;
    final papanKetik = MediaQuery.of(context).viewInsets.bottom;

    return AnimatedBuilder(
      animation: _kontrol,
      builder: (context, anak) {
        final t = Curves.easeOutCubic.transform(_kontrol.value);
        return Opacity(
          opacity: t,
          child: Transform.translate(offset: Offset(0, (1 - t) * 40), child: anak),
        );
      },
      child: Container(
        constraints: BoxConstraints(maxHeight: tinggiMaks),
        margin: EdgeInsets.only(bottom: papanKetik),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Pegangan: penanda visual bahwa lembar ini bisa ditarik.
            Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 4),
              child: Container(
                height: 4.5,
                width: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 12, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.judul,
                            style: const TextStyle(
                                fontSize: 18, fontWeight: FontWeight.w800)),
                        if (widget.keterangan != null) ...[
                          const SizedBox(height: 3),
                          Text(widget.keterangan!,
                              style: const TextStyle(
                                  fontSize: 12.5, color: AppColors.muted)),
                        ],
                      ],
                    ),
                  ),
                  if (widget.bisaDitutup)
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      color: AppColors.muted,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                child: StatefulBuilder(
                  builder: (ctx, setSheetState) => widget.isi(ctx, setSheetState),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Konfirmasi tindakan (hapus, batalkan) dengan gaya dan animasi yang sama.
Future<bool> konfirmasi(
  BuildContext context, {
  required String judul,
  required String pesan,
  String tombolYa = 'Ya, lanjutkan',
  String tombolTidak = 'Batal',
  bool berbahaya = false,
}) async {
  final hasil = await lembarTarik<bool>(
    context: context,
    judul: judul,
    isi: (ctx, _) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(pesan, style: const TextStyle(fontSize: 14, height: 1.55)),
        const SizedBox(height: 22),
        FilledButton(
          style: berbahaya
              ? FilledButton.styleFrom(backgroundColor: AppColors.danger)
              : null,
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(tombolYa),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text(tombolTidak),
        ),
      ],
    ),
  );
  return hasil ?? false;
}
