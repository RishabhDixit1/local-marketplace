import 'package:flutter/material.dart';
import '../../../../core/theme/design_tokens.dart';

class AuthDivider extends StatelessWidget {
  const AuthDivider({super.key, this.label = 'or'});

  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        const Expanded(child: Divider(color: AppColors.border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.inkFaint,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const Expanded(child: Divider(color: AppColors.border)),
      ],
    );
  }
}
