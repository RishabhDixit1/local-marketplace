import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/design_system/design_system.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/constants/app_routes.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/trust_badge.dart';
import '../data/marketplace_repository.dart';
import '../domain/marketplace_provider.dart';

const _categories = [
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

class MarketplaceLandingPage extends ConsumerStatefulWidget {
  const MarketplaceLandingPage({super.key});

  @override
  ConsumerState<MarketplaceLandingPage> createState() => _LandingPageState();
}

class _LandingPageState extends ConsumerState<MarketplaceLandingPage> {
  final _searchController = TextEditingController();
  String? _selectedCategory;
  bool _showBanner = true;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final providersAsync = ref.watch(marketplaceProvidersProvider(_selectedCategory));

    final providerList = providersAsync.asData?.value ?? <MarketplaceProvider>[];
    final searchQuery = _searchController.text.trim().toLowerCase();
    final filteredProviders = searchQuery.isEmpty
        ? providerList
        : providerList.where((p) {
            final q = searchQuery;
            return p.name.toLowerCase().contains(q) ||
                p.bio.toLowerCase().contains(q) ||
                p.services.any((s) => s.toLowerCase().contains(q));
          }).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            _buildHeader(),
            if (_showBanner) _buildHowItWorksBanner(),
            _buildHeroSection(),
            _buildCategoryChips(),
            _buildResultsCount(filteredProviders.length),
            _buildProviderList(providersAsync, filteredProviders, searchQuery.isNotEmpty),
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
            Row(
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
                const Text('ServiQ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.inkStrong)),
              ],
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(
                minWidth: 0, maxWidth: 150,
                minHeight: 0, maxHeight: 48,
              ),
              child: FilledButton.tonalIcon(
                onPressed: () => context.push(AppRoutes.signIn),
                label: const Text('Sign In'),
                icon: const Icon(Icons.login_rounded, size: 18),
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
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(AppRadii.xl),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('How ServiQ works', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.inkStrong)),
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
                child: const Icon(Icons.close_rounded, size: 20, color: AppColors.inkSubtle),
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
            color: AppColors.primaryDeep,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          child: Center(child: Text(number, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold))),
        ),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
      ],
    );
  }

  Widget _buildHeroSection() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pageInset, vertical: AppSpacing.lg),
        child: Column(
          children: [
            const Text('What do you need done?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: AppColors.inkStrong)),
            const SizedBox(height: AppSpacing.xxs),
            const Text('Find trusted providers near you in Crossings Republik',
                style: TextStyle(fontSize: 14, color: AppColors.inkSubtle)),
            const SizedBox(height: AppSpacing.md),
            _HeroSearchField(controller: _searchController),
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => context.push(AppRoutes.marketZones),
                icon: const Icon(Icons.explore_rounded, size: 18),
                label: const Text('Explore Local Zones'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primaryDeep,
                  side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.xl)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryChips() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pageInset),
        child: Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: _categories.map((cat) {
            final selected = _selectedCategory == cat.$2;
            return FilterChip(
              label: Text('${cat.$1} ${cat.$2}', style: TextStyle(fontSize: 12, fontWeight: selected ? FontWeight.bold : FontWeight.w500)),
              selected: selected,
              selectedColor: AppColors.primarySoft,
              checkmarkColor: AppColors.primaryDeep,
              onSelected: (val) => setState(() => _selectedCategory = val ? cat.$2 : null),
              side: BorderSide(color: selected ? AppColors.primary.withValues(alpha: 0.4) : AppColors.border),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildResultsCount(int count) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.pageInset, AppSpacing.lg, AppSpacing.pageInset, AppSpacing.sm),
        child: Row(
          children: [
            Text('$count ${count == 1 ? 'provider' : 'providers'} near you',
                style: const TextStyle(fontSize: 13, color: AppColors.inkSubtle)),
            const Spacer(),
            if (_selectedCategory != null)
              GestureDetector(
                onTap: () => setState(() => _selectedCategory = null),
                child: const Text('Clear filter',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primaryDeep)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildProviderList(
    AsyncValue<List<MarketplaceProvider>> asyncValue,
    List<MarketplaceProvider> filtered,
    bool hasSearch,
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
            if (filtered.isEmpty) {
              return EmptyStateView(
                icon: Icons.search_off_rounded,
                title: hasSearch ? 'No matches' : 'No providers found',
                message: hasSearch
                    ? 'Try a different search term.'
                    : 'No providers available for this area or category.',
              );
            }

            return Column(
              children: [
                for (final provider in filtered) ...[
                  _ProviderLandingCard(
                    provider: provider,
                    onTap: () => _showProviderDetail(context, provider),
                    onContact: () {
                      context.push(AppRoutes.signIn);
                    },
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
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.4), width: 1.2),
            borderRadius: BorderRadius.circular(AppRadii.xl),
            color: AppColors.primarySoft.withValues(alpha: 0.3),
          ),
          child: Column(
            children: [
              Icon(Icons.store_rounded, size: 32, color: AppColors.primaryDeep),
              const SizedBox(height: AppSpacing.sm),
              const Text('Are you a service provider?',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.inkStrong)),
              const SizedBox(height: AppSpacing.xxs),
              const Text('List your business on ServiQ and get more customers from your neighborhood.',
                  style: TextStyle(fontSize: 13, color: AppColors.inkSubtle), textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.md),
              FilledButton.icon(
                onPressed: () => context.push(AppRoutes.signIn),
                label: const Text('List Your Business'),
                icon: const Icon(Icons.store_rounded, size: 18),
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
        child: const Text(
          'ServiQ — Crossings Republik\'s local marketplace · Built for the community',
          style: TextStyle(fontSize: 11, color: AppColors.inkFaint),
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

/// ── Hero Search Field ──
class _HeroSearchField extends StatelessWidget {
  const _HeroSearchField({required this.controller});
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: (_) {},
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: 'Try "AC repair", "electrician", "plumber nearby"...',
        prefixIcon: const Icon(Icons.search_rounded, color: AppColors.inkFaint),
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          borderSide: BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          borderSide: BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
      ),
    );
  }
}

/// ── Provider Landing Card ──
class _ProviderLandingCard extends StatelessWidget {
  const _ProviderLandingCard({
    required this.provider,
    required this.onTap,
    required this.onContact,
  });

  final MarketplaceProvider provider;
  final VoidCallback onTap;
  final VoidCallback onContact;

  @override
  Widget build(BuildContext context) {
    final priceLabel = provider.priceMin != null
        ? provider.priceMax != null && provider.priceMax! > provider.priceMin!
            ? '₹${provider.priceMin} - ₹${provider.priceMax}'
            : 'From ₹${provider.priceMin}'
        : null;

    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        side: BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: AppColors.primarySoft,
                child: Text(
                  provider.name.isNotEmpty ? provider.name[0].toUpperCase() : '?',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.primaryDeep),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(provider.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.inkStrong)),
                        ),
                        if (provider.verified)
                          const Padding(
                            padding: EdgeInsets.only(left: 4),
                            child: TrustBadge(label: 'Verified'),
                          ),
                      ],
                    ),
                    Text(provider.location.isNotEmpty ? provider.location : 'Crossings Republik',
                        style: const TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
                    const SizedBox(height: AppSpacing.xxs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xxs,
                      children: [
                        if (provider.avgRating != null)
                          _SignalChip(
                            icon: Icons.star_rounded,
                            label: '${provider.avgRating!.toStringAsFixed(1)} (${provider.reviewCount})',
                            color: AppColors.warm,
                          ),
                        if (provider.responseMinutes != null)
                          _SignalChip(
                            icon: Icons.bolt_rounded,
                            label: '${provider.responseMinutes} min',
                            color: AppColors.primaryDeep,
                          ),
                        if (provider.completedJobs > 0)
                          _SignalChip(
                            icon: Icons.check_circle_outline_rounded,
                            label: '${provider.completedJobs} jobs',
                            color: AppColors.success,
                          ),
                        if (provider.distanceKm != null)
                          _SignalChip(
                            icon: Icons.location_on_rounded,
                            label: '${provider.distanceKm!.toStringAsFixed(1)} km',
                            color: AppColors.inkSubtle,
                          ),
                      ],
                    ),
                    if (provider.bio.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(provider.bio, maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, color: AppColors.inkMuted)),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        if (priceLabel != null)
                          Expanded(
                            child: Text(priceLabel, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.primaryDeep)),
                          ),
                        FilledButton.icon(
                          onPressed: onContact,
                          label: const Text('Contact', style: TextStyle(fontSize: 11)),
                          icon: const Icon(Icons.phone_rounded, size: 14),
                          style: FilledButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            minimumSize: Size.zero,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SignalChip extends StatelessWidget {
  const _SignalChip({required this.icon, required this.label, required this.color});

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 2),
        Text(label, style: TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
      ],
    );
  }
}

/// ── Provider Detail Sheet ──
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
              color: AppColors.border,
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
                      Text(provider.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.inkStrong)),
                      if (provider.verified) ...[
                        const SizedBox(width: AppSpacing.xxs),
                        const TrustBadge(label: 'Verified'),
                      ],
                    ],
                  ),
                  Text(provider.location.isNotEmpty ? provider.location : 'Crossings Republik',
                      style: const TextStyle(fontSize: 13, color: AppColors.inkSubtle)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        // Trust signals grid
        Row(
          children: [
            if (provider.avgRating != null)
              _DetailStat(icon: Icons.star_rounded, value: provider.avgRating!.toStringAsFixed(1), label: '${provider.reviewCount} reviews'),
            if (provider.completedJobs > 0)
              _DetailStat(icon: Icons.check_circle_outline_rounded, value: provider.completedJobs.toString(), label: 'jobs done'),
            if (provider.responseMinutes != null)
              _DetailStat(icon: Icons.bolt_rounded, value: '${provider.responseMinutes} min', label: 'response'),
            if (provider.distanceKm != null)
              _DetailStat(icon: Icons.location_on_rounded, value: provider.distanceKm!.toStringAsFixed(1), label: 'km away'),
          ],
        ),
        if (provider.bio.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          const Text('ABOUT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2, color: AppColors.inkFaint)),
          const SizedBox(height: AppSpacing.xxs),
          Text(provider.bio, style: const TextStyle(fontSize: 14, color: AppColors.ink, height: 1.5)),
        ],
        if (provider.services.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          const Text('SERVICES', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2, color: AppColors.inkFaint)),
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
          const Text('AVAILABLE LISTINGS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2, color: AppColors.inkFaint)),
          const SizedBox(height: AppSpacing.xs),
          ...provider.listings.map((l) => Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.xxs),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadii.lg),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Expanded(child: Text(l.title, style: const TextStyle(fontSize: 13, color: AppColors.ink))),
                if (l.price != null)
                  Text('₹${l.price}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.primaryDeep)),
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
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: AppSpacing.xs),
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        decoration: BoxDecoration(
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(AppRadii.lg),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: AppColors.accent),
            const SizedBox(height: AppSpacing.xxs),
            Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.inkStrong)),
            Text(label, style: const TextStyle(fontSize: 10, color: AppColors.inkFaint)),
          ],
        ),
      ),
    );
  }
}

/// ── Loading Shimmer ──
class _ProviderListShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(4, (_) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
        child: Card(
          margin: EdgeInsets.zero,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.xl),
            side: BorderSide(color: AppColors.border),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const LoadingShimmer(width: 48, height: 48, borderRadius: 24),
                const SizedBox(width: AppSpacing.sm),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      LoadingShimmer(width: 140, height: 14),
                      SizedBox(height: 4),
                      LoadingShimmer(width: 100, height: 11),
                      SizedBox(height: 8),
                      LoadingShimmer(width: 200, height: 11),
                      SizedBox(height: 4),
                      LoadingShimmer(width: 160, height: 11),
                      SizedBox(height: 12),
                      Row(
                        children: [
                          LoadingShimmer(width: 80, height: 32, borderRadius: 16),
                          Spacer(),
                          LoadingShimmer(width: 90, height: 32, borderRadius: 16),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      )),
    );
  }
}
