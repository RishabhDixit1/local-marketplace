import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';
import 'app_buttons.dart';

class EmptyStateView extends StatelessWidget {
  const EmptyStateView({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.inbox_rounded,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppColors.accentSoft,
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: Icon(icon, size: 26, color: AppColors.accentDeep),
        ),
        const SizedBox(height: 12),
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Text(message, style: Theme.of(context).textTheme.bodyMedium),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(height: 16),
          GhostButton(label: actionLabel!, onPressed: onAction),
        ],
      ],
    );
  }
}
