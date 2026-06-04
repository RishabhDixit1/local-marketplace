import 'dart:math';
import 'package:flutter/material.dart';
import '../../../../core/theme/design_tokens.dart';

enum PasswordStrength { empty, weak, fair, strong, veryStrong }

extension PasswordStrengthX on PasswordStrength {
  String get label {
    return switch (this) {
      PasswordStrength.empty => '',
      PasswordStrength.weak => 'Weak',
      PasswordStrength.fair => 'Fair',
      PasswordStrength.strong => 'Strong',
      PasswordStrength.veryStrong => 'Very strong',
    };
  }

  Color get color {
    return switch (this) {
      PasswordStrength.empty => Colors.transparent,
      PasswordStrength.weak => AppColors.danger,
      PasswordStrength.fair => AppColors.warning,
      PasswordStrength.strong => AppColors.primary,
      PasswordStrength.veryStrong => AppColors.verified,
    };
  }

  double get fraction {
    return switch (this) {
      PasswordStrength.empty => 0.0,
      PasswordStrength.weak => 0.25,
      PasswordStrength.fair => 0.5,
      PasswordStrength.strong => 0.75,
      PasswordStrength.veryStrong => 1.0,
    };
  }
}

PasswordStrength calculatePasswordStrength(String password) {
  if (password.isEmpty) return PasswordStrength.empty;

  var score = 0.0;

  if (password.length >= 8) score += 0.2;
  if (password.length >= 12) score += 0.15;

  if (RegExp(r'[a-z]').hasMatch(password)) score += 0.1;
  if (RegExp(r'[A-Z]').hasMatch(password)) score += 0.15;
  if (RegExp(r'\d').hasMatch(password)) score += 0.15;
  if (RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(password)) score += 0.2;

  if (RegExp(r'.{6,}').hasMatch(password)) {
    final variety = {
      if (RegExp(r'[a-z]').hasMatch(password)) 'lower',
      if (RegExp(r'[A-Z]').hasMatch(password)) 'upper',
      if (RegExp(r'\d').hasMatch(password)) 'digit',
      if (RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(password)) 'special',
    }.length;
    score += min(variety * 0.05, 0.15);
  }

  return switch (score) {
    > 0.8 => PasswordStrength.veryStrong,
    > 0.6 => PasswordStrength.strong,
    > 0.35 => PasswordStrength.fair,
    > 0.0 => PasswordStrength.weak,
    _ => PasswordStrength.empty,
  };
}

class PasswordStrengthIndicator extends StatelessWidget {
  const PasswordStrengthIndicator({
    super.key,
    required this.password,
  });

  final String password;

  @override
  Widget build(BuildContext context) {
    final strength = calculatePasswordStrength(password);
    if (strength == PasswordStrength.empty) return const SizedBox.shrink();

    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.pill),
          child: SizedBox(
            height: 4,
            child: Stack(
              children: [
                Container(color: AppColors.border.withValues(alpha: 0.3)),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: (strength.fraction * 200).clamp(0, 200),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        strength.color,
                        strength.color.withValues(alpha: 0.7),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          strength.label,
          style: theme.textTheme.labelSmall?.copyWith(
            color: strength.color,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
