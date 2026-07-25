import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/design_system/serviq_chrome.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';

class SavedFeedPage extends ConsumerStatefulWidget {
  const SavedFeedPage({super.key});

  @override
  ConsumerState<SavedFeedPage> createState() => _SavedFeedPageState();
}

class _SavedFeedPageState extends ConsumerState<SavedFeedPage> {
  static const _pageSize = 50;

  bool _loading = true;
  String? _error;
  List<_SavedCardRow> _rows = const [];
  bool _hasMore = true;
  bool _loadingMore = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final bootstrap = ref.read(appBootstrapProvider);
    final client = bootstrap.client;
    if (client == null) {
      setState(() {
        _loading = false;
        final initErr = bootstrap.initializationError?.trim() ?? '';
        _error = initErr.isNotEmpty
            ? initErr
            : 'Connect to the network to view saved cards.';
        _rows = const [];
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    final userId = client.auth.currentUser?.id;
    if (userId == null) {
      setState(() {
        _loading = false;
        _error = 'Sign in to view saved feed cards.';
        _rows = const [];
      });
      return;
    }

    try {
      final data = await client
          .from('feed_card_saves')
          .select(
            'id, card_id, focus_id, card_type, title, subtitle, action_path, created_at',
          )
          .eq('user_id', userId)
          .order('created_at', ascending: false)
          .range(0, _pageSize - 1);

      final list = (data as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map(_SavedCardRow.fromSupabase)
          .where((row) => row.cardId.isNotEmpty)
          .toList();

      setState(() {
        _rows = list;
        _loading = false;
        _hasMore = list.length >= _pageSize;
      });
    } on PostgrestException catch (error) {
      setState(() {
        _loading = false;
        _error = error.message;
        _rows = const [];
      });
    } catch (error) {
      setState(() {
        _loading = false;
        _error = error.toString();
        _rows = const [];
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() => _loadingMore = true);

    try {
      final bootstrap = ref.read(appBootstrapProvider);
      final client = bootstrap.client;
      final userId = client?.auth.currentUser?.id;
      if (client == null || userId == null) return;

      final from = _rows.length;
      final to = from + _pageSize - 1;

      final data = await client
          .from('feed_card_saves')
          .select(
            'id, card_id, focus_id, card_type, title, subtitle, action_path, created_at',
          )
          .eq('user_id', userId)
          .order('created_at', ascending: false)
          .range(from, to);

      final list = (data as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map(_SavedCardRow.fromSupabase)
          .where((row) => row.cardId.isNotEmpty)
          .toList();

      setState(() {
        _rows = [..._rows, ...list];
        _hasMore = list.length >= _pageSize;
        _loadingMore = false;
      });
    } catch (error) {
      setState(() => _loadingMore = false);
      if (mounted) {
        ServiqToast.show(context, message: 'Could not load more saves.', tone: ServiqToastTone.danger);
      }
    }
  }

  void _openRow(BuildContext context, _SavedCardRow row) {
    final path = row.actionPath.trim();
    if (path.startsWith('/app/')) {
      context.push(path);
      return;
    }
    ServiqToast.show(context, message: path.isEmpty
        ? 'This save has no open action yet.'
        : 'Open this from the web app: $path', tone: ServiqToastTone.warning);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Saved'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: _buildBody(context),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if ((_error ?? '').isNotEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            child: EmptyStateView(
              title: 'Saved feed unavailable',
              message: _error!,
              actionLabel: 'Retry',
              onAction: _load,
            ),
          ),
        ],
      );
    }
    if (_rows.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          SectionCard(
            child: EmptyStateView(
              title: 'No saved cards yet',
              message:
                  'Save cards from the feed to build a shortlist of local work you care about.',
            ),
          ),
        ],
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        itemCount: _rows.length + (_hasMore ? 1 : 0),
        separatorBuilder: (context, index) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == _rows.length) {
            return _loadingMore
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : TextButton(
                    onPressed: _loadMore,
                    child: const Text('Load more'),
                  );
          }
          final row = _rows[index];
          return SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.title.isEmpty ? 'Saved card' : row.title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (row.subtitle.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    row.subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    Chip(
                      label: Text(
                        row.cardType.isEmpty ? 'card' : row.cardType,
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ),
                    if (row.focusId.isNotEmpty)
                      Chip(
                        label: Text(
                          'Focus ${row.focusId}',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.tonal(
                    onPressed: () => _openRow(context, row),
                    child: const Text('Open'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SavedCardRow {
  const _SavedCardRow({
    required this.cardId,
    required this.focusId,
    required this.cardType,
    required this.title,
    required this.subtitle,
    required this.actionPath,
  });

  final String cardId;
  final String focusId;
  final String cardType;
  final String title;
  final String subtitle;
  final String actionPath;

  factory _SavedCardRow.fromSupabase(Map<String, dynamic> json) {
    String read(String key) {
      final v = json[key];
      return v is String ? v.trim() : '';
    }

    return _SavedCardRow(
      cardId: read('card_id'),
      focusId: read('focus_id'),
      cardType: read('card_type'),
      title: read('title'),
      subtitle: read('subtitle'),
      actionPath: read('action_path'),
    );
  }
}
