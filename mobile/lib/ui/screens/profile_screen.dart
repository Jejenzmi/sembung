import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../widgets/common.dart';
import '../widgets/lembar_tarik.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _edit(BuildContext context) async {
    final user = context.read<AuthBloc>().state.user!;
    final name = TextEditingController(text: user.name);
    final email = TextEditingController(text: user.email ?? '');
    final nik = TextEditingController(text: user.nik ?? '');
    final address = TextEditingController(text: user.address ?? '');
    final emName = TextEditingController(text: user.emergencyName ?? '');
    final emPhone = TextEditingController(text: user.emergencyPhone ?? '');

    final saved = await lembarTarik<bool>(
      context: context,
      judul: 'Ubah Profil',
      keterangan: 'Data ini dipakai tim SAR bila terjadi keadaan darurat',
      isi: (ctx, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _input(name, 'Nama Lengkap'),
          _input(email, 'Email'),
          _input(nik, 'NIK'),
          _input(address, 'Alamat'),
          const SizedBox(height: 6),
          const Text('Kontak Darurat',
              style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _input(emName, 'Nama Kontak Darurat'),
          _input(emPhone, 'No. HP Kontak Darurat'),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Simpan'),
          ),
        ],
      ),
    );

    if (saved == true && context.mounted) {
      context.read<AuthBloc>().add(AuthProfileUpdated({
            'name': name.text.trim(),
            if (email.text.trim().isNotEmpty) 'email': email.text.trim(),
            'nik': nik.text.trim(),
            'address': address.text.trim(),
            'emergencyName': emName.text.trim(),
            'emergencyPhone': emPhone.text.trim(),
          }));
    }
  }

  static Widget _input(TextEditingController c, String label) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: c,
          decoration: InputDecoration(labelText: label),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: BlocConsumer<AuthBloc, AuthState>(
        listenWhen: (a, b) => a.error != b.error && b.error != null,
        listener: (context, state) =>
            showSnack(context, state.error!, error: true),
        builder: (context, state) {
          final user = state.user;
          if (user == null) return const SizedBox.shrink();
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              AppCard(
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: AppColors.mossLight,
                      child: Text(
                        user.name.characters.first.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: AppColors.moss,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.name,
                              style: const TextStyle(
                                  fontSize: 17, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 3),
                          Text(user.phone,
                              style: const TextStyle(
                                  fontSize: 13, color: AppColors.muted)),
                          if (user.email != null)
                            Text(user.email!,
                                style: const TextStyle(
                                    fontSize: 13, color: AppColors.muted)),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => _edit(context),
                      icon: const Icon(Icons.edit_outlined),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Data Pendakian',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 14),
                    _row('NIK', user.nik ?? '—'),
                    _row('Alamat', user.address ?? '—'),
                    _row('Kontak Darurat', user.emergencyName ?? '—'),
                    _row('No. HP Darurat', user.emergencyPhone ?? '—'),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Tentang',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 12),
                    _row('Kawasan', kParkName),
                    _row('Nomor Darurat', kSarPhone),
                    _row('Versi Aplikasi', '1.0.0'),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  side: const BorderSide(color: Color(0xFFFFE4E6), width: 1.5),
                ),
                onPressed: () async {
                  final yes = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Keluar dari akun?'),
                      content: const Text(
                          'Anda perlu masuk kembali untuk mengakses E-Pass dan tombol SOS.'),
                      actions: [
                        TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: const Text('Batal')),
                        FilledButton(
                          style: FilledButton.styleFrom(
                              backgroundColor: AppColors.danger),
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Keluar'),
                        ),
                      ],
                    ),
                  );
                  if (yes == true && context.mounted) {
                    context.read<AuthBloc>().add(const AuthLogoutRequested());
                  }
                },
                icon: const Icon(Icons.logout),
                label: const Text('Keluar'),
              ),
            ],
          );
        },
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
                      fontSize: 13.5, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );
}
