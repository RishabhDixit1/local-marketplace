import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SecureLocalStorage extends LocalStorage {
  SecureLocalStorage({required this.persistSessionKey})
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
        );

  final String persistSessionKey;
  final FlutterSecureStorage _storage;

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasAccessToken() async {
    final token = await _storage.read(key: persistSessionKey);
    return token != null;
  }

  @override
  Future<String?> accessToken() async {
    return _storage.read(key: persistSessionKey);
  }

  @override
  Future<void> removePersistedSession() async {
    await _storage.delete(key: persistSessionKey);
  }

  @override
  Future<void> persistSession(String persistSessionString) async {
    await _storage.write(key: persistSessionKey, value: persistSessionString);
  }
}

class SecureGotrueAsyncStorage extends GotrueAsyncStorage {
  SecureGotrueAsyncStorage()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
        );

  final FlutterSecureStorage _storage;

  @override
  Future<String?> getItem({required String key}) async {
    return _storage.read(key: key);
  }

  @override
  Future<void> removeItem({required String key}) async {
    await _storage.delete(key: key);
  }

  @override
  Future<void> setItem({required String key, required String value}) async {
    await _storage.write(key: key, value: value);
  }
}
