import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => statusCode == null ? message : '[$statusCode] $message';
}

class MobileApiClient {
  MobileApiClient({
    required AppConfig config,
    required SupabaseClient? supabaseClient,
  }) : _config = config,
       _supabaseClient = supabaseClient,
       _httpClient = http.Client();

  final AppConfig _config;
  final SupabaseClient? _supabaseClient;
  final http.Client _httpClient;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, String>? queryParameters,
    bool authenticated = true,
  }) async {
    return _sendJson(
      method: 'GET',
      path: path,
      queryParameters: queryParameters,
      authenticated: authenticated,
    );
  }

  Future<Map<String, dynamic>> postJson(
    String path, {
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) async {
    return _sendJson(
      method: 'POST',
      path: path,
      body: body,
      authenticated: authenticated,
    );
  }

  Future<Map<String, dynamic>> patchJson(
    String path, {
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) async {
    return _sendJson(
      method: 'PATCH',
      path: path,
      body: body,
      authenticated: authenticated,
    );
  }

  Future<Map<String, dynamic>> _sendJson({
    required String method,
    required String path,
    Map<String, String>? queryParameters,
    Map<String, dynamic>? body,
    required bool authenticated,
  }) async {
    if (!_config.hasApiConfig) {
      throw const ApiException(
        'API base URL is missing. Add API_BASE_URL with --dart-define or mobile/config/local.json.',
      );
    }

    final uri = Uri.parse(_config.apiBaseUrl)
        .resolve(path)
        .replace(
          queryParameters: queryParameters?.map(
            (key, value) => MapEntry(key, value),
          ),
        );

    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (authenticated) ..._buildAuthHeaders(),
    };

    late http.Response response;
    if (method == 'GET') {
      response = await _httpClient.get(uri, headers: headers);
    } else if (method == 'POST') {
      response = await _httpClient.post(
        uri,
        headers: headers,
        body: jsonEncode(body ?? const <String, dynamic>{}),
      );
    } else if (method == 'PATCH') {
      response = await _httpClient.patch(
        uri,
        headers: headers,
        body: jsonEncode(body ?? const <String, dynamic>{}),
      );
    } else {
      throw ApiException('Unsupported method: $method');
    }

    final payload = _decodeBody(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        _extractMessage(payload) ?? 'Request failed.',
        statusCode: response.statusCode,
      );
    }

    return payload;
  }

  Map<String, String> _buildAuthHeaders() {
    final session = _supabaseClient?.auth.currentSession;
    final accessToken = session?.accessToken ?? '';

    if (accessToken.isEmpty) {
      throw const ApiException(
        'Sign in is required before calling authenticated APIs.',
        statusCode: 401,
      );
    }

    return {'Authorization': 'Bearer $accessToken'};
  }

  Map<String, dynamic> _decodeBody(String rawBody) {
    if (rawBody.trim().isEmpty) {
      return const <String, dynamic>{};
    }

    final decoded = jsonDecode(rawBody);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    if (decoded is Map) {
      return decoded.map((key, value) => MapEntry(key.toString(), value));
    }

    throw const ApiException('Unexpected JSON response shape.');
  }

  String? _extractMessage(Map<String, dynamic> payload) {
    final candidates = [
      payload['message'],
      payload['error'],
      payload['details'],
    ];

    for (final candidate in candidates) {
      if (candidate is String && candidate.trim().isNotEmpty) {
        return candidate.trim();
      }
    }

    return null;
  }

  void dispose() {
    _httpClient.close();
  }
}
