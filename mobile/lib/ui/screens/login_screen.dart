import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../widgets/common.dart';

/// Masuk dan daftar dalam satu layar bertab, dengan latar bergradasi dan
/// kartu yang mengambang. Menutup layar ini tidak memaksa keluar aplikasi —
/// pengguna kembali menjelajah sebagai tamu.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 2, vsync: this);

  final _formMasuk = GlobalKey<FormState>();
  final _formDaftar = GlobalKey<FormState>();

  final _identitas = TextEditingController();
  final _sandi = TextEditingController();

  final _nama = TextEditingController();
  final _telepon = TextEditingController();
  final _email = TextEditingController();
  final _sandiBaru = TextEditingController();
  final _kontakDaruratNama = TextEditingController();
  final _kontakDaruratHp = TextEditingController();

  bool _sembunyi = true;
  bool _sembunyiBaru = true;

  @override
  void dispose() {
    _tab.dispose();
    for (final c in [
      _identitas, _sandi, _nama, _telepon, _email, _sandiBaru,
      _kontakDaruratNama, _kontakDaruratHp,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _masuk() {
    if (!_formMasuk.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    context
        .read<AuthBloc>()
        .add(AuthLoginRequested(_identitas.text.trim(), _sandi.text));
  }

  void _daftar() {
    if (!_formDaftar.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    context.read<AuthBloc>().add(AuthRegisterRequested(
          name: _nama.text.trim(),
          phone: _telepon.text.trim(),
          password: _sandiBaru.text,
          email: _email.text.trim(),
          emergencyName: _kontakDaruratNama.text.trim(),
          emergencyPhone: _kontakDaruratHp.text.trim(),
        ));
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthBloc, AuthState>(
      listenWhen: (a, b) =>
          (a.error != b.error && b.error != null) || a.status != b.status,
      listener: (context, state) {
        if (state.error != null) showSnack(context, state.error!, error: true);
        if (state.status == AuthStatus.authenticated && Navigator.canPop(context)) {
          Navigator.of(context).pop();
        }
      },
      builder: (context, state) {
        return Scaffold(
          backgroundColor: AppColors.mossDark,
          body: Stack(
            children: [
              // Latar: siluet punggungan agar terasa "gunung", bukan formulir polos.
              Positioned.fill(
                child: CustomPaint(painter: _LatarPunggungan()),
              ),
              SafeArea(
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(8, 4, 20, 0),
                      child: Row(
                        children: [
                          if (Navigator.canPop(context))
                            IconButton(
                              icon: const Icon(Icons.arrow_back,
                                  color: Colors.white),
                              onPressed: () => Navigator.of(context).pop(),
                            )
                          else
                            const SizedBox(width: 12),
                          const Spacer(),
                          if (Navigator.canPop(context))
                            TextButton(
                              onPressed: () => Navigator.of(context).pop(),
                              child: const Text('Lanjut sebagai tamu',
                                  style: TextStyle(color: Color(0xFFC2D8BD))),
                            ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(28, 8, 28, 22),
                      child: Row(
                        children: [
                          Container(
                            height: 54,
                            width: 54,
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.13),
                              borderRadius: BorderRadius.circular(18),
                            ),
                            alignment: Alignment.center,
                            child: const Text('🏔️',
                                style: TextStyle(fontSize: 27)),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Sembung Explorer',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 21,
                                        fontWeight: FontWeight.w800)),
                                SizedBox(height: 2),
                                Text('Gunung Sembung, Purwakarta',
                                    style: TextStyle(
                                        color: Color(0xFFC2D8BD), fontSize: 12.5)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Container(
                        width: double.infinity,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          borderRadius:
                              BorderRadius.vertical(top: Radius.circular(30)),
                        ),
                        child: Column(
                          children: [
                            const SizedBox(height: 14),
                            Container(
                              margin: const EdgeInsets.symmetric(horizontal: 24),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: TabBar(
                                controller: _tab,
                                dividerColor: Colors.transparent,
                                indicatorSize: TabBarIndicatorSize.tab,
                                indicator: BoxDecoration(
                                  color: AppColors.moss,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                labelColor: Colors.white,
                                unselectedLabelColor: AppColors.muted,
                                labelStyle: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 14),
                                tabs: const [
                                  Tab(text: 'Masuk'),
                                  Tab(text: 'Daftar'),
                                ],
                              ),
                            ),
                            Expanded(
                              child: TabBarView(
                                controller: _tab,
                                children: [
                                  _isiMasuk(state),
                                  _isiDaftar(state),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _isiMasuk(AuthState state) => ListView(
        padding: const EdgeInsets.fromLTRB(24, 26, 24, 32),
        children: [
          Form(
            key: _formMasuk,
            child: Column(
              children: [
                TextFormField(
                  controller: _identitas,
                  decoration: const InputDecoration(
                    labelText: 'Email atau No. HP',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: (v) =>
                      (v == null || v.trim().length < 3) ? 'Wajib diisi' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _sandi,
                  obscureText: _sembunyi,
                  decoration: InputDecoration(
                    labelText: 'Kata Sandi',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_sembunyi
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined),
                      onPressed: () => setState(() => _sembunyi = !_sembunyi),
                    ),
                  ),
                  validator: (v) =>
                      (v == null || v.length < 6) ? 'Minimal 6 karakter' : null,
                  onFieldSubmitted: (_) => _masuk(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: state.busy ? null : _masuk,
            child: state.busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Masuk'),
          ),
          if (kGoogleClientId.isNotEmpty) ...[
            const SizedBox(height: 18),
            _pemisah(),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: state.busy
                  ? null
                  : () => context.read<AuthBloc>().add(const AuthGoogleRequested()),
              icon: const Text('G',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF4285F4))),
              label: const Text('Masuk dengan Google'),
            ),
          ],
          const SizedBox(height: 26),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, size: 17, color: AppColors.muted),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Akun demo: demo@sembung.id / demo123',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ),
              ],
            ),
          ),
        ],
      );

  Widget _isiDaftar(AuthState state) => ListView(
        padding: const EdgeInsets.fromLTRB(24, 22, 24, 32),
        children: [
          const Text(
            'Data ini dipakai petugas pos gerbang untuk verifikasi, dan tim SAR '
            'bila terjadi keadaan darurat.',
            style: TextStyle(fontSize: 12.5, color: AppColors.muted, height: 1.5),
          ),
          const SizedBox(height: 18),
          Form(
            key: _formDaftar,
            child: Column(
              children: [
                _kolom(_nama, 'Nama Lengkap', Icons.badge_outlined,
                    validator: (v) => (v == null || v.trim().length < 3)
                        ? 'Minimal 3 huruf'
                        : null),
                _kolom(_telepon, 'No. HP', Icons.phone_outlined,
                    keyboard: TextInputType.phone,
                    validator: (v) => (v == null || v.trim().length < 8)
                        ? 'Nomor tidak valid'
                        : null),
                _kolom(_email, 'Email (opsional)', Icons.mail_outline,
                    keyboard: TextInputType.emailAddress,
                    validator: (v) =>
                        (v != null && v.isNotEmpty && !v.contains('@'))
                            ? 'Email tidak valid'
                            : null),
                _kolom(_sandiBaru, 'Kata Sandi', Icons.lock_outline,
                    obscure: _sembunyiBaru,
                    toggle: () => setState(() => _sembunyiBaru = !_sembunyiBaru),
                    validator: (v) =>
                        (v == null || v.length < 6) ? 'Minimal 6 karakter' : null),
                const SizedBox(height: 6),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Kontak Darurat',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                ),
                const SizedBox(height: 12),
                _kolom(_kontakDaruratNama, 'Nama Kontak Darurat',
                    Icons.contact_emergency_outlined),
                _kolom(_kontakDaruratHp, 'No. HP Kontak Darurat',
                    Icons.phone_in_talk_outlined,
                    keyboard: TextInputType.phone),
              ],
            ),
          ),
          const SizedBox(height: 10),
          FilledButton(
            onPressed: state.busy ? null : _daftar,
            child: state.busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Buat Akun'),
          ),
        ],
      );

  Widget _pemisah() => Row(
        children: [
          const Expanded(child: Divider()),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text('atau',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
          ),
          const Expanded(child: Divider()),
        ],
      );

  Widget _kolom(
    TextEditingController controller,
    String label,
    IconData ikon, {
    bool obscure = false,
    VoidCallback? toggle,
    TextInputType? keyboard,
    String? Function(String?)? validator,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 13),
        child: TextFormField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboard,
          decoration: InputDecoration(
            labelText: label,
            prefixIcon: Icon(ikon),
            suffixIcon: toggle == null
                ? null
                : IconButton(
                    icon: Icon(obscure
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined),
                    onPressed: toggle,
                  ),
          ),
          validator: validator,
        ),
      );
}

/// Siluet punggungan gunung sebagai latar, digambar langsung tanpa gambar luar
/// supaya tetap tajam di semua kerapatan layar dan tidak menambah ukuran APK.
class _LatarPunggungan extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final tinggi = size.height;
    final lebar = size.width;

    final belakang = Path()
      ..moveTo(0, tinggi * 0.42)
      ..lineTo(lebar * 0.28, tinggi * 0.24)
      ..lineTo(lebar * 0.52, tinggi * 0.40)
      ..lineTo(lebar * 0.78, tinggi * 0.21)
      ..lineTo(lebar, tinggi * 0.38)
      ..lineTo(lebar, tinggi)
      ..lineTo(0, tinggi)
      ..close();
    canvas.drawPath(belakang, Paint()..color = Colors.white.withOpacity(0.05));

    final depan = Path()
      ..moveTo(0, tinggi * 0.50)
      ..lineTo(lebar * 0.36, tinggi * 0.32)
      ..lineTo(lebar * 0.68, tinggi * 0.49)
      ..lineTo(lebar, tinggi * 0.34)
      ..lineTo(lebar, tinggi)
      ..lineTo(0, tinggi)
      ..close();
    canvas.drawPath(depan, Paint()..color = Colors.white.withOpacity(0.07));
  }

  @override
  bool shouldRepaint(_LatarPunggungan oldDelegate) => false;
}
