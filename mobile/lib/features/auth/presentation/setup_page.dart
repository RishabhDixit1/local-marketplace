import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';

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

    return Scaffold(
      appBar: AppBar(title: const Text('Mobile Setup')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Text(
              'Finish the app bootstrap',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 12),
            Text(
              'The mobile project is in place. This screen shows what is configured and what still needs one-time setup on your machine.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 20),
            SectionCard(
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
            const SizedBox(height: 16),
            SectionCard(
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
            const SizedBox(height: 16),
            SectionCard(
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
                      color: const Color(0xFF0B1F33),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: SelectableText(
                      command,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white,
                        height: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Mobile auth uses the Supabase Flutter client directly. Android and iOS now register the default `serviq://auth-callback` return path, so keep your Supabase redirect URL and dart defines aligned with that callback while testing. If you want one-time email codes instead of only magic links, update the Supabase email template to include `{{ .Token }}`. Google sign-in also returns through this same callback.',
                    'The helper scripts read the public Supabase values from the repo .env.local, write mobile/config/local.json for debug builds, and still pass matching dart defines when they launch Flutter. Use the Android emulator override because localhost inside Android maps to 10.0.2.2.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: canContinue ? () => context.go('/sign-in') : null,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: const Text('Continue to sign in'),
            ),
          ],
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
    final color = ready ? const Color(0xFF0F766E) : const Color(0xFFB45309);
    final background = ready
        ? const Color(0xFFCCFBF1)
        : const Color(0xFFFEF3C7);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(top: 2),
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Icon(
            ready ? Icons.check_rounded : Icons.schedule_rounded,
            color: color,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
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
            backgroundColor: const Color(0xFFE0F2FE),
            child: Text(
              '$index',
              style: Theme.of(
                context,
              ).textTheme.labelLarge?.copyWith(color: const Color(0xFF0B1F33)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}
