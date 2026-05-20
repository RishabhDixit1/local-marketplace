import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/people/domain/people_snapshot.dart';
import 'cache_manager.dart';

final peopleCacheProvider = Provider<PeopleCache>((ref) => PeopleCache());

class PeopleCache {
  final _cache = AppCacheManager();
  static const _key = 'serviq_cache_people';
  
  Future<void> cachePeople(MobilePeopleSnapshot snapshot) async {
    final prefs = await SharedPreferences.getInstance();
    await _cache.set(_key, jsonEncode(snapshot.toJson()), prefs: prefs);
  }
  
  Future<MobilePeopleSnapshot?> getCachedPeople() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = await _cache.get(_key, prefs: prefs);
    if (raw == null) return null;
    try {
      return MobilePeopleSnapshot.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }
}
