import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Layar pembuka bergerak. Ditahan sebentar dengan sengaja supaya peralihan ke
/// isi aplikasi terasa mulus, bukan berkedip.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _kontrol = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..forward();

  late final Animation<double> _munculLogo = CurvedAnimation(
    parent: _kontrol,
    curve: const Interval(0.0, 0.55, curve: Curves.easeOutBack),
  );
  late final Animation<double> _munculTeks = CurvedAnimation(
    parent: _kontrol,
    curve: const Interval(0.35, 0.85, curve: Curves.easeOut),
  );
  late final Animation<double> _munculGaris = CurvedAnimation(
    parent: _kontrol,
    curve: const Interval(0.6, 1.0, curve: Curves.easeOut),
  );

  @override
  void dispose() {
    _kontrol.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.mossDark, AppColors.moss],
          ),
        ),
        child: SafeArea(
          child: AnimatedBuilder(
            animation: _kontrol,
            builder: (context, _) => Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(),
                Transform.scale(
                  scale: 0.6 + _munculLogo.value * 0.4,
                  child: Opacity(
                    opacity: _munculLogo.value.clamp(0, 1),
                    child: Container(
                      height: 116,
                      width: 116,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(34),
                      ),
                      alignment: Alignment.center,
                      child: const Text('🏔️', style: TextStyle(fontSize: 58)),
                    ),
                  ),
                ),
                const SizedBox(height: 26),
                Opacity(
                  opacity: _munculTeks.value.clamp(0, 1),
                  child: Transform.translate(
                    offset: Offset(0, (1 - _munculTeks.value) * 14),
                    child: const Column(
                      children: [
                        Text(
                          'Sembung Explorer',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.4,
                          ),
                        ),
                        SizedBox(height: 6),
                        Text(
                          'Pendamping pendaki Gunung Sembung',
                          style: TextStyle(color: Color(0xFFC2D8BD), fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                Opacity(
                  opacity: _munculGaris.value.clamp(0, 1),
                  child: Column(
                    children: [
                      SizedBox(
                        width: 120,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            minHeight: 3,
                            backgroundColor: Colors.white.withOpacity(0.18),
                            color: Colors.white.withOpacity(0.85),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'Kawasan Wisata Gunung Sembung · Purwakarta',
                        style: TextStyle(color: Color(0x99E0EBDD), fontSize: 11.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 34),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
