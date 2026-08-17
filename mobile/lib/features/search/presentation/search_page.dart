import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/api/mobile_api_provider.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/services/user_location.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../l10n/l10n.dart';
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
  } catch (e) {
    debugPrint('ServiQ search_page._loadRecent failed: $e');
    return [];
  }
}

Future<void> _deleteRecent(String query) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final recent = (prefs.getStringList(_recentKey) ?? [])
      ..remove(query);
    prefs.setStringList(_recentKey, recent);
  } catch (e) {
    debugPrint('ServiQ search_page._deleteRecent failed: $e');
  }
}

Future<void> _saveRecent(String query) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final recent = (prefs.getStringList(_recentKey) ?? [])
      ..remove(query)
      ..insert(0, query);
    prefs.setStringList(_recentKey, recent.take(_maxRecent).toList());
  } catch (e) {
    debugPrint('ServiQ search_page._saveRecent failed: $e');
  }
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
  const SearchPage({super.key, this.initialQuery, this.initialCategory, this.browseAll = false});

  final String? initialQuery;
  final String? initialCategory;
  final bool browseAll;

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final _searchBarController = TextEditingController();
  String _query = '';
  String? _selectedCategory;
  _SortBy _sortBy = _SortBy.distance;
  double? _minRating;
  bool _onlineOnly = false;
  List<Map<String, dynamic>> _categories = [];
  SearchResponse? _results;
  bool _loading = false;
  bool _loadingMore = false;
  String? _error;
  List<String> _recent = [];

  @override
  void initState() {
    super.initState();
    _query = widget.initialQuery?.trim() ?? '';
    _searchBarController.text = _query;
    _selectedCategory = widget.initialCategory?.trim().isEmpty ?? true ? null : widget.initialCategory!.trim();
    _sortBy = widget.browseAll && _query.isEmpty ? _SortBy.featured : _SortBy.distance;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      _recent = await _loadRecent();
      if (mounted) setState(() {});
      _initialize();
    });
  }

  @override
  void dispose() {
    _searchBarController.dispose();
    super.dispose();
  }

  /// A query and a category chip are mutually exclusive: picking one clears the
  /// other so the UI, the search, and the result count all describe the same
  /// filter instead of silently combining two.
  void _clearQuery() {
    _searchBarController.clear();
    _query = '';
  }

  void _applyQuery(String query) {
    _searchBarController.text = query;
    setState(() {
      _query = query;
      _selectedCategory = null;
    });
  }

  Future<void> _initialize() async {
    try {
      final client = ref.read(mobileApiClientProvider);
      final cats = await client.getServiceCategories();
      if (mounted) {
        setState(() { _categories = cats; });
      }
    } catch (e) {
      debugPrint('ServiQ search_page._initialize categories failed: $e');
    }
    if (mounted && (_query.isNotEmpty || widget.browseAll || _selectedCategory != null)) _doSearch();
  }
  Future<void> _doSearch() async {
    if (_query.isEmpty && _selectedCategory == null && !widget.browseAll) {
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
      final location = await ref.read(userLocationProvider.future);
      final results = await repo.search(
        category: _selectedCategory,
        query: _query.isNotEmpty ? _query : null,
        lat: location?.latitude,
        lng: location?.longitude,
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

  Future<void> _loadMore() async {
    final current = _results;
    if (current == null || !current.hasMore || _loadingMore) return;

    setState(() => _loadingMore = true);

    try {
      final repo = ref.read(searchRepositoryProvider);
      final location = await ref.read(userLocationProvider.future);
      final nextResults = await repo.search(
        category: _selectedCategory,
        query: _query.isNotEmpty ? _query : null,
        lat: location?.latitude,
        lng: location?.longitude,
        limit: 50,
        offset: current.offset + current.limit,
        minRating: _minRating,
        onlineOnly: _onlineOnly,
        sortBy: _sortBy.name,
      );
      if (mounted) {
        setState(() {
          _results = SearchResponse(
            providers: [...current.providers, ...nextResults.providers],
            facets: nextResults.facets,
            total: nextResults.total,
            offset: nextResults.offset,
            limit: nextResults.limit,
            hasMore: nextResults.hasMore,
          );
          _loadingMore = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _openProvider(SearchResult provider) {
    context.push(AppRoutes.provider(provider.id));
  }

  @override
  Widget build(BuildContext context) {
    return ServiqScaffold(
      appBar: ServiqTopBar(title: 'Search nearby'),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isDark
                  ? [AppColors.darkSurface.withValues(alpha: 0.85), AppColors.darkSurfaceAlt.withValues(alpha: 0.65)]
                  : [Colors.white.withValues(alpha: 0.9), Colors.white.withValues(alpha: 0.65)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border(bottom: BorderSide(color: isDark ? AppColors.glassStrokeDark : AppColors.glassStroke)),
          ),
          child: Column(
            children: [
              AiPromptBar(
                initialQuery: widget.initialQuery,
                controller: _searchBarController,
                enableDebounce: true,
                onResult: (result, query) {
                  _applyQuery(query);
                  if (_query.isNotEmpty) {
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
                        child: _GlassCategoryChip(
                          label: '${cat['name'] ?? ''}',
                          selected: _selectedCategory == cat['name'],
                          onSelected: (v) {
                            _clearQuery();
                            setState(() => _selectedCategory = v ? cat['name'] as String? : null);
                            _doSearch();
                          },
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: _GlassDropdown(
                      value: _sortBy,
                      items: _SortBy.values.map((s) => DropdownMenuItem(
                        value: s,
                        child: Text(s.label, style: const TextStyle(fontSize: 11)),
                      )).toList(),
                      onChanged: (v) {
                        if (v != null) { setState(() => _sortBy = v); _doSearch(); }
                      },
                    ),
                  ),
                  const SizedBox(width: 6),
                  _GlassFilterChip(
                    label: 'Online',
                    icon: Icons.circle,
                    selected: _onlineOnly,
                    iconSize: 6,
                    onTap: () => setState(() { _onlineOnly = !_onlineOnly; _doSearch(); }),
                  ),
                  const SizedBox(width: 6),
                  _GlassFilterChip(
                    label: _minRating != null ? '${_minRating!.toStringAsFixed(0)}+' : 'Rating',
                    icon: Icons.star,
                    selected: _minRating != null,
                    iconSize: 12,
                    iconColor: AppColors.warning,
                    onTap: _showRatingFilter,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xxs),
            ],
          ),
        ),
      ),
    );
  }

  void _showRatingFilter() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: SafeArea(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Theme.of(context).colorScheme.surface.withValues(alpha: 0.95),
                    Theme.of(context).colorScheme.surface.withValues(alpha: 0.8),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: AppSpacing.xs),
                  Container(width: 32, height: 3, decoration: BoxDecoration(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45), borderRadius: BorderRadius.circular(2))),
                  const SizedBox(height: AppSpacing.md),
                  const Text('Minimum Rating', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: AppSpacing.sm),
                  ...['Any', '3+', '4+', '4.5+'].map((label) {
                    final val = label == 'Any' ? null : double.tryParse(label.replaceAll('+', ''));
                    return ListTile(
                      title: Text(label),
                      trailing: _minRating == val ? const Icon(Icons.check, color: AppColors.primary) : null,
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
          ),
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
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              children: [
                Icon(Icons.history_rounded, size: 14, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                const SizedBox(width: 6),
                Text('Recent searches',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
              ],
            ),
          ),
          ServiqSurface(
            variant: ServiqSurfaceVariant.glass,
            padding: const EdgeInsets.all(AppSpacing.xs),
            child: Column(
              children: _recent.map((s) => InkWell(
                onTap: () {
                  _applyQuery(s);
                  _doSearch();
                },
                borderRadius: BorderRadius.circular(AppRadii.md),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
                  child: Row(
                    children: [
                      Icon(Icons.history_rounded, size: 18, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(child: Text(s, style: const TextStyle(fontSize: 14))),
                      IconButton(
                        icon: Icon(Icons.north_west_rounded, size: 16, color: AppColors.primary),
                        onPressed: () {
                          _applyQuery(s);
                          _doSearch();
                        },
                        visualDensity: VisualDensity.compact,
                      ),
                      IconButton(
                        icon: Icon(Icons.close, size: 16, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                        onPressed: () async {
                          setState(() => _recent.remove(s));
                          await _deleteRecent(s);
                        },
                        visualDensity: VisualDensity.compact,
                      ),
                    ],
                  ),
                ),
              )).toList(),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Row(
            children: [
              Icon(Icons.trending_up_rounded, size: 14, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
              const SizedBox(width: 6),
              Text('Suggestions',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
            ],
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _suggestions.map((s) => _GlassSuggestionChip(
            label: s,
            onTap: () {
              _applyQuery(s);
              _doSearch();
            },
          )).toList(),
        ),
      ],
    );
  }

  Widget _buildResults() {
      if (_loading && (_results == null || _results!.providers.isEmpty)) {
        return const _ResultsLoading();
      }

    if (_error != null && (_results == null || _results!.providers.isEmpty)) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: ServiqSurface(
            variant: ServiqSurfaceVariant.glass,
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 40, color: AppColors.danger),
                const SizedBox(height: AppSpacing.sm),
                Text(_error!, style: TextStyle(color: AppColors.danger, fontSize: 13)),
                const SizedBox(height: AppSpacing.sm),
                PrimaryButton(
                  label: 'Retry',
                  onPressed: _doSearch,
                  expanded: false,
                ),
              ],
            ),
          ),
        ),
      );
    }

    final results = _results!;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (_loading)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: LinearProgressIndicator(
                backgroundColor: AppColors.primary.withValues(alpha: 0.1),
              ),
            ),
          ),
        if (results.providers.isNotEmpty) ...[
          ServiqSurface(
            variant: ServiqSurfaceVariant.glass,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
            child: Row(
              children: [
                Text(
                  '${results.total} provider${results.total == 1 ? '' : 's'} found',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          ...results.providers.map((p) => _ProviderResultCard(
            provider: p,
            onTap: () => _openProvider(p),
          )),
          if (results.hasMore)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Center(
                child: _loadingMore
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : PrimaryButton(
                        label: 'Load more',
                        onPressed: _loadMore,
                        expanded: false,
                      ),
              ),
            ),
        ] else if (!_loading) ...[
          const SizedBox(height: AppSpacing.xxl),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: EmptyStateView(
              title: AppLocalizations.of(context).aiNoProvidersFound,
              message: 'Post a requirement and let providers come to you.',
              actionLabel: AppLocalizations.of(context).aiPostRequirement,
              onAction: () {
                final params = <String, String>{};
                if (_query.isNotEmpty) params['title'] = _query;
                context.push(Uri(path: AppRoutes.createNeed, queryParameters: params).toString());
              },
            ),
          ),
        ],
      ],
    );
  }
}

class _GlassCategoryChip extends StatelessWidget {
  const _GlassCategoryChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final ValueChanged<bool> onSelected;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onSelected(!selected),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.pill),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: selected
                    ? [AppColors.primary.withValues(alpha: 0.25), AppColors.primary.withValues(alpha: 0.1)]
                    : [Colors.transparent, Colors.transparent],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadii.pill),
              border: Border.all(
                color: selected
                    ? AppColors.primary.withValues(alpha: 0.5)
                    : Theme.of(context).colorScheme.outline.withValues(alpha: 0.3),
              ),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? AppColors.primary : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GlassDropdown extends StatelessWidget {
  const _GlassDropdown({
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final _SortBy value;
  final List<DropdownMenuItem<_SortBy>> items;
  final ValueChanged<_SortBy?> onChanged;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
        child: Container(
          height: 32,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.3)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<_SortBy>(
              value: value,
              isExpanded: true,
              isDense: true,
              style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface),
              items: items,
              onChanged: onChanged,
            ),
          ),
        ),
      ),
    );
  }
}

class _GlassFilterChip extends StatelessWidget {
  const _GlassFilterChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
    this.iconSize = 6,
    this.iconColor,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  final double iconSize;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
          child: Container(
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: Border.all(
                color: selected ? AppColors.primary.withValues(alpha: 0.5) : Theme.of(context).colorScheme.outline.withValues(alpha: 0.3),
              ),
              gradient: selected
                  ? LinearGradient(
                      colors: [AppColors.primary.withValues(alpha: 0.2), AppColors.primary.withValues(alpha: 0.08)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: iconSize, color: iconColor ?? (selected ? AppColors.primary : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45))),
                const SizedBox(width: AppSpacing.xxs),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: selected ? AppColors.primary : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GlassSuggestionChip extends StatelessWidget {
  const _GlassSuggestionChip({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.pill),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.pill),
              border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.2)),
              gradient: LinearGradient(
                colors: [
                  Colors.white.withValues(alpha: 0.5),
                  Colors.white.withValues(alpha: 0.2),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Text(label, style: const TextStyle(fontSize: 12)),
          ),
        ),
      ),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark
                    ? [AppColors.darkSurface.withValues(alpha: 0.85), AppColors.darkSurfaceAlt.withValues(alpha: 0.65)]
                    : [Colors.white.withValues(alpha: 0.9), Colors.white.withValues(alpha: 0.65)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadii.xl),
              border: Border.all(color: isDark ? AppColors.glassStrokeDark : AppColors.glassStroke),
              boxShadow: AppShadows.glass,
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onTap,
                borderRadius: BorderRadius.circular(AppRadii.xl),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppAvatar(
                        name: provider.name,
                        avatarUrl: provider.avatarUrl,
                        radius: 22,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(provider.name,
                                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
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
                                Padding(
                                  padding: const EdgeInsets.only(left: 6),
                                  child: AppPill(
                                    label: 'Service',
                                    backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                                    foregroundColor: AppColors.primary,
                                    border: BorderSide(color: AppColors.primary.withValues(alpha: 0.25)),
                                    size: AppPillSize.mini,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.xxxs),
                            if (provider.location.isNotEmpty)
                              Text(provider.location,
                                  style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis),
                            const SizedBox(height: AppSpacing.xxs),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                if (provider.avgRating != null)
                                  AppPill(
                                    label: provider.ratingLabel,
                                    icon: Icons.star,
                                    backgroundColor: AppColors.warning.withValues(alpha: 0.1),
                                    foregroundColor: AppColors.warning,
                                    size: AppPillSize.mini,
                                  ),
                                if (provider.distanceKm != null)
                                  AppPill(
                                    label: '${provider.distanceKm!.toStringAsFixed(1)} km',
                                    icon: Icons.location_on,
                                    backgroundColor: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.045),
                                    foregroundColor: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                                    size: AppPillSize.mini,
                                  ),
                                if (provider.isOnline)
                                  AppPill(
                                    label: 'Online',
                                    icon: Icons.circle,
                                    backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                                    foregroundColor: AppColors.primary,
                                    size: AppPillSize.mini,
                                  ),
                                if (provider.completedJobs > 0)
                                  AppPill(
                                    label: '${provider.completedJobs} jobs',
                                    backgroundColor: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.045),
                                    foregroundColor: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                                    size: AppPillSize.mini,
                                  ),
                              ],
                            ),
                            if (provider.priceLabel.isNotEmpty) ...[
                              const SizedBox(height: AppSpacing.xxs),
                              Text(provider.priceLabel,
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurface)),
                            ],
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(AppRadii.pill),
                        ),
                        child: Icon(Icons.chevron_right, size: 14, color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ResultsLoading extends StatelessWidget {
  const _ResultsLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        const Center(child: LoadingShimmer(height: 12, width: 120)),
        const SizedBox(height: AppSpacing.sm),
        ServiqSurface(
          variant: ServiqSurfaceVariant.glass,
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Column(
            children: [
              for (var i = 0; i < 5; i++) ...[
                if (i > 0) const SizedBox(height: AppSpacing.sm),
                const _ProviderResultSkeleton(),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _ProviderResultSkeleton extends StatelessWidget {
  const _ProviderResultSkeleton();

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const LoadingShimmer(height: 44, width: 44, borderRadius: 22),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              LoadingShimmer(height: 13, width: 140),
              SizedBox(height: AppSpacing.xxxs),
              LoadingShimmer(height: 11, width: 100),
              SizedBox(height: AppSpacing.xs),
              LoadingShimmer(height: 20, width: 64, borderRadius: 10),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        const LoadingShimmer(height: 22, width: 22, borderRadius: 11),
      ],
    );
  }
}
