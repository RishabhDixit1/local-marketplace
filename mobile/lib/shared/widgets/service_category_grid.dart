import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/app_routes.dart';
import '../../core/theme/design_tokens.dart';

class ServiceCategoryGrid extends StatelessWidget {
  const ServiceCategoryGrid({
    super.key,
    required this.categories,
    this.localityId,
    this.zoneSlug,
    this.maxItems = 8,
    this.crossAxisCount = 2,
    this.onTapCategory,
  });

  final List<Map<String, dynamic>> categories;
  final String? localityId;
  final String? zoneSlug;
  final int maxItems;
  final int crossAxisCount;
  final void Function(String name, String slug)? onTapCategory;

  @override
  Widget build(BuildContext context) {
    final items = categories.isNotEmpty ? categories : _defaultCategories;
    if (items.isEmpty) return const SizedBox.shrink();

    final visibleItems = items.length > maxItems ? items.take(maxItems).toList() : items;

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        childAspectRatio: 1.5,
        crossAxisSpacing: AppSpacing.sm,
        mainAxisSpacing: AppSpacing.sm,
      ),
      itemCount: visibleItems.length,
      itemBuilder: (context, index) {
        final cat = visibleItems[index];
        final name = cat['name'] as String? ?? '';
        final icon = cat['icon'] as String? ?? '';
        final slug = cat['slug'] as String? ?? '';
        final priceRange = cat['priceRange'] as String? ?? '';
        final providerCount = cat['providerCount'] as int? ?? 0;

        return _GlassCategoryCard(
          name: name,
          icon: icon,
          priceRange: priceRange,
          providerCount: providerCount,
          onTap: onTapCategory != null
              ? () => onTapCategory!(name, slug)
              : () {
                  context.push(
                    Uri(
                      path: AppRoutes.search,
                      queryParameters: {'category': name},
                    ).toString(),
                  );
                },
        );
      },
    );
  }

  static const _defaultCategories = <Map<String, dynamic>>[
    {'name': 'Electrician', 'icon': '⚡', 'priceRange': '₹150-500', 'slug': 'electrician'},
    {'name': 'Plumber', 'icon': '🔧', 'priceRange': '₹200-600', 'slug': 'plumber'},
    {'name': 'AC Repair', 'icon': '❄️', 'priceRange': '₹300-1500', 'slug': 'ac-repair'},
    {'name': 'RO Repair', 'icon': '💧', 'priceRange': '₹200-800', 'slug': 'ro-repair'},
    {'name': 'Carpenter', 'icon': '🪚', 'priceRange': '₹300-1000', 'slug': 'carpenter'},
    {'name': 'Appliance Repair', 'icon': '🔌', 'priceRange': '₹250-1200', 'slug': 'appliance-repair'},
    {'name': 'Mobile Repair', 'icon': '📱', 'priceRange': '₹200-1500', 'slug': 'mobile-repair'},
    {'name': 'Bike Repair', 'icon': '🏍️', 'priceRange': '₹100-800', 'slug': 'bike-repair'},
  ];
}

class _GlassCategoryCard extends StatelessWidget {
  const _GlassCategoryCard({
    required this.name,
    required this.icon,
    this.priceRange,
    this.providerCount = 0,
    required this.onTap,
  });

  final String name;
  final String icon;
  final String? priceRange;
  final int providerCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  isDark
                      ? AppColors.darkSurface.withValues(alpha: 0.6)
                      : Colors.white.withValues(alpha: 0.7),
                  isDark
                      ? AppColors.darkSurfaceAlt.withValues(alpha: 0.4)
                      : Colors.white.withValues(alpha: 0.4),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadii.xl),
              border: Border.all(
                color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.2),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(icon, style: const TextStyle(fontSize: 22)),
                const SizedBox(height: AppSpacing.xs),
                Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                if (priceRange != null && priceRange!.isNotEmpty)
                  Text(priceRange!,
                      style: TextStyle(
                        fontSize: 11,
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                        fontWeight: FontWeight.w600,
                      )),
                if (providerCount > 0)
                  Container(
                    margin: const EdgeInsets.only(top: 2),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                    ),
                    child: Text('$providerCount providers',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.primaryDeep)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
