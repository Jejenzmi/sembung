import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../blocs/home/home_bloc.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../widgets/common.dart';
import 'content_detail_screen.dart';
import 'epass_screen.dart';
import 'trail_detail_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.onOpenTab});

  /// Lets the home shortcuts jump to the Map / Trips / SOS tabs.
  final void Function(int index) onOpenTab;

  @override
  Widget build(BuildContext context) {
    final user = context.select((AuthBloc b) => b.state.user);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          context.read<HomeBloc>().add(const HomeRefreshed());
          await context.read<HomeBloc>().stream.firstWhere(
              (s) => s.status != HomeStatus.loading);
        },
        child: BlocBuilder<HomeBloc, HomeState>(
          builder: (context, state) {
            if (state.status == HomeStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.status == HomeStatus.failure) {
              return ListView(
                children: [
                  const SizedBox(height: 120),
                  ErrorView(
                    message: state.error ?? 'Gagal memuat data',
                    onRetry: () =>
                        context.read<HomeBloc>().add(const HomeRefreshed()),
                  ),
                ],
              );
            }

            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(child: _Header(name: user?.name ?? 'Pendaki')),
                if (state.activeBookings.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _ActiveBookingCard(booking: state.activeBookings.first),
                  ),
                SliverToBoxAdapter(child: _QuickActions(onOpenTab: onOpenTab)),
                if (state.capacity != null)
                  SliverToBoxAdapter(child: _CapacityCard(capacity: state.capacity!)),
                const SliverToBoxAdapter(
                  child: SectionTitle('Jalur Pendakian'),
                ),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 232,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: state.trails.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 14),
                      itemBuilder: (_, i) => _TrailCard(trail: state.trails[i]),
                    ),
                  ),
                ),
                const SliverToBoxAdapter(
                  child: SectionTitle('Informasi & Sejarah Lokal'),
                ),
                SliverList.separated(
                  itemCount: state.contents.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: _ContentCard(item: state.contents[i]),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 60, 20, 26),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.mossDark, AppColors.moss],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Selamat datang di',
                  style: TextStyle(color: Color(0xFFC2D8BD), fontSize: 13),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Gunung Sembung',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Halo, $name 👋',
                  style: const TextStyle(color: Color(0xFFE0EBDD), fontSize: 13.5),
                ),
              ],
            ),
          ),
          const Text('🏔️', style: TextStyle(fontSize: 40)),
        ],
      ),
    );
  }
}

class _ActiveBookingCard extends StatelessWidget {
  const _ActiveBookingCard({required this.booking});
  final Booking booking;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: AppCard(
        color: booking.status == 'PENDING_PAYMENT'
            ? const Color(0xFFFEF3C7)
            : AppColors.mossLight,
        onTap: booking.status == 'PENDING_PAYMENT'
            ? null
            : () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => EPassScreen(bookingId: booking.id),
                  ),
                ),
        child: Row(
          children: [
            Container(
              height: 46,
              width: 46,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              alignment: Alignment.center,
              child: Text(
                booking.status == 'PENDING_PAYMENT' ? '⏳' : '🎫',
                style: const TextStyle(fontSize: 22),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    booking.statusLabel,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 14.5),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${booking.trailName} · ${relatif(booking.startDate)} · ${booking.totalPersons} orang',
                    style: const TextStyle(fontSize: 12.5, color: Colors.black87),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.mossDark),
          ],
        ),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.onOpenTab});
  final void Function(int) onOpenTab;

  @override
  Widget build(BuildContext context) {
    final items = [
      ('🗺️', 'Peta Offline', 1),
      ('🎟️', 'Perjalanan', 2),
      ('🚨', 'Tombol SOS', 3),
      ('👤', 'Profil', 4),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: Row(
        children: items
            .map(
              (item) => Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 5),
                  child: AppCard(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    onTap: () => onOpenTab(item.$3),
                    child: Column(
                      children: [
                        Text(item.$1, style: const TextStyle(fontSize: 24)),
                        const SizedBox(height: 8),
                        Text(
                          item.$2,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              fontSize: 11.5, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _CapacityCard extends StatelessWidget {
  const _CapacityCard({required this.capacity});
  final Capacity capacity;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('Kepadatan Saat Ini',
                    style: TextStyle(fontWeight: FontWeight.w800)),
                const Spacer(),
                Pill('${capacity.totalPersons} pendaki di atas',
                    icon: Icons.groups_outlined),
              ],
            ),
            const SizedBox(height: 14),
            ...capacity.trails.map(
              (t) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(t.trailName,
                              style: const TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w600)),
                        ),
                        Text(
                          '${t.persons}/${t.quota}',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.muted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: (t.utilization / 100).clamp(0, 1),
                        minHeight: 7,
                        backgroundColor: const Color(0xFFE2E8F0),
                        color: t.utilization > 85
                            ? AppColors.danger
                            : t.utilization > 60
                                ? AppColors.ember
                                : AppColors.moss,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TrailCard extends StatelessWidget {
  const _TrailCard({required this.trail});
  final Trail trail;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 250,
      child: AppCard(
        padding: EdgeInsets.zero,
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => TrailDetailScreen(trail: trail)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                NetImage(trail.imageUrl, height: 110, width: 250, radius: 20),
                Positioned(
                  top: 10,
                  left: 10,
                  child: Pill(
                    trail.statusLabel,
                    color: trail.status == 'OPEN'
                        ? AppColors.moss
                        : trail.status == 'LIMITED'
                            ? const Color(0xFFB45309)
                            : AppColors.danger,
                    background: Colors.white,
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    trail.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${trail.distanceKm} km · ${trail.summitElevM} mdpl · ${trail.estimatedHours} jam',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Pill(trail.difficultyLabel),
                      const SizedBox(width: 6),
                      Pill('⭐ ${trail.rating}',
                          background: const Color(0xFFFEF3C7),
                          color: const Color(0xFFB45309)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ContentCard extends StatelessWidget {
  const _ContentCard({required this.item});
  final ContentItem item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ContentDetailScreen(item: item)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NetImage(item.imageUrl, height: 66, width: 66, radius: 14),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Pill('${item.categoryIcon} ${item.categoryLabel}'),
                const SizedBox(height: 6),
                Text(
                  item.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 14, height: 1.3),
                ),
                const SizedBox(height: 4),
                Text(
                  item.excerpt ?? '',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
