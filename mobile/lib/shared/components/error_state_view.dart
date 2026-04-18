import 'package:flutter/material.dart';

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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.error_outline_rounded,
          size: 30,
          color: Theme.of(context).colorScheme.error,
        ),
        const SizedBox(height: 12),
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Text(message, style: Theme.of(context).textTheme.bodyMedium),
        if (onRetry != null) ...[
          const SizedBox(height: 16),
          SecondaryButton(
            label: 'Try again',
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            expanded: false,
          ),
        ],
      ],
    );
  }
}
