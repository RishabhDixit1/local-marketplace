import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../inbox/data/chat_repository.dart';
import '../data/people_repository.dart';
import '../domain/people_snapshot.dart';

class PeoplePage extends ConsumerStatefulWidget {
  const PeoplePage({super.key});

  @override
  ConsumerState<PeoplePage> createState() => _PeoplePageState();
}

class _PeoplePageState extends ConsumerState<PeoplePage> {
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

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(peopleSnapshotProvider);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
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
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
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
