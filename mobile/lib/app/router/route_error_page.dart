import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/app_routes.dart';
import '../../core/theme/design_tokens.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/l10n.dart';
import '../../shared/components/app_buttons.dart';

/// Renders a branded fallback for any navigation that fails to resolve a
/// route (GoException) or errors during build. Never shows raw exception
/// text to the user.
class RouteErrorPage extends StatelessWidget {
  const RouteErrorPage({super.key, required this.error, this.location});

  final Object? error;
  final String? location;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final failedLocation = location;

    debugPrint(
      'ServiQ navigation error: ${error ?? 'unknown route error'} '
      'at ${failedLocation ?? 'unknown location'}',
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: isDark
              ? ServiqThemeTokens.dark.authGradient
              : ServiqThemeTokens.light.authGradient,
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  decoration: BoxDecoration(
                    color: AppColors.surface.withValues(alpha: 0.94),
                    borderRadius: BorderRadius.circular(AppRadii.xl),
                    border: Border.all(color: AppColors.glassStroke),
                    boxShadow: AppShadows.floating,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          gradient: AppGradients.premiumAccent,
                          borderRadius: BorderRadius.circular(AppRadii.lg),
                          boxShadow: AppShadows.soft,
                        ),
                        child: const Icon(
                          Icons.explore_off_rounded,
                          size: 30,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        l10n.routeErrorTitle,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w800),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        l10n.routeErrorMessage,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.6),
                          height: 1.4,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      PrimaryButton(
                        label: l10n.goHome,
                        icon: const Icon(Icons.home_rounded, size: 18),
                        onPressed: () => context.go(AppRoutes.root),
                        expanded: true,
                      ),
                      if (failedLocation != null &&
                          failedLocation != AppRoutes.root) ...[
                        const SizedBox(height: AppSpacing.sm),
                        TextButton(
                          onPressed: () => context.go(failedLocation),
                          child: Text(
                            '${l10n.retry} · $failedLocation',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
