import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';

/// Inline non-blocking error / recovery strip (network, payment retry hints).
class ServiqRecoveryBanner extends StatelessWidget {
  const ServiqRecoveryBanner({
    super.key,
    required this.message,
    this.icon = Icons.info_outline_rounded,
    this.actionLabel,
    this.onAction,
    this.tone = ServiqRecoveryTone.warning,
  });

  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  final ServiqRecoveryTone tone;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (tone) {
      ServiqRecoveryTone.neutral => (
        AppColors.surfaceMuted,
        AppColors.ink,
      ),
      ServiqRecoveryTone.warning => (AppColors.warningSoft, AppColors.warning),
      ServiqRecoveryTone.danger => (AppColors.dangerSoft, AppColors.danger),
    };

    return Material(
      color: Colors.transparent,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: fg),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.ink,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(width: AppSpacing.sm),
              TextButton(
                onPressed: onAction,
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

enum ServiqRecoveryTone { neutral, warning, danger }
