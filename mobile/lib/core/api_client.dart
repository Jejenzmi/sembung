import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'config.dart';

/// Thrown for any non-2xx API response so the UI can show the server's
/// Indonesian message directly instead of a raw Dio error.
class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, [this.status]);

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._(this._dio, this._prefs);

  final Dio _dio;
  final SharedPreferences _prefs;

  static const _tokenKey = 'sembung_token';

  static Future<ApiClient> create() async {
    final prefs = await SharedPreferences.getInstance();
    final dio = Dio(
      BaseOptions(
        baseUrl: '$kApiUrl/api',
        connectTimeout: const Duration(seconds: 12),
        receiveTimeout: const Duration(seconds: 20),
        // Let the interceptor translate errors instead of Dio throwing first.
        validateStatus: (_) => true,
      ),
    );
    final client = ApiClient._(dio, prefs);

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = client.token;
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
    return client;
  }

  String? get token => _prefs.getString(_tokenKey);

  Future<void> setToken(String? value) async {
    if (value == null) {
      await _prefs.remove(_tokenKey);
    } else {
      await _prefs.setString(_tokenKey, value);
    }
  }

  SharedPreferences get prefs => _prefs;

  Map<String, dynamic> _unwrap(Response res) {
    final body = res.data;
    if (body is! Map) {
      throw ApiException('Respons server tidak dikenali', res.statusCode);
    }
    final map = Map<String, dynamic>.from(body);
    if (res.statusCode == null || res.statusCode! >= 400 || map['success'] != true) {
      throw ApiException(
        (map['message'] as String?) ?? 'Permintaan gagal',
        res.statusCode,
      );
    }
    return map;
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Object? data,
    Map<String, dynamic>? query,
  }) async {
    try {
      final res = await _dio.request(
        path,
        data: data,
        queryParameters: query,
        options: Options(method: method),
      );
      return _unwrap(res);
    } on DioException catch (e) {
      throw ApiException(
        e.type == DioExceptionType.connectionError ||
                e.type == DioExceptionType.connectionTimeout
            ? 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
            : e.message ?? 'Permintaan gagal',
      );
    }
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async =>
      (await _send('GET', path, query: query))['data'];

  /// Some list endpoints return `meta` alongside `data`; callers that paginate
  /// use this variant.
  Future<Map<String, dynamic>> getWithMeta(String path,
          {Map<String, dynamic>? query}) async =>
      await _send('GET', path, query: query);

  Future<dynamic> post(String path, [Object? data]) async =>
      (await _send('POST', path, data: data))['data'];

  /// Seperti [post] tetapi menyertakan `message`, dipakai bila teks dari server
  /// perlu ditampilkan apa adanya.
  Future<Map<String, dynamic>> postFull(String path, [Object? data]) async =>
      await _send('POST', path, data: data);

  Future<dynamic> put(String path, [Object? data]) async =>
      (await _send('PUT', path, data: data))['data'];

  Future<dynamic> delete(String path) async =>
      (await _send('DELETE', path))['data'];
}
