import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../widgets/common.dart';

/// Kotak masuk pendaki: kabar penanganan darurat dan pemberitahuan pengelola.
class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  List<InboxItem> _items = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _muat();
  }

  Future<void> _muat() async {
    try {
      final hasil = await context.read<InboxRepository>().load();
      if (mounted) setState(() { _items = hasil.items; _loading = false; _error = null; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  Future<void> _tandaiSemua() async {
    await context.read<InboxRepository>().tandaiSemua();
    await _muat();
  }

  IconData _ikon(String? refType) => switch (refType) {
        'SOS' => Icons.sos,
        'BOOKING_OVERDUE' => Icons.schedule,
        _ => Icons.notifications_outlined,
      };

  @override
  Widget build(BuildContext context) {
    final belumDibaca = _items.where((i) => i.belumDibaca).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kotak Masuk'),
        actions: [
          if (belumDibaca > 0)
            TextButton(onPressed: _tandaiSemua, child: const Text('Tandai semua')),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorView(message: _error!, onRetry: _muat)
              : _items.isEmpty
                  ? const EmptyState(
                      emoji: '📭',
                      text: 'Belum ada pemberitahuan.\nKabar penanganan darurat akan muncul di sini.',
                    )
                  : RefreshIndicator(
                      onRefresh: _muat,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(20),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) {
                          final item = _items[i];
                          return AppCard(
                            color: item.belumDibaca ? AppColors.mossLight : Colors.white,
                            onTap: item.belumDibaca
                                ? () async {
                                    await context.read<InboxRepository>().tandaiDibaca(item.id);
                                    await _muat();
                                  }
                                : null,
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  height: 40,
                                  width: 40,
                                  decoration: BoxDecoration(
                                    color: item.belumDibaca ? Colors.white : AppColors.mossLight,
                                    borderRadius: BorderRadius.circular(13),
                                  ),
                                  alignment: Alignment.center,
                                  child: Icon(_ikon(item.refType),
                                      size: 20, color: AppColors.moss),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              item.subject,
                                              style: TextStyle(
                                                fontWeight: item.belumDibaca
                                                    ? FontWeight.w800
                                                    : FontWeight.w600,
                                                fontSize: 14.5,
                                              ),
                                            ),
                                          ),
                                          if (item.belumDibaca)
                                            Container(
                                              height: 8,
                                              width: 8,
                                              decoration: const BoxDecoration(
                                                color: AppColors.ember,
                                                shape: BoxShape.circle,
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 5),
                                      Text(item.body,
                                          style: const TextStyle(
                                              fontSize: 13, height: 1.5)),
                                      const SizedBox(height: 6),
                                      Text(tanggalJam(item.createdAt),
                                          style: const TextStyle(
                                              fontSize: 11.5, color: AppColors.muted)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
