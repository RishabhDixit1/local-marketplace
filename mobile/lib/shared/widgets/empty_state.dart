import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';
import 'cards.dart';

class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.primaryAction,
    this.secondaryAction,
  });

  final String title;
  final String message;
  final IconData icon;
  final Widget? primaryAction;
  final Widget? secondaryAction;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Icon(icon, color: AppColors.ink),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
          if (primaryAction != null || secondaryAction != null) ...[
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: [
                if (primaryAction != null) Expanded(child: primaryAction!),
                if (primaryAction != null && secondaryAction != null)
                  const SizedBox(width: AppSpacing.sm),
                if (secondaryAction != null) Expanded(child: secondaryAction!),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
