import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../widgets/common.dart';

/// Full-screen boarding-pass style E-Pass, kept bright so the officer's
/// scanner can read it in daylight.
class EPassScreen extends StatefulWidget {
  const EPassScreen({super.key, required this.bookingId});
  final String bookingId;

  @override
  State<EPassScreen> createState() => _EPassScreenState();
}

class _EPassScreenState extends State<EPassScreen> {
  EPass? _pass;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final pass = await context.read<BookingRepository>().epass(widget.bookingId);
      if (mounted) setState(() => _pass = pass);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.mossDark,
      appBar: AppBar(
        title: const Text('E-Pass Pendakian',
            style: TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _error != null
          ? ErrorView(message: _error!, onRetry: _load)
          : _pass == null
              ? const Center(
                  child: CircularProgressIndicator(color: Colors.white))
              : SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(26),
                        ),
                        child: Column(
                          children: [
                            StatusChip(_pass!.status),
                            const SizedBox(height: 18),
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                    color: const Color(0xFFE2E8F0), width: 1.5),
                              ),
                              child: QrImageView(
                                data: _pass!.qrToken,
                                size: 220,
                                padding: EdgeInsets.zero,
                              ),
                            ),
                            const SizedBox(height: 16),
                            SelectableText(
                              _pass!.code,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Tunjukkan QR ini kepada petugas pos gerbang',
                              style: TextStyle(
                                  fontSize: 12, color: AppColors.muted),
                            ),
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 20),
                              child: Divider(),
                            ),
                            _row('Jalur', _pass!.trail),
                            _row('Ketua Rombongan', _pass!.leader),
                            _row('Jumlah Pendaki', '${_pass!.persons} orang'),
                            _row('Naik', tanggal(_pass!.startDate)),
                            _row('Rencana Turun', tanggal(_pass!.endDate)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Termasuk dalam E-Pass',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 12),
                            ..._pass!.items.map(
                              (i) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(
                                  children: [
                                    const Text('•',
                                        style: TextStyle(color: Colors.white70)),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        '${i.name} ×${i.qty}${i.days > 1 ? " · ${i.days} hari" : ""}',
                                        style: const TextStyle(
                                            color: Colors.white70,
                                            fontSize: 13),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 130,
              child: Text(label,
                  style:
                      const TextStyle(fontSize: 13, color: AppColors.muted)),
            ),
            Expanded(
              child: Text(value,
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      );
}
