import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';
import '../../shared/widgets/chips.dart';

/// Trust/status badge. Renders through [AppPill] so every pill in the app
/// shares one visual language (audit H-2: three pill systems collapsed).
class TrustBadge extends StatelessWidget {
  const TrustBadge({
    super.key,
    required this.label,
    this.icon = Icons.verified_rounded,
    this.backgroundColor = AppColors.successSoft,
    this.foregroundColor = AppColors.success,
    this.size = AppPillSize.regular,
  });

  final String label;
  final IconData icon;
  final Color backgroundColor;
  final Color foregroundColor;
  final AppPillSize size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      child: AppPill(
        label: label,
        icon: icon,
        backgroundColor: backgroundColor,
        foregroundColor: foregroundColor,
        size: size,
        border: BorderSide(color: foregroundColor.withValues(alpha: 0.12)),
      ),
    );
  }
}
