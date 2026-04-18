import 'dart:async';
import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../api/mobile_api_client.dart';
import 'app_exception.dart';

class AppErrorMapper {
  const AppErrorMapper._();

  static String toMessage(
    Object error, {
    String fallback = 'Something went wrong. Please try again.',
  }) {
    if (error is AppException && error.message.trim().isNotEmpty) {
      return error.message.trim();
    }

    if (error is ApiException && error.message.trim().isNotEmpty) {
      return error.message.trim();
    }

    if (error is AuthException && error.message.trim().isNotEmpty) {
      return error.message.trim();
    }

    if (error is SocketException) {
      return 'Network connection lost. Check your internet and try again.';
    }

    if (error is TimeoutException) {
      return 'The request took too long. Please try again.';
    }

    final raw = error.toString().trim();
    if (raw.isEmpty) {
      return fallback;
    }

    return raw;
  }
}
