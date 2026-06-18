import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';

class CartRepository {
  CartRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<List<Map<String, dynamic>>> fetchCart() async {
    try {
      final response = await _apiClient.getJson('/api/cart');
      final items = response['items'] as List? ?? [];
      return items.whereType<Map<String, dynamic>>().toList();
    } catch (e) {
      debugPrint('CartRepository.fetchCart: $e');
      return [];
    }
  }

  Future<bool> syncCart(List<Map<String, dynamic>> items) async {
    try {
      await _apiClient.putJson('/api/cart', body: {'items': items}, authenticated: true);
      return true;
    } catch (e) {
      debugPrint('CartRepository.syncCart: $e');
      return false;
    }
  }

  Future<void> clearCart() async {
    try {
      await _apiClient.deleteJson('/api/cart');
    } catch (e) {
      debugPrint('CartRepository.clearCart: $e');
    }
  }
}

final cartRepositoryProvider = Provider<CartRepository>((ref) {
  return CartRepository(ref.watch(mobileApiClientProvider));
});
