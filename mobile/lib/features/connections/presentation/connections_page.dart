import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/design_tokens.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../people/data/people_repository.dart';
import '../../people/domain/people_snapshot.dart';
import '../data/connections_repository.dart';
import '../domain/connection_models.dart';

class ConnectionsPage extends ConsumerStatefulWidget {
  const ConnectionsPage({super.key});

  @override
  ConsumerState<ConnectionsPage> createState() => _ConnectionsPageState();
}

class _ConnectionsPageState extends ConsumerState<ConnectionsPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final connectionsAsync = ref.watch(connectionsListProvider);
    final peopleAsync = ref.watch(peopleSnapshotProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Connections'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Incoming'),
            Tab(text: 'Outgoing'),
            Tab(text: 'Accepted'),
          ],
        ),
      ),
      body: connectionsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off, size: 40, color: AppColors.inkFaint),
              const SizedBox(height: 12),
              Text('Unable to load connections'),
              const SizedBox(height: 12),
              FilledButton.tonal(
                onPressed: () => ref.invalidate(connectionsListProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (rows) {
          final people = peopleAsync.asData?.value;
          final viewerId = people?.currentUserId ?? '';

          final incoming = rows
              .where((r) => r.recipientId == viewerId && r.isPending)
              .toList();
          final outgoing = rows
              .where((r) => r.requesterId == viewerId && r.isPending)
              .toList();
          final accepted = rows.where((r) => r.isAccepted).toList();

          return TabBarView(
            controller: _tabController,
            children: [
              _ConnectionsList(
                rows: incoming,
                viewerId: viewerId,
                people: people,
                emptyMessage: 'No incoming requests.',
                showActions: true,
                onAccept: (r) => _respond(r.id, 'accepted'),
                onReject: (r) => _respond(r.id, 'rejected'),
              ),
              _ConnectionsList(
                rows: outgoing,
                viewerId: viewerId,
                people: people,
                emptyMessage: 'No outgoing requests.',
                showActions: false,
                onCancel: (r) => _respond(r.id, 'cancelled'),
              ),
              _ConnectionsList(
                rows: accepted,
                viewerId: viewerId,
                people: people,
                emptyMessage: 'No accepted connections yet.',
                showActions: false,
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _respond(String requestId, String decision) async {
    try {
      await ref.read(connectionsRepositoryProvider).respondToConnection(
        requestId: requestId,
        decision: decision,
      );
      ref.invalidate(connectionsListProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e')),
      );
    }
  }
}

class _ConnectionsList extends StatelessWidget {
  const _ConnectionsList({
    required this.rows,
    required this.viewerId,
    this.people,
    required this.emptyMessage,
    this.showActions = false,
    this.onAccept,
    this.onReject,
    this.onCancel,
  });

  final List<ConnectionRequestRow> rows;
  final String viewerId;
  final MobilePeopleSnapshot? people;
  final String emptyMessage;
  final bool showActions;
  final void Function(ConnectionRequestRow)? onAccept;
  final void Function(ConnectionRequestRow)? onReject;
  final void Function(ConnectionRequestRow)? onCancel;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return Center(
        child: EmptyStateView(title: emptyMessage, message: ''),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: rows.map((row) => _buildRow(context, row)).toList(),
    );
  }

  Widget _buildRow(BuildContext context, ConnectionRequestRow row) {
    final peerId =
        row.requesterId == viewerId ? row.recipientId : row.requesterId;
    final person = people?.people.where((p) => p.id == peerId).firstOrNull;
    final name = person?.name ?? peerId.substring(0, 8);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundImage: (person?.avatarUrl.isNotEmpty ?? false)
                  ? NetworkImage(person!.avatarUrl)
                  : null,
              child: (person?.avatarUrl.isNotEmpty ?? false)
                  ? null
                  : Text(name[0].toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  Text(
                    row.statusLabel,
                    style: TextStyle(
                        fontSize: 12, color: AppColors.inkSubtle),
                  ),
                ],
              ),
            ),
            if (showActions) ...[
              IconButton(
                icon: Icon(Icons.check_circle, color: AppColors.verified),
                onPressed: () => onAccept?.call(row),
                tooltip: 'Accept',
              ),
              IconButton(
                icon: Icon(Icons.cancel, color: AppColors.danger),
                onPressed: () => onReject?.call(row),
                tooltip: 'Reject',
              ),
            ],
            if (onCancel != null)
              TextButton(
                onPressed: () => onCancel?.call(row),
                child: const Text('Cancel'),
              ),
          ],
        ),
      ),
    );
  }
}
