import 'dart:convert';

import 'package:http/http.dart' as http;

/// Client for the Servio website backend. Configure a deployed backend with:
/// flutter run --dart-define=API_BASE_URL=https://your-domain.example
class ApiClient {
  ApiClient._();

  static final ApiClient instance = ApiClient._();

  static const String _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5173',
  );

  String? _accessToken;

  String get baseUrl => _configuredBaseUrl.replaceFirst(RegExp(r'/$'), '');

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
      final message = decoded is Map<String, dynamic>
          ? (decoded['message'] ?? decoded['error'] ?? 'Request failed').toString()
          : 'Request failed';
      throw ApiException(message, statusCode: response.statusCode);
    }
    if (decoded is! Map<String, dynamic>) {
      throw ApiException('The server returned an invalid response.');
    }
    return decoded;
  }
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}
