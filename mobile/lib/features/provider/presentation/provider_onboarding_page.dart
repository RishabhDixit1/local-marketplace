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
      appBar: AppBar(title: const Text('Provider setup')),
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
                          ? 'Launch provider profile'
                          : 'Become a provider',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Complete identity, offers, location, and publish readiness.',
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
                      label: 'Open launchpad',
                      icon: const Icon(Icons.rocket_launch_outlined),
                      onPressed: () =>
                          context.push(AppRoutes.providerLaunchpad),
                    ),
                    const SizedBox(height: 10),
                    SecondaryButton(
                      label: 'Manage listings',
                      icon: const Icon(Icons.inventory_2_outlined),
                      onPressed: () => context.push(AppRoutes.providerListings),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const SectionHeader(
                title: 'Setup flow',
                subtitle: 'Four steps to become discoverable.',
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
            children: [SectionCard(child: Text(error.toString()))],
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
              color: item.done
                  ? const Color(0xFFE7F4EF)
                  : const Color(0xFFF1F4F8),
              shape: BoxShape.circle,
            ),
            child: Icon(
              item.done ? Icons.check_rounded : Icons.circle_outlined,
              size: 16,
              color: item.done
                  ? const Color(0xFF146C53)
                  : const Color(0xFF616B79),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
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
      title: 'Step 1: Identity',
      description: 'Name, headline, and intro.',
      done: profile.fullName.isNotEmpty && profile.headline.isNotEmpty,
    ),
    _ChecklistItemData(
      title: 'Step 2: Services / products',
      description: 'Add at least one offer.',
      done: snapshot.serviceCount + snapshot.productCount > 0,
    ),
    _ChecklistItemData(
      title: 'Step 3: Location / availability',
      description: 'Set area and response availability.',
      done: profile.location.isNotEmpty && snapshot.availabilityCount > 0,
    ),
    _ChecklistItemData(
      title: 'Step 4: Publish',
      description: 'Review profile and go live.',
      done:
          snapshot.serviceCount + snapshot.productCount > 0 &&
          profile.location.isNotEmpty,
    ),
  ];
}
