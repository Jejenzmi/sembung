import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../blocs/trips/trips_bloc.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../widgets/common.dart';
import '../widgets/lembar_tarik.dart';
import '../../core/pengingat.dart';
import 'epass_screen.dart';

class TripsScreen extends StatelessWidget {
  const TripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Perjalanan Saya'),
          bottom: const TabBar(
            labelColor: AppColors.moss,
            unselectedLabelColor: AppColors.muted,
            indicatorColor: AppColors.moss,
            labelStyle: TextStyle(fontWeight: FontWeight.w700),
            tabs: [Tab(text: 'Aktif'), Tab(text: 'Riwayat')],
          ),
        ),
        body: BlocConsumer<TripsBloc, TripsState>(
          listenWhen: (a, b) => a.notice != b.notice || a.error != b.error,
          listener: (context, state) {
            if (state.notice != null) showSnack(context, state.notice!);
            if (state.error != null) {
              showSnack(context, state.error!, error: true);
            }
          },
          builder: (context, state) {
            if (state.status == TripsStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.status == TripsStatus.failure) {
              return ErrorView(
                message: state.error ?? 'Gagal memuat perjalanan',
                onRetry: () =>
                    context.read<TripsBloc>().add(const TripsRefreshed()),
              );
            }
            // Jadwalkan pengingat H-1 untuk setiap pendakian yang akan datang.
            for (final b in state.upcoming) {
              if (b.status == 'PAID') {
                Pengingat.jadwalkanPendakian(
                  kodeBooking: b.code,
                  namaJalur: b.trailName,
                  tanggalMulai: b.startDate,
                );
              }
            }

            return TabBarView(
              children: [
                _List(bookings: state.upcoming, emptyText: 'Belum ada pendakian terjadwal'),
                _List(bookings: state.history, emptyText: 'Belum ada riwayat pendakian'),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _List extends StatelessWidget {
  const _List({required this.bookings, required this.emptyText});
  final List<Booking> bookings;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    if (bookings.isEmpty) return EmptyState(text: emptyText);
    return RefreshIndicator(
      onRefresh: () async {
        context.read<TripsBloc>().add(const TripsRefreshed());
        await context
            .read<TripsBloc>()
            .stream
            .firstWhere((s) => s.status != TripsStatus.loading);
      },
      child: ListView.separated(
        padding: const EdgeInsets.all(20),
        itemCount: bookings.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (_, i) => _TripCard(booking: bookings[i]),
      ),
    );
  }
}

class _TripCard extends StatelessWidget {
  const _TripCard({required this.booking});
  final Booking booking;

  Future<void> _confirmCancel(BuildContext context) async {
    final yes = await konfirmasi(
      context,
      judul: 'Batalkan booking?',
      pesan: 'Booking ${booking.code} akan dibatalkan dan alat sewa dikembalikan ke stok. '
          'Tindakan ini tidak dapat dibatalkan.'
          '${booking.status == 'PAID' ? '\n\nKarena booking ini sudah lunas, pengajuan pengembalian dana otomatis dibuat dan menunggu persetujuan pengelola.' : ''}',
      tombolYa: 'Ya, batalkan',
      tombolTidak: 'Tidak',
      berbahaya: true,
    );
    if (yes && context.mounted) {
      context.read<TripsBloc>().add(TripCancelled(booking.id));
    }
  }

  Future<void> _review(BuildContext context) async {
    var rating = 5;
    final comment = TextEditingController();
    final ok = await lembarTarik<bool>(
      context: context,
      judul: 'Beri Ulasan',
      keterangan: 'Pendakian ${booking.trailName}',
      isi: (ctx, setSheetState) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              5,
              (i) => IconButton(
                iconSize: 34,
                onPressed: () => setSheetState(() => rating = i + 1),
                icon: Icon(
                  i < rating ? Icons.star_rounded : Icons.star_border_rounded,
                  color: const Color(0xFFF59E0B),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: comment,
            maxLines: 3,
            decoration: const InputDecoration(
                hintText: 'Bagaimana pengalaman pendakian Anda?'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Kirim Ulasan'),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      context
          .read<TripsBloc>()
          .add(TripReviewed(booking.id, rating, comment.text.trim()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              NetImage(booking.trailImage, height: 52, width: 52, radius: 14),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(booking.trailName,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                    const SizedBox(height: 3),
                    Text(
                      '${booking.code} · ${booking.totalPersons} orang',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.muted),
                    ),
                  ],
                ),
              ),
              StatusChip(booking.status),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const Icon(Icons.calendar_today_outlined,
                  size: 15, color: AppColors.muted),
              const SizedBox(width: 6),
              Text(
                '${tanggal(booking.startDate)} → ${tanggal(booking.endDate)}',
                style: const TextStyle(fontSize: 12.5),
              ),
              const Spacer(),
              Text(rupiah(booking.total),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              if (booking.isActive)
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(42)),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => EPassScreen(bookingId: booking.id)),
                    ),
                    child: const Text('Lihat E-Pass'),
                  ),
                ),
              if (booking.status == 'PENDING_PAYMENT')
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(42)),
                    onPressed: () => _confirmCancel(context),
                    child: const Text('Batalkan'),
                  ),
                ),
              if (booking.status == 'COMPLETED')
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(42)),
                    onPressed: () => _review(context),
                    icon: const Icon(Icons.star_border, size: 18),
                    label: const Text('Beri Ulasan'),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
