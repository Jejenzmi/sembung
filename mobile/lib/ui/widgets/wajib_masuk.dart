import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../core/theme.dart';
import '../screens/login_screen.dart';
import 'lembar_tarik.dart';

/// Pintu masuk tunggal untuk seluruh aksi yang membutuhkan akun.
///
/// Tamu boleh menjelajah beranda, peta, jadwal salat, dan kompas. Begitu ia
/// menyentuh sesuatu yang menyangkut identitas — memesan, melihat perjalanan,
/// menekan SOS — barulah login diminta, lengkap dengan alasannya.
Future<bool> wajibMasuk(
  BuildContext context, {
  required String alasan,
  String judul = 'Masuk dulu, ya',
}) async {
  final sudah = context.read<AuthBloc>().state.status == AuthStatus.authenticated;
  if (sudah) return true;

  final mau = await lembarTarik<bool>(
    context: context,
    judul: judul,
    isi: (ctx, _) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.mossLight,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const Text('🏔️', style: TextStyle(fontSize: 30)),
              const SizedBox(width: 14),
              Expanded(
                child: Text(alasan,
                    style: const TextStyle(fontSize: 13.5, height: 1.5)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: const Text('Masuk / Daftar'),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Lihat-lihat dulu'),
        ),
      ],
    ),
  );

  if (mau != true || !context.mounted) return false;

  await Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => const LoginScreen()),
  );
  if (!context.mounted) return false;
  return context.read<AuthBloc>().state.status == AuthStatus.authenticated;
}

/// Spanduk ajakan yang tampil di beranda selama pengguna masih tamu.
class SpandukTamu extends StatelessWidget {
  const SpandukTamu({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: Material(
        borderRadius: BorderRadius.circular(20),
        color: AppColors.mossDark,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => wajibMasuk(
            context,
            alasan: 'Buat akun untuk memesan E-Pass, menyimpan perjalanan, '
                'dan mengaktifkan tombol darurat.',
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  height: 42,
                  width: 42,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.14),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  alignment: Alignment.center,
                  child: const Text('👋', style: TextStyle(fontSize: 20)),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Anda sedang melihat sebagai tamu',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 14)),
                      SizedBox(height: 3),
                      Text('Masuk untuk memesan E-Pass dan mengaktifkan SOS',
                          style: TextStyle(
                              color: Color(0xFFC2D8BD), fontSize: 12)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colors.white70),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
