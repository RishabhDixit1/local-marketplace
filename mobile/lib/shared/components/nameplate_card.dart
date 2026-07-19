import 'package:flutter/material.dart';
import '../../core/theme/design_tokens.dart';

/// A card treatment that evokes a physical signboard/nameplate.
/// Features a subtle inset bevel, a thicker top border, and a small
/// mounting-bracket detail at the top edge.
class NameplateCard extends StatelessWidget {
  const NameplateCard({
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(12),
    this.margin,
    this.opacity = 1.0,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = isDark ? AppColors.darkBorder : const Color(0xFFD8D4CB);
    final bracketColor = isDark ? AppColors.darkBorderStrong : const Color(0xFFC2BDB2);

    return Opacity(
      opacity: opacity,
      child: Container(
        margin: margin,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadii.xl),
          border: Border.all(color: borderColor),
          boxShadow: [
            BoxShadow(
              color: isDark
                  ? Colors.black.withValues(alpha: 0.12)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: 2,
              offset: const Offset(0, -1),
            ),
            BoxShadow(
              color: isDark
                  ? Colors.black.withValues(alpha: 0.12)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: 2,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadii.xl),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppRadii.xl),
            child: Padding(
              padding: padding.add(const EdgeInsets.only(top: 8)),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  // Mounting bracket detail at top
                  Positioned(
                    top: -8,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        width: 28,
                        height: 5,
                        decoration: BoxDecoration(
                          color: borderColor,
                          borderRadius: const BorderRadius.vertical(
                            bottom: Radius.circular(4),
                          ),
                          border: Border(
                            bottom: BorderSide(color: bracketColor),
                            left: BorderSide(color: bracketColor),
                            right: BorderSide(color: bracketColor),
                          ),
                        ),
                      ),
                    ),
                  ),
                  child,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
