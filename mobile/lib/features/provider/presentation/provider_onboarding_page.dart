import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/widgets/section_card.dart';
import '../../../features/profile/data/profile_repository.dart';
import '../../../features/profile/domain/mobile_profile_snapshot.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/section_header.dart';

class ProviderOnboardingPage extends ConsumerWidget {
  const ProviderOnboardingPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = ref.watch(profileSnapshotProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Provider onboarding')),
      body: SafeArea(
        child: snapshot.when(
          data: (data) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      data.roleFamily == 'provider'
                          ? 'Keep building trust locally'
                          : 'Become a provider on ServiQ',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Use this checklist to move from a basic profile to a provider identity that nearby users can trust.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final width = (constraints.maxWidth - 12) / 2;
                        return Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            SizedBox(
                              width: width,
                              child: MetricTile(
                                label: 'Completion',
                                value: '${data.completionPercent}%',
                                icon: Icons.verified_user_outlined,
                              ),
                            ),
                            SizedBox(
                              width: width,
                              child: MetricTile(
                                label: 'Trust score',
                                value: data.trustScore.toString(),
                                icon: Icons.shield_outlined,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 16),
                    PrimaryButton(
                      label: 'Open profile',
                      onPressed: () => context.push(AppRoutes.profile),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const SectionHeader(
                title: 'Readiness checklist',
                subtitle:
                    'Every completed step improves local discovery and response confidence.',
              ),
              const SizedBox(height: 12),
              ..._buildChecklist(data).map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _ChecklistCard(item: item),
                ),
              ),
            ],
          ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SectionCard(child: Text(error.toString())),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChecklistItemData {
  const _ChecklistItemData({
    required this.title,
    required this.description,
    required this.done,
  });

  final String title;
  final String description;
  final bool done;
}

class _ChecklistCard extends StatelessWidget {
  const _ChecklistCard({required this.item});

  final _ChecklistItemData item;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: item.done ? const Color(0xFFE7F4EF) : const Color(0xFFF1F4F8),
              shape: BoxShape.circle,
            ),
            child: Icon(
              item.done ? Icons.check_rounded : Icons.circle_outlined,
              size: 16,
              color: item.done ? const Color(0xFF146C53) : const Color(0xFF616B79),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 6),
                Text(
                  item.description,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

List<_ChecklistItemData> _buildChecklist(MobileProfileSnapshot snapshot) {
  final profile = snapshot.profile;
  return [
    _ChecklistItemData(
      title: 'Business identity',
      description: 'Name, headline, and intro that make local intent clear.',
      done: profile.fullName.isNotEmpty && profile.headline.isNotEmpty,
    ),
    _ChecklistItemData(
      title: 'Area served',
      description: 'A clear service area helps nearby buyers trust the match.',
      done: profile.location.isNotEmpty,
    ),
    _ChecklistItemData(
      title: 'Services and products',
      description: 'Give people a fast way to understand what you offer.',
      done: snapshot.serviceCount + snapshot.productCount > 0,
    ),
    _ChecklistItemData(
      title: 'Availability',
      description: 'Show when you can respond and take work.',
      done: snapshot.availabilityCount > 0,
    ),
    _ChecklistItemData(
      title: 'Proof and trust',
      description: 'Reviews, payment readiness, and portfolio build confidence.',
      done: snapshot.reviewCount > 0 ||
          snapshot.paymentMethodCount > 0 ||
          snapshot.portfolioCount > 0,
    ),
  ];
}
