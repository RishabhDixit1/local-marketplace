import 'package:flutter/material.dart';

import '../../../core/widgets/section_card.dart';

class TasksPage extends StatelessWidget {
  const TasksPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tasks')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Text(
              'Provider execution loop',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 12),
            Text(
              'This will become the provider control center for open leads, accepted work, and completion tracking. The goal is to make the daily repeat workflow fit naturally on a phone.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 16),
            const _TaskLane(
              title: 'Open leads',
              detail:
                  'Interest, quote, and response-time workflows belong here first because that is where provider retention is won or lost.',
              icon: Icons.flash_on_rounded,
              accent: Color(0xFFFEF3C7),
            ),
            const SizedBox(height: 14),
            const _TaskLane(
              title: 'Accepted work',
              detail:
                  'After acceptance, mobile should make it easy to update progress, coordinate delivery, and keep both sides informed.',
              icon: Icons.handshake_outlined,
              accent: Color(0xFFDBEAFE),
            ),
            const SizedBox(height: 14),
            const _TaskLane(
              title: 'Completed jobs',
              detail:
                  'This section will later surface completion history, reviews, and repeat-customer insights for providers.',
              icon: Icons.verified_rounded,
              accent: Color(0xFFD1FAE5),
            ),
          ],
        ),
      ),
    );
  }
}

class _TaskLane extends StatelessWidget {
  const _TaskLane({
    required this.title,
    required this.detail,
    required this.icon,
    required this.accent,
  });

  final String title;
  final String detail;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: accent,
              borderRadius: BorderRadius.circular(18),
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
      ),
    );
  }
}
