import 'package:shared_preferences/shared_preferences.dart';

class CacheEntry<T> {
  final T data;
  final DateTime cachedAt;
  final Duration ttl;
  
  CacheEntry({required this.data, DateTime? cachedAt, this.ttl = const Duration(minutes: 5)})
    : cachedAt = cachedAt ?? DateTime.now();
  
  bool get isExpired => DateTime.now().difference(cachedAt) > ttl;
}

class AppCacheManager {
  static const _prefix = 'serviq_cache_';
  
  Future<void> set(String key, String value, {SharedPreferences? prefs}) async {
    final p = prefs ?? await SharedPreferences.getInstance();
    await p.setString('$_prefix$key', value);
  }
  
  Future<String?> get(String key, {SharedPreferences? prefs}) async {
    final p = prefs ?? await SharedPreferences.getInstance();
    return p.getString('$_prefix$key');
  }
  
  Future<void> remove(String key, {SharedPreferences? prefs}) async {
    final p = prefs ?? await SharedPreferences.getInstance();
    await p.remove('$_prefix$key');
  }
  
  Future<void> clear({SharedPreferences? prefs}) async {
    final p = prefs ?? await SharedPreferences.getInstance();
    final keys = p.getKeys().where((k) => k.startsWith(_prefix));
    for (final key in keys) {
      await p.remove(key);
    }
  }
}
