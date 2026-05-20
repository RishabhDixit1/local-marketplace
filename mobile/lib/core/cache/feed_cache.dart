import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/feed/domain/feed_snapshot.dart';
import 'cache_manager.dart';

final feedCacheProvider = Provider<FeedCache>((ref) => FeedCache());

class FeedCache {
  final _cache = AppCacheManager();
  static const _key = 'serviq_cache_feed';
  
  Future<void> cacheFeed(MobileFeedSnapshot snapshot) async {
    final prefs = await SharedPreferences.getInstance();
    await _cache.set(_key, jsonEncode(snapshot.toJson()), prefs: prefs);
  }
  
  Future<MobileFeedSnapshot?> getCachedFeed() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = await _cache.get(_key, prefs: prefs);
    if (raw == null) return null;
    try {
      return MobileFeedSnapshot.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }
}
