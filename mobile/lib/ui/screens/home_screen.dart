import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../blocs/home/home_bloc.dart';
import '../../core/formatters.dart';
import '../../core/kisi.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../widgets/common.dart';
import '../widgets/lembar_tarik.dart';
import '../widgets/kartu_posisi.dart';
import '../widgets/wajib_masuk.dart';
import 'content_detail_screen.dart';
import 'epass_screen.dart';
import 'inbox_screen.dart';
import 'kompas_screen.dart';
import 'shalat_screen.dart';
import 'penginapan_screen.dart';
import 'sinyal_screen.dart';
import 'warung_screen.dart';
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
        // Digeser ke bawah hero: pada posisi bawaan, lingkaran indikator
        // muncul tepat menimpa judul dan terlihat seperti kerusakan.
        displacement: 120,
        color: AppColors.moss,
        backgroundColor: Colors.white,
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
                SliverToBoxAdapter(
                  child: _Hero(
                    name: user?.name.split(' ').first ?? 'Pendaki',
                    kondisi: state.kondisi,
                    cuaca: state.cuaca,
                  ),
                ),
                if (user == null) const SliverToBoxAdapter(child: SpandukTamu()),
                SliverToBoxAdapter(child: _AjakanBeliTiket(trails: state.trails)),
                if (state.activeBookings.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _ActiveBookingCard(booking: state.activeBookings.first),
                  ),
                SliverToBoxAdapter(child: _QuickActions(onOpenTab: onOpenTab)),
                const SliverToBoxAdapter(child: KartuPosisi()),
                if (state.cuaca != null)
                  SliverToBoxAdapter(child: _CuacaCard(cuaca: state.cuaca!)),
                if (state.capacity != null)
                  SliverToBoxAdapter(child: _CapacityCard(capacity: state.capacity!)),
                if (state.kondisi != null)
                  SliverToBoxAdapter(
                    child: _KondisiJalurSeksi(kondisi: state.kondisi!),
                  ),
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
                if (state.penginapan.isNotEmpty) ...[
                  const SliverToBoxAdapter(
                    child: SectionTitle('Menginap di Sekitar Basecamp'),
                  ),
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: 214,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        itemCount: state.penginapan.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 14),
                        itemBuilder: (_, i) =>
                            _KartuPenginapan(item: state.penginapan[i]),
                      ),
                    ),
                  ),
                ],
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

/// Hero beranda: bukan sekadar sapaan, tetapi ringkasan kondisi kawasan hari
/// ini — berapa pendaki yang benar-benar sedang di atas, dan sisa kuota.
class _Hero extends StatelessWidget {
  const _Hero({required this.name, this.kondisi, this.cuaca});
  final String name;
  final KondisiKawasan? kondisi;
  final CuacaKawasan? cuaca;

  @override
  Widget build(BuildContext context) {
    final k = kondisi;
    final kini = cuaca?.sekarang;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 58, 20, 22),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.mossDark, AppColors.moss],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(30),
          bottomRight: Radius.circular(30),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Halo, $name 👋',
                        style: const TextStyle(
                            color: Color(0xFFC2D8BD), fontSize: 13)),
                    const SizedBox(height: 3),
                    const FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text('Gunung Sembung',
                          maxLines: 1,
                          softWrap: false,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 27,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                            height: 1.1,
                          )),
                    ),
                    const SizedBox(height: 3),
                    const Text('Sanggabuana · Purwakarta',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: Color(0x99E0EBDD), fontSize: 11.5)),
                  ],
                ),
              ),
              if (kini != null) ...[
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(kini.lambang, style: const TextStyle(fontSize: 25)),
                    const SizedBox(height: 2),
                    Text('${kini.suhu}°C',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w800)),
                  ],
                ),
                const SizedBox(width: 8),
              ],
              _TombolKotakMasuk(),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.13),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                _Angka(
                  nilai: '${k?.totalPendakiAktif ?? 0}',
                  label: 'Sedang mendaki',
                  lambang: '🥾',
                ),
                _Pemisah(),
                _Angka(
                  nilai: '${k?.totalRombonganAktif ?? 0}',
                  label: 'Rombongan aktif',
                  lambang: '👥',
                ),
                _Pemisah(),
                _Angka(
                  nilai: k == null
                      ? '—'
                      : '${k.jalur.fold<int>(0, (a, j) => a + j.sisaKuotaHariIni)}',
                  label: 'Sisa kuota',
                  lambang: '🎫',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Pintasan kotak masuk. Untuk tamu, ketukan mengarah ke ajakan masuk.
class _TombolKotakMasuk extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withOpacity(0.13),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () async {
          if (!await wajibMasuk(context,
              alasan: 'Kotak masuk berisi kabar penanganan darurat dan '
                  'pengingat pendakian Anda.')) {
            return;
          }
          if (!context.mounted) return;
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const InboxScreen()),
          );
        },
        child: const Padding(
          padding: EdgeInsets.all(10),
          child: Icon(Icons.notifications_outlined,
              color: Colors.white, size: 22),
        ),
      ),
    );
  }
}

class _Angka extends StatelessWidget {
  const _Angka({required this.nilai, required this.label, required this.lambang});
  final String nilai;
  final String label;
  final String lambang;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          children: [
            Text(lambang, style: const TextStyle(fontSize: 17)),
            const SizedBox(height: 5),
            Text(nilai,
                style: const TextStyle(
                    color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800)),
            const SizedBox(height: 1),
            Text(label,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xB3E0EBDD), fontSize: 10.5)),
          ],
        ),
      );
}

class _Pemisah extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        height: 38,
        width: 1,
        color: Colors.white.withOpacity(0.16),
      );
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
  @override
  Widget build(BuildContext context) {
    // -1 berarti membuka layar tersendiri, bukan berpindah tab.
    final items = <(String, String, int, Widget?)>[
      ('🗺️', 'Peta', 1, null),
      ('🎟️', 'Trip', 2, null),
      ('🚨', 'SOS', 3, null),
      ('🧭', 'Kompas', -1, const KompasScreen()),
      ('🕌', 'Salat', -1, const ShalatScreen()),
      ('🍜', 'Makan', -1, const WarungScreen()),
      ('📶', 'Sinyal', -1, const SinyalScreen()),
      ('🏠', 'Menginap', -1, const PenginapanScreen()),
      ('👤', 'Profil', 4, null),
    ];

    Widget kartu((String, String, int, Widget?) item) => AppCard(
          padding: const EdgeInsets.symmetric(vertical: 14),
          onTap: () {
            if (item.$4 != null) {
              Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => item.$4!));
            } else {
              onOpenTab(item.$3);
            }
          },
          child: Column(
            children: [
              Text(item.$1, style: const TextStyle(fontSize: 23)),
              const SizedBox(height: 7),
              Text(
                item.$2,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        );

    // Pembagian baris dipusatkan di bagiPerBaris() yang sudah teruji, supaya
    // menambah atau mengurangi pintasan tidak lagi bisa melewati batas indeks.
    const perBaris = 3;
    final baris = bagiPerBaris(items, perBaris);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: Column(
        children: [
          for (var r = 0; r < baris.length; r++) ...[
            if (r > 0) const SizedBox(height: 10),
            Row(
              children: [
                for (var k = 0; k < perBaris; k++) ...[
                  if (k > 0) const SizedBox(width: 10),
                  // Sel kosong tetap memakai ruang agar kisi tidak melar.
                  Expanded(
                    child: k < baris[r].length
                        ? kartu(baris[r][k])
                        : const SizedBox.shrink(),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _CuacaCard extends StatelessWidget {
  const _CuacaCard({required this.cuaca});
  final CuacaKawasan cuaca;

  @override
  Widget build(BuildContext context) {
    final kini = cuaca.sekarang;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Cuaca Kawasan',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text('${cuaca.desa}, ${cuaca.kecamatan} · ${cuaca.sumber}',
                          style: const TextStyle(
                              fontSize: 11.5, color: AppColors.muted)),
                    ],
                  ),
                ),
                if (kini != null)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(kini.lambang, style: const TextStyle(fontSize: 28)),
                      Text('${kini.suhu}°C',
                          style: const TextStyle(
                              fontSize: 20, fontWeight: FontWeight.w800)),
                    ],
                  ),
              ],
            ),
            if (kini != null) ...[
              const SizedBox(height: 10),
              Text(
                '${kini.cuaca} · angin ${kini.anginKmJam.round()} km/j ${kini.arahAngin} · '
                'lembap ${kini.kelembapan}%',
                style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
              ),
            ],
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cuaca.aman
                    ? AppColors.mossLight
                    : AppColors.emberLight,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    cuaca.aman ? '✅ Aman didaki' : '⚠️ Perhatian pendakian',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 12.5,
                      color: cuaca.aman ? AppColors.mossDark : AppColors.ember,
                    ),
                  ),
                  const SizedBox(height: 6),
                  ...cuaca.peringatan.map(
                    (p) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text('• $p',
                          style: const TextStyle(fontSize: 12, height: 1.45)),
                    ),
                  ),
                ],
              ),
            ),
            if (cuaca.prakiraan.length > 1) ...[
              const SizedBox(height: 14),
              SizedBox(
                height: 74,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: cuaca.prakiraan.length.clamp(0, 8),
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final p = cuaca.prakiraan[i];
                    return Container(
                      width: 64,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        children: [
                          Text(p.jam,
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.muted)),
                          Text(p.lambang, style: const TextStyle(fontSize: 18)),
                          Text('${p.suhu}°',
                              style: const TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
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

/// Kondisi tiap jalur hari ini: status, pendaki yang sedang di atas, sisa
/// kuota, dan catatan terakhir jagawana — informasi yang menentukan apakah
/// seseorang jadi naik atau tidak.
/// Jalan masuk utama membeli tiket. Sebelumnya pemesanan hanya bisa ditemukan
/// lewat detail jalur, sehingga pengguna baru kebingungan harus mulai dari mana.
class _AjakanBeliTiket extends StatelessWidget {
  const _AjakanBeliTiket({required this.trails});
  final List<Trail> trails;

  @override
  Widget build(BuildContext context) {
    final terbuka = trails.where((t) => t.status != 'CLOSED').toList();

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: Material(
        borderRadius: BorderRadius.circular(20),
        color: AppColors.ember,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () {
            if (terbuka.isEmpty) {
              showSnack(context, 'Semua jalur sedang ditutup', error: true);
              return;
            }
            if (terbuka.length == 1) {
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => TrailDetailScreen(trail: terbuka.first),
              ));
              return;
            }
            // Lebih dari satu jalur: biarkan pendaki memilih dulu.
            lembarTarik<void>(
              context: context,
              judul: 'Beli Tiket Masuk',
              keterangan: 'Pilih jalur pendakian yang ingin Anda tempuh',
              isi: (ctx, _) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: terbuka
                    .map((t) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: AppCard(
                            color: const Color(0xFFF8FAFC),
                            onTap: () {
                              Navigator.of(ctx).pop();
                              Navigator.of(context).push(MaterialPageRoute(
                                builder: (_) => TrailDetailScreen(trail: t),
                              ));
                            },
                            child: Row(
                              children: [
                                NetImage(t.imageUrl,
                                    height: 46, width: 46, radius: 13),
                                const SizedBox(width: 13),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(t.name,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 14)),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${t.difficultyLabel} · ${t.distanceKm} km · '
                                        'kuota ${t.dailyQuota}/hari',
                                        style: const TextStyle(
                                            fontSize: 11.5, color: AppColors.muted),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right,
                                    color: AppColors.muted),
                              ],
                            ),
                          ),
                        ))
                    .toList(),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(17),
            child: Row(
              children: [
                Container(
                  height: 46,
                  width: 46,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.22),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: const Text('🎫', style: TextStyle(fontSize: 22)),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Beli Tiket Masuk',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 16)),
                      SizedBox(height: 3),
                      Text('Tiket, izin berkemah, sewa alat, pemandu, dan menginap '
                          'dalam satu pembayaran',
                          style: TextStyle(color: Colors.white, fontSize: 11.5, height: 1.35)),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward, color: Colors.white, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _KondisiJalurSeksi extends StatelessWidget {
  const _KondisiJalurSeksi({required this.kondisi});
  final KondisiKawasan kondisi;

  Color _warna(String status) => switch (status) {
        'OPEN' => AppColors.moss,
        'LIMITED' => AppColors.ember,
        _ => AppColors.danger,
      };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionTitle('Kondisi Jalur Hari Ini'),
        ...kondisi.jalur.map((j) {
          final warna = _warna(j.status);
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        height: 10,
                        width: 10,
                        decoration: BoxDecoration(
                          color: warna,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(color: warna.withOpacity(0.35), blurRadius: 7)
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(j.nama,
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 15)),
                      ),
                      Pill(j.labelStatus,
                          color: warna,
                          background: warna.withOpacity(0.12)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _Metrik(
                          nilai: '${j.pendakiAktif}',
                          label: 'sedang di atas',
                        ),
                      ),
                      Expanded(
                        child: _Metrik(
                          nilai: '${j.sisaKuotaHariIni}',
                          label: 'sisa kuota',
                        ),
                      ),
                      Expanded(
                        child: _Metrik(
                          nilai: '${j.okupansiPersen}%',
                          label: 'terisi',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      value: (j.okupansiPersen / 100).clamp(0, 1),
                      minHeight: 6,
                      backgroundColor: const Color(0xFFE2E8F0),
                      color: warna,
                    ),
                  ),
                  if (j.catatanKondisi != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('📋', style: TextStyle(fontSize: 14)),
                          const SizedBox(width: 9),
                          Expanded(
                            child: Text(
                              j.catatanKondisi!,
                              style: const TextStyle(
                                  fontSize: 12, height: 1.5, color: Colors.black87),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}

class _Metrik extends StatelessWidget {
  const _Metrik({required this.nilai, required this.label});
  final String nilai;
  final String label;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(nilai,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          Text(label,
              style: const TextStyle(fontSize: 11, color: AppColors.muted)),
        ],
      );
}

class _KartuPenginapan extends StatelessWidget {
  const _KartuPenginapan({required this.item});
  final Penginapan item;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 216,
      child: AppCard(
        padding: EdgeInsets.zero,
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => PenginapanScreen(sorot: item.id)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                NetImage(item.imageUrl, height: 104, width: 216, radius: 20),
                Positioned(
                  top: 10,
                  left: 10,
                  child: Pill('${item.lambang} ${item.labelJenis}',
                      background: Colors.white),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(13, 11, 13, 13),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 14)),
                  const SizedBox(height: 4),
                  Text(
                    '${item.capacity} orang'
                    '${item.distanceKm != null ? ' · ${item.distanceKm} km dari basecamp' : ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
                  ),
                  const SizedBox(height: 8),
                  Text('${rupiah(item.pricePerNight)} / malam',
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13.5,
                          color: AppColors.moss)),
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
