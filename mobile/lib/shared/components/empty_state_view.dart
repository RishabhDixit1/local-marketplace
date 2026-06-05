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
    this.gradientColors,
  });

  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  final List<Color>? gradientColors;

  List<Color> get _gradient {
    if (gradientColors != null && gradientColors!.length >= 2) {
      return gradientColors!;
    }
    return [AppColors.accentSoft, AppColors.primarySoft];
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$title: $message',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: _gradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadii.lg),
              boxShadow: AppShadows.soft,
            ),
            child: Icon(icon, size: 28, color: Colors.white),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.inkSubtle,
                  height: 1.4,
                ),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 20),
            GhostButton(label: actionLabel!, onPressed: onAction),
          ],
        ],
      ),
    );
  }
}
