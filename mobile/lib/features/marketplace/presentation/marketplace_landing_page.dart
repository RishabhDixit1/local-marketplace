import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/constants/app_routes.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/nameplate_card.dart';
import '../../../shared/components/marketplace_provider_card.dart';
import '../../../shared/widgets/ai_prompt_bar.dart';
import '../data/marketplace_repository.dart';
import '../domain/marketplace_provider.dart';

final _categoriesProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, void>((ref, _) async {
  final repo = ref.watch(marketplaceRepositoryProvider);
  return repo.fetchServiceCategories();
});

class MarketplaceLandingPage extends ConsumerStatefulWidget {
  const MarketplaceLandingPage({
    super.key,
    this.zoneSlug,
  });

  final String? zoneSlug;

  @override
  ConsumerState<MarketplaceLandingPage> createState() => _LandingPageState();
}

class _LandingPageState extends ConsumerState<MarketplaceLandingPage> {
  final _searchController = TextEditingController();
  String? _selectedCategory;
  bool _showBanner = true;

  String get _locationLabel => 'Your area';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final providersAsync = ref.watch(marketplaceProvidersProvider(_selectedCategory));
    final categoriesAsync = ref.watch(_categoriesProvider(null));

    final providerList = providersAsync.asData?.value ?? <MarketplaceProvider>[];
    final categories = categoriesAsync.asData?.value ?? <Map<String, dynamic>>[];

    final searchQuery = _searchController.text.trim().toLowerCase();
    final filteredProviders = searchQuery.isEmpty
        ? providerList
        : providerList.where((p) {
            final q = searchQuery;
            return p.name.toLowerCase().contains(q) ||
                p.bio.toLowerCase().contains(q) ||
                p.services.any((s) => s.toLowerCase().contains(q));
          }).toList();

    final hasActiveFilter = _selectedCategory != null || searchQuery.isNotEmpty;
    final showEmptyState = filteredProviders.isEmpty && hasActiveFilter;
    final showHeroActions = filteredProviders.isEmpty && !hasActiveFilter;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            _buildHeader(),
            if (_showBanner) _buildHowItWorksBanner(),
            _buildUnifiedHero(showHeroActions, categories),
            _buildProviderList(
              providersAsync,
              filteredProviders,
              searchQuery.isNotEmpty,
              showEmptyState,
            ),
            _buildBusinessCta(),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pageInset, vertical: AppSpacing.sm),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.primaryDeep,
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                    ),
                    child: const Center(
                      child: Text('S', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Flexible(
                    child: Text('ServiQ', overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Theme.of(context).colorScheme.onSurface)),
                  ),
                ],
              ),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 0, maxWidth: 150, minHeight: 0, maxHeight: 48),
              child: FilledButton.tonalIcon(
                onPressed: () => context.push(AppRoutes.signIn),
                label: const Text('Sign In'),
                icon: Icon(Icons.login_rounded, size: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHowItWorksBanner() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pageInset),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.marigoldSoft,
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(color: AppColors.marigoldMuted),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('How ServiQ works',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.md,
                      runSpacing: AppSpacing.xxs,
                      children: [
                        _stepChip('1', 'Browse nearby providers'),
                        _stepChip('2', 'Contact & compare'),
                        _stepChip('3', 'Get work done'),
                      ],
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () => setState(() => _showBanner = false),
                child: Icon(Icons.close_rounded, size: 20, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _stepChip(String number, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            color: AppColors.marigold,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          child: Center(child: Text(number, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold))),
        ),
        const SizedBox(width: 4),
        Flexible(child: Text(text, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)))),
      ],
    );
  }

  Widget _buildUnifiedHero(
    bool showActions,
    List<Map<String, dynamic>> categories,
  ) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pageInset, vertical: AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('What do you need done?',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface,
                )),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.location_on_rounded, size: 14, color: AppColors.primaryDeep),
                  const SizedBox(width: 4),
                  Text(_locationLabel,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primaryDeep)),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            AiPromptBar(
              placeholder: 'Try "AC repair", "electrician", "plumber nearby"...',
              onResult: (result) {
                final query = result.response.trim().toLowerCase();
                setState(() => _searchController.text = query);
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: (categories.isNotEmpty ? categories : _defaultCategories()).map((cat) {
                final name = cat is Map<String, dynamic>
                    ? (cat['name'] as String? ?? '')
                    : (cat.$2 as String);
                final selected = _selectedCategory == name;
                return FilterChip(
                  label: Text(name,
                      style: TextStyle(fontSize: 12, fontWeight: selected ? FontWeight.bold : FontWeight.w500)),
                  selected: selected,
                  selectedColor: AppColors.marigoldSoft,
                  checkmarkColor: AppColors.marigoldDeep,
                  onSelected: (val) => setState(() => _selectedCategory = val ? name : null),
                  side: BorderSide(
                    color: selected
                        ? AppColors.marigold.withValues(alpha: 0.5)
                        : Theme.of(context).colorScheme.outline,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Text(
                  _selectedCategory != null
                      ? 'Showing "$_selectedCategory" providers'
                      : 'Showing results for all',
                  style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                ),
                const Spacer(),
                if (_selectedCategory != null)
                  GestureDetector(
                    onTap: () => setState(() => _selectedCategory = null),
                    child: const Text('Clear',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primaryDeep)),
                  ),
              ],
            ),
            if (showActions) ...[
              const SizedBox(height: 12),
              Text('Covering all service categories in your area.',
                  style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => context.go(AppRoutes.marketZones),
                      icon: const Icon(Icons.explore_rounded, size: 18),
                      label: const Text('View Market'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primaryDeep,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.go(AppRoutes.marketZones),
                      icon: const Icon(Icons.store_rounded, size: 18),
                      label: const Text('Browse All Providers'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primaryDeep,
                        side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<dynamic> _defaultCategories() {
    return const [
      ('⚡', 'Electrician'),
      ('🔧', 'Plumber'),
      ('❄️', 'AC Repair'),
      ('💧', 'RO Repair'),
      ('🪚', 'Carpenter'),
      ('🔌', 'Appliance Repair'),
      ('📱', 'Mobile Repair'),
      ('🏍️', 'Bike Repair'),
      ('🏪', 'Hardware Shop'),
      ('💡', 'Electrical Shop'),
    ];
  }

  Widget _buildProviderList(
    AsyncValue<List<MarketplaceProvider>> asyncValue,
    List<MarketplaceProvider> filtered,
    bool hasSearch,
    bool showEmptyState,
  ) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pageInset),
        child: ServiqAsyncBody<List<MarketplaceProvider>>(
          value: asyncValue,
          onRetry: () => ref.invalidate(marketplaceProvidersProvider(_selectedCategory)),
          loadingBuilder: () => _ProviderListShimmer(),
          errorBuilder: (error, stack) {
            return ErrorStateView(
              title: 'Could not load providers',
              message: error.toString(),
              onRetry: () => ref.invalidate(marketplaceProvidersProvider(_selectedCategory)),
            );
          },
          data: (providers) {
            if (showEmptyState) {
              return Padding(
                padding: const EdgeInsets.only(top: AppSpacing.md),
                child: EmptyStateView(
                  icon: Icons.search_off_rounded,
                  title: 'No providers found nearby',
                  message: hasSearch
                      ? 'Try a different search term.'
                      : 'Try adjusting your filters or browse all providers.',
                ),
              );
            }

            if (filtered.isEmpty) return const SizedBox.shrink();

            return Column(
              children: [
                const SizedBox(height: AppSpacing.xs),
                for (final provider in filtered) ...[
                  MarketplaceProviderCard(
                    name: provider.name,
                    location: provider.location.isNotEmpty ? provider.location : null,
                    bio: provider.bio,
                    avgRating: provider.avgRating,
                    completedJobs: provider.completedJobs,
                    responseMinutes: provider.responseMinutes,
                    priceMin: provider.priceMin,
                    priceMax: provider.priceMax,
                    verified: provider.verified,
                    onTap: () => _showProviderDetail(context, provider),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildBusinessCta() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.pageInset, AppSpacing.xxxl, AppSpacing.pageInset, AppSpacing.lg),
        child: NameplateCard(
          child: Column(
            children: [
              Icon(Icons.store_rounded, size: 32, color: AppColors.marigold),
              const SizedBox(height: AppSpacing.sm),
              Text('Are you a service provider?',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: AppSpacing.xxs),
              Text('List your business on ServiQ and get more customers from your neighborhood.',
                  style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                  textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.md),
              FilledButton.icon(
                onPressed: () => context.push(AppRoutes.signIn),
                label: const Text('List Your Business'),
                icon: Icon(Icons.store_rounded, size: 18),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.marigold,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFooter() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.pageInset, AppSpacing.lg, AppSpacing.pageInset, AppSpacing.xxxl),
        child: Text(
          'ServiQ — Local marketplace · Built for the community',
          style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  void _showProviderDetail(BuildContext context, MarketplaceProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
      ),
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.65,
        maxChildSize: 0.85,
        minChildSize: 0.3,
        builder: (_, scrollController) => SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.all(AppSpacing.pageInset),
          child: _ProviderDetailSheet(provider: provider, onContact: () {
            Navigator.of(sheetContext).pop();
            context.push(AppRoutes.signIn);
          }),
        ),
      ),
    );
  }
}

class _ProviderDetailSheet extends StatelessWidget {
  const _ProviderDetailSheet({required this.provider, required this.onContact});

  final MarketplaceProvider provider;
  final VoidCallback onContact;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
          child: Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.outline,
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: AppColors.primarySoft,
              child: Text(
                provider.name.isNotEmpty ? provider.name[0].toUpperCase() : '?',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: AppColors.primaryDeep),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(provider.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleLarge),
                      ),
                      if (provider.verified) ...[
                        const SizedBox(width: AppSpacing.xxs),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.verifiedSoft,
                            borderRadius: BorderRadius.circular(AppRadii.pill),
                          ),
                          child: const Text('Verified',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.verified)),
                        ),
                      ],
                    ],
                  ),
                  Text(provider.location.isNotEmpty ? provider.location : 'Location not set',
                      style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            if (provider.avgRating != null)
              _DetailStat(icon: Icons.star_rounded, value: provider.avgRating?.toStringAsFixed(1) ?? '—', label: '${provider.reviewCount} reviews'),
            if (provider.completedJobs > 0)
              _DetailStat(icon: Icons.check_circle_outline_rounded, value: provider.completedJobs.toString(), label: 'jobs done'),
            if (provider.responseMinutes != null)
              _DetailStat(icon: Icons.bolt_rounded, value: '${provider.responseMinutes} min', label: 'response'),
          ],
        ),
        if (provider.bio.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text('ABOUT',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45))),
          const SizedBox(height: AppSpacing.xxs),
          Text(provider.bio, style: TextStyle(fontSize: 14, color: Theme.of(context).colorScheme.onSurface, height: 1.5)),
        ],
        if (provider.services.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text('SERVICES',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45))),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: provider.services.map((s) => Chip(
              label: Text(s, style: const TextStyle(fontSize: 12)),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
            )).toList(),
          ),
        ],
        if (provider.listings.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text('AVAILABLE LISTINGS',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45))),
          const SizedBox(height: AppSpacing.xs),
          ...provider.listings.map((l) => Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.xxs),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(AppRadii.lg),
              border: Border.all(color: Theme.of(context).colorScheme.outline),
            ),
            child: Row(
              children: [
                Expanded(child: Text(l.title, style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurface))),
                if (l.price != null)
                  Text('₹${l.price}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.marigold)),
              ],
            ),
          )),
        ],
        const SizedBox(height: AppSpacing.lg),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: onContact,
            label: const Text('Contact'),
            icon: const Icon(Icons.phone_rounded, size: 18),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primaryDeep,
              foregroundColor: Colors.white,
            ),
          ),
        ),
      ],
    );
  }
}

class _DetailStat extends StatelessWidget {
  const _DetailStat({required this.icon, required this.value, required this.label});

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: AppSpacing.xs),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
      child: Column(
        children: [
          Icon(icon, size: 16, color: AppColors.marigold),
          const SizedBox(height: AppSpacing.xxs),
          Text(value, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          Text(label, style: TextStyle(fontSize: 10, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45))),
        ],
      ),
    );
  }
}

class _ProviderListShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(4, (_) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
        child: NameplateCard(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const LoadingShimmer(width: 44, height: 44, borderRadius: 22),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const LoadingShimmer(width: 140, height: 14),
                    const SizedBox(height: 4),
                    const LoadingShimmer(width: 100, height: 11),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        LoadingShimmer(width: 60, height: 20, borderRadius: 10),
                        const SizedBox(width: 8),
                        LoadingShimmer(width: 60, height: 20, borderRadius: 10),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      )),
    );
  }
}
