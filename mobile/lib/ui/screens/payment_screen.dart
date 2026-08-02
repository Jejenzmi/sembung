import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../blocs/booking/booking_bloc.dart';
import '../../blocs/trips/trips_bloc.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../widgets/common.dart';
import 'epass_screen.dart';

const _methods = <(String, String, String)>[
  ('QRIS', '📱', 'Scan QRIS dari aplikasi bank atau e-wallet apa pun'),
  ('VA_BCA', '🏦', 'Transfer ke Virtual Account BCA'),
  ('VA_BNI', '🏦', 'Transfer ke Virtual Account BNI'),
  ('EWALLET', '👛', 'Bayar dengan saldo e-wallet'),
];

class PaymentScreen extends StatelessWidget {
  const PaymentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<BookingBloc, BookingState>(
      listenWhen: (a, b) => a.error != b.error && b.error != null,
      listener: (context, state) => showSnack(context, state.error!, error: true),
      builder: (context, state) {
        final booking = state.booking;
        if (booking == null) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }

        if (state.step == BookingStep.paid) {
          return _SuccessView(bookingId: booking.id, code: booking.code);
        }

        return Scaffold(
          appBar: AppBar(title: const Text('Pembayaran')),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
            children: [
              AppCard(
                color: AppColors.mossLight,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Kode Booking ${booking.code}',
                        style: const TextStyle(
                            fontSize: 12.5, color: AppColors.mossDark)),
                    const SizedBox(height: 6),
                    Text(rupiah(booking.total),
                        style: const TextStyle(
                            fontSize: 26, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text(
                      '${booking.trailName} · ${tanggal(booking.startDate)} · ${booking.totalPersons} orang',
                      style: const TextStyle(fontSize: 12.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              if (state.payment == null) ...[
                const Text('Pilih Metode Pembayaran',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                ..._methods.map(
                  (m) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AppCard(
                      onTap: state.busy
                          ? null
                          : () => context
                              .read<BookingBloc>()
                              .add(BookingPaymentRequested(m.$1)),
                      child: Row(
                        children: [
                          Text(m.$2, style: const TextStyle(fontSize: 24)),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(m.$1.replaceAll('_', ' '),
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                                const SizedBox(height: 3),
                                Text(m.$3,
                                    style: const TextStyle(
                                        fontSize: 12, color: AppColors.muted)),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right,
                              color: AppColors.muted),
                        ],
                      ),
                    ),
                  ),
                ),
              ] else
                _PaymentInstruction(state: state),
            ],
          ),
        );
      },
    );
  }
}

class _PaymentInstruction extends StatelessWidget {
  const _PaymentInstruction({required this.state});
  final BookingState state;

  @override
  Widget build(BuildContext context) {
    final payment = state.payment!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppCard(
          child: Column(
            children: [
              Text(payment.method.replaceAll('_', ' '),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 16),
              if (payment.qrisPayload != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: QrImageView(
                    data: payment.qrisPayload!,
                    size: 210,
                    padding: EdgeInsets.zero,
                  ),
                ),
              if (payment.vaNumber != null) ...[
                const Text('Nomor Virtual Account',
                    style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
                const SizedBox(height: 6),
                SelectableText(
                  payment.vaNumber!,
                  style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5),
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: payment.vaNumber!));
                    showSnack(context, 'Nomor VA disalin');
                  },
                  icon: const Icon(Icons.copy, size: 16),
                  label: const Text('Salin Nomor'),
                ),
              ],
              const SizedBox(height: 16),
              Text(rupiah(payment.amount),
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(
                payment.expiresAt == null
                    ? 'Selesaikan pembayaran sebelum kedaluwarsa'
                    : 'Berlaku sampai ${tanggalJam(payment.expiresAt!)}',
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
              const SizedBox(height: 8),
              SelectableText('Ref: ${payment.reference}',
                  style: const TextStyle(fontSize: 11, color: AppColors.muted)),
            ],
          ),
        ),
        const SizedBox(height: 18),
        // In production the gateway webhook flips this; the button lets the
        // demo (and manual counter payments) complete the same flow.
        FilledButton.icon(
          onPressed: state.busy
              ? null
              : () => context
                  .read<BookingBloc>()
                  .add(const BookingPaymentConfirmed()),
          icon: state.busy
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.verified_outlined),
          label: const Text('Saya Sudah Membayar'),
        ),
        const SizedBox(height: 10),
        const Text(
          'Status akan otomatis diperbarui setelah pembayaran terverifikasi oleh penyedia pembayaran.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: AppColors.muted, height: 1.5),
        ),
      ],
    );
  }
}

class _SuccessView extends StatelessWidget {
  const _SuccessView({required this.bookingId, required this.code});
  final String bookingId;
  final String code;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('🎉', style: TextStyle(fontSize: 64)),
              const SizedBox(height: 18),
              const Text('Pembayaran Berhasil',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(
                'E-Pass untuk booking $code sudah terbit. Tunjukkan QR di pos gerbang saat pendakian.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, height: 1.6),
              ),
              const SizedBox(height: 32),
              FilledButton(
                onPressed: () {
                  context.read<TripsBloc>().add(const TripsRefreshed());
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(
                      builder: (_) => EPassScreen(bookingId: bookingId),
                    ),
                  );
                },
                child: const Text('Lihat E-Pass'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () {
                  context.read<TripsBloc>().add(const TripsRefreshed());
                  Navigator.of(context).popUntil((r) => r.isFirst);
                },
                child: const Text('Kembali ke Beranda'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
