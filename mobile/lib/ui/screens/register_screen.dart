import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../blocs/auth/auth_bloc.dart';
import '../widgets/common.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _nik = TextEditingController();
  final _password = TextEditingController();
  final _emergencyName = TextEditingController();
  final _emergencyPhone = TextEditingController();

  @override
  void dispose() {
    for (final c in [
      _name,
      _phone,
      _email,
      _nik,
      _password,
      _emergencyName,
      _emergencyPhone
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    context.read<AuthBloc>().add(AuthRegisterRequested(
          name: _name.text.trim(),
          phone: _phone.text.trim(),
          password: _password.text,
          email: _email.text.trim(),
          nik: _nik.text.trim(),
          emergencyName: _emergencyName.text.trim(),
          emergencyPhone: _emergencyPhone.text.trim(),
        ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Daftar Akun Pendaki')),
      body: BlocConsumer<AuthBloc, AuthState>(
        listenWhen: (a, b) => a.error != b.error && b.error != null,
        listener: (context, state) =>
            showSnack(context, state.error!, error: true),
        builder: (context, state) => Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              const Text(
                'Data ini dipakai petugas pos gerbang untuk verifikasi dan tim SAR bila terjadi keadaan darurat.',
                style: TextStyle(color: Colors.black54, height: 1.5),
              ),
              const SizedBox(height: 22),
              _field(_name, 'Nama Lengkap', Icons.badge_outlined,
                  validator: (v) =>
                      (v == null || v.trim().length < 3) ? 'Minimal 3 huruf' : null),
              _field(_phone, 'No. HP', Icons.phone_outlined,
                  keyboard: TextInputType.phone,
                  validator: (v) =>
                      (v == null || v.trim().length < 8) ? 'Nomor tidak valid' : null),
              _field(_email, 'Email (opsional)', Icons.mail_outline,
                  keyboard: TextInputType.emailAddress,
                  validator: (v) => (v != null && v.isNotEmpty && !v.contains('@'))
                      ? 'Email tidak valid'
                      : null),
              _field(_nik, 'NIK (opsional)', Icons.credit_card,
                  keyboard: TextInputType.number),
              _field(_password, 'Kata Sandi', Icons.lock_outline,
                  obscure: true,
                  validator: (v) =>
                      (v == null || v.length < 6) ? 'Minimal 6 karakter' : null),
              const SizedBox(height: 8),
              const Text('Kontak Darurat',
                  style: TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              _field(_emergencyName, 'Nama Kontak Darurat', Icons.contact_emergency_outlined),
              _field(_emergencyPhone, 'No. HP Kontak Darurat', Icons.phone_in_talk_outlined,
                  keyboard: TextInputType.phone),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: state.busy ? null : _submit,
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
          ),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    IconData icon, {
    bool obscure = false,
    TextInputType? keyboard,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: controller,
        obscureText: obscure,
        keyboardType: keyboard,
        decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
        validator: validator,
      ),
    );
  }
}
