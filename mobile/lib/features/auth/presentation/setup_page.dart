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

    final command = [
      'flutter run -d chrome',
      '--dart-define=APP_ENV=development',
      '--dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co',
      '--dart-define=SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY',
      '--dart-define=API_BASE_URL=https://YOUR_WEB_APP_DOMAIN',
      '--dart-define=AUTH_REDIRECT_SCHEME=serviq',
      '--dart-define=AUTH_REDIRECT_HOST=auth-callback',
    ].join(' \\\n');

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
                        : 'Missing SUPABASE_URL or SUPABASE_ANON_KEY',
                  ),
                  const SizedBox(height: 14),
                  _StatusRow(
                    label: 'Secure API base URL',
                    ready: config.hasApiConfig,
                    detail: config.hasApiConfig
                        ? config.apiBaseUrl
                        : 'Missing API_BASE_URL',
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
                    'Do these 3 Windows steps',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 10),
                  const _ChecklistItem(
                    index: 1,
                    text:
                        'Enable Windows Developer Mode so Flutter plugins can create symlinks inside the project.',
                  ),
                  const _ChecklistItem(
                    index: 2,
                    text:
                        'Open Android Studio once and complete the SDK installation, including Android SDK, Emulator, and Command-line Tools.',
                  ),
                  const _ChecklistItem(
                    index: 3,
                    text:
                        'Create one Android emulator and boot it successfully before the first flutter run.',
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
                    'Run with dart defines',
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
                    'Mobile auth uses the Supabase Flutter client directly. Your current web-only /api/auth/send-link callback logic still accepts only http/https callbacks, so native sign-in should stay on the Supabase SDK path.',
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
