import 'dart:convert';

import '../core/api_client.dart';
import 'models.dart';

class AuthRepository {
  AuthRepository(this.api);
  final ApiClient api;

  static const _userKey = 'sembung_user';

  AppUser? get cachedUser {
    final raw = api.prefs.getString(_userKey);
    if (raw == null) return null;
    return AppUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<AppUser> login(String identifier, String password) async {
    final data = await api.post('/auth/login', {
      'identifier': identifier,
      'password': password,
    }) as Map<String, dynamic>;
    return _persist(data);
  }

  Future<AppUser> register({
    required String name,
    required String phone,
    required String password,
    String? email,
    String? nik,
    String? emergencyName,
    String? emergencyPhone,
  }) async {
    final data = await api.post('/auth/register', {
      'name': name,
      'phone': phone,
      'password': password,
      if (email != null && email.isNotEmpty) 'email': email,
      if (nik != null && nik.isNotEmpty) 'nik': nik,
      if (emergencyName != null && emergencyName.isNotEmpty)
        'emergencyName': emergencyName,
      if (emergencyPhone != null && emergencyPhone.isNotEmpty)
        'emergencyPhone': emergencyPhone,
    }) as Map<String, dynamic>;
    return _persist(data);
  }

  Future<AppUser> _persist(Map<String, dynamic> data) async {
    await api.setToken(data['token'] as String);
    final user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
    await api.prefs.setString(_userKey, jsonEncode(data['user']));
    return user;
  }

  /// Menukar ID token Google dengan sesi aplikasi.
  Future<({AppUser user, bool perluLengkapiProfil})> masukGoogle(String idToken) async {
    final data = await api.post('/auth/google', {'idToken': idToken})
        as Map<String, dynamic>;
    final user = await _persist(data);
    return (
      user: user,
      perluLengkapiProfil: (data['perluLengkapiProfil'] as bool?) ?? false,
    );
  }

  Future<AppUser> me() async {
    final data = await api.get('/auth/me') as Map<String, dynamic>;
    await api.prefs.setString(_userKey, jsonEncode(data));
    return AppUser.fromJson(data);
  }

  Future<AppUser> updateProfile(Map<String, dynamic> payload) async {
    final data = await api.put('/auth/me', payload) as Map<String, dynamic>;
    await api.prefs.setString(_userKey, jsonEncode(data));
    return AppUser.fromJson(data);
  }

  Future<void> logout() async {
    await api.setToken(null);
    await api.prefs.remove(_userKey);
  }
}

class CatalogRepository {
  CatalogRepository(this.api);
  final ApiClient api;

  static const _bundlePrefix = 'offline_bundle_';

  Future<List<Trail>> trails() async {
    final list = await api.get('/trails') as List;
    return list.map((e) => Trail.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Trail> trail(String slug) async =>
      Trail.fromJson(await api.get('/trails/$slug') as Map<String, dynamic>);

  Future<List<QuotaDay>> quotaCalendar(String trailId, {int days = 30}) async {
    final list = await api.get(
      '/trails/$trailId/quota-calendar',
      query: {'days': days},
    ) as List;
    return list
        .map((e) => QuotaDay.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Downloads the trail map bundle and keeps a copy on device, so the map
  /// still works once the hiker loses signal above Pos 2.
  Future<OfflineBundle> downloadBundle(String slug) async {
    final json = await api.get('/trails/$slug/offline-bundle')
        as Map<String, dynamic>;
    final bundle = OfflineBundle.fromJson(json);
    await api.prefs
        .setString('$_bundlePrefix$slug', jsonEncode(bundle.toJson()));
    return bundle;
  }

  OfflineBundle? cachedBundle(String slug) {
    final raw = api.prefs.getString('$_bundlePrefix$slug');
    if (raw == null) return null;
    return OfflineBundle.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  /// Cache first so the map opens instantly and offline; refresh in background.
  Future<OfflineBundle> bundle(String slug) async {
    final cached = cachedBundle(slug);
    if (cached != null) {
      downloadBundle(slug).ignore();
      return cached;
    }
    return downloadBundle(slug);
  }

  Future<List<TicketType>> tickets() async {
    final list = await api.get('/catalog/tickets') as List;
    return list
        .map((e) => TicketType.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<RentalItem>> rentals() async {
    final list = await api.get('/catalog/rentals') as List;
    return list
        .map((e) => RentalItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<Guide>> guides() async {
    final list = await api.get('/catalog/guides') as List;
    return list.map((e) => Guide.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Capacity> capacity() async =>
      Capacity.fromJson(await api.get('/dashboard/capacity') as Map<String, dynamic>);

  /// Prakiraan BMKG. Mengembalikan null bila layanan tidak dapat dihubungi —
  /// beranda menampilkan ketidaktersediaannya apa adanya.
  Future<CuacaKawasan?> cuaca() async {
    try {
      return CuacaKawasan.fromJson(
          await api.get('/weather') as Map<String, dynamic>);
    } on ApiException {
      return null;
    }
  }

  Future<List<Penginapan>> penginapan() async {
    final list = await api.get('/homestays') as List;
    return list.map((e) => Penginapan.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<KondisiKawasan?> kondisi() async {
    try {
      return KondisiKawasan.fromJson(
          await api.get('/trails/kondisi/sekarang') as Map<String, dynamic>);
    } on ApiException {
      return null;
    }
  }

  Future<List<Warung>> warung() async {
    final list = await api.get('/warung') as List;
    return list.map((e) => Warung.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<MenuWarung>> menuPraPesan() async {
    final list = await api.get('/warung/pra-pesan') as List;
    return list.map((e) => MenuWarung.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<PetaSinyal?> sinyal(String slug) async {
    try {
      return PetaSinyal.fromJson(await api.get('/sinyal/$slug') as Map<String, dynamic>);
    } on ApiException {
      return null;
    }
  }

  Future<List<Voucher>> vouchers() async {
    final list = await api.get('/vouchers/active') as List;
    return list.map((e) => Voucher.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<ContentItem>> contents({String? category}) async {
    final list = await api.get(
      '/content',
      query: category == null ? null : {'category': category},
    ) as List;
    return list
        .map((e) => ContentItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

class BookingRepository {
  BookingRepository(this.api);
  final ApiClient api;

  Future<Quote> quote(Map<String, dynamic> draft) async =>
      Quote.fromJson(await api.post('/bookings/quote', draft) as Map<String, dynamic>);

  Future<Booking> create(Map<String, dynamic> draft) async =>
      Booking.fromJson(await api.post('/bookings', draft) as Map<String, dynamic>);

  Future<List<Booking>> mine({String? status}) async {
    final res = await api.getWithMeta(
      '/bookings/mine',
      query: {'limit': 50, if (status != null) 'status': status},
    );
    return (res['data'] as List)
        .map((e) => Booking.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Booking> detail(String id) async =>
      Booking.fromJson(await api.get('/bookings/$id') as Map<String, dynamic>);

  Future<Payment> pay(String bookingId, String method) async =>
      Payment.fromJson(
          await api.post('/bookings/$bookingId/pay', {'method': method})
              as Map<String, dynamic>);

  /// Simulation-mode settlement (owner-only). In production the gateway calls
  /// the signed webhook and the app just waits for the status to flip.
  Future<void> confirmPayment(String bookingId) async =>
      api.post('/bookings/$bookingId/simulate-payment');

  /// The e-pass is scanned at the gate, where signal is often poor, so the last
  /// fetched copy is kept on device and served when the network fails.
  Future<EPass> epass(String bookingId) async {
    try {
      final json = await api.get('/bookings/$bookingId/epass') as Map<String, dynamic>;
      await api.prefs.setString('epass_$bookingId', jsonEncode(json));
      return EPass.fromJson(json);
    } on ApiException {
      final cached = api.prefs.getString('epass_$bookingId');
      if (cached == null) rethrow;
      return EPass.fromJson(jsonDecode(cached) as Map<String, dynamic>);
    }
  }

  bool hasCachedEpass(String bookingId) =>
      api.prefs.containsKey('epass_$bookingId');

  /// Mengembalikan pesan server agar kode refund (bila ada) sampai ke pengguna.
  Future<String> cancel(String bookingId) async {
    final res = await api.postFull('/bookings/$bookingId/cancel');
    return (res['message'] as String?) ?? 'Booking dibatalkan';
  }

  Future<void> review(String bookingId, int rating, String? comment) async =>
      api.post('/bookings/$bookingId/review', {
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      });
}

class InboxRepository {
  InboxRepository(this.api);
  final ApiClient api;

  /// Mengembalikan pesan sekaligus jumlah yang belum dibaca untuk lencana.
  Future<({List<InboxItem> items, int unread})> load() async {
    final res = await api.getWithMeta('/notifications', query: {'limit': 50});
    final items = (res['data'] as List)
        .map((e) => InboxItem.fromJson(e as Map<String, dynamic>))
        .toList();
    final unread = ((res['meta'] as Map?)?['unread'] as num?)?.toInt() ?? 0;
    return (items: items, unread: unread);
  }

  Future<void> tandaiDibaca(String id) => api.post('/notifications/$id/read');

  Future<void> tandaiSemua() => api.post('/notifications/read-all');
}

class SosRepository {
  SosRepository(this.api);
  final ApiClient api;

  static const _queueKey = 'sos_outbox';

  /// A distress call must survive a dead zone: anything that fails to send is
  /// persisted and retried on the next successful connection.
  List<Map<String, dynamic>> get _outbox {
    final raw = api.prefs.getStringList(_queueKey) ?? const [];
    return raw
        .map((e) => jsonDecode(e) as Map<String, dynamic>)
        .toList(growable: true);
  }

  Future<void> _saveOutbox(List<Map<String, dynamic>> items) =>
      api.prefs.setStringList(_queueKey, items.map(jsonEncode).toList());

  int get pendingCount => _outbox.length;

  Future<void> _enqueue(String path, Map<String, dynamic> payload) async {
    final items = _outbox
      ..add({
        'path': path,
        'payload': payload,
        'queuedAt': DateTime.now().toIso8601String(),
      });
    await _saveOutbox(items);
  }

  /// Drains the outbox oldest-first; stops at the first failure so ordering and
  /// the remaining queue stay intact.
  Future<int> flushOutbox() async {
    final items = _outbox;
    if (items.isEmpty) return 0;

    var sent = 0;
    while (items.isNotEmpty) {
      final item = items.first;
      try {
        await api.post(item['path'] as String, item['payload']);
        items.removeAt(0);
        sent++;
      } catch (_) {
        break;
      }
    }
    await _saveOutbox(items);
    return sent;
  }

  Future<SosAlert?> trigger({
    required double lat,
    required double lng,
    required String type,
    int? elevationM,
    double? accuracy,
    String? message,
  }) async {
    final payload = <String, dynamic>{
      'lat': lat,
      'lng': lng,
      'type': type,
      if (elevationM != null) 'elevationM': elevationM,
      if (accuracy != null) 'accuracy': accuracy,
      if (message != null && message.isNotEmpty) 'message': message,
    };
    try {
      return SosAlert.fromJson(await api.post('/sos', payload) as Map<String, dynamic>);
    } on ApiException {
      await _enqueue('/sos', payload);
      // Null means "queued, not delivered" — the UI says so plainly.
      return null;
    }
  }

  Future<List<SosAlert>> mine() async {
    final list = await api.get('/sos/mine') as List;
    return list
        .map((e) => SosAlert.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Returns true when the ping reached the server, false when it was queued.
  Future<bool> ping({
    required double lat,
    required double lng,
    int? elevationM,
    double? accuracy,
    int? battery,
  }) async {
    final payload = <String, dynamic>{
      'lat': lat,
      'lng': lng,
      if (elevationM != null) 'elevationM': elevationM,
      if (accuracy != null) 'accuracy': accuracy,
      if (battery != null) 'battery': battery,
    };
    try {
      await api.post('/sos/track', payload);
      return true;
    } on ApiException {
      await _enqueue('/sos/track', payload);
      return false;
    }
  }
}
