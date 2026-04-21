import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

import '../config/app_config.dart';

class DebugHttpOverrides extends HttpOverrides {
  DebugHttpOverrides(this._allowedHosts);

  final Set<String> _allowedHosts;

  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final client = super.createHttpClient(context);
    client.badCertificateCallback = (cert, host, port) {
      final normalizedHost = host.toLowerCase();
      final shouldTrust = _allowedHosts.contains(normalizedHost);

      if (shouldTrust) {
        debugPrint(
          'ServiQ mobile: accepting debug TLS certificate for '
          '$normalizedHost:$port issued by ${cert.issuer}.',
        );
      }

      return shouldTrust;
    };
    return client;
  }
}

class DebugNetworkTrust {
  static bool _installed = false;

  static void installIfNeeded(AppConfig config) {
    if (_installed) {
      return;
    }

    final allowedHosts = _allowedHosts(config);
    if (allowedHosts == null) {
      return;
    }

    HttpOverrides.global = DebugHttpOverrides(allowedHosts);
    _installed = true;

    debugPrint(
      'ServiQ mobile: installed debug TLS override for '
      '${allowedHosts.join(', ')}.',
    );
  }

  static http.Client? createHttpClient(AppConfig config) {
    final allowedHosts = _allowedHosts(config);
    if (allowedHosts == null) {
      return null;
    }

    debugPrint(
      'ServiQ mobile: created debug TLS client for '
      '${allowedHosts.join(', ')}.',
    );

    return IOClient(_createScopedHttpClient(allowedHosts));
  }

  static Set<String>? _allowedHosts(AppConfig config) {
    if (!kDebugMode || !Platform.isAndroid || !config.allowBadCertificates) {
      return null;
    }

    final allowedHosts = <String>{
      if (config.supabaseHost.isNotEmpty) config.supabaseHost,
      ..._httpsHostsFrom(config.apiBaseUrl),
    };

    if (allowedHosts.isEmpty) {
      return null;
    }

    return allowedHosts;
  }

  static HttpClient _createScopedHttpClient(Set<String> allowedHosts) {
    final client = HttpClient();
    client.badCertificateCallback = (cert, host, port) {
      final normalizedHost = host.toLowerCase();
      final shouldTrust = allowedHosts.contains(normalizedHost);

      if (shouldTrust) {
        debugPrint(
          'ServiQ mobile: accepting debug TLS certificate for '
          '$normalizedHost:$port issued by ${cert.issuer}.',
        );
      }

      return shouldTrust;
    };
    return client;
  }

  static Iterable<String> _httpsHostsFrom(String rawUrl) sync* {
    final uri = Uri.tryParse(rawUrl.trim());
    if (uri == null || uri.scheme.toLowerCase() != 'https') {
      return;
    }

    final host = uri.host.toLowerCase();
    if (host.isNotEmpty) {
      yield host;
    }
  }
}
