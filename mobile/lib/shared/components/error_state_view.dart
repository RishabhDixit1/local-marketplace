import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';
import 'app_buttons.dart';

class ErrorStateView extends StatelessWidget {
  const ErrorStateView({
    super.key,
    required this.title,
    required this.message,
    this.onRetry,
  });

  final String title;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$title: $message',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.dangerSoft,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: const Icon(
              Icons.error_outline_rounded,
              size: 26,
              color: AppColors.danger,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
          if (onRetry != null) ...[
            const SizedBox(height: AppSpacing.md),
            SecondaryButton(
              label: 'Try again',
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              expanded: false,
            ),
          ],
        ],
      ),
    );
  }
}
