import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/theme/app_theme.dart';
import '../application/cart_notifier.dart';
import '../domain/mobile_cart_item.dart';

Future<void> showServiqCartSheet(BuildContext context) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) {
      return Consumer(
        builder: (_, ref, _) {
          final cartAsync = ref.watch(cartProvider);
          return cartAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, _) => Padding(
              padding: const EdgeInsets.all(24),
              child: Text(error.toString()),
            ),
            data: (items) => _CartSheetBody(
              items: items,
              maxHeight: MediaQuery.sizeOf(context).height * 0.55,
              onCheckout: items.isEmpty
                  ? null
                  : () {
                      Navigator.of(sheetContext).pop();
                      context.push(AppRoutes.checkoutFromCart);
                    },
              onQuantity: (key, qty) =>
                  ref.read(cartProvider.notifier).setQuantity(key, qty),
              onRemove: (key) => ref.read(cartProvider.notifier).remove(key),
            ),
          );
        },
      );
    },
  );
}

class _CartSheetBody extends StatelessWidget {
  const _CartSheetBody({
    required this.items,
    required this.maxHeight,
    required this.onCheckout,
    required this.onQuantity,
    required this.onRemove,
  });

  final List<MobileCartItem> items;
  final double maxHeight;
  final VoidCallback? onCheckout;
  final void Function(String key, int quantity) onQuantity;
  final void Function(String key) onRemove;

  @override
  Widget build(BuildContext context) {
    final total = cartSubtotalInr(items);
    final padding = MediaQuery.paddingOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: padding + 12,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Cart', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                'Your cart is empty. Add services or products from the feed.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.inkMuted,
                ),
              ),
            )
          else
            SizedBox(
              height: maxHeight.clamp(120, 420),
              child: ListView.separated(
                itemCount: items.length,
                separatorBuilder: (context, index) =>
                    const Divider(height: 1),
                itemBuilder: (context, index) {
                  final item = items[index];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      '${item.providerName} · INR ${item.price.round()} each',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          onPressed: item.quantity <= 1
                              ? null
                              : () => onQuantity(item.key, item.quantity - 1),
                          icon: const Icon(Icons.remove_rounded),
                        ),
                        Text('${item.quantity}'),
                        IconButton(
                          onPressed: () =>
                              onQuantity(item.key, item.quantity + 1),
                          icon: const Icon(Icons.add_rounded),
                        ),
                        IconButton(
                          onPressed: () => onRemove(item.key),
                          icon: const Icon(Icons.delete_outline_rounded),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 12),
          if (items.isNotEmpty) ...[
            Text(
              'Subtotal · INR ${total.round()}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onCheckout,
                child: const Text('Checkout'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
