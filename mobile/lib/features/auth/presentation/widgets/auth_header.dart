import 'package:flutter/material.dart';
import '../../../../core/theme/design_tokens.dart';
import '../../../../shared/components/premium_primitives.dart';

class AuthHeader extends StatelessWidget {
  const AuthHeader({
    super.key,
    this.title,
    this.subtitle,
    this.compact = false,
  });

  final String? title;
  final String? subtitle;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        ServiqBrandLockup(
          compact: compact,
          foregroundColor: AppColors.ink,
          subtleColor: AppColors.inkFaint,
        ),
        SizedBox(height: compact ? 24 : 32),
        if (title != null) ...[
          Text(
            title!,
            style: theme.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: compact ? 6 : 8),
        ],
        if (subtitle != null)
          Padding(
            padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 24),
            child: Text(
              subtitle!,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.inkFaint,
                height: 1.4,
              ),
            ),
          ),
      ],
    );
  }
}
