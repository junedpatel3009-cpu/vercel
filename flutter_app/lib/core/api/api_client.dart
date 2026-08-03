import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

/// Client for the Servio website backend. Configure a deployed backend with:
/// flutter run --dart-define=API_BASE_URL=https://your-domain.example
class ApiClient {
  ApiClient._();

  static final ApiClient instance = ApiClient._();

  // Development computer's reserved Wi-Fi address. This lets physical phones
  // on the same network use the local server without a dart-define flag.
  static const String _localNetworkBaseUrl = 'http://192.168.31.114:5173';

  static const String _configuredBaseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  String? _accessToken;

  String get baseUrl {
    // The Android emulator reaches the host through 10.0.2.2. Flutter web
    // runs in the desktop browser, where the correct local host is localhost.
    // Vite serves this project on port 5173 by default. Physical phones use
    // the computer's Wi-Fi address; Flutter web on this computer uses localhost.
    final fallback = kIsWeb ? 'http://localhost:5173' : _localNetworkBaseUrl;
    final value = _configuredBaseUrl.isEmpty ? fallback : _configuredBaseUrl;
    return value.replaceFirst(RegExp(r'/$'), '');
  }

  void setAccessToken(String? token) => _accessToken = token;

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
    final headers = <String, String>{'accept': 'application/json'};
    if (authenticated && _accessToken != null) {
      headers['authorization'] = 'Bearer $_accessToken';
    }
    final response = await http.get(Uri.parse('$baseUrl$path'), headers: headers);
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
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
    final headers = <String, String>{'accept': 'application/json'};
    if (data != null) headers['content-type'] = 'application/json';
    if (authenticated && _accessToken != null) {
      headers['authorization'] = 'Bearer $_accessToken';
    }

    final uri = Uri.parse('$baseUrl$path');
    late final http.Response response;
    try {
      response = switch (method) {
        'GET' => await http.get(uri, headers: headers),
        'POST' => await http.post(uri, headers: headers, body: jsonEncode(data)),
        'PATCH' => await http.patch(uri, headers: headers, body: jsonEncode(data)),
        _ => throw UnsupportedError('Unsupported HTTP method: $method'),
      };
    } on Exception catch (_) {
      throw ApiException('Unable to reach the website server at $baseUrl.');
    }

    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = decoded is Map<String, dynamic> ? decoded['error'] : null;
      final message = error is Map
          ? (error['message'] ?? 'Request failed').toString()
          : decoded is Map<String, dynamic>
              ? (decoded['message'] ?? 'Request failed').toString()
              : 'Request failed';
      final details = error is Map ? error['details'] : null;
      throw ApiException(message, statusCode: response.statusCode, details: details);
    }
    if (decoded is! Map<String, dynamic>) {
      throw ApiException('The server returned an invalid response.');
    }
    // The website serializes successful API payloads as { "data": { ... } }.
    // Flutter uses the inner object so all endpoint callers have one shape.
    final responseData = decoded['data'];
    if (responseData is Map) return Map<String, dynamic>.from(responseData);
    return decoded;
  }

  /// Uploads one file to the backend's generic file-storage endpoint
  /// (`POST /api/v1/files`, multipart) and returns its stored metadata
  /// (`id`, `fileName`, `mimeType`, `sizeBytes`). Pair with
  /// [getFileAccessUrl] to obtain a shareable preview link for it.
  Future<Map<String, dynamic>> uploadFile(File file, {String purpose = 'document'}) async {
    final uri = Uri.parse('$baseUrl/api/v1/files');
    final request = http.MultipartRequest('POST', uri)..fields['purpose'] = purpose;
    if (_accessToken != null) {
      request.headers['authorization'] = 'Bearer $_accessToken';
    }
    request.files.add(
      await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: MediaType.parse(_guessMimeType(file.path)),
      ),
    );

    late final http.StreamedResponse streamed;
    try {
      streamed = await request.send();
    } on Exception catch (_) {
      throw ApiException('Unable to reach the website server at $baseUrl.');
    }
    final response = await http.Response.fromStream(streamed);
    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = decoded is Map<String, dynamic> ? decoded['error'] : null;
      throw ApiException(
        error is Map ? (error['message'] ?? 'Upload failed').toString() : 'Upload failed',
        statusCode: response.statusCode,
        details: error is Map ? error['details'] : null,
      );
    }
    final responseData = decoded is Map<String, dynamic> ? decoded['data'] : null;
    if (responseData is! Map) throw ApiException('The server returned an invalid response.');
    return Map<String, dynamic>.from(responseData);
  }

  /// Exchanges a stored file id for the short-lived signed download URL
  /// required by `GET /api/v1/files/:id/access`.
  Future<String> getFileAccessUrl(int fileId) async {
    final result = await get('/api/v1/files/$fileId/access');
    return result['url'] as String;
  }

  String _guessMimeType(String filePath) {
    switch (filePath.toLowerCase().split('.').last) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
      default:
        return 'image/jpeg';
    }
  }
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.details});
  final String message;
  final int? statusCode;
  final Object? details;

  @override
  String toString() => message;
}
