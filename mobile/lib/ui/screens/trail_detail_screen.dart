import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../blocs/booking/booking_bloc.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../widgets/common.dart';
import 'booking_screen.dart';
import 'map_screen.dart';

class TrailDetailScreen extends StatefulWidget {
  const TrailDetailScreen({super.key, required this.trail});
  final Trail trail;

  @override
  State<TrailDetailScreen> createState() => _TrailDetailScreenState();
}

class _TrailDetailScreenState extends State<TrailDetailScreen> {
  Trail? _full;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  /// The list payload lacks trail points, so the detail view fetches the full
  /// record while already showing what it has.
  Future<void> _loadDetail() async {
    try {
      final full = await context.read<CatalogRepository>().trail(widget.trail.slug);
      if (mounted) setState(() => _full = full);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  void _startBooking() {
    final user = context.read<AuthBloc>().state.user;
    if (user == null) return;
    final trail = _full ?? widget.trail;
    if (trail.status == 'CLOSED') {
      showSnack(context, 'Jalur sedang ditutup untuk pendakian', error: true);
      return;
    }
    context.read<BookingBloc>().add(BookingDraftStarted(trail, user));
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const BookingScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final trail = _full ?? widget.trail;
    final points = trail.points;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 240,
            pinned: true,
            backgroundColor: AppColors.mossDark,
            iconTheme: const IconThemeData(color: Colors.white),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  NetImage(trail.imageUrl),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Color(0xCC274224)],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: 18,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          trail.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Pill(trail.difficultyLabel,
                                background: Colors.white),
                            const SizedBox(width: 6),
                            Pill(
                              trail.statusLabel,
                              background: Colors.white,
                              color: trail.status == 'OPEN'
                                  ? AppColors.moss
                                  : AppColors.ember,
                            ),
                            const SizedBox(width: 6),
                            Pill('⭐ ${trail.rating}',
                                background: Colors.white,
                                color: const Color(0xFFB45309)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _Stat(label: 'Jarak', value: '${trail.distanceKm} km'),
                      _Stat(label: 'Puncak', value: '${trail.summitElevM} m'),
                      _Stat(
                          label: 'Tanjakan', value: '${trail.elevationGainM} m'),
                      _Stat(label: 'Estimasi', value: '${trail.estimatedHours} j'),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text(
                    trail.description ?? '',
                    style: const TextStyle(height: 1.6, color: Colors.black87),
                  ),
                  const SizedBox(height: 20),
                  OutlinedButton.icon(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => MapScreen(slug: trail.slug),
                      ),
                    ),
                    icon: const Icon(Icons.map_outlined),
                    label: const Text('Buka Peta Jalur & Unduh Offline'),
                  ),
                  const SizedBox(height: 26),
                  const Text('Titik Sepanjang Jalur',
                      style: TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  if (_error != null)
                    Text(_error!,
                        style: const TextStyle(color: AppColors.danger)),
                  if (points.isEmpty && _error == null)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  ...points.map((p) => _PointTile(point: p)),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(
            20, 12, 20, 12 + MediaQuery.of(context).padding.bottom),
        decoration: const BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12)],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Kuota harian',
                      style: TextStyle(fontSize: 11.5, color: AppColors.muted)),
                  Text('${trail.dailyQuota} orang/hari',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ],
              ),
            ),
            SizedBox(
              width: 190,
              child: FilledButton(
                onPressed: trail.status == 'CLOSED' ? null : _startBooking,
                child: Text(trail.status == 'CLOSED'
                    ? 'Jalur Ditutup'
                    : 'Pesan Tiket & Simaksi'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Text(value,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 14.5)),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ],
        ),
      ),
    );
  }
}

class _PointTile extends StatelessWidget {
  const _PointTile({required this.point});
  final TrailPoint point;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                height: 38,
                width: 38,
                decoration: BoxDecoration(
                  color: AppColors.mossLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Text(point.icon, style: const TextStyle(fontSize: 18)),
              ),
              Container(width: 2, height: 24, color: const Color(0xFFE2E8F0)),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(point.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14.5)),
                    ),
                    Text('${point.elevationM} mdpl',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.muted)),
                  ],
                ),
                const SizedBox(height: 3),
                Text(point.typeLabel,
                    style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.moss,
                        fontWeight: FontWeight.w600)),
                if (point.description != null) ...[
                  const SizedBox(height: 4),
                  Text(point.description!,
                      style: const TextStyle(
                          fontSize: 12.5, color: Colors.black54, height: 1.5)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
