import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../blocs/auth/auth_bloc.dart';
import '../core/preferensi.dart';
import 'screens/onboarding_screen.dart';
import 'screens/shell_screen.dart';
import 'screens/splash_screen.dart';

/// Menentukan layar pertama yang dilihat pengguna:
/// splash → (sekali saja) perkenalan & izin → beranda.
///
/// Beranda dibuka untuk siapa pun, termasuk tamu. Login baru diminta ketika
/// pengguna menyentuh sesuatu yang menyangkut identitasnya.
class Gerbang extends StatefulWidget {
  const Gerbang({super.key, required this.preferensi});
  final Preferensi preferensi;

  @override
  State<Gerbang> createState() => _GerbangState();
}

class _GerbangState extends State<Gerbang> {
  bool _splashSelesai = false;
  late bool _perluOnboarding = !widget.preferensi.sudahOnboarding;

  @override
  void initState() {
    super.initState();
    // Ditahan sebentar dengan sengaja: pemeriksaan sesi biasanya selesai dalam
    // sekejap, dan layar yang berkedip terasa seperti kerusakan.
    Future.delayed(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => _splashSelesai = true);
    });
  }

  Future<void> _selesaikanOnboarding() async {
    await widget.preferensi.tandaiOnboardingSelesai();
    if (mounted) setState(() => _perluOnboarding = false);
  }

  @override
  Widget build(BuildContext context) {
    // Tunggu splash sekaligus pemulihan sesi tersimpan.
    final sesiBelumJelas = context.select(
      (AuthBloc b) => b.state.status == AuthStatus.unknown,
    );

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 380),
      switchInCurve: Curves.easeOut,
      child: !_splashSelesai || sesiBelumJelas
          ? const SplashScreen(key: ValueKey('splash'))
          : _perluOnboarding
              ? OnboardingScreen(
                  key: const ValueKey('onboarding'),
                  onSelesai: _selesaikanOnboarding,
                )
              : const ShellScreen(key: ValueKey('shell')),
    );
  }
}
