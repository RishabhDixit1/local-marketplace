import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http_parser/http_parser.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../network/rate_limiter.dart';

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
    RateLimiter? rateLimiter,
  }) : _config = config,
       _supabaseClient = supabaseClient,
       _httpClient = http.Client(),
       _rateLimiter = rateLimiter ?? RateLimiter();

  final AppConfig _config;
  final SupabaseClient? _supabaseClient;
  final http.Client _httpClient;
  final RateLimiter _rateLimiter;
  static Completer<void>? _refreshCompleter;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, String>? queryParameters,
    bool authenticated = true,
  }) {
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
  }) {
    return _sendJson(
      method: 'POST',
      path: path,
      body: body,
      authenticated: authenticated,
    );
  }

  /// POST with a JSON array body (for APIs that expect List at top level).
  Future<Map<String, dynamic>> postJsonArray(
    String path, {
    required List<Object> body,
    bool authenticated = true,
  }) {
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
  }) {
    return _sendJson(
      method: 'PATCH',
      path: path,
      body: body,
      authenticated: authenticated,
    );
  }

  Future<Map<String, dynamic>> deleteJson(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? queryParameters,
    bool authenticated = true,
  }) {
    return _sendJson(
      method: 'DELETE',
      path: path,
      body: body,
      queryParameters: queryParameters,
      authenticated: authenticated,
    );
  }

  // ── Locality & Service Category helpers ──

  Future<List<Map<String, dynamic>>> getLocalities({
    String? zoneType,
    int? phase,
  }) async {
    final params = <String, String>{};
    if (zoneType != null) params['zone_type'] = zoneType;
    if (phase != null) params['phase'] = phase.toString();

    final response = await getJson(
      '/api/localities',
      queryParameters: params.isNotEmpty ? params : null,
      authenticated: false,
    );

    final list = (response['localities'] as List?) ?? <dynamic>[];
    return list.whereType<Map>().cast<Map<String, dynamic>>().toList();
  }

  Future<List<Map<String, dynamic>>> getServiceCategories({
    String? localityId,
  }) async {
    final params = <String, String>{};
    if (localityId != null) params['locality_id'] = localityId;

    final response = await getJson(
      '/api/service-categories',
      queryParameters: params.isNotEmpty ? params : null,
      authenticated: false,
    );

    final list = (response['categories'] as List?) ?? <dynamic>[];
    return list.whereType<Map>().cast<Map<String, dynamic>>().toList();
  }

  Future<List<Map<String, dynamic>>> getLocalityProviders(
    String localityId, {
    String? categoryId,
    int limit = 20,
    int offset = 0,
  }) async {
    final params = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
    if (categoryId != null) params['category_id'] = categoryId;

    final response = await getJson(
      '/api/localities/$localityId/providers',
      queryParameters: params,
      authenticated: false,
    );

    final list = (response['providers'] as List?) ?? <dynamic>[];
    return list.whereType<Map>().cast<Map<String, dynamic>>().toList();
  }

  Future<Map<String, dynamic>> postOnboardLocality({
    required String localityId,
    List<String> serviceZoneIds = const [],
    List<String> serviceCategoryIds = const [],
    double serviceAreaRadiusKm = 3.0,
  }) async {
    return postJson(
      '/api/providers/onboard-locality',
      body: {
        'locality_id': localityId,
        'service_zone_ids': serviceZoneIds,
        'service_category_ids': serviceCategoryIds,
        'service_area_radius_km': serviceAreaRadiusKm,
      },
      authenticated: true,
    );
  }

  Future<Map<String, dynamic>> searchProviders({
    String? category,
    String? search,
    double? lat,
    double? lng,
    int limit = 50,
    int offset = 0,
    double? minRating,
    bool onlineOnly = false,
    String sortBy = 'distance',
  }) async {
    final params = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
    if (category != null && category.isNotEmpty) params['category'] = category;
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (lat != null) params['lat'] = lat.toString();
    if (lng != null) params['lng'] = lng.toString();
    if (minRating != null) params['minRating'] = minRating.toString();
    if (onlineOnly) params['onlineOnly'] = 'true';
    if (['distance', 'rating', 'jobs', 'response', 'featured'].contains(sortBy)) {
      params['sortBy'] = sortBy;
    }

    return getJson(
      '/api/community/providers-by-category',
      queryParameters: params,
      authenticated: false,
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
    bool isRetry = false,
  }) async {
    if (!_config.hasApiConfig) {
      throw const ApiException(
        'API base URL is missing. Add API_BASE_URL with --dart-define or mobile/config/local.json.',
      );
    }

    final uri = _buildUri(path);
    final request = http.MultipartRequest('POST', uri);
    if (authenticated) {
      request.headers.addAll(await _buildAuthHeaders());
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
        if (response.statusCode == 401 && authenticated && !isRetry) {
          final refreshed = await _tryRefreshSession();
          if (refreshed) {
            return uploadFile(
              path,
              filePath: filePath,
              fileName: fileName,
              mediaType: mediaType,
              fieldName: fieldName,
              fields: fields,
              authenticated: authenticated,
              isRetry: true,
            );
          }
        }
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
    Object? body,
    required bool authenticated,
    bool isRetry = false,
  }) async {
    if (!_config.hasApiConfig) {
      throw const ApiException(
        'API base URL is missing. Add API_BASE_URL with --dart-define or mobile/config/local.json.',
      );
    }

    final uri = _buildUri(path, queryParameters: queryParameters);

    final rateLimitKey = '$method ${uri.path}';
    if (!_rateLimiter.tryConsume(rateLimitKey)) {
      throw RateLimitExceeded('API request', retryAfterMs: 1000);
    }

    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (authenticated) ...await _buildAuthHeaders(),
    };

    late http.Response response;
    try {
      switch (method) {
        case 'GET':
          response = await _httpClient
              .get(uri, headers: headers)
              .timeout(_requestTimeout);
        case 'POST':
          response = await _httpClient
              .post(
                uri,
                headers: headers,
                body: jsonEncode(body ?? <String, dynamic>{}),
              )
              .timeout(_requestTimeout);
        case 'PATCH':
          response = await _httpClient
              .patch(
                uri,
                headers: headers,
                body: jsonEncode(body ?? <String, dynamic>{}),
              )
              .timeout(_requestTimeout);
        case 'DELETE':
          response = await _httpClient
              .delete(
                uri,
                headers: headers,
                body: jsonEncode(body ?? <String, dynamic>{}),
              )
              .timeout(_requestTimeout);
        default:
          throw ApiException('Unsupported method: $method');
      }
    } on TimeoutException {
      throw ApiException(
        'The API request timed out after ${_requestTimeout.inSeconds} seconds. '
        'Check that ${_describeBaseUrl()} is reachable from this device.',
      );
    } on SocketException catch (error) {
      throw ApiException(_buildSocketErrorMessage(uri, error));
    } on http.ClientException catch (error) {
      throw ApiException(
        'The mobile client could not reach ${uri.origin}. '
        'Check API_BASE_URL and confirm the local server is running. '
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
      if (response.statusCode == 401 && authenticated && !isRetry) {
        final refreshed = await _tryRefreshSession();
        if (refreshed) {
          return _sendJson(
            method: method,
            path: path,
            queryParameters: queryParameters,
            body: body,
            authenticated: authenticated,
            isRetry: true,
          );
        }
      }
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

    if ((Platform.isIOS || Platform.isMacOS) &&
        _isAndroidEmulatorHostAlias(parsed.host)) {
      return parsed.replace(host: '127.0.0.1');
    }

    return parsed;
  }

  bool _isAndroidLocalhostAlias(String host) {
    final normalized = host.trim().toLowerCase();
    return normalized == 'localhost' ||
        normalized == '127.0.0.1' ||
        normalized == '0.0.0.0';
  }

  bool _isAndroidEmulatorHostAlias(String host) {
    return host.trim().toLowerCase() == '10.0.2.2';
  }

  String _describeBaseUrl() => _resolveBaseUri().origin;

  String _buildSocketErrorMessage(Uri uri, SocketException error) {
    final code = error.osError?.errorCode;
    final refused = code == 61 || code == 111;
    final originalHost = Uri.parse(_config.apiBaseUrl.trim()).host;
    final androidLocalhostHint =
        !kIsWeb && Platform.isAndroid && _isAndroidLocalhostAlias(originalHost)
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

  Future<Map<String, String>> _buildAuthHeaders() async {
    var session = _supabaseClient?.auth.currentSession;
    var accessToken = session?.accessToken ?? '';

    if (accessToken.isEmpty) {
      await _tryRefreshSession();
      session = _supabaseClient?.auth.currentSession;
      accessToken = session?.accessToken ?? '';
    }

    if (accessToken.isEmpty) {
      throw const ApiException(
        'Sign in is required before calling authenticated APIs.',
        statusCode: 401,
      );
    }

    return {'Authorization': 'Bearer $accessToken'};
  }

  Future<bool> _tryRefreshSession() async {
    final client = _supabaseClient;
    if (client == null) return false;
    if (_refreshCompleter != null) {
      await _refreshCompleter!.future;
      return client.auth.currentSession != null;
    }
    _refreshCompleter = Completer<void>();
    try {
      final session = client.auth.currentSession;
      if (session == null) return false;
      await client.auth.refreshSession();
      return client.auth.currentSession != null;
    } catch (e) {
      return false;
    } finally {
      _refreshCompleter?.complete();
      _refreshCompleter = null;
    }
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
      final is404 = statusCode == 404;
      throw ApiException(
        'The server returned HTML instead of JSON for $target'
        '${statusCode == null ? '' : ' (HTTP $statusCode)'}. '
        '${is404 ? 'This route may not exist on the API - check the endpoint path.' : 'This usually means the Next.js route crashed or returned an error page.'} '
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

  Uri _buildUri(String path, {Map<String, String>? queryParameters}) {
    return _resolveBaseUri()
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
