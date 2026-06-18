import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../orders/domain/order_models.dart';
import '../data/cart_repository.dart';
import '../domain/mobile_cart_item.dart';

final cartProvider =
    AsyncNotifierProvider<CartNotifier, List<MobileCartItem>>(CartNotifier.new);

class CartNotifier extends AsyncNotifier<List<MobileCartItem>> {
  static const _storageKey = 'serviq_cart_v1';
  static const _schemaKey = 'serviq_cart_schema_v';
  static const _schemaVersion = 3;

  Timer? _syncTimer;

  @override
  Future<List<MobileCartItem>> build() async {
    final local = await _load();
    ref.onDispose(() => _syncTimer?.cancel());
    // Attempt server sync after local load (fire-and-forget merge)
    _syncFromServer(local);
    return local;
  }

  void cancelSyncTimer() {
    _syncTimer?.cancel();
  }

  // ── Local persistence ─────────────────────────────────────────────

  Future<List<MobileCartItem>> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_schemaKey);
    if (v != '$_schemaVersion') {
      await prefs.remove(_storageKey);
      await prefs.setString(_schemaKey, '$_schemaVersion');
      return [];
    }
    final raw = prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final parsed = jsonDecode(raw) as List<dynamic>;
      return parsed
          .whereType<Map<String, dynamic>>()
          .map(MobileCartItem.fromJson)
          .where((e) => e.quantity > 0)
          .toList();
    } catch (_) {
      await prefs.remove(_storageKey);
      return [];
    }
  }

  Future<void> _persist(List<MobileCartItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_schemaKey, '$_schemaVersion');
    await prefs.setString(
      _storageKey,
      jsonEncode(items.map((e) => e.toJson()).toList()),
    );
  }

  // ── Server sync ───────────────────────────────────────────────────

  Future<void> _syncFromServer(List<MobileCartItem> localItems) async {
    try {
      final session = Supabase.instance.client.auth.currentSession;
      if (session == null) return;

      final repo = ref.read(cartRepositoryProvider);
      final serverItems = await repo.fetchCart();
      if (serverItems.isEmpty && localItems.isNotEmpty) {
        // First sync — push local to server
        await repo.syncCart(localItems.map((e) => e.toJson()).toList());
      } else if (serverItems.isNotEmpty) {
        // Merge server items with local
        final merged = _merge(
          localItems,
          serverItems.map(MobileCartItem.fromServerJson).toList(),
        );
        state = AsyncData(merged);
        await _persist(merged);
        // Push merged state back to server
        await repo.syncCart(merged.map((e) => e.toJson()).toList());
      }
    } catch (e) {
      debugPrint('CartNotifier._syncFromServer: $e');
    }
  }

  List<MobileCartItem> _merge(
    List<MobileCartItem> local,
    List<MobileCartItem> server,
  ) {
    if (server.isEmpty) return local;
    if (local.isEmpty) return server;
    final map = <String, MobileCartItem>{};
    for (final item in server) {
      map[item.key] = item;
    }
    for (final item in local) {
      if (!map.containsKey(item.key)) {
        map[item.key] = item;
      }
    }
    return map.values.toList();
  }

  Future<void> _debouncedSync() async {
    _syncTimer?.cancel();
    _syncTimer = Timer(const Duration(seconds: 2), () async {
      try {
        final session = Supabase.instance.client.auth.currentSession;
        if (session == null) return;
      final repo = ref.read(cartRepositoryProvider);
      final items = state.asData?.value ?? [];
      await repo.syncCart(items.map((e) => e.toJson()).toList());
      } catch (e) {
        debugPrint('CartNotifier._debouncedSync: $e');
      }
    });
  }

  // ── Mutations ─────────────────────────────────────────────────────

  Future<void> addListing(
    MobileCheckoutItem item, {
    required String providerName,
  }) async {
    final nextItem = MobileCartItem.fromCheckout(
      item,
      providerName: providerName,
    );
    final list = List<MobileCartItem>.from(state.value ?? []);
    final idx = list.indexWhere((e) => e.key == nextItem.key);
    if (idx >= 0) {
      final existing = list[idx];
      list[idx] = MobileCartItem(
        key: existing.key,
        itemType: existing.itemType,
        itemId: existing.itemId,
        providerId: existing.providerId,
        providerName: existing.providerName,
        title: existing.title,
        price: existing.price,
        quantity: existing.quantity + nextItem.quantity,
      );
    } else {
      list.add(nextItem);
    }
    state = AsyncData(list);
    try {
      await _persist(list);
      await _debouncedSync();
    } catch (e) {
      debugPrint('CartNotifier.addListing: failed to persist — $e');
    }
  }

  Future<void> setQuantity(String key, int quantity) async {
    final list = List<MobileCartItem>.from(state.value ?? []);
    if (quantity <= 0) {
      list.removeWhere((e) => e.key == key);
    } else {
      final idx = list.indexWhere((e) => e.key == key);
      if (idx < 0) return;
      final existing = list[idx];
      list[idx] = MobileCartItem(
        key: existing.key,
        itemType: existing.itemType,
        itemId: existing.itemId,
        providerId: existing.providerId,
        providerName: existing.providerName,
        title: existing.title,
        price: existing.price,
        quantity: quantity,
      );
    }
    state = AsyncData(list);
    try {
      await _persist(list);
      await _debouncedSync();
    } catch (e) {
      debugPrint('CartNotifier.setQuantity: failed to persist — $e');
    }
  }

  Future<void> remove(String key) async {
    final list =
        (state.value ?? []).where((e) => e.key != key).toList(growable: false);
    state = AsyncData(list);
    try {
      await _persist(list);
      await _debouncedSync();
    } catch (e) {
      debugPrint('CartNotifier.remove: failed to persist — $e');
    }
  }

  Future<void> clear() async {
    state = const AsyncData([]);
    try {
      await _persist(const []);
      // Also clear server cart
      try {
        final session = Supabase.instance.client.auth.currentSession;
        if (session != null) {
          final repo = ref.read(cartRepositoryProvider);
          await repo.clearCart();
        }
      } catch (_) {}
    } catch (e) {
      debugPrint('CartNotifier.clear: failed to persist — $e');
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

int cartTotalQuantity(List<MobileCartItem> items) {
  return items.fold<int>(0, (a, b) => a + b.quantity);
}

double cartSubtotalInr(List<MobileCartItem> items) {
  return items.fold<double>(0, (a, b) => a + b.price * b.quantity);
}
