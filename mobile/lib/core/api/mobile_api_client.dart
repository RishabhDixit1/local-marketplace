import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../supabase/app_bootstrap.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => statusCode == null ? message : '[$statusCode] $message';
}

final mobileApiClientProvider = Provider<MobileApiClient>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  final client = MobileApiClient(
    config: bootstrap.config,
    supabaseClient: bootstrap.client,
  );
  ref.onDispose(client.dispose);
  return client;
});

class MobileApiClient {
  static const Duration _requestTimeout = Duration(seconds: 15);

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

  Future<Map<String, dynamic>> uploadFile(
    String path, {
    required String filePath,
    required String fileName,
    required String mediaType,
    String fieldName = 'file',
    Map<String, String>? fields,
    bool authenticated = true,
  }) async {
    if (!_config.hasApiConfig) {
      throw const ApiException(
        'API base URL is missing. Add API_BASE_URL with --dart-define or mobile/config/local.json.',
      );
    }

    final uri = _buildUri(path);
    final request = http.MultipartRequest('POST', uri);
    if (authenticated) {
      request.headers.addAll(_buildAuthHeaders());
    }
    if (fields != null && fields.isNotEmpty) {
      request.fields.addAll(fields);
    }

    try {
      request.files.add(
        await http.MultipartFile.fromPath(
          fieldName,
          filePath,
          filename: fileName,
          contentType: _safeMediaType(mediaType),
        ),
      );

      final streamed = await request.send().timeout(_requestTimeout);
      final response = await http.Response.fromStream(streamed);
      final payload = _decodeBody(response.body);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(
          _extractMessage(payload) ?? 'Upload failed.',
          statusCode: response.statusCode,
        );
      }

      return payload;
    } on SocketException {
      throw const ApiException(
        'Network connection failed. Check your internet and try again.',
      );
    } on TimeoutException {
      throw const ApiException(
        'The server took too long to respond. Please try again.',
      );
    } on http.ClientException {
      throw const ApiException(
        'Unable to reach the server right now. Please try again.',
      );
    }
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

    final uri = _buildUri(path, queryParameters: queryParameters);

    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (authenticated) ..._buildAuthHeaders(),
    };

    try {
      late http.Response response;
      if (method == 'GET') {
        response = await _httpClient
            .get(uri, headers: headers)
            .timeout(_requestTimeout);
      } else if (method == 'POST') {
        response = await _httpClient
            .post(
              uri,
              headers: headers,
              body: jsonEncode(body ?? const <String, dynamic>{}),
            )
            .timeout(_requestTimeout);
      } else if (method == 'PATCH') {
        response = await _httpClient
            .patch(
              uri,
              headers: headers,
              body: jsonEncode(body ?? const <String, dynamic>{}),
            )
            .timeout(_requestTimeout);
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
    } on FormatException {
      throw const ApiException('Unexpected response format from the server.');
    } on SocketException {
      throw const ApiException(
        'Network connection failed. Check your internet and try again.',
      );
    } on TimeoutException {
      throw const ApiException(
        'The server took too long to respond. Please try again.',
      );
    } on http.ClientException {
      throw const ApiException(
        'Unable to reach the server right now. Please try again.',
      );
    }
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

  Uri _buildUri(String path, {Map<String, String>? queryParameters}) {
    return Uri.parse(_config.apiBaseUrl)
        .resolve(path)
        .replace(
          queryParameters: queryParameters?.map(
            (key, value) => MapEntry(key, value),
          ),
        );
  }

  MediaType _safeMediaType(String value) {
    final normalized = value.trim();
    if (normalized.isEmpty) {
      return MediaType('application', 'octet-stream');
    }

    try {
      return MediaType.parse(normalized);
    } on FormatException {
      return MediaType('application', 'octet-stream');
    }
  }

  void dispose() {
    _httpClient.close();
  }
}
