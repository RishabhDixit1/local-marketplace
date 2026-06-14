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
              maxHeight: MediaQuery.sizeOf(context).height * 0.6,
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
          Row(
            children: [
              Text('Cart', style: Theme.of(context).textTheme.titleLarge),
              if (items.isNotEmpty) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${items.length}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryDeep,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Column(
                children: [
                  Icon(Icons.shopping_cart_outlined, size: 48, color: AppColors.inkFaint),
                  const SizedBox(height: 12),
                  Text(
                    'Your cart is empty',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.inkSubtle,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Add services or products from the feed.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
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
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceAlt,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            item.itemType == 'product'
                                ? Icons.inventory_2_outlined
                                : Icons.build_outlined,
                            color: AppColors.inkSubtle,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${item.providerName} · INR ${item.price.round()} each',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.inkMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 4),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              onPressed: item.quantity <= 1
                                  ? null
                                  : () => onQuantity(item.key, item.quantity - 1),
                              icon: const Icon(Icons.remove_rounded, size: 18),
                              visualDensity: VisualDensity.compact,
                            ),
                            SizedBox(
                              width: 20,
                              child: Text(
                                '${item.quantity}',
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: () =>
                                  onQuantity(item.key, item.quantity + 1),
                              icon: const Icon(Icons.add_rounded, size: 18),
                              visualDensity: VisualDensity.compact,
                            ),
                            const SizedBox(width: 4),
                            IconButton(
                              onPressed: () => onRemove(item.key),
                              icon: Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.inkFaint),
                              visualDensity: VisualDensity.compact,
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 12),
          if (items.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Subtotal',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: AppColors.inkSubtle,
                    ),
                  ),
                  Text(
                    'INR ${total.round()}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onCheckout,
                icon: const Icon(Icons.shopping_bag_outlined),
                label: const Text('Proceed to checkout'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
