import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/theme/app_theme.dart';
import '../application/cart_notifier.dart';
import '../domain/mobile_cart_item.dart';

Future<void> showServiqCartSheet(BuildContext context) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      return ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Consumer(
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
      ),
    ),
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
                  const SizedBox(width: AppSpacing.xs),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: AppSpacing.xxxs),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
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
          const SizedBox(height: AppSpacing.sm),
          if (items.isEmpty)
            ServiqSurface(
              variant: ServiqSurfaceVariant.glass,
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl, horizontal: AppSpacing.md),
              child: Column(
                children: [
                  Icon(Icons.shopping_cart_outlined, size: 48, color: AppColors.primary.withValues(alpha: 0.6)),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Your cart is empty',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Add services or products from the feed.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45),
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
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                AppColors.primarySoft.withValues(alpha: 0.7),
                                AppColors.primarySoft.withValues(alpha: 0.3),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                          ),
                          child: Icon(
                            item.itemType == 'product'
                                ? Icons.inventory_2_outlined
                                : Icons.build_outlined,
                            color: AppColors.primaryDeep,
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
                              const SizedBox(height: AppSpacing.xxxs),
                              Text(
                                '${item.providerName} · INR ${item.price.round()} each',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xxs),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              onPressed: item.quantity <= 1
                                  ? null
                                  : () => onQuantity(item.key, item.quantity - 1),
                              icon: Icon(Icons.remove_rounded, size: 18),
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
                              icon: Icon(Icons.add_rounded, size: 18),
                              visualDensity: VisualDensity.compact,
                            ),
                            const SizedBox(width: AppSpacing.xxs),
                            IconButton(
                              onPressed: () => onRemove(item.key),
                              icon: Icon(Icons.delete_outline_rounded, size: 18, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
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
          const SizedBox(height: AppSpacing.sm),
          if (items.isNotEmpty) ...[
            ServiqSurface(
              variant: ServiqSurfaceVariant.glass,
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Subtotal',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                  Text(
                    'INR ${total.round()}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            PrimaryButton(
              label: 'Proceed to checkout',
              icon: const Icon(Icons.shopping_bag_outlined),
              onPressed: onCheckout,
            ),
          ],
        ],
      ),
    );
  }
}
