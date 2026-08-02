import 'package:shared_preferences/shared_preferences.dart';

/// Penanda alur pertama kali pakai. Disimpan terpisah dari data sesi supaya
/// pengguna yang keluar akun tidak dipaksa mengulang perkenalan.
class Preferensi {
  Preferensi(this._prefs);
  final SharedPreferences _prefs;

  static const _kunciOnboarding = 'onboarding_selesai';
  static const _kunciIzinDiminta = 'izin_sudah_diminta';

  bool get sudahOnboarding => _prefs.getBool(_kunciOnboarding) ?? false;
  Future<void> tandaiOnboardingSelesai() =>
      _prefs.setBool(_kunciOnboarding, true);

  bool get izinSudahDiminta => _prefs.getBool(_kunciIzinDiminta) ?? false;
  Future<void> tandaiIzinDiminta() => _prefs.setBool(_kunciIzinDiminta, true);
}
