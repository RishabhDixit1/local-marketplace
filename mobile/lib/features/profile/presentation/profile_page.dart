import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state_controller.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.read(authStateControllerProvider);
    final bootstrap = ref.watch(appBootstrapProvider);
    final user = ref.watch(currentSessionProvider).asData?.value?.user;
    final isAuthenticated = user != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Text(
              user?.email ?? 'ServiQ account',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 10),
            Text(
              'This tab shows the mobile environment status alongside the signed-in account so it is easier to debug setup while we build the product surface.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 16),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Environment',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                  _ProfileField(
                    label: 'APP_ENV',
                    value: bootstrap.config.environment,
                  ),
                  _ProfileField(
                    label: 'API_BASE_URL',
                    value: bootstrap.config.apiBaseUrl.isEmpty
                        ? 'Not configured'
                        : bootstrap.config.apiBaseUrl,
                  ),
                  _ProfileField(
                    label: 'Auth callback',
                    value: bootstrap.config.magicLinkRedirectUrl,
                  ),
                  _ProfileField(
                    label: 'Supabase ready',
                    value: bootstrap.supabaseReady ? 'Yes' : 'No',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Account',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                  _ProfileField(
                    label: 'User ID',
                    value: user?.id ?? 'No active session',
                  ),
                  _ProfileField(
                    label: 'Email',
                    value: user?.email ?? 'No active session',
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: isAuthenticated
                        ? () async {
                            await auth.signOut();
                          }
                        : null,
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Sign out'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileField extends StatelessWidget {
  const _ProfileField({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(color: const Color(0xFF64748B)),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
