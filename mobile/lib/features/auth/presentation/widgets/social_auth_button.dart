import 'package:flutter/material.dart';
import '../../../../core/theme/design_tokens.dart';

enum SocialAuthProvider { google, apple }

class SocialAuthButton extends StatelessWidget {
  const SocialAuthButton({
    super.key,
    required this.provider,
    this.onPressed,
    this.isLoading = false,
  });

  final SocialAuthProvider provider;
  final VoidCallback? onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (icon, label, bgColor, fgColor, borderColor) = switch (provider) {
      SocialAuthProvider.google => (
        Icons.g_mobiledata_rounded,
        'Continue with Google',
        AppColors.surface,
        Theme.of(context).colorScheme.onSurface,
        Theme.of(context).colorScheme.outline,
      ),
      SocialAuthProvider.apple => (
        Icons.apple_rounded,
        'Continue with Apple',
        Theme.of(context).colorScheme.onSurface,
        Colors.white,
        Colors.transparent,
      ),
    };

    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: bgColor,
          foregroundColor: fgColor,
          side: BorderSide(color: borderColor),
          padding: const EdgeInsets.symmetric(vertical: 15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          elevation: 0,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isLoading)
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: provider == SocialAuthProvider.apple
                      ? Colors.white
                      : Theme.of(context).colorScheme.onSurface,
                ),
              )
            else
              Icon(icon, size: 22),
            const SizedBox(width: 10),
            Text(
              label,
              style: theme.textTheme.labelLarge?.copyWith(
                color: provider == SocialAuthProvider.apple
                    ? Colors.white
                    : Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
