import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../orders/domain/order_models.dart';
import '../domain/mobile_cart_item.dart';

final cartProvider =
    AsyncNotifierProvider<CartNotifier, List<MobileCartItem>>(CartNotifier.new);

class CartNotifier extends AsyncNotifier<List<MobileCartItem>> {
  static const _storageKey = 'serviq_cart_v1';
  static const _schemaKey = 'serviq_cart_schema_v';
  static const _schemaVersion = 3;

  @override
  Future<List<MobileCartItem>> build() async {
    return _load();
  }

  Future<List<MobileCartItem>> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_schemaKey);
    if (v != '$_schemaVersion') {
      await prefs.remove(_storageKey);
      await prefs.setString(_schemaKey, '$_schemaVersion');
      return [];
    }
    final raw = prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) {
      return [];
    }
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
      if (idx < 0) {
        return;
      }
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
    } catch (e) {
      debugPrint('CartNotifier.remove: failed to persist — $e');
    }
  }

  Future<void> clear() async {
    state = const AsyncData([]);
    try {
      await _persist(const []);
    } catch (e) {
      debugPrint('CartNotifier.clear: failed to persist — $e');
    }
  }
}

int cartTotalQuantity(List<MobileCartItem> items) {
  return items.fold<int>(0, (a, b) => a + b.quantity);
}

double cartSubtotalInr(List<MobileCartItem> items) {
  return items.fold<double>(0, (a, b) => a + b.price * b.quantity);
}
