import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';

/// Maps category keywords to a gradient + icon pair for visual card anchors.
/// Used when a feed card has no uploaded photo to show a category-themed
/// illustration instead of a blank grey box.
class CategoryIllustration extends StatelessWidget {
  const CategoryIllustration({
    super.key,
    required this.category,
    this.height = 72,
    this.borderRadius,
    this.showLabel = false,
  });

  final String category;
  final double height;
  final BorderRadiusGeometry? borderRadius;
  final bool showLabel;

  @override
  Widget build(BuildContext context) {
    final theme = _categoryTheme(category);

    return ClipRRect(
      borderRadius: borderRadius ?? BorderRadius.circular(AppRadii.lg),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: theme.colors,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
            Positioned(
              right: -12,
              bottom: -12,
              child: Icon(
                theme.icon,
                size: height * 0.7,
                color: Colors.white.withValues(alpha: 0.12),
              ),
            ),
            Positioned(
              left: AppSpacing.sm,
              bottom: AppSpacing.sm,
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                    ),
                    child: Icon(theme.icon, size: 18, color: Colors.white),
                  ),
                  if (showLabel) ...[
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      theme.label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact category icon badge (no full illustration, just a gradient icon).
class CategoryBadge extends StatelessWidget {
  const CategoryBadge({
    super.key,
    required this.category,
    this.size = 36,
  });

  final String category;
  final double size;

  @override
  Widget build(BuildContext context) {
    final theme = _categoryTheme(category);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: theme.colors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Icon(theme.icon, size: size * 0.5, color: Colors.white),
    );
  }
}

class _CategoryTheme {
  const _CategoryTheme({
    required this.colors,
    required this.icon,
    required this.label,
  });

  final List<Color> colors;
  final IconData icon;
  final String label;
}

/// Maps a category string to a visual theme. Uses keyword matching so any
/// category text resolves to a sensible gradient + icon. Falls back to a
/// soft branded gradient with a general service icon.
_CategoryTheme _categoryTheme(String category) {
  final value = category.toLowerCase();

  // --- Trades & home services ---

  if (value.contains('clean') || value.contains('housekeep')) {
    return const _CategoryTheme(
      colors: [Color(0xFF0E8345), Color(0xFF10B981)],
      icon: Icons.cleaning_services_rounded,
      label: 'Cleaning',
    );
  }
  if (value.contains('electric')) {
    return const _CategoryTheme(
      colors: [Color(0xFFD97706), Color(0xFFF59E0B)],
      icon: Icons.electrical_services_rounded,
      label: 'Electrical',
    );
  }
  if (value.contains('plumb') || value.contains('water purifier')) {
    return const _CategoryTheme(
      colors: [Color(0xFF0369A1), Color(0xFF0EA5E9)],
      icon: Icons.plumbing_rounded,
      label: 'Plumbing',
    );
  }
  if (value.contains('ro ') || value.contains('ro service') || value == 'ro') {
    return const _CategoryTheme(
      colors: [Color(0xFF0891B2), Color(0xFF22D3EE)],
      icon: Icons.water_drop_rounded,
      label: 'RO Service',
    );
  }
  if (value.contains('paint')) {
    return const _CategoryTheme(
      colors: [Color(0xFF7C3AED), Color(0xFFA78BFA)],
      icon: Icons.format_paint_rounded,
      label: 'Painting',
    );
  }
  if (value.contains('repair') || value.contains('appliance')) {
    return const _CategoryTheme(
      colors: [Color(0xFFB45309), Color(0xFFD97706)],
      icon: Icons.build_circle_outlined,
      label: 'Repair',
    );
  }
  if (value.contains('carpent') || value.contains('wood') || value.contains('furniture')) {
    return const _CategoryTheme(
      colors: [Color(0xFF92400E), Color(0xFFB45309)],
      icon: Icons.carpenter_rounded,
      label: 'Carpentry',
    );
  }
  if (value.contains('ac') || value.contains('hvac') || value.contains('cool') || value.contains('air condition')) {
    return const _CategoryTheme(
      colors: [Color(0xFF0284C7), Color(0xFF38BDF8)],
      icon: Icons.ac_unit_rounded,
      label: 'AC & Cooling',
    );
  }

  // --- Tech & devices ---

  if (value.contains('mobile') || value.contains('phone') || value.contains('tablet')) {
    return const _CategoryTheme(
      colors: [Color(0xFF4338CA), Color(0xFF6366F1)],
      icon: Icons.smartphone_rounded,
      label: 'Mobile Repair',
    );
  }
  if (value.contains('computer') || value.contains('laptop') || value.contains('tech')) {
    return const _CategoryTheme(
      colors: [Color(0xFF334155), Color(0xFF64748B)],
      icon: Icons.computer_rounded,
      label: 'Computer Repair',
    );
  }
  if (value.contains('cctv') || value.contains('security') || value.contains('surveillance')) {
    return const _CategoryTheme(
      colors: [Color(0xFF1E293B), Color(0xFF475569)],
      icon: Icons.videocam_rounded,
      label: 'Security & CCTV',
    );
  }
  if (value.contains('internet') || value.contains('wifi') || value.contains('broadband') || value.contains('network')) {
    return const _CategoryTheme(
      colors: [Color(0xFF5B21B6), Color(0xFF8B5CF6)],
      icon: Icons.wifi_rounded,
      label: 'Internet & WiFi',
    );
  }

  // --- Education & personal ---

  if (value.contains('tutor') || value.contains('teach') || value.contains('educat') || value.contains('coach')) {
    return const _CategoryTheme(
      colors: [Color(0xFF1E40AF), Color(0xFF3B82F6)],
      icon: Icons.school_rounded,
      label: 'Tutoring',
    );
  }
  if (value.contains('beaut') || value.contains('salon') || value.contains('hair') || value.contains('spa')) {
    return const _CategoryTheme(
      colors: [Color(0xFFBE185D), Color(0xFFEC4899)],
      icon: Icons.content_cut_rounded,
      label: 'Beauty',
    );
  }
  if (value.contains('tailor') || value.contains('sew') || value.contains('stitch') || value.contains('alter')) {
    return const _CategoryTheme(
      colors: [Color(0xFF9F1239), Color(0xFFF43F5E)],
      icon: Icons.checkroom_rounded,
      label: 'Tailoring',
    );
  }
  if (value.contains('photo') || value.contains('camera') || value.contains('video') || value.contains('event')) {
    return const _CategoryTheme(
      colors: [Color(0xFF0F766E), Color(0xFF2DD4BF)],
      icon: Icons.photo_camera_rounded,
      label: 'Photography',
    );
  }

  // --- Logistics & transport ---

  if (value.contains('deliver') || value.contains('courier') || value.contains('logistics')) {
    return const _CategoryTheme(
      colors: [Color(0xFFC2410C), Color(0xFFF97316)],
      icon: Icons.local_shipping_rounded,
      label: 'Delivery',
    );
  }
  if (value.contains('mechanic') || value.contains('auto') || value.contains('vehicle') || value.contains('bike') || value.contains('car ')) {
    return const _CategoryTheme(
      colors: [Color(0xFF374151), Color(0xFF6B7280)],
      icon: Icons.two_wheeler_rounded,
      label: 'Mechanic',
    );
  }
  if (value.contains('mov') || value.contains('shift') || value.contains('pack')) {
    return const _CategoryTheme(
      colors: [Color(0xFF0F766E), Color(0xFF14B8A6)],
      icon: Icons.local_shipping_rounded,
      label: 'Moving',
    );
  }

  // --- Food & outdoors ---

  if (value.contains('cook') || value.contains('food') || value.contains('cater') || value.contains('bakery')) {
    return const _CategoryTheme(
      colors: [Color(0xFFDC2626), Color(0xFFEF4444)],
      icon: Icons.restaurant_rounded,
      label: 'Food',
    );
  }
  if (value.contains('garden') || value.contains('landscap') || value.contains('lawn')) {
    return const _CategoryTheme(
      colors: [Color(0xFF047857), Color(0xFF059669)],
      icon: Icons.yard_rounded,
      label: 'Garden',
    );
  }

  // --- Real estate & property ---

  if (value.contains('real estate') || value.contains('property') || value.contains('rent') || value.contains('flat') || value.contains('apartment')) {
    return const _CategoryTheme(
      colors: [Color(0xFF0D2137), Color(0xFF1E4D6B)],
      icon: Icons.apartment_rounded,
      label: 'Real Estate',
    );
  }

  // --- Products & marketplace ---

  if (value.contains('product') || value.contains('perfume') || value.contains('fragrance') || value.contains('cosmetic') || value.contains('spray')) {
    return const _CategoryTheme(
      colors: [Color(0xFF0D9488), Color(0xFF14B8A6)],
      icon: Icons.inventory_2_rounded,
      label: 'Product',
    );
  }
  if (value.contains('health') || value.contains('medical') || value.contains('pharma') || value.contains('doctor')) {
    return const _CategoryTheme(
      colors: [Color(0xFF059669), Color(0xFF34D399)],
      icon: Icons.local_hospital_rounded,
      label: 'Healthcare',
    );
  }

  // --- Catch-all: any uncategorized post gets a polished branded gradient ---
  return const _CategoryTheme(
    colors: [Color(0xFF0F766E), Color(0xFF14B8A6)],
    icon: Icons.home_repair_service_rounded,
    label: 'Service',
  );
}
