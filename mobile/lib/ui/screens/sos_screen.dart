import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../blocs/sos/sos_bloc.dart';
import '../../core/config.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../widgets/common.dart';
import '../widgets/lembar_tarik.dart';

const _sosTypes = <(String, String, String)>[
  ('INJURY', '🩹', 'Cedera'),
  ('LOST', '🧭', 'Tersesat'),
  ('MEDICAL', '🚑', 'Darurat Medis'),
  ('WEATHER', '🌩️', 'Cuaca Ekstrem'),
  ('FIRE', '🔥', 'Kebakaran'),
  ('OTHER', '❗', 'Lainnya'),
];

class SosScreen extends StatelessWidget {
  const SosScreen({super.key});

  Future<void> _confirm(BuildContext context) async {
    var type = 'OTHER';
    final message = TextEditingController();

    final send = await lembarTarik<bool>(
      context: context,
      judul: 'Jenis Keadaan Darurat',
      keterangan: 'Pilih yang paling sesuai agar tim membawa perlengkapan yang tepat',
      isi: (ctx, setSheetState) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _sosTypes
                .map(
                  (t) => ChoiceChip(
                    selected: type == t.$1,
                    onSelected: (_) => setSheetState(() => type = t.$1),
                    label: Text('${t.$2} ${t.$3}'),
                    selectedColor: AppColors.mossLight,
                    labelStyle: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: type == t.$1 ? AppColors.mossDark : Colors.black87,
                    ),
                    backgroundColor: const Color(0xFFF1F5F9),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: message,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Keterangan singkat',
              hintText: 'Contoh: kaki terkilir di Pos 3, tidak bisa berjalan',
            ),
          ),
          const SizedBox(height: 22),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('KIRIM SINYAL DARURAT'),
          ),
        ],
      ),
    );

    if (send == true && context.mounted) {
      context.read<SosBloc>().add(SosTriggered(type, message.text.trim()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Darurat & Lokasi'),
        actions: [
          IconButton(
            tooltip: 'Perbarui lokasi',
            onPressed: () =>
                context.read<SosBloc>().add(const SosLocationRefreshed()),
            icon: const Icon(Icons.gps_fixed),
          ),
        ],
      ),
      body: BlocConsumer<SosBloc, SosState>(
        listenWhen: (a, b) => a.notice != b.notice || a.error != b.error,
        listener: (context, state) {
          if (state.notice != null) showSnack(context, state.notice!);
          if (state.error != null) showSnack(context, state.error!, error: true);
        },
        builder: (context, state) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            AppCard(
              child: Row(
                children: [
                  Icon(
                    state.hasFix ? Icons.location_on : Icons.location_off,
                    color: state.hasFix ? AppColors.moss : AppColors.danger,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          state.status == SosStatus.locating
                              ? 'Mencari sinyal GPS…'
                              : state.hasFix
                                  ? 'Lokasi terkunci'
                                  : 'Lokasi belum tersedia',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          state.hasFix
                              ? '${state.lat!.toStringAsFixed(5)}, ${state.lng!.toStringAsFixed(5)}'
                                  '${state.elevationM != null ? " · ${state.elevationM} mdpl" : ""}'
                                  '${state.accuracy != null ? " · ±${state.accuracy!.round()} m" : ""}'
                              : 'SOS tetap dikirim menggunakan titik basecamp bila GPS gagal.',
                          style: const TextStyle(
                              fontSize: 12.5, color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Center(
              child: GestureDetector(
                onLongPress: () => _confirm(context),
                onTap: () => showSnack(context,
                    'Tekan dan tahan tombol SOS untuk mengirim sinyal darurat'),
                child: Container(
                  height: 190,
                  width: 190,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFFF43F5E), Color(0xFFBE123C)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.danger.withOpacity(0.35),
                        blurRadius: 28,
                        spreadRadius: 4,
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: state.status == SosStatus.sending
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.sos, color: Colors.white, size: 54),
                            SizedBox(height: 6),
                            Text(
                              'TEKAN & TAHAN',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                                letterSpacing: 1,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
            const SizedBox(height: 22),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        context.read<SosBloc>().add(const SosPinged()),
                    icon: const Icon(Icons.share_location, size: 18),
                    label: const Text('Bagikan Lokasi'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        launchUrl(Uri.parse('tel:$kSarPhone')),
                    icon: const Icon(Icons.call, size: 18),
                    label: const Text('Telepon SAR'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            AppCard(
              child: Column(
                children: [
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    value: state.autoTrack,
                    activeColor: AppColors.moss,
                    onChanged: (v) =>
                        context.read<SosBloc>().add(SosAutoTrackToggled(v)),
                    title: const Text('Berbagi Lokasi Otomatis',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                    subtitle: Text(
                      state.autoTrack
                          ? 'Dilaporkan tiap ${state.interval.inMinutes} menit selama aplikasi terbuka.'
                          : 'Kirim posisi berkala agar pos pemantau tahu jejak Anda.',
                      style: const TextStyle(fontSize: 12, color: AppColors.muted),
                    ),
                  ),
                  if (state.autoTrack) ...[
                    const Divider(height: 18),
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Text('Jeda laporan',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700)),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: SosBloc.pilihanInterval
                          .map((o) => ChoiceChip(
                                selected: state.interval == o.$1,
                                onSelected: (_) => context
                                    .read<SosBloc>()
                                    .add(SosAutoTrackToggled(true, interval: o.$1)),
                                label: Text(o.$2,
                                    style: const TextStyle(fontSize: 11.5)),
                                selectedColor: AppColors.mossLight,
                                backgroundColor: const Color(0xFFF1F5F9),
                              ))
                          .toList(),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'GPS termasuk perangkat paling haus daya di ponsel. Jeda yang '
                      'lebih panjang menghemat baterai secara berarti, dan bagi tim '
                      'pencari selisih beberapa menit biasanya tidak mengubah area '
                      'pencarian. Pilih 5 menit hanya bila cuaca memburuk atau '
                      'rombongan terpisah.',
                      style: TextStyle(
                          fontSize: 11, color: AppColors.muted, height: 1.5),
                    ),
                  ],
                  if (state.queued > 0) ...[
                    const Divider(height: 18),
                    Row(
                      children: [
                        const Icon(Icons.cloud_upload_outlined,
                            size: 18, color: AppColors.ember),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${state.queued} laporan menunggu jaringan',
                            style: const TextStyle(
                                fontSize: 12.5, fontWeight: FontWeight.w600),
                          ),
                        ),
                        TextButton(
                          onPressed: () => context
                              .read<SosBloc>()
                              .add(const SosOutboxFlushed()),
                          child: const Text('Kirim ulang'),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Pos pemantau menerima koordinat, ketinggian, dan data rombongan Anda seketika. '
              'Tetap di tempat yang aman dan hemat baterai sambil menunggu tim.',
              style:
                  TextStyle(fontSize: 12.5, color: AppColors.muted, height: 1.6),
            ),
            if (state.history.isNotEmpty) ...[
              const SizedBox(height: 28),
              const Text('Riwayat Sinyal Darurat',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              ...state.history.map(
                (a) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(a.typeLabel,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700)),
                            ),
                            StatusChip(a.status),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${a.code} · ${tanggalJam(a.createdAt)}',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.muted),
                        ),
                        if (a.message != null) ...[
                          const SizedBox(height: 6),
                          Text(a.message!,
                              style: const TextStyle(fontSize: 13, height: 1.5)),
                        ],
                        if (a.resolutionNote != null) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.mossLight,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              'Catatan pos: ${a.resolutionNote!}',
                              style: const TextStyle(
                                  fontSize: 12.5, height: 1.5),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
