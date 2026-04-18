import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
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

    final uri = _resolveBaseUri()
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
    try {
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
    } on TimeoutException {
      throw ApiException(
        'The API request timed out after '
        '${_requestTimeout.inSeconds} seconds. '
        'Check that ${_describeBaseUrl()} is reachable from this device.',
      );
    } on SocketException catch (error) {
      throw ApiException(_buildSocketErrorMessage(uri, error));
    } on http.ClientException catch (error) {
      throw ApiException(
        'The mobile client could not reach ${uri.origin}. '
        'Check API_BASE_URL and confirm the local Next.js server is running. '
        'Details: ${error.message}',
      );
    }

    final payload = _decodeBody(
      response.body,
      contentType: response.headers['content-type'],
      statusCode: response.statusCode,
      requestUri: uri,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        _extractMessage(payload) ?? 'Request failed.',
        statusCode: response.statusCode,
      );
    }

    return payload;
  }

  Uri _resolveBaseUri() {
    final parsed = Uri.parse(_config.apiBaseUrl.trim());
    if (kIsWeb) {
      return parsed;
    }

    if (Platform.isAndroid && _isAndroidLocalhostAlias(parsed.host)) {
      return parsed.replace(host: '10.0.2.2');
    }

    return parsed;
  }

  bool _isAndroidLocalhostAlias(String host) {
    final normalized = host.trim().toLowerCase();
    return normalized == 'localhost' ||
        normalized == '127.0.0.1' ||
        normalized == '0.0.0.0';
  }

  String _describeBaseUrl() => _resolveBaseUri().origin;

  String _buildSocketErrorMessage(Uri uri, SocketException error) {
    final code = error.osError?.errorCode;
    final refused = code == 61 || code == 111;
    final androidLocalhostHint =
        !kIsWeb &&
            Platform.isAndroid &&
            _isAndroidLocalhostAlias(Uri.parse(_config.apiBaseUrl.trim()).host)
        ? ' Android emulators must use 10.0.2.2 instead of localhost.'
        : '';

    if (refused) {
      return 'Connection refused for ${uri.origin}. '
          'No server is accepting requests there right now. '
          'Start the local web/API server with `npm run dev`, '
          'or update API_BASE_URL if your backend is running elsewhere.'
          '$androidLocalhostHint';
    }

    return 'The mobile client could not connect to ${uri.origin}. '
        'Check API_BASE_URL, device networking, and whether the backend is reachable. '
        'Details: ${error.message}';
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

  Map<String, dynamic> _decodeBody(
    String rawBody, {
    String? contentType,
    int? statusCode,
    Uri? requestUri,
  }) {
    if (rawBody.trim().isEmpty) {
      return const <String, dynamic>{};
    }

    final normalizedContentType = (contentType ?? '').toLowerCase();
    final looksLikeHtml =
        normalizedContentType.contains('text/html') ||
        rawBody.trimLeft().startsWith('<!DOCTYPE html') ||
        rawBody.trimLeft().startsWith('<html');

    if (looksLikeHtml) {
      final target = requestUri?.path.isNotEmpty == true
          ? requestUri!.path
          : (requestUri?.origin ?? 'the API route');
      final preview = _bodyPreview(rawBody);
      throw ApiException(
        'The server returned HTML instead of JSON for $target'
        '${statusCode == null ? '' : ' (HTTP $statusCode)'}. '
        'This usually means the Next.js route crashed or returned an error page. '
        'Check the local web server logs.'
        '${preview.isEmpty ? '' : ' Response preview: $preview'}',
        statusCode: statusCode,
      );
    }

    try {
      final decoded = jsonDecode(rawBody);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }

      if (decoded is Map) {
        return decoded.map((key, value) => MapEntry(key.toString(), value));
      }
    } on FormatException catch (error) {
      throw ApiException(
        'The server returned an invalid JSON response'
        '${statusCode == null ? '' : ' (HTTP $statusCode)'}. '
        'Check the API route and local server logs. '
        'Details: ${error.message}',
        statusCode: statusCode,
      );
    }

    throw const ApiException('Unexpected JSON response shape.');
  }

  String _bodyPreview(String rawBody) {
    final collapsed = rawBody.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (collapsed.isEmpty) {
      return '';
    }

    const maxLength = 120;
    if (collapsed.length <= maxLength) {
      return collapsed;
    }

    return '${collapsed.substring(0, maxLength)}...';
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
