import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/models/serviq_models.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../../../shared/widgets/section_header.dart';
import '../data/people_hub_repository.dart';
import 'connection_requests_section.dart';
import 'people_cards.dart';

class PeopleScreen extends ConsumerStatefulWidget {
  const PeopleScreen({super.key});

  @override
  ConsumerState<PeopleScreen> createState() => _PeopleScreenState();
}

class _PeopleScreenState extends ConsumerState<PeopleScreen> {
  final _searchController = TextEditingController();
  bool _verifiedOnly = false;
  bool _onlineOnly = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsServiceProvider).trackScreen('people_screen');
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(peopleHubProvider);
    await ref.read(peopleHubProvider.future);
  }

  List<PersonSummary> _filterPeople(List<PersonSummary> people) {
    final query = _searchController.text.trim().toLowerCase();
    return people.where((person) {
      if (_verifiedOnly &&
          person.verificationLevel == VerificationLevel.unverified) {
        return false;
      }
      if (_onlineOnly && !person.isOnline) {
        return false;
      }
      if (query.isEmpty) {
        return true;
      }
      final haystack =
          '${person.name} ${person.headline} ${person.locality} ${person.serviceCategories.join(' ')}'
              .toLowerCase();
      return haystack.contains(query);
    }).toList();
  }

  Future<void> _handlePrimary(PersonSummary person) async {
    final repo = ref.read(peopleHubRepositoryProvider);
    switch (person.connectionState) {
      case PeopleConnectionState.none:
        await repo.sendConnectionRequest(person.id);
      case PeopleConnectionState.incoming:
        final hub = await ref.read(peopleHubProvider.future);
        final request = hub.incomingRequests.firstWhere(
          (item) => item.personId == person.id,
        );
        await repo.acceptIncomingRequest(request.id);
      case PeopleConnectionState.connected:
      case PeopleConnectionState.requested:
      case PeopleConnectionState.blocked:
        break;
    }
    ref.invalidate(peopleHubProvider);
  }

  void _showSafetySheet(PersonSummary person) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.pageInset),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Safety and trust',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: AppSpacing.sm),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Remove connection'),
                  subtitle: const Text('Stop direct network trust context.'),
                  onTap: () async {
                    Navigator.of(context).pop();
                    await ref
                        .read(peopleHubRepositoryProvider)
                        .removeConnection(person.id);
                    ref.invalidate(peopleHubProvider);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Block profile'),
                  subtitle: const Text(
                    'Hide this person across discovery and chat.',
                  ),
                  onTap: () async {
                    Navigator.of(context).pop();
                    await ref
                        .read(peopleHubRepositoryProvider)
                        .blockPerson(person.id);
                    ref.invalidate(peopleHubProvider);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Report profile'),
                  subtitle: const Text('Flag suspicious or unsafe behavior.'),
                  onTap: () {
                    Navigator.of(context).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Thanks, this profile was flagged for review.',
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final hubAsync = ref.watch(peopleHubProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('People')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.pageInset,
              AppSpacing.sm,
              AppSpacing.pageInset,
              120,
            ),
            children: [
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Build your local trust graph',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Connections, nearby providers, and social proof that shortens decision time.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: _searchController,
                      decoration: const InputDecoration(
                        hintText: 'Search by name, category, or locality',
                        prefixIcon: Icon(Icons.search_rounded),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        AppFilterChip(
                          label: 'Verified only',
                          selected: _verifiedOnly,
                          leading: Icons.verified_rounded,
                          onSelected: (value) =>
                              setState(() => _verifiedOnly = value),
                        ),
                        AppFilterChip(
                          label: 'Online now',
                          selected: _onlineOnly,
                          leading: Icons.circle,
                          onSelected: (value) =>
                              setState(() => _onlineOnly = value),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              hubAsync.when(
                data: (hub) {
                  final accepted = _filterPeople(hub.acceptedConnections);
                  final suggested = _filterPeople(hub.suggestedPeople);
                  PersonSummary? resolvePerson(String personId) {
                    final combined = [
                      ...hub.acceptedConnections,
                      ...hub.suggestedPeople,
                    ];
                    try {
                      return combined.firstWhere((item) => item.id == personId);
                    } catch (_) {
                      return null;
                    }
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ConnectionRequestsSection(
                        incoming: hub.incomingRequests,
                        outgoing: hub.outgoingRequests,
                        resolvePerson: resolvePerson,
                        onAcceptIncoming: (requestId) async {
                          await ref
                              .read(peopleHubRepositoryProvider)
                              .acceptIncomingRequest(requestId);
                          ref.invalidate(peopleHubProvider);
                        },
                      ),
                      if (accepted.isNotEmpty) ...[
                        const AppSectionHeader(
                          title: 'Accepted connections',
                          subtitle:
                              'People already inside your trusted local graph.',
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        SizedBox(
                          height: 172,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemBuilder: (context, index) =>
                                ConnectionSummaryCard(person: accepted[index]),
                            separatorBuilder: (context, index) =>
                                const SizedBox(width: AppSpacing.sm),
                            itemCount: accepted.length,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                      ],
                      const AppSectionHeader(
                        title: 'Suggested nearby people',
                        subtitle:
                            'Ranked by trust fit, distance, responsiveness, and category relevance.',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      if (suggested.isEmpty)
                        AppEmptyState(
                          title: 'No people match this filter',
                          message:
                              'Clear one filter or broaden your search to widen the local graph.',
                          primaryAction: FilledButton(
                            onPressed: () {
                              setState(() {
                                _verifiedOnly = false;
                                _onlineOnly = false;
                                _searchController.clear();
                              });
                            },
                            child: const Text('Reset'),
                          ),
                        )
                      else
                        ...suggested.map(
                          (person) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: PersonCard(
                              person: person,
                              onPrimaryAction: () => _handlePrimary(person),
                              onSave: () async {
                                await ref
                                    .read(peopleHubRepositoryProvider)
                                    .toggleSaved(person.id);
                                ref.invalidate(peopleHubProvider);
                              },
                              onMore: () => _showSafetySheet(person),
                            ),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const CardListSkeleton(count: 4),
                error: (error, _) => AppErrorState(
                  title: 'People is unavailable',
                  message: AppErrorMapper.toMessage(error),
                  onRetry: _refresh,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
