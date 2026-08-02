import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../blocs/booking/booking_bloc.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../widgets/common.dart';
import '../widgets/lembar_tarik.dart';
import 'payment_screen.dart';

class BookingScreen extends StatelessWidget {
  const BookingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<BookingBloc, BookingState>(
      listenWhen: (a, b) =>
          (a.error != b.error && b.error != null) || a.step != b.step,
      listener: (context, state) {
        if (state.error != null) showSnack(context, state.error!, error: true);
        if (state.step == BookingStep.created) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const PaymentScreen()),
          );
        }
      },
      builder: (context, state) {
        if (state.loading || state.trail == null) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final quote = state.quoteResult;
        final quotaLeft = state.remainingQuota;
        final quotaShort = quotaLeft != null && quotaLeft < state.persons;

        return Scaffold(
          appBar: AppBar(title: Text('Pesan · ${state.trail!.name}')),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
            children: [
              const _StepLabel('1', 'Tanggal Pendakian'),
              const _DateSection(),
              if (quotaLeft != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Row(
                    children: [
                      Icon(
                        quotaShort ? Icons.error_outline : Icons.check_circle_outline,
                        size: 16,
                        color: quotaShort ? AppColors.danger : AppColors.moss,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          quotaShort
                              ? 'Kuota tersisa $quotaLeft orang — kurangi anggota atau pilih tanggal lain'
                              : 'Kuota tersisa $quotaLeft orang pada tanggal ini',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: quotaShort ? AppColors.danger : AppColors.muted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              const _StepLabel('2', 'Anggota Rombongan'),
              const _MembersSection(),
              const _StepLabel('3', 'Tiket & Retribusi'),
              const _TicketsSection(),
              const _StepLabel('4', 'Sewa Alat (opsional)'),
              const _RentalsSection(),
              const _StepLabel('5', 'Pemandu & Porter (opsional)'),
              const _GuidesSection(),
              const _StepLabel('6', 'Menginap (opsional)'),
              const _PenginapanSection(),
              const _StepLabel('7', 'Kode Voucher'),
              const _VoucherSection(),
              if (quote != null) ...[
                const _StepLabel('8', 'Ringkasan Biaya'),
                _SummarySection(quote: quote),
              ],
            ],
          ),
          bottomNavigationBar: Container(
            padding: EdgeInsets.fromLTRB(
                20, 14, 20, 14 + MediaQuery.of(context).padding.bottom),
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
                      const Text('Total bayar',
                          style:
                              TextStyle(fontSize: 11.5, color: AppColors.muted)),
                      Text(
                        quote == null ? '—' : rupiah(quote.total),
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 18),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  width: 180,
                  child: FilledButton(
                    onPressed: (quote == null || state.busy || quotaShort)
                        ? null
                        : () => context
                            .read<BookingBloc>()
                            .add(const BookingSubmitted()),
                    child: state.busy
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Lanjut Bayar'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _StepLabel extends StatelessWidget {
  const _StepLabel(this.number, this.title);
  final String number;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 24, 0, 12),
      child: Row(
        children: [
          Container(
            height: 24,
            width: 24,
            decoration: const BoxDecoration(
                color: AppColors.moss, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text(number,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w800)),
          ),
          const SizedBox(width: 10),
          Text(title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _DateSection extends StatelessWidget {
  const _DateSection();

  Future<void> _pick(BuildContext context, BookingState state) async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 60)),
      initialDateRange: DateTimeRange(start: state.start!, end: state.end!),
      helpText: 'Pilih tanggal naik dan turun',
      saveText: 'Pilih',
    );
    if (range != null && context.mounted) {
      context
          .read<BookingBloc>()
          .add(BookingDatesChanged(range.start, range.end));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<BookingBloc>().state;
    return AppCard(
      onTap: () => _pick(context, state),
      child: Row(
        children: [
          const Icon(Icons.calendar_month_outlined, color: AppColors.moss),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${tanggal(state.start!)} → ${tanggal(state.end!)}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text('${state.days} hari pendakian',
                    style: const TextStyle(
                        fontSize: 12.5, color: AppColors.muted)),
              ],
            ),
          ),
          const Icon(Icons.edit_outlined, size: 18, color: AppColors.muted),
        ],
      ),
    );
  }
}

class _MembersSection extends StatelessWidget {
  const _MembersSection();

  Future<void> _add(BuildContext context) async {
    final nameCtrl = TextEditingController();
    final nikCtrl = TextEditingController();
    final ageCtrl = TextEditingController();
    var gender = 'L';

    final member = await lembarTarik<BookingMember>(
      context: context,
      judul: 'Tambah Anggota',
      keterangan: 'Data ini dipakai petugas pos gerbang dan tim SAR',
      isi: (ctx, setSheetState) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: nameCtrl,
            decoration: const InputDecoration(labelText: 'Nama Lengkap'),
            textCapitalization: TextCapitalization.words,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: nikCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'NIK (opsional)'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: ageCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Usia'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: gender,
                  decoration: const InputDecoration(labelText: 'Jenis Kelamin'),
                  items: const [
                    DropdownMenuItem(value: 'L', child: Text('Laki-laki')),
                    DropdownMenuItem(value: 'P', child: Text('Perempuan')),
                  ],
                  onChanged: (v) => setSheetState(() => gender = v ?? 'L'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          FilledButton(
            onPressed: () {
              if (nameCtrl.text.trim().length < 2) return;
              Navigator.of(ctx).pop(
                BookingMember(
                  name: nameCtrl.text.trim(),
                  nik: nikCtrl.text.trim(),
                  age: int.tryParse(ageCtrl.text.trim()),
                  gender: gender,
                ),
              );
            },
            child: const Text('Tambahkan'),
          ),
        ],
      ),
    );

    if (member != null && context.mounted) {
      context.read<BookingBloc>().add(BookingMemberAdded(member));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<BookingBloc>().state;
    return AppCard(
      child: Column(
        children: [
          ...state.members.asMap().entries.map(
                (e) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundColor: AppColors.mossLight,
                        child: Text(
                          e.value.name.characters.first.toUpperCase(),
                          style: const TextStyle(
                              color: AppColors.moss,
                              fontWeight: FontWeight.w800,
                              fontSize: 13),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(e.value.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600, fontSize: 14)),
                            if (e.value.isLeader)
                              const Text('Ketua rombongan',
                                  style: TextStyle(
                                      fontSize: 11.5, color: AppColors.moss)),
                          ],
                        ),
                      ),
                      if (!e.value.isLeader)
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          color: AppColors.danger,
                          onPressed: () => context
                              .read<BookingBloc>()
                              .add(BookingMemberRemoved(e.key)),
                        ),
                    ],
                  ),
                ),
              ),
          const Divider(height: 20),
          TextButton.icon(
            onPressed: () => _add(context),
            icon: const Icon(Icons.person_add_alt),
            label: Text('Tambah Anggota (${state.persons} orang)'),
          ),
        ],
      ),
    );
  }
}

class _TicketsSection extends StatelessWidget {
  const _TicketsSection();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<BookingBloc>().state;
    return Column(
      children: state.ticketCatalog.map((t) {
        final qty = state.tickets[t.id] ?? 0;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: AppCard(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14)),
                      const SizedBox(height: 3),
                      Text(
                        '${rupiah(t.price)}${t.perNight ? " / orang / malam" : " / orang"}',
                        style: const TextStyle(
                            fontSize: 12.5, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
                _Stepper(
                  value: qty,
                  onChanged: (v) => context
                      .read<BookingBloc>()
                      .add(BookingTicketChanged(t.id, v)),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _RentalsSection extends StatelessWidget {
  const _RentalsSection();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<BookingBloc>().state;
    return Column(
      children: state.rentalCatalog.map((r) {
        final qty = state.rentals[r.id] ?? 0;
        final habis = r.stock <= 0;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: AppCard(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(r.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14)),
                      const SizedBox(height: 3),
                      Text(
                        '${rupiah(r.pricePerDay)} / hari · ${habis ? "stok habis" : "stok ${r.stock}"}',
                        style: TextStyle(
                          fontSize: 12.5,
                          color: habis ? AppColors.danger : AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                _Stepper(
                  value: qty,
                  max: r.stock,
                  onChanged: habis
                      ? null
                      : (v) => context
                          .read<BookingBloc>()
                          .add(BookingRentalChanged(r.id, v)),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _GuidesSection extends StatelessWidget {
  const _GuidesSection();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<BookingBloc>().state;
    return Column(
      children: state.guideCatalog.map((g) {
        final selected = state.guides.contains(g.id);
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: AppCard(
            onTap: () =>
                context.read<BookingBloc>().add(BookingGuideToggled(g.id)),
            color: selected ? AppColors.mossLight : Colors.white,
            child: Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor:
                      selected ? Colors.white : AppColors.mossLight,
                  child: Text(g.type == 'PORTER' ? '🎒' : '🧭',
                      style: const TextStyle(fontSize: 17)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${g.typeLabel} ${g.name}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14)),
                      const SizedBox(height: 3),
                      Text(
                        '${rupiah(g.ratePerDay)}/hari · ⭐ ${g.rating} · ${g.experienceYears} th pengalaman',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
                Icon(
                  selected ? Icons.check_circle : Icons.circle_outlined,
                  color: selected ? AppColors.moss : const Color(0xFFCBD5E1),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

/// Penginapan dihitung per MALAM, jadi perjalanan sehari tidak menagih menginap.
class _PenginapanSection extends StatelessWidget {
  const _PenginapanSection();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<BookingBloc>().state;
    final malam = (state.days - 1).clamp(0, 99);

    if (state.penginapanKatalog.isEmpty) {
      return const AppCard(
        child: Text('Belum ada penginapan terdaftar.',
            style: TextStyle(fontSize: 13, color: AppColors.muted)),
      );
    }

    if (malam == 0) {
      return const AppCard(
        child: Row(
          children: [
            Text('🌙', style: TextStyle(fontSize: 22)),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Pendakian Anda pulang di hari yang sama, jadi belum perlu menginap. '
                'Ubah tanggal selesai bila ingin menambah penginapan.',
                style: TextStyle(fontSize: 12.5, height: 1.5),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: state.penginapanKatalog.map((p) {
        final qty = state.penginapan[p.id] ?? 0;
        final habis = p.units <= 0;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: AppCard(
            child: Row(
              children: [
                NetImage(p.imageUrl, height: 54, width: 54, radius: 14),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${p.lambang} ${p.name}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14)),
                      const SizedBox(height: 3),
                      Text(
                        '${rupiah(p.pricePerNight)} × $malam malam · '
                        '${p.capacity} orang/unit',
                        style: TextStyle(
                          fontSize: 12,
                          color: habis ? AppColors.danger : AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                _Stepper(
                  value: qty,
                  max: p.units,
                  onChanged: habis
                      ? null
                      : (v) => context
                          .read<BookingBloc>()
                          .add(BookingPenginapanChanged(p.id, v)),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _VoucherSection extends StatefulWidget {
  const _VoucherSection();

  @override
  State<_VoucherSection> createState() => _VoucherSectionState();
}

class _VoucherSectionState extends State<_VoucherSection> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<BookingBloc>().state;
    final terpasang = state.voucherCode.isNotEmpty && (state.quoteResult?.discount ?? 0) > 0;

    return AppCard(
      child: terpasang
          ? Row(
              children: [
                const Icon(Icons.local_activity, color: AppColors.moss),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(state.voucherCode,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 15)),
                      const SizedBox(height: 2),
                      Text('Hemat ${rupiah(state.quoteResult!.discount)}',
                          style: const TextStyle(
                              fontSize: 12.5, color: AppColors.moss)),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () {
                    _controller.clear();
                    context.read<BookingBloc>().add(const BookingVoucherChanged(''));
                  },
                  child: const Text('Lepas'),
                ),
              ],
            )
          : Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      hintText: 'Punya kode voucher?',
                      prefixIcon: Icon(Icons.local_activity_outlined),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(90, 48),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  onPressed: () => context
                      .read<BookingBloc>()
                      .add(BookingVoucherChanged(_controller.text)),
                  child: const Text('Pakai'),
                ),
              ],
            ),
    );
  }
}

class _SummarySection extends StatelessWidget {
  const _SummarySection({required this.quote});
  final Quote quote;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        children: [
          ...quote.items.map(
            (i) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${i.name} ×${i.qty}${i.days > 1 ? " · ${i.days} hari" : ""}',
                      style: const TextStyle(fontSize: 13.5),
                    ),
                  ),
                  Text(rupiah(i.amount),
                      style: const TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
          const Divider(height: 18),
          _row('Subtotal', rupiah(quote.subtotal)),
          if (quote.discount > 0)
            _row('Potongan ${quote.voucherCode ?? ''}'.trim(),
                '- ${rupiah(quote.discount)}',
                hijau: true),
          _row('Biaya layanan', rupiah(quote.serviceFee)),
          const Divider(height: 18),
          _row('Total', rupiah(quote.total), bold: true),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false, bool hijau = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            Expanded(
              child: Text(label,
                  style: TextStyle(
                      fontSize: 14,
                      color: hijau ? AppColors.moss : null,
                      fontWeight: bold ? FontWeight.w800 : FontWeight.w400)),
            ),
            Text(value,
                style: TextStyle(
                  fontSize: bold ? 16 : 14,
                  fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                  color: bold || hijau ? AppColors.moss : null,
                )),
          ],
        ),
      );
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.value, this.onChanged, this.max});
  final int value;
  final int? max;
  final void Function(int)? onChanged;

  @override
  Widget build(BuildContext context) {
    final canAdd = onChanged != null && (max == null || value < max!);
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            iconSize: 18,
            visualDensity: VisualDensity.compact,
            onPressed: value > 0 && onChanged != null
                ? () => onChanged!(value - 1)
                : null,
            icon: const Icon(Icons.remove),
          ),
          SizedBox(
            width: 24,
            child: Text('$value',
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w800)),
          ),
          IconButton(
            iconSize: 18,
            visualDensity: VisualDensity.compact,
            onPressed: canAdd ? () => onChanged!(value + 1) : null,
            icon: const Icon(Icons.add),
          ),
        ],
      ),
    );
  }
}
