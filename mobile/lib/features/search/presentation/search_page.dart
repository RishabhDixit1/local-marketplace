import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/api/mobile_api_provider.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/widgets/ai_prompt_bar.dart';
import '../data/search_repository.dart';
import '../domain/search_models.dart';

const _recentKey = 'serviq_recent_searches';
const _maxRecent = 5;

const _suggestions = [
  'Electrician',
  'Plumber',
  'AC Repair',
  'RO Repair',
  'Carpenter',
  'Appliance Repair',
  'Mobile Repair',
  'Bike Repair',
  'Hardware Shop',
  'Painter',
];

Future<List<String>> _loadRecent() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_recentKey) ?? [];
  } catch (_) {
    return [];
  }
}

Future<void> _saveRecent(String query) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final recent = (prefs.getStringList(_recentKey) ?? [])
      ..remove(query)
      ..insert(0, query);
    prefs.setStringList(_recentKey, recent.take(_maxRecent).toList());
  } catch (_) {}
}

enum _SortBy {
  distance('Nearest'),
  rating('Top Rated'),
  jobs('Most Jobs'),
  response('Fastest'),
  featured('Featured');

  final String label;
  const _SortBy(this.label);
}

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key, this.initialQuery});

  final String? initialQuery;

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  String _query = '';
  String? _selectedCategory;
  _SortBy _sortBy = _SortBy.distance;
  double? _minRating;
  bool _onlineOnly = false;
  List<Map<String, dynamic>> _categories = [];
  SearchResponse? _results;
  bool _loading = false;
  String? _error;
  List<String> _recent = [];

  @override
  void initState() {
    super.initState();
    _query = widget.initialQuery?.trim() ?? '';
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      _recent = await _loadRecent();
      if (mounted) setState(() {});
      _initialize();
    });
  }

  Future<void> _initialize() async {
    try {
      final client = ref.read(mobileApiClientProvider);
      final cats = await client.getServiceCategories();
      if (mounted) {
        setState(() { _categories = cats; });
      }
    } catch (_) {
      // Categories failed to load — search will still work
    }
    if (mounted && _query.isNotEmpty) _doSearch();
  }
  Future<void> _doSearch() async {
    if (_query.isEmpty && _selectedCategory == null) {
      setState(() { _results = null; _loading = false; _error = null; });
      return;
    }

    if (_query.isNotEmpty) {
      await _saveRecent(_query);
      setState(() => _recent = [_query, ..._recent.where((s) => s != _query)].take(_maxRecent).toList());
    }

    setState(() { _loading = true; _error = null; });

    try {
      final repo = ref.read(searchRepositoryProvider);
      final results = await repo.search(
        category: _selectedCategory,
        query: _query.isNotEmpty ? _query : null,
        limit: 50,
        offset: 0,
        minRating: _minRating,
        onlineOnly: _onlineOnly,
        sortBy: _sortBy.name,
      );
      if (mounted) setState(() { _results = results; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _openProvider(SearchResult provider) {
    context.push(AppRoutes.provider(provider.id));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Search nearby')),
      body: SafeArea(
        child: Column(
          children: [
            _buildSearchBar(),
            Expanded(
              child: _results == null && !_loading
                  ? _buildInitialState()
                  : _buildResults(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
      ),
      child: Column(
        children: [
          AiPromptBar(
            placeholder: 'Service, provider, or category...',
            initialQuery: widget.initialQuery,
            onResult: (result) {
              setState(() => _query = result.response);
              if (result.redirect != null) {
                context.push(result.redirect!);
              } else if (_query.isNotEmpty) {
                _doSearch();
              }
            },
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 28,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final cat in _categories)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: FilterChip(
                      label: Text(
                        '${cat['name'] ?? ''}',
                        style: const TextStyle(fontSize: 11),
                      ),
                      selected: _selectedCategory == cat['name'],
                      onSelected: (v) {
                        setState(() => _selectedCategory = v ? cat['name'] as String? : null);
                        _doSearch();
                      },
                      visualDensity: VisualDensity.compact,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 32,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<_SortBy>(
                      value: _sortBy,
                      isExpanded: true,
                      isDense: true,
                      style: const TextStyle(fontSize: 11, color: AppColors.inkStrong),
                      items: _SortBy.values.map((s) => DropdownMenuItem(
                        value: s,
                        child: Text(s.label, style: const TextStyle(fontSize: 11)),
                      )).toList(),
                      onChanged: (v) {
                        if (v != null) { setState(() => _sortBy = v); _doSearch(); }
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              InkWell(
                onTap: () => setState(() { _onlineOnly = !_onlineOnly; _doSearch(); }),
                child: Container(
                  height: 32,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _onlineOnly ? AppColors.primary : AppColors.border,
                    ),
                    color: _onlineOnly ? AppColors.primarySoft : null,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.circle, size: 6, color: _onlineOnly ? AppColors.primary : AppColors.inkFaint),
                      const SizedBox(width: 4),
                      Text('Online', style: TextStyle(fontSize: 11, color: _onlineOnly ? AppColors.primary : AppColors.inkSubtle)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              InkWell(
                onTap: () {
                  _showRatingFilter();
                },
                child: Container(
                  height: 32,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _minRating != null ? AppColors.primary : AppColors.border,
                    ),
                    color: _minRating != null ? AppColors.primarySoft : null,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star, size: 12, color: AppColors.warning),
                      const SizedBox(width: 3),
                      Text(
                        _minRating != null ? '${_minRating!.toStringAsFixed(0)}+' : 'Rating',
                        style: TextStyle(fontSize: 11, color: _minRating != null ? AppColors.primary : AppColors.inkSubtle),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }

  void _showRatingFilter() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(width: 32, height: 3, decoration: BoxDecoration(color: AppColors.inkFaint, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            const Text('Minimum Rating', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...['Any', '3+', '4+', '4.5+'].map((label) {
              final val = label == 'Any' ? null : double.tryParse(label.replaceAll('+', ''));
              return ListTile(
                title: Text(label),
                trailing: _minRating == val ? const Icon(Icons.check) : null,
                onTap: () {
                  Navigator.pop(ctx);
                  setState(() => _minRating = val);
                  _doSearch();
                },
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildInitialState() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (_recent.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                Icon(Icons.history_rounded, size: 14, color: AppColors.inkMuted),
                const SizedBox(width: 6),
                Text('Recent searches',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AppColors.inkMuted)),
              ],
            ),
          ),
          ..._recent.map((s) => ListTile(
            dense: true,
            leading: Icon(Icons.history_rounded, size: 18, color: AppColors.inkFaint),
            title: Text(s, style: const TextStyle(fontSize: 14)),
            trailing: IconButton(
              icon: Icon(Icons.north_west_rounded, size: 16, color: AppColors.primary),
              onPressed: () {
                _query = s;
                _doSearch();
              },
              visualDensity: VisualDensity.compact,
            ),
            onTap: () {
              _query = s;
              _doSearch();
            },
          )),
          const Divider(height: 24),
        ],
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              Icon(Icons.trending_up_rounded, size: 14, color: AppColors.inkMuted),
              const SizedBox(width: 6),
              Text('Suggestions',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AppColors.inkMuted)),
            ],
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _suggestions.map((s) => ActionChip(
            label: Text(s, style: const TextStyle(fontSize: 12)),
            onPressed: () {
              _query = s;
              _doSearch();
            },
            visualDensity: VisualDensity.compact,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          )).toList(),
        ),
      ],
    );
  }

  Widget _buildResults() {
      if (_loading && (_results == null || _results!.providers.isEmpty)) {
        return const Center(child: CircularProgressIndicator());
      }

    if (_error != null && (_results == null || _results!.providers.isEmpty)) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 40, color: AppColors.danger),
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
              const SizedBox(height: 12),
              FilledButton.tonal(onPressed: _doSearch, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final results = _results!;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (_loading)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: LinearProgressIndicator(),
          ),
        if (results.providers.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              '${results.total} provider${results.total == 1 ? '' : 's'} found',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.inkSubtle),
            ),
          ),
          ...results.providers.map((p) => _ProviderResultCard(
            provider: p,
            onTap: () => _openProvider(p),
          )),
          if (results.hasMore)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Center(
                child: FilledButton.tonal(
                  onPressed: () {},
                  child: const Text('Load more'),
                ),
              ),
            ),
        ] else if (!_loading) ...[
          const SizedBox(height: 32),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: EmptyStateView(
              title: 'No providers found',
              message: 'Try a different search term or adjust your filters.',
            ),
          ),
        ],
      ],
    );
  }
}

class _ProviderResultCard extends StatelessWidget {
  final SearchResult provider;
  final VoidCallback onTap;

  const _ProviderResultCard({
    required this.provider,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 22,
                backgroundImage: provider.avatarUrl.isNotEmpty
                    ? NetworkImage(provider.avatarUrl)
                    : null,
                child: provider.avatarUrl.isEmpty
                    ? Text(provider.name.isNotEmpty ? provider.name[0].toUpperCase() : '?',
                        style: const TextStyle(fontWeight: FontWeight.bold))
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(provider.name,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        ),
                        if (provider.verified)
                          const Padding(
                            padding: EdgeInsets.only(left: 4),
                            child: Icon(Icons.verified, size: 14, color: AppColors.primary),
                          ),
                        if (provider.featured)
                          const Padding(
                            padding: EdgeInsets.only(left: 2),
                            child: Icon(Icons.auto_awesome, size: 12, color: AppColors.warning),
                          ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    if (provider.location.isNotEmpty)
                      Text(provider.location,
                          style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        if (provider.avgRating != null)
                          _Tag(label: provider.ratingLabel, icon: Icons.star, color: AppColors.warning),
                        if (provider.distanceKm != null)
                          _Tag(label: '${provider.distanceKm!.toStringAsFixed(1)} km', icon: Icons.location_on),
                        if (provider.isOnline)
                          const _Tag(label: 'Online', icon: Icons.circle, color: AppColors.primary),
                        if (provider.completedJobs > 0)
                          _Tag(label: '${provider.completedJobs} jobs'),
                      ],
                    ),
                    if (provider.priceLabel.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(provider.priceLabel,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.inkStrong)),
                    ],
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, size: 16, color: AppColors.inkFaint),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final IconData? icon;
  final Color? color;

  const _Tag({required this.label, this.icon, this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: (color ?? AppColors.inkFaint).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: color ?? AppColors.inkSubtle),
            const SizedBox(width: 2),
          ],
          Text(label, style: TextStyle(fontSize: 10, color: color ?? AppColors.inkSubtle)),
        ],
      ),
    );
  }
}
