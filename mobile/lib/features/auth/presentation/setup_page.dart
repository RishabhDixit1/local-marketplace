import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/design_tokens.dart';

class SetupPage extends ConsumerWidget {
  const SetupPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(appBootstrapProvider);
    final config = bootstrap.config;
    final canContinue =
        config.hasMinimumClientConfig && bootstrap.initializationError == null;

    const command = '''
macOS / Linux
bash scripts/run-mobile.sh

Android emulator override
bash scripts/run-mobile.sh --device emulator-5554 --api-base-url http://10.0.2.2:3000

Sync config for IDE launches only
bash scripts/run-mobile.sh --sync-only

Windows
.\\scripts\\run-mobile-android.ps1
''';

    return ServiqScaffold(
      appBar: ServiqTopBar(title: 'Mobile Setup'),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 28),
          children: [
            Text(
              'Finish the app bootstrap',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'The mobile project is in place. This screen shows what is configured and what still needs one-time setup on your machine.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.lg),
            _GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _StatusRow(
                    label: 'Supabase client config',
                    ready: config.hasSupabaseConfig,
                    detail: config.hasSupabaseConfig
                        ? 'Present'
                        : 'Missing SUPABASE_URL or SUPABASE_ANON_KEY in dart defines or mobile/config/local.json',
                  ),
                  const SizedBox(height: 14),
                  _StatusRow(
                    label: 'Secure API base URL',
                    ready: config.hasApiConfig,
                    detail: config.hasApiConfig
                        ? config.apiBaseUrl
                        : 'Missing API_BASE_URL in dart defines or mobile/config/local.json',
                  ),
                  const SizedBox(height: 14),
                  _StatusRow(
                    label: 'Native auth callback',
                    ready: config.hasNativeAuthRedirectConfig,
                    detail: config.magicLinkRedirectUrl,
                  ),
                  if (bootstrap.initializationError != null) ...[
                    const SizedBox(height: 18),
                    Text(
                      bootstrap.initializationError!,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'One-time setup checklist',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 10),
                  const _ChecklistItem(
                    index: 1,
                    text:
                        'Install Flutter and open Android Studio or Xcode once so the platform toolchains finish setup.',
                  ),
                  const _ChecklistItem(
                    index: 2,
                    text:
                        'Start the local Next.js app so the API base URL points at a real ServiQ backend while testing.',
                  ),
                  const _ChecklistItem(
                    index: 3,
                    text:
                        'Run one of the helper scripts below to sync mobile/config/local.json before launching from your IDE.',
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Recommended local run',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.onSurface,
                      borderRadius: BorderRadius.circular(AppRadii.xl),
                    ),
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: SelectableText(
                      command,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white,
                        height: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Mobile auth uses the Supabase Flutter client directly. Android and iOS now register the default `serviq://auth-callback` return path, so keep your Supabase redirect URL and dart defines aligned with that callback while testing. '
                    'Google sign-in returns through this same callback. Supabase email sign-in sends whatever its email template is configured to show; for one-time codes, make sure the template includes `{{ .Token }}` and does not rely on `{{ .ConfirmationURL }}`. '
                    'That passwordless template is shared across the whole Supabase project, so if the web app still expects magic-link clicks you should include both the code and the link in the hosted template, or migrate the web flow too. '
                    'The helper scripts read the public Supabase values from the repo .env.local, write mobile/config/local.json for debug builds, and still pass matching dart defines when they launch Flutter. Use the Android emulator override because localhost inside Android maps to 10.0.2.2.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            PrimaryButton(
              label: 'Continue to sign in',
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              onPressed: canContinue
                  ? () => context.go(AppRoutes.signIn)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _GlassCard extends StatelessWidget {
  const _GlassCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.xl),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Theme.of(context).colorScheme.surface.withValues(alpha: 0.7),
                Theme.of(context).colorScheme.surface.withValues(alpha: 0.4),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(
              color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.12),
            ),
          ),
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: child,
        ),
      ),
    );
  }
}

class _StatusRow extends StatelessWidget {
  const _StatusRow({
    required this.label,
    required this.ready,
    required this.detail,
  });

  final String label;
  final bool ready;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final color = ready ? AppColors.primary : AppColors.warm;
    final background = ready
        ? AppColors.primarySoft
        : AppColors.warmSoft;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(top: AppSpacing.xxxs),
          width: AppSpacing.xxl,
          height: AppSpacing.xxl,
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          child: Icon(
            ready ? Icons.check_rounded : Icons.schedule_rounded,
            color: color,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xxs),
              Text(detail, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
      ],
    );
  }
}

class _ChecklistItem extends StatelessWidget {
  const _ChecklistItem({required this.index, required this.text});

  final int index;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 13,
            backgroundColor: AppColors.accentSoft,
            child: Text(
              '$index',
              style: Theme.of(
                context,
              ).textTheme.labelLarge?.copyWith(color: Theme.of(context).colorScheme.onSurface),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}
