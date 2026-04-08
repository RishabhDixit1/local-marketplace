import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state_controller.dart';
import '../../../core/widgets/section_card.dart';

class InboxPage extends ConsumerWidget {
  const InboxPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentSessionProvider).asData?.value?.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Inbox')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Text(
              'Fast replies will drive retention.',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 12),
            Text(
              'This screen is the mobile home for chat, quote follow-up, and push-triggered conversations for ${user?.email ?? 'your account'}.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 16),
            const SectionCard(
              child: _InboxWorkstream(
                title: 'Realtime messaging',
                detail:
                    'Next step is wiring Supabase conversations, messages, and presence so providers can reply instantly from a push notification.',
                icon: Icons.forum_rounded,
              ),
            ),
            const SizedBox(height: 14),
            const SectionCard(
              child: _InboxWorkstream(
                title: 'Quote follow-up',
                detail:
                    'We will connect this with your quote draft and accept routes so sending a quote does not silently create a surprise chat message.',
                icon: Icons.receipt_long_rounded,
              ),
            ),
            const SizedBox(height: 14),
            const SectionCard(
              child: _InboxWorkstream(
                title: 'Push to in-app handoff',
                detail:
                    'Push notifications and the in-app inbox will share one thread model so mobile users land directly in the right conversation.',
                icon: Icons.notifications_active_outlined,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InboxWorkstream extends StatelessWidget {
  const _InboxWorkstream({
    required this.title,
    required this.detail,
    required this.icon,
  });

  final String title;
  final String detail;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: const Color(0xFFE0F2FE),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(icon, color: const Color(0xFF0B1F33)),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(detail, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
      ],
    );
  }
}
