import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'app_buttons.dart';

class StickyBottomCTA extends StatelessWidget {
  const StickyBottomCTA({
    super.key,
    this.title,
    required this.primaryLabel,
    required this.onPrimary,
    this.subtitle,
    this.secondaryLabel,
    this.onSecondary,
  });

  /// Optional heading. Omit when the surrounding step already shows the same
  /// title, otherwise it reads twice on screen.
  final String? title;
  final String? subtitle;
  final String primaryLabel;
  final VoidCallback? onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final heading = title?.trim();
    final subheading = subtitle?.trim();
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(top: BorderSide(color: scheme.outline)),
        boxShadow: AppShadows.floating,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (heading != null && heading.isNotEmpty) ...[
              Text(heading, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
            ],
            if (subheading != null && subheading.isNotEmpty) ...[
              Text(subheading, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: AppSpacing.sm),
            ],
            Row(
              children: [
                if (secondaryLabel != null && onSecondary != null) ...[
                  Expanded(
                    child: SecondaryButton(
                      label: secondaryLabel!,
                      onPressed: onSecondary,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                ],
                Expanded(
                  child: PrimaryButton(
                    label: primaryLabel,
                    onPressed: onPrimary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
