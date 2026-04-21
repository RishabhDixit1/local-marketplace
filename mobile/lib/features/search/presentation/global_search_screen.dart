import 'dart:async';

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
import '../../../shared/widgets/section_header.dart';
import '../data/search_repository.dart';
import 'search_results_sections.dart';

class GlobalSearchScreen extends ConsumerStatefulWidget {
  const GlobalSearchScreen({super.key, this.initialQuery});

  final String? initialQuery;

  @override
  ConsumerState<GlobalSearchScreen> createState() => _GlobalSearchScreenState();
}

class _GlobalSearchScreenState extends ConsumerState<GlobalSearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';
  SearchScope _scope = SearchScope.all;
  Future<List<SearchResultItem>>? _pendingSearch;

  @override
  void initState() {
    super.initState();
    _controller.text = widget.initialQuery ?? '';
    _query = _controller.text;
    _pendingSearch = _runSearch();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsServiceProvider).trackScreen('global_search_screen');
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<List<SearchResultItem>> _runSearch() {
    return ref
        .read(searchRepositoryProvider)
        .search(query: _query, scope: _scope);
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 200), () {
      setState(() {
        _query = value.trim();
        _pendingSearch = _runSearch();
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final recents = ref.watch(recentSearchesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.pageInset,
            AppSpacing.sm,
            AppSpacing.pageInset,
            AppSpacing.pageInset,
          ),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _controller,
                    autofocus: true,
                    decoration: const InputDecoration(
                      hintText:
                          'Search tasks, providers, people, and categories',
                      prefixIcon: Icon(Icons.search_rounded),
                    ),
                    onChanged: _onChanged,
                    onSubmitted: (value) async {
                      await ref
                          .read(searchRepositoryProvider)
                          .addRecentSearch(value);
                    },
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: SearchScope.values
                          .map(
                            (scope) => Padding(
                              padding: const EdgeInsets.only(
                                right: AppSpacing.sm,
                              ),
                              child: AppFilterChip(
                                label: scope.label,
                                selected: _scope == scope,
                                onSelected: (_) {
                                  setState(() {
                                    _scope = scope;
                                    _pendingSearch = _runSearch();
                                  });
                                },
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            if (recents.isNotEmpty) ...[
              AppSectionHeader(
                title: 'Recent searches',
                subtitle: 'Lightweight memory of your recent local intent.',
                action: TextButton(
                  onPressed: () async {
                    await ref
                        .read(searchRepositoryProvider)
                        .clearRecentSearches();
                  },
                  child: const Text('Clear'),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: recents
                    .map(
                      (item) => ActionChip(
                        label: Text(item),
                        onPressed: () {
                          _controller.text = item;
                          _onChanged(item);
                        },
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            FutureBuilder<List<SearchResultItem>>(
              future: _pendingSearch,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const CircularProgressIndicator();
                }
                if (snapshot.hasError) {
                  return AppErrorState(
                    title: 'Search failed',
                    message: AppErrorMapper.toMessage(snapshot.error!),
                  );
                }

                final results = snapshot.data ?? const [];
                if (results.isEmpty) {
                  return AppEmptyState(
                    title: _query.isEmpty
                        ? 'Start with a local intent'
                        : 'No matches',
                    message: _query.isEmpty
                        ? 'Try categories, trusted providers, or a specific nearby request.'
                        : 'Broaden the wording or switch search scope to widen the result set.',
                  );
                }

                final byCategories = results
                    .where((item) => item.scope == SearchScope.categories)
                    .toList();
                final byListings = results
                    .where((item) => item.scope == SearchScope.listings)
                    .toList();
                final byPeople = results
                    .where((item) => item.scope == SearchScope.people)
                    .toList();
                final byTasks = results
                    .where((item) => item.scope == SearchScope.tasks)
                    .toList();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SearchResultsSection(
                      title: 'Categories',
                      subtitle: 'Top entry points for local action.',
                      items: byCategories,
                    ),
                    SearchResultsSection(
                      title: 'Listings',
                      subtitle: 'Nearby requests, opportunities, and services.',
                      items: byListings,
                    ),
                    SearchResultsSection(
                      title: 'People',
                      subtitle:
                          'Connections, providers, and locals worth knowing.',
                      items: byPeople,
                    ),
                    SearchResultsSection(
                      title: 'Tasks',
                      subtitle: 'Your open, scheduled, and completed work.',
                      items: byTasks,
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
