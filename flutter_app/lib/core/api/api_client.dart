import 'dart:io';
import 'dart:convert';
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Client for the Servio website backend. Configure a deployed backend with:
/// flutter run --dart-define=API_BASE_URL=https://your-domain.example
class ApiClient {
  ApiClient._();

  static final ApiClient instance = ApiClient._();

  static const String _configuredBaseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  // Development computer's reserved Wi-Fi address. Physical phones on this
  // network use it automatically when no production API URL is configured.
  static const String _localNetworkBaseUrl = 'http://10.16.120.18:5173';

  String? _accessToken;
  static const Duration _requestTimeout = Duration(seconds: 12);

  String get baseUrl {
    // Flutter web runs on this computer; physical phones use the LAN address.
    const fallback = kIsWeb ? 'http://localhost:5173' : _localNetworkBaseUrl;
    final value = _configuredBaseUrl.isEmpty ? fallback : _configuredBaseUrl;
    return value.replaceFirst(RegExp(r'/$'), '');
  }

  void setAccessToken(String? token) => _accessToken = token;

  /// A screen can be opened before the app bootstrap has restored its bearer
  /// token (for example after an Android activity resume). Restore it lazily
  /// so protected client pages do not show an "Authentication required" error.
  Future<void> _restoreSavedTokenIfNeeded() async {
    if (_accessToken != null && _accessToken!.trim().isNotEmpty) return;
    final preferences = await SharedPreferences.getInstance();
    final savedToken = preferences.getString('access_token');
    if (savedToken != null && savedToken.trim().isNotEmpty) {
      _accessToken = savedToken;
    }
  }

  /// Stores a job attachment and returns its metadata from the website API.
  Future<Map<String, dynamic>> uploadFile(File file, {required String purpose}) async {
    await _restoreSavedTokenIfNeeded();
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/api/v1/files'));
    request.headers['accept'] = 'application/json';
    if (_accessToken != null) request.headers['authorization'] = 'Bearer $_accessToken';
    request.fields['purpose'] = purpose;
    request.files.add(
      await http.MultipartFile.fromPath(
        'file',
        file.path,
        filename: file.uri.pathSegments.last,
        contentType: _contentTypeFor(file.path),
      ),
    );

    try {
      final response = await http.Response.fromStream(await request.send());
      return _decodeMapResponse(response);
    } on ApiException {
      rethrow;
    } on Exception {
      throw ApiException('Unable to reach the website server at $baseUrl.');
    }
  }

  /// Resolves a stored file to the short-lived URL the API authorizes.
  Future<String> getFileAccessUrl(int fileId) async {
    final payload = await get('/api/v1/files/$fileId/access');
    final value = payload['url'];
    if (value is! String || value.isEmpty) {
      throw ApiException('The server returned an invalid file access URL.');
    }
    return Uri.parse(value).isAbsolute ? value : '$baseUrl$value';
  }

  Future<Map<String, dynamic>> get(String path, {bool authenticated = true}) =>
      _request('GET', path, authenticated: authenticated);

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? data,
    bool authenticated = true,
  }) =>
      _request('POST', path, data: data, authenticated: authenticated);

  Future<Map<String, dynamic>> patch(
    String path, {
    required Map<String, dynamic> data,
  }) =>
      _request('PATCH', path, data: data);

  Future<List<Map<String, dynamic>>> getList(
    String path, {
    bool authenticated = true,
  }) async {
    if (authenticated) await _restoreSavedTokenIfNeeded();
    final headers = <String, String>{'accept': 'application/json'};
    if (authenticated && _accessToken != null) {
      headers['authorization'] = 'Bearer $_accessToken';
    }
    late final http.Response response;
    dynamic decoded;
    try {
      response = await http
          .get(Uri.parse('$baseUrl$path'), headers: headers)
          .timeout(_requestTimeout);
      decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    } on TimeoutException {
      throw ApiException('The server took too long to respond. Please try again.');
    } on Exception {
      throw ApiException('Unable to reach the website server at $baseUrl.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = decoded is Map<String, dynamic> ? decoded['error'] : null;
      throw ApiException(
        error is Map ? (error['message'] ?? 'Request failed').toString() : 'Request failed',
        statusCode: response.statusCode,
      );
    }
    final payload = decoded is Map<String, dynamic> ? decoded['data'] : null;
    if (payload is! List) throw ApiException('The server returned an invalid list.');
    return payload.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? data,
    bool authenticated = true,
  }) async {
    if (authenticated) await _restoreSavedTokenIfNeeded();
    final headers = <String, String>{'accept': 'application/json'};
    if (data != null) headers['content-type'] = 'application/json';
    if (authenticated && _accessToken != null) {
      headers['authorization'] = 'Bearer $_accessToken';
    }

    final uri = Uri.parse('$baseUrl$path');
    late final http.Response response;
    try {
      response = switch (method) {
        'GET' => await http.get(uri, headers: headers).timeout(_requestTimeout),
        'POST' => await http
            .post(uri, headers: headers, body: jsonEncode(data))
            .timeout(_requestTimeout),
        'PATCH' => await http
            .patch(uri, headers: headers, body: jsonEncode(data))
            .timeout(_requestTimeout),
        _ => throw UnsupportedError('Unsupported HTTP method: $method'),
      };
    } on Exception catch (_) {
      throw ApiException('Unable to reach the website server at $baseUrl.');
    }

    return _decodeMapResponse(response);
  }

  Map<String, dynamic> _decodeMapResponse(http.Response response) {
    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = decoded is Map ? decoded['error'] : null;
      final message = error is Map
          ? (error['message'] ?? 'Request failed').toString()
          : decoded is Map
              ? (decoded['message'] ?? 'Request failed').toString()
              : 'Request failed';
      throw ApiException(message, statusCode: response.statusCode, details: error is Map ? error['details'] : null);
    }
    if (decoded is! Map) throw ApiException('The server returned an invalid response.');
    final responseData = decoded['data'];
    if (responseData is Map) return Map<String, dynamic>.from(responseData);
    return Map<String, dynamic>.from(decoded);
  }

  MediaType _contentTypeFor(String path) {
    final extension = path.split('.').last.toLowerCase();
    return switch (extension) {
      'jpg' || 'jpeg' => MediaType('image', 'jpeg'),
      'png' => MediaType('image', 'png'),
      'webp' => MediaType('image', 'webp'),
      'pdf' => MediaType('application', 'pdf'),
      _ => MediaType('application', 'octet-stream'),
    };
  }
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.details});
  final String message;
  final int? statusCode;
  final dynamic details;

  @override
  String toString() => message;
}
