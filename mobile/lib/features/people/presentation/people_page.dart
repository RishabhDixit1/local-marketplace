import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/section_header.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../inbox/data/chat_repository.dart';
import '../data/people_repository.dart';

class PeoplePage extends ConsumerStatefulWidget {
  const PeoplePage({super.key});

  @override
  ConsumerState<PeoplePage> createState() => _PeoplePageState();
}

class _PeoplePageState extends ConsumerState<PeoplePage> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  final Set<String> _filters = <String>{};
  RealtimeChannel? _peopleChannel;
  SupabaseClient? _client;

  @override
  void initState() {
    super.initState();
    try {
      _client = ref.read(appBootstrapProvider).client;
    } catch (_) {
      _client = null;
    }
    _subscribe();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    if (_client != null && _peopleChannel != null) {
      _client!.removeChannel(_peopleChannel!);
    }
    super.dispose();
  }

  void _subscribe() {
    final client = _client;
    if (client == null) {
      return;
    }

    _peopleChannel = client
        .channel('mobile-people-directory')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'profiles',
          callback: (_) => ref.invalidate(peopleSnapshotProvider),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'provider_presence',
          callback: (_) => ref.invalidate(peopleSnapshotProvider),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'reviews',
          callback: (_) => ref.invalidate(peopleSnapshotProvider),
        )
        .subscribe();
  }

  Future<void> _refresh() async {
    ref.invalidate(peopleSnapshotProvider);
    await ref.read(peopleSnapshotProvider.future);
  final TextEditingController _searchController = TextEditingController();
  String _query = '';
  String? _busyPersonId;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(peopleSnapshotProvider);
    await ref.read(peopleSnapshotProvider.future);
  }

  Future<void> _openChat(MobilePersonItem person) async {
    if (person.isCurrentUser || _busyPersonId != null) {
      return;
    }

    setState(() {
      _busyPersonId = person.id;
    });

    try {
      final conversationId = await ref
          .read(chatRepositoryProvider)
          .getOrCreateDirectConversation(recipientId: person.id);
      if (!mounted) {
        return;
      }
      context.push('/app/inbox/$conversationId');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _busyPersonId = null;
        });
      }
    }
  }

  List<MobilePersonItem> _filter(List<MobilePersonItem> items) {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) {
      return items;
    }

    return items.where((item) {
      final haystack = [
        item.name,
        item.roleLabel,
        item.locationLabel,
        item.availabilityLabel,
        item.bio,
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 220), () {
      if (mounted) {
        setState(() => _query = value.trim());
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(peopleSnapshotProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('People'),
        actions: [
          IconButton(
            onPressed: () => context.push(AppRoutes.notifications),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Nearby providers, trust first.',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Search by skill, service area, response speed, and reputation.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    AppSearchField(
                      controller: _searchController,
                      hintText: 'Search name, skill, area, or trust signal',
                      onChanged: _onQueryChanged,
                    ),
                    const SizedBox(height: 12),
                    FilterChipGroup<String>(
                      options: const [
                        FilterOption(value: 'online', label: 'Online now'),
                        FilterOption(value: 'verified', label: 'Verified'),
                        FilterOption(value: 'top_rated', label: 'Top rated'),
                      ],
                      selectedValues: _filters,
                      onChanged: (next) => setState(() {
                        _filters
                          ..clear()
                          ..addAll(next);
                      }),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              snapshot.when(
                data: (data) {
                  final filtered = data.people.where((person) {
                    if (_filters.contains('online') && !person.isOnline) {
                      return false;
                    }
                    if (_filters.contains('verified') &&
                        person.completionPercent < 80) {
                      return false;
                    }
                    if (_filters.contains('top_rated') &&
                        ((person.averageRating ?? 0) < 4.5 ||
                            person.reviewCount < 1)) {
                      return false;
                    }

                    return person.matchesQuery(_query);
                  }).toList();

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionHeader(
                        title: 'Provider directory',
                        subtitle:
                            '${filtered.length} people match your current view.',
                      ),
                      const SizedBox(height: 12),
                      if (filtered.isEmpty)
                        const SectionCard(
                          child: EmptyStateView(
                            title: 'No matching providers',
                            message:
                                'Broaden the search or clear a filter to widen the local network.',
                          ),
                        )
                      else
                        ...filtered.map(
                          (person) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: ProviderCard(
                              person: person,
                              onOpenProfile: () => context.push(
                                AppRoutes.provider(person.id),
                              ),
                              onMessage: () => context.push(
                                '${AppRoutes.chat}?recipientId=${person.id}',
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const _PeopleLoading(),
                error: (error, _) => SectionCard(
                  child: ErrorStateView(
                    title: 'Unable to load people',
                    message: AppErrorMapper.toMessage(error),
                    onRetry: _refresh,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoPill(
                label: person.verificationLabel,
                background: const Color(0xFFE0F2FE),
                foreground: const Color(0xFF0B1F33),
              ),
              _InfoPill(
                label: person.priceLabel,
                background: const Color(0xFFF1F5F9),
                foreground: const Color(0xFF334155),
              ),
              _InfoPill(
                label: person.ratingLabel,
                background: const Color(0xFFFEF3C7),
                foreground: const Color(0xFF92400E),
              ),
              _InfoPill(
                label: person.workLabel,
                background: const Color(0xFFDCFCE7),
                foreground: const Color(0xFF166534),
              ),
            ],
          ),
          if (person.primaryTags.isNotEmpty) ...[
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: [
              Text(
                'People Network',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                'Browse nearby providers and active members using the same people directory as the web dashboard.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => _query = value),
                decoration: InputDecoration(
                  hintText: 'Search people by name, role, location, or skills',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _query.isEmpty
                      ? null
                      : IconButton(
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _query = '');
                          },
                          icon: const Icon(Icons.close_rounded),
                        ),
                ),
              ),
              const SizedBox(height: 16),
              snapshot.when(
                data: (data) {
                  final people = _filter(data.people);
                  if (people.isEmpty) {
                    return _PeopleEmptyState(query: _query);
                  }

                  return Column(
                    children: people
                        .map(
                          (person) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _PersonCard(
                              person: person,
                              busy: _busyPersonId == person.id,
                              onChat: person.isCurrentUser
                                  ? null
                                  : () => _openChat(person),
                            ),
                          ),
                        )
                        .toList(),
                  );
                },
                loading: () => Column(
                  children: List.generate(
                    4,
                    (_) => const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: _PeopleSkeletonCard(),
                    ),
                  ),
                ),
                error: (error, _) => _PeopleErrorState(error: error),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PersonCard extends StatelessWidget {
  const _PersonCard({
    required this.person,
    required this.busy,
    required this.onChat,
  });

  final MobilePersonItem person;
  final bool busy;
  final VoidCallback? onChat;

  @override
  Widget build(BuildContext context) {
    final badgeColor = person.online
        ? const Color(0xFFD1FAE5)
        : const Color(0xFFE2E8F0);
    final badgeInk = person.online
        ? const Color(0xFF047857)
        : const Color(0xFF475569);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0B1F33), Color(0xFF11466A)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    person.initials,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        person.name,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${person.roleLabel} • ${person.locationLabel}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: badgeColor,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    person.online ? 'Online' : person.availabilityLabel,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: badgeInk,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              person.bio,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: person.primaryTags
                  .map(
                    (tag) => Chip(
                      visualDensity: VisualDensity.compact,
                      label: Text(tag),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});
              children: [
                _MetricPill(
                  icon: Icons.design_services_outlined,
                  label: '${person.serviceCount} services',
                ),
                _MetricPill(
                  icon: Icons.inventory_2_outlined,
                  label: '${person.productCount} products',
                ),
                _MetricPill(
                  icon: Icons.task_alt_rounded,
                  label: '${person.completedJobs} completed',
                ),
                _MetricPill(
                  icon: Icons.star_outline_rounded,
                  label: person.ratingLabel,
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              person.statsSummary,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (onChat != null) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: busy ? null : onChat,
                  icon: busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.chat_bubble_outline_rounded),
                  label: const Text('Open chat'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF334155)),
          const SizedBox(width: 8),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: foreground, fontWeight: FontWeight.w700),
          Icon(icon, size: 15, color: const Color(0xFF475569)),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: const Color(0xFF0F172A),
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

class _PeopleSkeletonCard extends StatelessWidget {
  const _PeopleSkeletonCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: SizedBox(
        height: 168,
        child: Center(
          child: CircularProgressIndicator(
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      ),
    );
  }
}

class _PeopleEmptyState extends StatelessWidget {
  const _PeopleEmptyState();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('No matches yet', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Text(
          'Try a different search or switch off the online filter to widen the local network.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ),
    );
  }
}

class _PeopleLoading extends StatelessWidget {
  const _PeopleLoading();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 18, width: 140),
                SizedBox(height: 10),
                LoadingShimmer(height: 14),
                SizedBox(height: 8),
                LoadingShimmer(height: 14, width: 220),
              ],
            ),
          ),
  const _PeopleEmptyState({required this.query});

  final String query;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              query.trim().isEmpty ? 'No people yet' : 'No matches found',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(
              query.trim().isEmpty
                  ? 'People will appear here as nearby members and providers become available in your ServiQ network.'
                  : 'Try a different name, role, or location.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _PeopleErrorState extends StatelessWidget {
  const _PeopleErrorState({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Unable to load people right now',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Text(error.toString(), style: Theme.of(context).textTheme.bodyMedium),
      ],
    final message = switch (error) {
      ApiException apiError => apiError.message,
      _ => error.toString(),
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'People directory unavailable',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(message, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}
