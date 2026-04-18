import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import '../data/people_repository.dart';
import '../domain/people_snapshot.dart';

class PeoplePage extends ConsumerStatefulWidget {
  const PeoplePage({super.key});

  @override
  ConsumerState<PeoplePage> createState() => _PeoplePageState();
}

class _PeoplePageState extends ConsumerState<PeoplePage> {
  final _searchController = TextEditingController();
  String _query = '';
  bool _onlineOnly = false;
  RealtimeChannel? _peopleChannel;

  AppBootstrap? _readBootstrap() {
    try {
      return ref.read(appBootstrapProvider);
    } catch (_) {
      return null;
    }
  }

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_handleSearchChanged);
    _subscribeToRealtime();
  }

  @override
  void dispose() {
    _searchController
      ..removeListener(_handleSearchChanged)
      ..dispose();
    final client = _readBootstrap()?.client;
    final channel = _peopleChannel;
    if (client != null && channel != null) {
      client.removeChannel(channel);
    }
    super.dispose();
  }

  void _handleSearchChanged() {
    setState(() {
      _query = _searchController.text;
    });
  }

  void _subscribeToRealtime() {
    final client = _readBootstrap()?.client;
    if (client == null) {
      return;
    }

    void invalidatePeople() {
      ref.invalidate(peopleSnapshotProvider);
    }

    _peopleChannel = client
        .channel('mobile-people-directory')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'profiles',
          callback: (_) => invalidatePeople(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'provider_presence',
          callback: (_) => invalidatePeople(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'service_listings',
          callback: (_) => invalidatePeople(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'product_catalog',
          callback: (_) => invalidatePeople(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'reviews',
          callback: (_) => invalidatePeople(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'orders',
          callback: (_) => invalidatePeople(),
        )
        .subscribe();
  }

  Future<void> _refresh() async {
    ref.invalidate(peopleSnapshotProvider);
    await ref.read(peopleSnapshotProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(peopleSnapshotProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('People')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              snapshot.when(
                data: (data) {
                  final filtered = data.people.where((person) {
                    if (_onlineOnly && !person.isOnline) {
                      return false;
                    }
                    return person.matchesQuery(_query);
                  }).toList();

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _PeopleHero(snapshot: data),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _searchController,
                        textInputAction: TextInputAction.search,
                        decoration: const InputDecoration(
                          labelText: 'Search nearby people',
                          hintText: 'Name, skill, location, trust level',
                          prefixIcon: Icon(Icons.search_rounded),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          FilterChip(
                            label: const Text('Online now'),
                            selected: _onlineOnly,
                            onSelected: (selected) {
                              setState(() {
                                _onlineOnly = selected;
                              });
                            },
                          ),
                          FilterChip(
                            label: Text('${data.totalCount} people'),
                            selected: !_onlineOnly,
                            onSelected: (_) {
                              setState(() {
                                _onlineOnly = false;
                              });
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (filtered.isEmpty)
                        const SectionCard(child: _PeopleEmptyState())
                      else
                        ...filtered.map(
                          (person) => Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: _PersonCard(person: person),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const _PeopleLoadingState(),
                error: (error, stackTrace) =>
                    SectionCard(child: _PeopleErrorState(error: error)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PeopleHero extends StatelessWidget {
  const _PeopleHero({required this.snapshot});

  final MobilePeopleSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(32),
        gradient: const LinearGradient(
          colors: [Color(0xFF0B1F33), Color(0xFF1D4ED8), Color(0xFF22C55E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Find the people already making ServiQ feel alive.',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            'This directory is built from the same live profiles, presence, reviews, and order history that power the web product.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
            ),
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _HeroStat(label: 'People', value: snapshot.totalCount.toString()),
              _HeroStat(
                label: 'Online',
                value: snapshot.onlineCount.toString(),
              ),
              _HeroStat(
                label: 'Ready',
                value: snapshot.verifiedCount.toString(),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(color: Colors.white),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _PersonCard extends StatelessWidget {
  const _PersonCard({required this.person});

  final MobilePersonCard person;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: const Color(0xFFE0F2FE),
                    backgroundImage: person.avatarUrl.isEmpty
                        ? null
                        : NetworkImage(person.avatarUrl),
                    child: person.avatarUrl.isEmpty
                        ? Text(
                            person.name.characters.first.toUpperCase(),
                            style: Theme.of(context).textTheme.titleLarge,
                          )
                        : null,
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: person.isOnline
                            ? const Color(0xFF22C55E)
                            : const Color(0xFFCBD5E1),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(person.name, style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 6),
                    Text(
                      person.headline,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _MetaPill(
                          icon: Icons.location_on_outlined,
                          label: person.locationLabel,
                        ),
                        _MetaPill(
                          icon: person.isOnline
                              ? Icons.bolt_rounded
                              : Icons.schedule_rounded,
                          label: person.activityLabel,
                        ),
                      ],
                    ),
                  ],
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

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
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
      ],
    );
  }
}

class _PeopleLoadingState extends StatelessWidget {
  const _PeopleLoadingState();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (index) => const Padding(
          padding: EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: SizedBox(
              height: 180,
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
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
    );
  }
}
