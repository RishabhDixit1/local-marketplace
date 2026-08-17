import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../l10n/l10n.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../core/auth/auth_state_controller.dart';
import '../../../core/constants/categories.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
import '../../cart/application/cart_notifier.dart';
import '../../cart/presentation/cart_sheet.dart';
import '../../orders/domain/order_models.dart';
import '../../profile/data/profile_repository.dart';
import '../../reporting/domain/report_models.dart';
import '../../reporting/presentation/report_sheet.dart';
import '../../../shared/components/feed_card.dart';
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/marketplace_guidance.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/section_header.dart';
import '../../../shared/widgets/ai_prompt_bar.dart';
import '../../chat/data/chat_repository.dart';
import '../../people/data/people_repository.dart';
import '../../people/domain/people_snapshot.dart';

import '../data/feed_interactions_repository.dart';
import '../data/feed_repository.dart';
import '../domain/feed_snapshot.dart';

enum FeedPageMode {
  welcome,
  explore;

  MobileFeedScope get scope => this == FeedPageMode.welcome
      ? MobileFeedScope.connected
      : MobileFeedScope.all;

  String get title => this == FeedPageMode.welcome ? 'Home' : 'Find Help';

  String get searchHint => this == FeedPageMode.welcome
      ? 'What do you need?'
      : 'Search services, requests, or areas';

  String get heroTitle => this == FeedPageMode.welcome
      ? 'What do you need?'
      : 'Find local help nearby.';

  String get heroMessage => this == FeedPageMode.welcome
      ? 'Post a need, find providers, and track active work.'
      : 'Browse requests, services, products, and trusted providers.';
}

class FeedPage extends ConsumerStatefulWidget {
  const FeedPage({
    super.key,
    this.mode = FeedPageMode.explore,
    this.snapshotOverride,
    this.peopleOverride,
  });

  final FeedPageMode mode;
  final AsyncValue<MobileFeedSnapshot>? snapshotOverride;
  final AsyncValue<MobilePeopleSnapshot>? peopleOverride;

  @override
  ConsumerState<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends ConsumerState<FeedPage> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _debounce;
  String _query = '';
  late MobileFeedScope _scope;
  final Set<String> _filters = <String>{};
  String? _selectedCategory;
  String? _selectedLocalityId;
  String? _selectedLocalityName;
  String? _busyFeedActionId;

  static const _pageSize = 20;
  int _visibleCount = _pageSize;
  bool _isLoadingMore = false;

  @override
  void initState() {
    super.initState();
    _scope = widget.mode.scope;
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_isLoadingMore) return;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final current = _scrollController.offset;
    if (maxScroll - current <= 200) {
      _loadMore();
    }
  }

  void _loadMore() {
    final snapshot = widget.snapshotOverride ?? ref.read(feedSnapshotProvider(_scope));
    final items = snapshot?.asData?.value.items;
    if (items == null || items.isEmpty || _visibleCount >= items.length) return;

    setState(() {
      _isLoadingMore = true;
    });

    Future<void>.delayed(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() {
        _visibleCount += _pageSize;
        _isLoadingMore = false;
      });
    });
  }

  void _resetPagination() {
    _visibleCount = _pageSize;
    _isLoadingMore = false;
  }

  Future<void> _refresh() async {
    _resetPagination();
    ref.invalidate(feedSnapshotProvider(_scope));
    await ref.read(feedSnapshotProvider(_scope).future);
  }

  Future<void> _showLocalityPicker() async {
    final client = ref.read(mobileApiClientProvider);
    final localities = await client.getLocalities(zoneType: 'society', phase: 1);
    if (!mounted || localities.isEmpty) return;

    final selected = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.xl, AppSpacing.md, AppSpacing.xxl),
        children: [
          const Text('Select locality',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: AppSpacing.sm),
          ...localities.map((loc) {
            final id = loc['id'] as String? ?? '';
            final name = loc['name'] as String? ?? '';
            return ListTile(
              title: Text(name),
              leading: const Icon(Icons.location_city_rounded),
              onTap: () => Navigator.of(ctx).pop(id),
            );
          }),
        ],
      ),
    );

    if (selected != null && mounted) {
      final name = localities
          .firstWhere(
            (l) => l['id'] == selected,
            orElse: () => <String, dynamic>{},
          )['name'] as String?;
      setState(() {
        _selectedLocalityId = selected;
        _selectedLocalityName = name;
        _resetPagination();
      });
    }
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 220), () {
      if (mounted) {
        setState(() {
          _query = value.trim();
          _resetPagination();
        });
      }
    });
  }

  MobileCheckoutItem _checkoutLineFromFeed(MobileFeedItem item) {
    final type = item.type == MobileFeedItemType.product
        ? 'product'
        : 'service';
    return MobileCheckoutItem(
      providerId: item.providerId,
      itemType: type,
      itemId: item.id,
      title: item.title,
      price: item.price,
      quantity: 1,
      providerName: item.creatorName,
    );
  }

  void _showListingActionsSheet(MobileFeedItem item) {
    final currentUserId =
        ref.read(currentSessionProvider).asData?.value?.user.id ?? '';
    if (currentUserId.isNotEmpty && item.providerId == currentUserId) {
      ServiqToast.show(
        context,
        message: 'This is your own listing.',
        tone: ServiqToastTone.warning,
      );
      return;
    }

    ServiqBottomSheet.show<void>(
      context: context,
      title: item.title,
      subtitle: 'Choose how to continue with this listing.',
      children: [
        ListTile(
          leading: const Icon(Icons.add_shopping_cart_outlined),
          title: const Text('Add to cart'),
          onTap: () async {
            Navigator.of(context).pop();
            final line = _checkoutLineFromFeed(item);
            await ref
                .read(cartProvider.notifier)
                .addListing(line, providerName: item.creatorName);
            if (!mounted) {
              return;
            }
            ServiqToast.show(
              context,
              message: 'Added to cart.',
              tone: ServiqToastTone.success,
            );
          },
        ),
        ListTile(
          leading: const Icon(Icons.payments_outlined),
          title: Text(_checkoutLabelFor(item)),
          onTap: () {
            Navigator.of(context).pop();
            _openCheckout(item);
          },
        ),
        ListTile(
          leading: const Icon(Icons.chat_bubble_outline_rounded),
          title: const Text('Message provider'),
          onTap: () {
            Navigator.of(context).pop();
            _messageActionFor(item)?.call();
          },
        ),
        ListTile(
          leading: const Icon(Icons.visibility_off_outlined),
          title: const Text('Not interested'),
          onTap: () {
            Navigator.of(context).pop();
            _hideFeedItem(item);
          },
        ),
        ListTile(
          leading: const Icon(Icons.flag_outlined),
          title: const Text('Report'),
          onTap: () {
            Navigator.of(context).pop();
            ReportSheet.show(
              context: context,
              targetType: ReportTargetType.feedItem,
              targetId: item.id,
              targetTitle: item.title,
            );
          },
        ),
      ],
    );
  }

  VoidCallback? _moreActionFor(MobileFeedItem item) {
    if (item.type != MobileFeedItemType.service &&
        item.type != MobileFeedItemType.product) {
      return null;
    }
    return () => _showListingActionsSheet(item);
  }

  void _openListingDetail(MobileFeedItem item) {
    context.push(
      AppRoutes.listingDetail(item.id, source: item.source.apiValue),
    );
  }

  Future<void> _sendInterest(MobileFeedItem item) async {
    final helpRequestId = item.helpRequestId;
    if (helpRequestId == null || _busyFeedActionId != null) {
      return;
    }

    HapticFeedback.lightImpact();
    setState(() => _busyFeedActionId = item.id);
    try {
      if (item.viewerHasExpressedInterest) {
        await ref.read(feedRepositoryProvider).withdrawInterest(helpRequestId);
      } else {
        await ref.read(feedRepositoryProvider).expressInterest(helpRequestId);
      }

      ref.invalidate(feedSnapshotProvider(_scope));
      await ref.read(feedSnapshotProvider(_scope).future);
      if (!mounted) {
        return;
      }

      ServiqToast.show(
        context,
        message: item.viewerHasExpressedInterest
            ? 'Interest withdrawn.'
            : 'Interest sent. The requester will review it shortly.',
        tone: ServiqToastTone.success,
      );
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ServiqToast.show(
        context,
        message: error.message,
        tone: ServiqToastTone.danger,
      );
    } finally {
      if (mounted) {
        setState(() => _busyFeedActionId = null);
      }
    }
  }

  Future<void> _openChat(MobileFeedItem item) async {
    if (_busyFeedActionId != null || item.providerId.trim().isEmpty) {
      return;
    }

    final currentUserId =
        ref.read(currentSessionProvider).asData?.value?.user.id ?? '';
    if (currentUserId.isNotEmpty && item.providerId == currentUserId) {
      ServiqToast.show(
        context,
        message: 'This is your own post.',
        tone: ServiqToastTone.warning,
      );
      return;
    }

    setState(() => _busyFeedActionId = item.id);
    try {
      final conversationId = await ref
          .read(chatRepositoryProvider)
          .ensureConversation(item.providerId);
      if (!mounted) {
        return;
      }
      context.push(
        AppRoutes.chatThreadWithContext(
          conversationId,
          contextTitle: item.title,
          contextTaskId: item.id,
          contextStatus: item.statusLabel,
          source: 'feed_card',
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ServiqToast.show(
        context,
        message: error.message,
        tone: ServiqToastTone.danger,
      );
    } finally {
      if (mounted) {
        setState(() => _busyFeedActionId = null);
      }
    }
  }

  List<MobileFeedItem> _filterItems(List<MobileFeedItem> items) {
    return items.where((item) {
      if (_filters.contains('verified') && !item.isVerified) {
        return false;
      }
      if (_filters.contains('urgent') && !item.urgent) {
        return false;
      }
      if (_filters.contains('media') && !item.hasMedia) {
        return false;
      }
      if (_filters.contains('top_rated') &&
          ((item.averageRating ?? 0) < 4.5 || item.reviewCount < 1)) {
        return false;
      }

      if (_selectedCategory != null &&
          !item.category.toLowerCase().contains(_selectedCategory!.toLowerCase())) {
        return false;
      }

      if (_selectedLocalityId != null &&
          !item.locationLabel.toLowerCase().contains(_selectedLocalityName?.toLowerCase() ?? '')) {
        return false;
      }

      final query = _query.trim().toLowerCase();
      if (query.isEmpty) {
        return true;
      }

      final haystack = [
        item.title,
        item.description,
        item.category,
        item.creatorName,
        item.locationLabel,
        item.priceLabel,
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();
  }

  List<MobilePersonCard> _filterPeople(List<MobilePersonCard> people) {
    return people.where((person) {
      if (_filters.contains('verified') && person.completionPercent < 80) {
        return false;
      }
      if (_filters.contains('top_rated') &&
          ((person.averageRating ?? 0) < 4.5 || person.reviewCount < 1)) {
        return false;
      }

      return person.matchesQuery(_query);
    }).toList();
  }

  VoidCallback? _primaryActionFor(MobileFeedItem item) {
    if (item.isClosed) {
      return null;
    }
    if (item.helpRequestId == null) {
      if (item.providerId.trim().isEmpty) {
        return null;
      }
      if (item.type == MobileFeedItemType.service ||
          item.type == MobileFeedItemType.product) {
        return () => _openListingDetail(item);
      }
      return () => context.push(AppRoutes.provider(item.providerId));
    }
    if (item.isAccepted || item.statusKey == 'matched') {
      return () => _openChat(item);
    }

    return () => _sendInterest(item);
  }

  void _openCheckout(MobileFeedItem item) {
    final currentUserId =
        ref.read(currentSessionProvider).asData?.value?.user.id ?? '';
    if (currentUserId.isNotEmpty && item.providerId == currentUserId) {
      ServiqToast.show(
        context,
        message: 'This is your own listing.',
        tone: ServiqToastTone.warning,
      );
      return;
    }

    context.push(
      AppRoutes.checkoutItem(
        providerId: item.providerId,
        itemType: item.type == MobileFeedItemType.product
            ? 'product'
            : 'service',
        itemId: item.id,
        title: item.title,
        price: item.price,
      ),
    );
  }

  Future<void> _hideFeedItem(MobileFeedItem item) async {
    final ctx = FeedCardInteractionContext(
      cardId: item.id,
      focusId: item.providerId,
      cardType: item.type == MobileFeedItemType.service ? 'service' : 'product',
      title: item.title,
    );
    try {
      await ref.read(feedInteractionsRepositoryProvider).hide(ctx, reason: 'not_interested');
      ref.invalidate(feedSnapshotProvider(_scope));
      if (!mounted) return;
      ServiqToast.show(context, message: 'Hidden.', tone: ServiqToastTone.success);
    } catch (error) {
      if (!mounted) return;
      ServiqToast.show(
        context,
        message: AppErrorMapper.toMessage(error),
        tone: ServiqToastTone.danger,
      );
    }
  }

  FeedCardInteractionContext _buildInteractionContext(MobileFeedItem item) {
    return FeedCardInteractionContext(
      cardId: item.cardKey,
      focusId: item.providerId,
      cardType: item.type == MobileFeedItemType.service ? 'service' : 'product',
      title: item.title,
      subtitle: item.description,
    );
  }

  bool _isSaved(MobileFeedItem item, Set<String> savedCardIds) {
    return savedCardIds.contains(item.cardKey);
  }

  Future<void> _toggleSave(
    MobileFeedItem item, {
    required Set<String> savedCardIds,
  }) async {
    final saved = _isSaved(item, savedCardIds);
    final ctx = _buildInteractionContext(item);

    try {
      final repository = ref.read(feedInteractionsRepositoryProvider);
      if (saved) {
        await repository.removeSave(item.cardKey);
      } else {
        await repository.save(ctx);
      }
      ref.invalidate(feedSnapshotProvider(_scope));
      if (!mounted) return;
      ServiqToast.show(
        context,
        message: saved ? 'Removed from saved.' : 'Saved for later.',
        tone: ServiqToastTone.success,
      );
    } catch (error) {
      if (!mounted) return;
      ServiqToast.show(
        context,
        message: AppErrorMapper.toMessage(error),
        tone: ServiqToastTone.danger,
      );
    }
  }

  VoidCallback? _messageActionFor(MobileFeedItem item) {
    if (item.providerId.trim().isEmpty) {
      return null;
    }

    return () => _openChat(item);
  }

  /// Label varies by relationship state, not by post category.
  String? _primaryLabelFor(MobileFeedItem item) {
    if (item.isClosed) {
      return null;
    }
    if (item.isAccepted || item.statusKey == 'matched') {
      return 'View chat';
    }
    if (item.helpRequestId != null) {
      return item.viewerHasExpressedInterest
          ? 'Withdraw interest'
          : 'Express interest';
    }
    return 'Send Request';
  }

  String _checkoutLabelFor(MobileFeedItem item) {
    if (item.type == MobileFeedItemType.product) {
      return 'Order';
    }
    return 'Reserve';
  }

  String _secondaryLabelFor(MobileFeedItem item) {
    if (_busyFeedActionId == item.id) {
      return 'Working...';
    }
    return 'Message';
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<MobileFeedSnapshot> snapshot =
        widget.snapshotOverride ?? ref.watch(feedSnapshotProvider(_scope));
    final AsyncValue<MobilePeopleSnapshot> peopleSnapshot =
        widget.peopleOverride ?? ref.watch(peopleSnapshotProvider);
    final cartAsync = ref.watch(cartProvider);
    final cartCount = cartAsync.value == null
        ? 0
        : cartTotalQuantity(cartAsync.value!);
    final feedChildren = _feedChildren(
      snapshot: snapshot,
      peopleSnapshot: peopleSnapshot,
    );

    return ServiqScaffold(
      appBar: ServiqTopBar(
        title: widget.mode.title,
        actions: [
          Semantics(
            label: 'Search',
            child: IconButton(
              onPressed: () => context.push(AppRoutes.search),
              icon: const Icon(Icons.search_rounded),
            ),
          ),
          Semantics(
            label: 'Cart',
            child: IconButton(
              onPressed: () => showServiqCartSheet(context),
              icon: Badge(
                isLabelVisible: cartCount > 0,
                label: Text('$cartCount'),
                child: const Icon(Icons.shopping_cart_outlined),
              ),
            ),
          ),
          Semantics(
            label: 'Notifications',
            child: IconButton(
              onPressed: () => context.push(AppRoutes.notifications),
              icon: const Icon(Icons.notifications_none_rounded),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, 28),
            itemCount: feedChildren.length + (_isLoadingMore ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == feedChildren.length) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              return feedChildren[index];
            },
          ),
        ),
      ),
    );
  }

  List<Widget> _feedChildren({
    required AsyncValue<MobileFeedSnapshot> snapshot,
    required AsyncValue<MobilePeopleSnapshot> peopleSnapshot,
  }) {
    final previewData = snapshot.asData?.value;
    final profileSnapshot = ref.watch(profileSnapshotProvider);

    return [
      ...profileSnapshot.maybeWhen(
        data: (profile) {
          if (profile.completionPercent >= 50) {
            return <Widget>[];
          }
          return [
            ServiqSurface(
              variant: ServiqSurfaceVariant.glass,
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(AppRadii.lg),
                    ),
                    child: Icon(
                      Icons.assignment_turned_in_outlined,
                      color: AppColors.primaryDeep,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Finish your public profile',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xxxs),
                        Text(
                          'You are at ${profile.completionPercent}% — add name, area, and contact so nearby customers trust you faster.',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton.tonal(
                    onPressed: () => context.go(AppRoutes.profile),
                    child: const Text('Go'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ];
        },
        orElse: () => <Widget>[],
      ),
      MarketplaceLoopHero(
        title: widget.mode.heroTitle,
        message: widget.mode.heroMessage,
        searchLabel: widget.mode.searchHint,
        signalLabels: _exploreHeroSignals(
          snapshot: previewData,
          providerCount: peopleSnapshot.asData?.value.people.length ?? 0,
        ),
        onSearchTap: () => context.push(AppRoutes.search),
      ),
      const SizedBox(height: AppSpacing.md),
      AiPromptBar(
        placeholder: AppLocalizations.of(context).aiPlaceholder,
        enableDebounce: true,
        onResult: (result, query) {},
      ),
      const SizedBox(height: AppSpacing.md),
      _ExploreIntentPanel(
        mode: widget.mode,
        searchController: _searchController,
        scope: _scope,
        filters: _filters,
        onQueryChanged: _onQueryChanged,
        onScopeChanged: (scope) => setState(() {
          _scope = scope;
          _resetPagination();
        }),
        onFiltersChanged: (next) => setState(() {
          _filters
            ..clear()
            ..addAll(next);
          _resetPagination();
        }),
        onOpenPeople: () => context.push(AppRoutes.people),
        selectedCategory: _selectedCategory,
        onCategoryChanged: (cat) => setState(() {
          _selectedCategory = cat;
          _resetPagination();
        }),
        selectedLocalityName: _selectedLocalityName,
        onOpenLocalityPicker: _showLocalityPicker,
      ),
      if (widget.mode == FeedPageMode.explore) ...[
        ServiqSurface(
          variant: ServiqSurfaceVariant.glass,
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.xl),
            onTap: () => context.go(AppRoutes.discovery),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                  ),
                  child: Icon(Icons.explore_rounded, color: AppColors.primaryDeep),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Explore Local Zones',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Theme.of(context).colorScheme.onSurface)),
                      const SizedBox(height: AppSpacing.xxxs),
                      Text('Browse societies, markets, and supply areas in your locality',
                          style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
              ],
            ),
          ),
        ),
      ],
      const SizedBox(height: AppSpacing.md),
      ServiqAsyncBody<MobileFeedSnapshot>(
        value: snapshot,
        errorTitle: 'Unable to load the feed',
        errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
        onRetry: _refresh,
        loadingBuilder: () => const _FeedLoadingState(),
        data: (data) {
          final allItems = _filterItems(data.items);
          final visibleItems = allItems.take(_visibleCount).toList();
          final hasMore = _visibleCount < allItems.length;
          final people = _filterPeople(
            peopleSnapshot.asData?.value.people ??
                const <MobilePersonCard>[],
          );

          if (widget.mode == FeedPageMode.explore) {
            return _ExploreMarketplaceLanes(
              items: visibleItems,
              people: people,
              peopleSnapshot: peopleSnapshot,
              viewerRoleFamily: data.viewerRoleFamily,
              onOpenPeople: () => context.go(AppRoutes.people),
              onRetryPeople: () {
                ref.invalidate(peopleSnapshotProvider);
              },
              feedCardBuilder: (item) {
                final savedCardIds =
                    snapshot.asData?.value.savedCardIds ?? const {};
                return FeedCard(
                  item: item,
                  onPrimaryTap: _primaryActionFor(item),
                  onSecondaryTap: _messageActionFor(item),
                  primaryLabel: _primaryLabelFor(item),
                  secondaryLabel: _secondaryLabelFor(item),
                  onMoreTap: _moreActionFor(item),
                  isSaved: _isSaved(item, savedCardIds),
                  onSaveTap: () => _toggleSave(item, savedCardIds: savedCardIds),
                );
              },
              providerCardBuilder: (person) => ProviderCard(
                person: person,
                onOpenProfile: () =>
                    context.push(AppRoutes.provider(person.id)),
                onMessage: () => context.push(
                  AppRoutes.chatDirect(
                    recipientId: person.id,
                    contextTitle: person.name,
                    source: 'feed_provider_card',
                  ),
                ),
              ),
            );
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionHeader(
                title: widget.mode == FeedPageMode.welcome
                    ? 'Connected feed'
                    : 'Live local feed',
              ),
              const SizedBox(height: AppSpacing.sm),
              if (visibleItems.isEmpty)
                const SectionCard(
                  child: EmptyStateView(
                    title: 'No matching posts',
                    message:
                        'Try a broader term or clear one of the active filters to widen the nearby feed.',
                  ),
                )
              else
                ...visibleItems.map(
                  (item) {
                    final savedCardIds =
                        snapshot.asData?.value.savedCardIds ?? const {};
                    return Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: FeedCard(
                        item: item,
                        onPrimaryTap: _primaryActionFor(item),
                        onSecondaryTap: _messageActionFor(item),
                        primaryLabel: _primaryLabelFor(item),
                        secondaryLabel: _secondaryLabelFor(item),
                        onMoreTap: _moreActionFor(item),
                        isSaved: _isSaved(item, savedCardIds),
                        onSaveTap: () =>
                            _toggleSave(item, savedCardIds: savedCardIds),
                      ),
                    );
                  },
                ),
              if (hasMore && !_isLoadingMore)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sm),
                  child: Center(
                    child: TextButton(
                      onPressed: _loadMore,
                      child: const Text('Load more'),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    ];
  }
}

List<String> _exploreHeroSignals({
  required MobileFeedSnapshot? snapshot,
  required int providerCount,
}) {
  final stats = snapshot?.stats;
  if (stats == null) {
    return const ['Find help', 'Post need', 'Track tasks'];
  }

  return [
    '${stats.demand} requests',
    '$providerCount providers',
    '${stats.urgent} urgent',
  ];
}

class _ExploreIntentPanel extends StatelessWidget {
  const _ExploreIntentPanel({
    required this.mode,
    required this.searchController,
    required this.scope,
    required this.filters,
    required this.onQueryChanged,
    required this.onScopeChanged,
    required this.onFiltersChanged,
    required this.onOpenPeople,
    required this.selectedCategory,
    required this.onCategoryChanged,
    required this.selectedLocalityName,
    required this.onOpenLocalityPicker,
  });

  final FeedPageMode mode;
  final TextEditingController searchController;
  final MobileFeedScope scope;
  final Set<String> filters;
  final ValueChanged<String> onQueryChanged;
  final ValueChanged<MobileFeedScope> onScopeChanged;
  final ValueChanged<Set<String>> onFiltersChanged;
  final VoidCallback onOpenPeople;
  final String? selectedCategory;
  final ValueChanged<String?> onCategoryChanged;
  final String? selectedLocalityName;
  final VoidCallback onOpenLocalityPicker;

  @override
  Widget build(BuildContext context) {
    return ServiqSurface(
      variant: ServiqSurfaceVariant.glass,
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSearchField(
            controller: searchController,
            hintText: 'Filter by service, provider, area, or request',
            onChanged: onQueryChanged,
          ),
          const SizedBox(height: AppSpacing.sm),
          ShaderMask(
            shaderCallback: (Rect bounds) {
              return LinearGradient(
                begin: Alignment.centerRight,
                end: Alignment.centerLeft,
                colors: [
                  Theme.of(context).colorScheme.surface,
                  Theme.of(context).colorScheme.surface.withValues(alpha: 0),
                ],
                stops: const [0.95, 1.0],
              ).createShader(bounds);
            },
            blendMode: BlendMode.dstOut,
            child: SizedBox(
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(right: 20),
                itemCount: categories.length,
                separatorBuilder: (_, _) => const SizedBox(width: 6),
                itemBuilder: (context, index) {
                  final cat = categories[index];
                  final selected = selectedCategory == cat;
                  return FilterChip(
                    label: Text(cat, style: const TextStyle(fontSize: 12)),
                    selected: selected,
                    onSelected: (_) => onCategoryChanged(selected ? null : cat),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: MobileFeedScope.values.map((nextScope) {
                    return ChoiceChip(
                      label: Text(nextScope.label),
                      selected: scope == nextScope,
                      onSelected: (_) => onScopeChanged(nextScope),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              SizedBox(
                width: 100,
                child: OutlinedButton.icon(
                  onPressed: onOpenLocalityPicker,
                  icon: Icon(
                    Icons.location_on_outlined,
                    size: 16,
                    color: selectedLocalityName != null
                        ? AppColors.primaryDeep
                        : null,
                  ),
                  label: Text(
                    selectedLocalityName ?? 'Area',
                    style: TextStyle(
                      fontSize: 12,
                      color: selectedLocalityName != null
                          ? AppColors.primaryDeep
                          : null,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: selectedLocalityName != null
                        ? AppColors.primaryDeep
                        : null,
                    side: BorderSide(
                      color: selectedLocalityName != null
                          ? AppColors.primary.withValues(alpha: 0.4)
                          : Theme.of(context).colorScheme.outline,
                    ),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              SizedBox(
                width: 80,
                child: OutlinedButton.icon(
                  onPressed: onOpenPeople,
                  icon: const Icon(Icons.people_outline_rounded, size: 16),
                  label: const Text('Find', style: TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          FilterChipGroup<String>(
            options: const [
              FilterOption(value: 'urgent', label: 'Urgent'),
              FilterOption(value: 'verified', label: 'Verified'),
              FilterOption(value: 'top_rated', label: 'Top rated'),
              FilterOption(value: 'media', label: 'Media'),
            ],
            selectedValues: filters,
            onChanged: onFiltersChanged,
          ),
        ],
      ),
    );
  }
}





class _ExploreMarketplaceLanes extends StatelessWidget {
  const _ExploreMarketplaceLanes({
    required this.items,
    required this.people,
    required this.peopleSnapshot,
    required this.viewerRoleFamily,
    required this.onOpenPeople,
    required this.onRetryPeople,
    required this.feedCardBuilder,
    required this.providerCardBuilder,
  });

  final List<MobileFeedItem> items;
  final List<MobilePersonCard> people;
  final AsyncValue<MobilePeopleSnapshot>? peopleSnapshot;
  final String viewerRoleFamily;
  final VoidCallback onOpenPeople;
  final VoidCallback onRetryPeople;
  final Widget Function(MobileFeedItem item) feedCardBuilder;
  final Widget Function(MobilePersonCard person) providerCardBuilder;

  @override
  Widget build(BuildContext context) {
    final nearbyRequests = items
        .where((item) => item.type == MobileFeedItemType.demand && !item.urgent)
        .take(4)
        .toList();
    final urgentRequests = items.where((item) => item.urgent).take(2).toList();
    final recommendedPeople = people.take(3).toList();
    final hasAnyFeed =
        nearbyRequests.isNotEmpty ||
        urgentRequests.isNotEmpty ||
        recommendedPeople.isNotEmpty;
    final isProvider = viewerRoleFamily == 'provider';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!hasAnyFeed)
          SectionCard(
            child: EmptyStateView(
              title: isProvider
                  ? 'No matching demand yet'
                  : 'No matching local activity',
              message: isProvider
                  ? 'Clear a filter or broaden the category to find nearby requests, fast buyers, and provider opportunities.'
                  : 'Broaden the search or clear a filter to bring requests, trusted providers, and popular services back into view.',
            ),
          )
        else ...[
          if (urgentRequests.isNotEmpty) ...[
            _ExploreFeedLane(
              title: 'Urgent nearby',
              items: urgentRequests,
              cardBuilder: feedCardBuilder,
            ),
            const SizedBox(height: 18),
          ],
          _ExploreProviderLane(
            title: 'Trusted',
            people: recommendedPeople,
            peopleSnapshot: peopleSnapshot,
            onOpenPeople: onOpenPeople,
            onRetryPeople: onRetryPeople,
            providerCardBuilder: providerCardBuilder,
          ),
          const SizedBox(height: 18),
          _ExploreFeedLane(
            title: 'All',
            items: nearbyRequests,
            cardBuilder: feedCardBuilder,
            emptyTitle: isProvider
                ? 'No open requests in this view'
                : 'No nearby requests in this view',
            emptyMessage: isProvider
                ? 'Clear a filter or check a broader category for provider demand.'
                : 'Post your own need or clear a filter to widen the local feed.',
          ),
        ],
      ],
    );
  }
}

class _ExploreFeedLane extends StatelessWidget {
  const _ExploreFeedLane({
    required this.title,
    required this.items,
    required this.cardBuilder,
    this.emptyTitle,
    this.emptyMessage,
  });

  final String title;
  final List<MobileFeedItem> items;
  final Widget Function(MobileFeedItem item) cardBuilder;
  final String? emptyTitle;
  final String? emptyMessage;

  @override
  Widget build(BuildContext context) {
    final empty = items.isEmpty;
    final itemCount = 1 + (empty ? 1 : items.length);

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionHeader(title: title),
              const SizedBox(height: AppSpacing.sm),
            ],
          );
        }
        if (empty) {
          return SectionCard(
            child: EmptyStateView(
              title: emptyTitle ?? 'Nothing here yet',
              message:
                  emptyMessage ??
                  'Clear a filter or search a broader category.',
            ),
          );
        }
        final item = items[index - 1];
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: cardBuilder(item),
        );
      },
    );
  }
}

class _ExploreProviderLane extends StatelessWidget {
  const _ExploreProviderLane({
    required this.title,
    required this.people,
    required this.peopleSnapshot,
    required this.onOpenPeople,
    required this.onRetryPeople,
    required this.providerCardBuilder,
  });

  final String title;
  final List<MobilePersonCard> people;
  final AsyncValue<MobilePeopleSnapshot>? peopleSnapshot;
  final VoidCallback onOpenPeople;
  final VoidCallback onRetryPeople;
  final Widget Function(MobilePersonCard person) providerCardBuilder;

  @override
  Widget build(BuildContext context) {
    final snapshot = peopleSnapshot;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: title,
          actionLabel: 'Find',
          onAction: onOpenPeople,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (snapshot?.isLoading == true)
          const SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LoadingShimmer(height: 18, width: 180),
                SizedBox(height: 10),
                LoadingShimmer(height: 14),
                SizedBox(height: AppSpacing.xs),
                LoadingShimmer(height: 14, width: 220),
              ],
            ),
          )
        else if (snapshot?.hasError == true)
          SectionCard(
            child: ErrorStateView(
              title: 'Provider lane is delayed',
              message: 'Requests and services are still available.',
              onRetry: onRetryPeople,
            ),
          )
        else if (people.isEmpty)
          SectionCard(
            child: EmptyStateView(
              title: 'No providers match these filters',
              message: 'Open Find to browse the wider provider directory.',
              actionLabel: 'Open Find',
              onAction: onOpenPeople,
            ),
          )
        else
          ...people.map(
            (person) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: providerCardBuilder(person),
            ),
          ),
      ],
    );
  }
}

class _FeedLoadingState extends StatelessWidget {
  const _FeedLoadingState();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (_) => Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 16, width: 96),
                SizedBox(height: 14),
                LoadingShimmer(height: 22, width: 220),
                SizedBox(height: 10),
                LoadingShimmer(height: 14),
                SizedBox(height: AppSpacing.xs),
                LoadingShimmer(height: 14, width: 260),
                SizedBox(height: AppSpacing.md),
                LoadingShimmer(height: 88),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
