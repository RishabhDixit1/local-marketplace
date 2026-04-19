import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../features/feed/data/feed_interactions_repository.dart';
import '../../../features/feed/data/feed_repository.dart';
import '../../../features/feed/domain/feed_snapshot.dart';
import '../../../features/people/data/people_repository.dart';
import '../../../features/people/domain/people_snapshot.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/section_header.dart';

class WelcomePage extends ConsumerStatefulWidget {
  const WelcomePage({
    super.key,
    this.snapshotOverride,
    this.trustedSnapshotOverride,
    this.peopleOverride,
  });

  final AsyncValue<MobileFeedSnapshot>? snapshotOverride;
  final AsyncValue<MobileFeedSnapshot>? trustedSnapshotOverride;
  final AsyncValue<MobilePeopleSnapshot>? peopleOverride;

  @override
  ConsumerState<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends ConsumerState<WelcomePage> {
  RealtimeChannel? _feedChannel;
  SupabaseClient? _client;
  _WelcomeSurface _surface = _WelcomeSurface.forYou;
  _WelcomeSurface _resolvedSurface = _WelcomeSurface.forYou;
  bool _surfaceManuallyChanged = false;
  final DateTime _openedAt = DateTime.now();
  bool _trackedFirstEngagement = false;
  final Set<String> _savedAddedIds = <String>{};
  final Set<String> _savedRemovedIds = <String>{};
  final Set<String> _hiddenFeedIds = <String>{};
  final Set<String> _hiddenProviderIds = <String>{};

  @override
  void initState() {
    super.initState();
    try {
      _client = ref.read(appBootstrapProvider).client;
    } catch (_) {
      _client = null;
    }
    _subscribeToRealtime();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref
          .read(analyticsServiceProvider)
          .trackScreen(
            'home_welcome',
            extras: {'surface': _resolvedSurface.analyticsValue},
          );
    });
  }

  @override
  void dispose() {
    if (_client != null && _feedChannel != null) {
      _client!.removeChannel(_feedChannel!);
    }
    super.dispose();
  }

  void _subscribeToRealtime() {
    final client = _client;
    if (client == null) {
      return;
    }

    void invalidateAll() {
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.connected));
      ref.invalidate(peopleSnapshotProvider);
    }

    _feedChannel = client
        .channel('mobile-home-snapshot-v2')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'posts',
          callback: (_) => invalidateAll(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'help_requests',
          callback: (_) => invalidateAll(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'service_listings',
          callback: (_) => invalidateAll(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'product_catalog',
          callback: (_) => invalidateAll(),
        )
        .subscribe();
  }

  Future<void> _refresh() async {
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_refresh_requested',
          extras: {'surface': _resolvedSurface.analyticsValue},
        );

    ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
    ref.invalidate(feedSnapshotProvider(MobileFeedScope.connected));
    ref.invalidate(peopleSnapshotProvider);

    await Future.wait([
      ref.read(feedSnapshotProvider(MobileFeedScope.all).future),
      ref.read(feedSnapshotProvider(MobileFeedScope.connected).future),
      ref.read(peopleSnapshotProvider.future),
    ]);
  }

  void _setSurface(_WelcomeSurface nextSurface) {
    if (_resolvedSurface == nextSurface) {
      return;
    }

    setState(() {
      _surface = nextSurface;
      _resolvedSurface = nextSurface;
      _surfaceManuallyChanged = true;
    });
    _trackFirstEngagement('surface_switch');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_surface_changed',
          extras: {'surface': nextSurface.analyticsValue},
        );
  }

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  bool _isSavedCard(String cardId, Set<String> backendSavedIds) {
    if (_savedAddedIds.contains(cardId)) {
      return true;
    }
    if (_savedRemovedIds.contains(cardId)) {
      return false;
    }
    return backendSavedIds.contains(cardId);
  }

  void _trackFirstEngagement(String action) {
    if (_trackedFirstEngagement) {
      return;
    }

    _trackedFirstEngagement = true;
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_first_engagement',
          extras: {
            'action': action,
            'surface': _resolvedSurface.analyticsValue,
            'within_two_seconds':
                DateTime.now().difference(_openedAt).inMilliseconds <= 2000,
          },
        );
  }

  Future<void> _toggleSave(
    _WelcomeFeedEntry entry, {
    required Set<String> backendSavedIds,
  }) async {
    final cardId = entry.storageKey;
    final saved = _isSavedCard(cardId, backendSavedIds);
    final card = _buildInteractionContext(entry);
    setState(() {
      if (saved) {
        _savedAddedIds.remove(cardId);
        _savedRemovedIds.add(cardId);
      } else {
        _savedRemovedIds.remove(cardId);
        _savedAddedIds.add(cardId);
      }
    });

    _trackFirstEngagement(saved ? 'unsave_card' : 'save_card');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          saved ? 'home_item_unsaved' : 'home_item_saved',
          extras: {
            'item_id': cardId,
            'surface': _resolvedSurface.analyticsValue,
            'item_type': entry.analyticsType,
          },
        );

    try {
      final repository = ref.read(feedInteractionsRepositoryProvider);
      if (saved) {
        await repository.removeSave(cardId);
      } else {
        await repository.save(card);
      }
      _showSnack(saved ? 'Removed from saved items.' : 'Saved for later.');
    } catch (error) {
      setState(() {
        if (saved) {
          _savedRemovedIds.remove(cardId);
        } else {
          _savedAddedIds.remove(cardId);
        }
      });
      _showSnack(AppErrorMapper.toMessage(error));
    }
  }

  Future<void> _hideEntry(_WelcomeFeedEntry entry, {String? reason}) async {
    setState(() {
      if (entry.item != null) {
        _hiddenFeedIds.add(entry.item!.id);
      }
      if (entry.person != null) {
        _hiddenProviderIds.add(entry.person!.id);
      }
    });

    _trackFirstEngagement('hide_card');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_item_hidden',
          extras: {
            'item_id': entry.storageKey,
            'surface': _resolvedSurface.analyticsValue,
            'item_type': entry.analyticsType,
          },
        );

    try {
      await ref
          .read(feedInteractionsRepositoryProvider)
          .hide(_buildInteractionContext(entry), reason: reason);
      _showSnack('We will show fewer posts like this.');
    } catch (error) {
      _showSnack(AppErrorMapper.toMessage(error));
    }
  }

  Future<void> _reportEntry(
    _WelcomeFeedEntry entry, {
    required String reason,
  }) async {
    _trackFirstEngagement('report_card');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_item_report_submitted',
          extras: {
            'item_id': entry.storageKey,
            'surface': _resolvedSurface.analyticsValue,
            'reason': reason,
          },
        );

    try {
      await ref
          .read(feedInteractionsRepositoryProvider)
          .report(_buildInteractionContext(entry), reason: reason);
      _showSnack('Thanks. We have flagged this for review.');
    } catch (error) {
      _showSnack(AppErrorMapper.toMessage(error));
    }
  }

  Future<void> _shareEntry(_WelcomeFeedEntry entry) async {
    final card = _buildInteractionContext(entry);
    final config = ref.read(appBootstrapProvider).config;
    final shareUrl = _resolveShareUrl(config.apiBaseUrl, card.actionPath);
    final shareText = shareUrl == null
        ? card.title
        : '${card.title}\n$shareUrl';

    _trackFirstEngagement('share_card');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_item_share_tapped',
          extras: {
            'item_id': entry.storageKey,
            'surface': _resolvedSurface.analyticsValue,
          },
        );

    try {
      await SharePlus.instance.share(
        ShareParams(text: shareText, subject: card.title),
      );
      await ref
          .read(feedInteractionsRepositoryProvider)
          .share(card, channel: 'native');
    } catch (error) {
      _showSnack(AppErrorMapper.toMessage(error));
    }
  }

  Future<void> _callEntry(_WelcomeFeedEntry entry) async {
    final phone = entry.item?.contactPhone ?? entry.person?.contactPhone ?? '';
    if (phone.trim().isEmpty) {
      _showSnack('Calling is not available for this profile.');
      return;
    }

    final uri = Uri(scheme: 'tel', path: phone);
    _trackFirstEngagement('call_card');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_item_call_tapped',
          extras: {
            'item_id': entry.storageKey,
            'surface': _resolvedSurface.analyticsValue,
          },
        );

    if (!await launchUrl(uri)) {
      _showSnack('Unable to open the phone dialer right now.');
    }
  }

  Future<String?> _showReportReasonSheet(String title) async {
    const reasons = <String>[
      'Spam or scam',
      'Unsafe request',
      'Wrong category',
      'Offensive content',
    ];

    return showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 6),
                Text(
                  'Tell us what is wrong with this card.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 12),
                ...reasons.map(
                  (reason) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(reason),
                    onTap: () => Navigator.of(context).pop(reason),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  FeedCardInteractionContext _buildInteractionContext(_WelcomeFeedEntry entry) {
    if (entry.item != null) {
      final item = entry.item!;
      return FeedCardInteractionContext(
        cardId: item.cardKey,
        focusId: item.id,
        cardType: item.type.name,
        title: item.title,
        subtitle: item.description,
        actionPath: item.publicProfilePath,
        metadata: {
          'source_type': item.sourceType,
          'viewer_role_fit': item.viewerRoleFit,
          'priority_score': item.priorityScore,
        },
      );
    }

    final person = entry.person!;
    return FeedCardInteractionContext(
      cardId: 'provider:${person.id}',
      focusId: person.id,
      cardType: 'service',
      title: person.name,
      subtitle: person.headline,
      actionPath: '/app/provider/${person.id}',
      metadata: {
        'source_type': person.isAcceptedConnection
            ? 'accepted_connection'
            : 'recommended',
        'mutual_connections_count': person.mutualConnectionsCount,
        'priority_score': person.priorityScore,
      },
    );
  }

  String? _resolveShareUrl(String apiBaseUrl, String? actionPath) {
    final normalizedPath = (actionPath ?? '').trim();
    if (normalizedPath.isEmpty) {
      return null;
    }
    if (normalizedPath.startsWith('http://') ||
        normalizedPath.startsWith('https://')) {
      return normalizedPath;
    }

    final apiUri = Uri.tryParse(apiBaseUrl);
    if (apiUri == null || !normalizedPath.startsWith('/')) {
      return normalizedPath;
    }

    return Uri(
      scheme: apiUri.scheme,
      host: apiUri.host,
      port: apiUri.hasPort ? apiUri.port : null,
      path: normalizedPath,
    ).toString();
  }

  Future<void> _showItemActionsSheet(
    _WelcomeFeedEntry entry, {
    required Set<String> backendSavedIds,
  }) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        final saved = _isSavedCard(entry.storageKey, backendSavedIds);
        final canCall =
            entry.item?.canCall == true || entry.person?.canCall == true;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.sheetTitle,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  'Choose what to do next with this item.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    saved
                        ? Icons.bookmark_remove_rounded
                        : Icons.bookmark_add_outlined,
                  ),
                  title: Text(saved ? 'Remove from saved' : 'Save for later'),
                  onTap: () async {
                    Navigator.of(context).pop();
                    await _toggleSave(entry, backendSavedIds: backendSavedIds);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.ios_share_rounded),
                  title: const Text('Share'),
                  onTap: () async {
                    Navigator.of(context).pop();
                    await _shareEntry(entry);
                  },
                ),
                if (canCall)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.call_outlined),
                    title: const Text('Call'),
                    onTap: () async {
                      Navigator.of(context).pop();
                      await _callEntry(entry);
                    },
                  ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.visibility_off_outlined),
                  title: const Text('Not interested'),
                  onTap: () async {
                    Navigator.of(context).pop();
                    await _hideEntry(entry, reason: 'not_interested');
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.flag_outlined),
                  title: const Text('Report'),
                  onTap: () async {
                    Navigator.of(context).pop();
                    final reason = await _showReportReasonSheet(
                      entry.sheetTitle,
                    );
                    if (reason == null || reason.trim().isEmpty) {
                      return;
                    }
                    await _reportEntry(entry, reason: reason);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _resolveViewerName() {
    final user = _client?.auth.currentUser;
    final metadata = user?.userMetadata;
    final dynamic rawName =
        metadata?['full_name'] ?? metadata?['name'] ?? metadata?['first_name'];

    if (rawName is String && rawName.trim().isNotEmpty) {
      return rawName.trim().split(' ').first;
    }

    final email = user?.email?.trim() ?? '';
    if (email.isNotEmpty && email.contains('@')) {
      final base = email
          .split('@')
          .first
          .replaceAll(RegExp(r'[^a-zA-Z0-9]+'), ' ')
          .trim();
      if (base.isNotEmpty) {
        return base.split(' ').first[0].toUpperCase() +
            base.split(' ').first.substring(1);
      }
    }

    return 'there';
  }

  String _greetingPrefix() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 17) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<MobileFeedSnapshot> allFeedAsync =
        widget.snapshotOverride ??
        ref.watch(feedSnapshotProvider(MobileFeedScope.all));
    final AsyncValue<MobileFeedSnapshot> trustedFeedAsync =
        widget.trustedSnapshotOverride ??
        ref.watch(feedSnapshotProvider(MobileFeedScope.connected));
    final AsyncValue<MobilePeopleSnapshot> peopleAsync =
        widget.peopleOverride ?? ref.watch(peopleSnapshotProvider);

    final allFeed = allFeedAsync.asData?.value;
    final trustedFeed = trustedFeedAsync.asData?.value;
    final people = peopleAsync.asData?.value;
    final hasAnyData = allFeed != null || trustedFeed != null || people != null;

    if (!hasAnyData &&
        (allFeedAsync.isLoading ||
            trustedFeedAsync.isLoading ||
            peopleAsync.isLoading)) {
      return const Scaffold(body: SafeArea(child: _WelcomeLoadingState()));
    }

    if (!hasAnyData &&
        (allFeedAsync.hasError ||
            trustedFeedAsync.hasError ||
            peopleAsync.hasError)) {
      final message = allFeedAsync.hasError
          ? AppErrorMapper.toMessage(allFeedAsync.error!)
          : trustedFeedAsync.hasError
          ? AppErrorMapper.toMessage(trustedFeedAsync.error!)
          : peopleAsync.hasError
          ? AppErrorMapper.toMessage(peopleAsync.error!)
          : 'Unable to load home right now.';

      return Scaffold(
        appBar: AppBar(title: const Text('ServiQ')),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: SectionCard(
              child: ErrorStateView(
                title: 'Unable to load home',
                message: message,
                onRetry: _refresh,
              ),
            ),
          ),
        ),
      );
    }

    final model = _WelcomeViewModel.build(
      allFeed: allFeed ?? _emptyFeedSnapshot,
      trustedFeed: trustedFeed ?? _emptyFeedSnapshot,
      people: people ?? _emptyPeopleSnapshot,
      hiddenFeedIds: _hiddenFeedIds,
      hiddenProviderIds: _hiddenProviderIds,
    );

    final warnings = <String>[
      if (allFeedAsync.hasError) 'Nearby feed is delayed.',
      if (trustedFeedAsync.hasError) 'Trusted connection posts are delayed.',
      if (peopleAsync.hasError) 'Provider recommendations are delayed.',
    ];

    final userName = _resolveViewerName();
    final greeting = '${_greetingPrefix()}, $userName';
    final preferredSurface = _surfaceManuallyChanged
        ? _surface
        : model.defaultSurface;
    _resolvedSurface = model.resolveSurface(preferredSurface);
    final activeEntries = model.entriesFor(_resolvedSurface);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _refresh,
          edgeOffset: 12,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              SliverAppBar(
                pinned: true,
                elevation: 0,
                scrolledUnderElevation: 0,
                titleSpacing: 16,
                backgroundColor: AppColors.background,
                surfaceTintColor: Colors.transparent,
                title: const _WelcomeAppBarTitle(),
                actions: [
                  _AppBarAction(
                    icon: Icons.search_rounded,
                    tooltip: 'Search',
                    onPressed: () {
                      _trackFirstEngagement('search');
                      ref
                          .read(analyticsServiceProvider)
                          .trackEvent(
                            'home_search_tapped',
                            extras: {
                              'surface': _resolvedSurface.analyticsValue,
                            },
                          );
                      context.push(AppRoutes.search);
                    },
                  ),
                  _AppBarAction(
                    icon: Icons.notifications_none_rounded,
                    tooltip: 'Notifications',
                    onPressed: () => context.push(AppRoutes.notifications),
                  ),
                  _AppBarAction(
                    icon: Icons.chat_bubble_outline_rounded,
                    tooltip: 'Chat',
                    onPressed: () => context.push(AppRoutes.chat),
                  ),
                  const SizedBox(width: 8),
                ],
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                sliver: SliverList(
                  delegate: SliverChildListDelegate.fixed([
                    _HeroSection(
                      greeting: greeting,
                      trustedCountLabel: model.trustedCountLabel,
                      liveStatusLabel: model.liveStatusLabel,
                      onSearchTap: () {
                        _trackFirstEngagement('search');
                        ref
                            .read(analyticsServiceProvider)
                            .trackEvent(
                              'home_search_tapped',
                              extras: {
                                'surface': _resolvedSurface.analyticsValue,
                              },
                            );
                        context.push(AppRoutes.search);
                      },
                      onPrimaryTap: () {
                        _trackFirstEngagement('post_need');
                        ref
                            .read(analyticsServiceProvider)
                            .trackEvent(
                              'home_post_need_tapped',
                              extras: {
                                'surface': _resolvedSurface.analyticsValue,
                              },
                            );
                        context.push(AppRoutes.createRequest);
                      },
                      onEarnTap: () {
                        _trackFirstEngagement('earn_nearby');
                        ref
                            .read(analyticsServiceProvider)
                            .trackEvent(
                              'home_earn_nearby_tapped',
                              extras: {
                                'surface': _resolvedSurface.analyticsValue,
                              },
                            );
                        context.push(AppRoutes.providerOnboarding);
                      },
                      onPeopleTap: () {
                        _trackFirstEngagement('people');
                        ref
                            .read(analyticsServiceProvider)
                            .trackEvent(
                              'home_people_tapped',
                              extras: {
                                'surface': _resolvedSurface.analyticsValue,
                              },
                            );
                        context.go(AppRoutes.people);
                      },
                      heroSignals: model.heroSignals,
                    ),
                    if (warnings.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _InlineWarningCard(
                        message: warnings.join(' '),
                        onRetry: _refresh,
                      ),
                    ],
                    const SizedBox(height: 18),
                    _TrustSummarySection(metrics: model.metrics),
                    if (model.quickCategories.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      SectionHeader(
                        title: 'Popular nearby',
                        subtitle:
                            'Intent shortcuts that map to what people are actively posting around you.',
                      ),
                      const SizedBox(height: 12),
                      _QuickCategoryRow(
                        categories: model.quickCategories,
                        onPressed: (category) {
                          ref
                              .read(analyticsServiceProvider)
                              .trackEvent(
                                'home_category_tapped',
                                extras: {'category': category},
                              );
                          context.push(
                            '${AppRoutes.search}?q=${Uri.encodeComponent(category)}',
                          );
                        },
                      ),
                    ],
                    const SizedBox(height: 20),
                    SectionHeader(
                      title: 'Trusted activity',
                      subtitle: model.trustedRailSubtitle,
                      actionLabel: model.hasTrustedNetwork
                          ? 'People'
                          : 'Grow network',
                      onAction: () => context.go(AppRoutes.people),
                    ),
                    const SizedBox(height: 12),
                    model.hasTrustedNetwork
                        ? _TrustedRail(
                            items: model.trustedRailItems,
                            onOpen: (item) {
                              ref
                                  .read(analyticsServiceProvider)
                                  .trackEvent(
                                    'home_trusted_card_opened',
                                    extras: {'item_id': item.id},
                                  );
                              _openFeedItem(item);
                            },
                            onMessage: (item) => _messageFeedItem(item),
                            onMore: (item) => _showItemActionsSheet(
                              _WelcomeFeedEntry.connection(
                                item: item,
                                reason: _buildFeedReason(
                                  item,
                                  hotCategories: model.hotCategoryKeys,
                                  trusted: true,
                                ),
                              ),
                              backendSavedIds: model.savedCardIds,
                            ),
                          )
                        : _NetworkPromptCard(
                            onPeopleTap: () => context.go(AppRoutes.people),
                            onExploreTap: () => context.go(AppRoutes.explore),
                          ),
                    const SizedBox(height: 22),
                    SectionHeader(
                      title: 'Live for today',
                      subtitle:
                          _resolvedSurface == model.defaultSurface &&
                              model.defaultSurfaceReason.isNotEmpty
                          ? model.defaultSurfaceReason
                          : _resolvedSurface.subtitle,
                      actionLabel: _resolvedSurface == _WelcomeSurface.nearby
                          ? 'Explore all'
                          : 'Switch view',
                      onAction: () {
                        if (_resolvedSurface == _WelcomeSurface.nearby) {
                          context.go(AppRoutes.explore);
                          return;
                        }
                        _setSurface(_WelcomeSurface.nearby);
                      },
                    ),
                    const SizedBox(height: 12),
                    _SurfaceTabsRow(
                      value: _resolvedSurface,
                      onChanged: _setSurface,
                    ),
                    const SizedBox(height: 14),
                    ...activeEntries.map((entry) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _buildEntryCard(entry, model),
                      );
                    }),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEntryCard(_WelcomeFeedEntry entry, _WelcomeViewModel model) {
    switch (entry.type) {
      case _WelcomeFeedEntryType.connection:
        return _TrustedConnectionCard(
          item: entry.item!,
          reason: entry.reason,
          isSaved: _isSavedCard(entry.storageKey, model.savedCardIds),
          onSave: () => _toggleSave(entry, backendSavedIds: model.savedCardIds),
          onOpen: () => _openFeedItem(entry.item!),
          onMessage: () => _messageFeedItem(entry.item!),
          onMore: () =>
              _showItemActionsSheet(entry, backendSavedIds: model.savedCardIds),
        );
      case _WelcomeFeedEntryType.request:
        return _WelcomeRequestCard(
          item: entry.item!,
          reason: entry.reason,
          isSaved: _isSavedCard(entry.storageKey, model.savedCardIds),
          fromTrustedNetwork: entry.fromTrustedNetwork,
          primaryLabel: entry.primaryLabel,
          secondaryLabel: entry.secondaryLabel,
          onPrimaryTap: () => _openFeedItem(entry.item!),
          onSecondaryTap: () => _messageFeedItem(entry.item!),
          onSaveTap: () =>
              _toggleSave(entry, backendSavedIds: model.savedCardIds),
          onMoreTap: () =>
              _showItemActionsSheet(entry, backendSavedIds: model.savedCardIds),
        );
      case _WelcomeFeedEntryType.opportunity:
        return _WelcomeRequestCard(
          item: entry.item!,
          reason: entry.reason,
          isSaved: _isSavedCard(entry.storageKey, model.savedCardIds),
          fromTrustedNetwork: entry.fromTrustedNetwork,
          primaryLabel: entry.primaryLabel,
          secondaryLabel: entry.secondaryLabel,
          accentColor: AppColors.warning,
          accentBackground: WelcomeThemeTokens.light.earnTint,
          onPrimaryTap: () => _messageFeedItem(entry.item!),
          onSecondaryTap: () =>
              _toggleSave(entry, backendSavedIds: model.savedCardIds),
          onSaveTap: () =>
              _toggleSave(entry, backendSavedIds: model.savedCardIds),
          onMoreTap: () =>
              _showItemActionsSheet(entry, backendSavedIds: model.savedCardIds),
        );
      case _WelcomeFeedEntryType.provider:
        return _WelcomeProviderCard(
          person: entry.person!,
          reason: entry.reason,
          isSaved: _isSavedCard(entry.storageKey, model.savedCardIds),
          onSaveTap: () =>
              _toggleSave(entry, backendSavedIds: model.savedCardIds),
          onMessageTap: () => _messagePerson(entry.person!),
          onOpenTap: () => _openPerson(entry.person!),
          onMoreTap: () =>
              _showItemActionsSheet(entry, backendSavedIds: model.savedCardIds),
        );
      case _WelcomeFeedEntryType.empty:
        return SectionCard(
          child: EmptyStateView(title: entry.title, message: entry.message),
        );
      case _WelcomeFeedEntryType.cta:
        return _WelcomeCtaCard(
          title: entry.title,
          message: entry.message,
          primaryLabel: entry.primaryLabel,
          secondaryLabel: entry.secondaryLabel,
          onPrimaryTap: () {
            if (entry.ctaTarget == _CtaTarget.postNeed) {
              context.push(AppRoutes.createRequest);
            } else if (entry.ctaTarget == _CtaTarget.people) {
              context.go(AppRoutes.people);
            } else {
              context.push(AppRoutes.providerOnboarding);
            }
          },
          onSecondaryTap: () => context.go(AppRoutes.explore),
        );
    }
  }

  void _openFeedItem(MobileFeedItem item) {
    _trackFirstEngagement('open_card');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_feed_primary_tapped',
          extras: {
            'item_id': item.id,
            'surface': _resolvedSurface.analyticsValue,
          },
        );

    if (item.providerId.trim().isNotEmpty) {
      context.push(AppRoutes.provider(item.providerId));
      return;
    }

    context.go(AppRoutes.explore);
  }

  void _messageFeedItem(MobileFeedItem item) {
    _trackFirstEngagement('message_card');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_feed_message_tapped',
          extras: {
            'item_id': item.id,
            'surface': _resolvedSurface.analyticsValue,
          },
        );

    if (item.providerId.trim().isEmpty) {
      _showSnack('Messaging opens when a visible profile is attached.');
      return;
    }

    final draft = item.type == MobileFeedItemType.demand
        ? 'Hi ${item.creatorName}, I can help with "${item.title}". What timing works best?'
        : 'Hi ${item.creatorName}, I am interested in "${item.title}". Can you share availability?';
    context.push(
      '${AppRoutes.chat}?recipientId=${item.providerId}&draft=${Uri.encodeComponent(draft)}&contextTitle=${Uri.encodeComponent(item.title)}',
    );
  }

  void _openPerson(MobilePersonCard person) {
    _trackFirstEngagement('open_provider');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_provider_opened',
          extras: {
            'provider_id': person.id,
            'surface': _resolvedSurface.analyticsValue,
          },
        );
    context.push(AppRoutes.provider(person.id));
  }

  void _messagePerson(MobilePersonCard person) {
    _trackFirstEngagement('message_provider');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_provider_message_tapped',
          extras: {
            'provider_id': person.id,
            'surface': _resolvedSurface.analyticsValue,
          },
        );
    final draft =
        'Hi ${person.name}, I found your profile on ServiQ and want to discuss a nearby job.';
    context.push(
      '${AppRoutes.chat}?recipientId=${person.id}&draft=${Uri.encodeComponent(draft)}&contextTitle=${Uri.encodeComponent(person.name)}',
    );
  }
}

enum _WelcomeSurface {
  forYou(
    title: 'For you',
    subtitle:
        'The best mix of trusted, urgent, and locally relevant posts right now.',
    analyticsValue: 'for_you',
  ),
  trusted(
    title: 'Trusted',
    subtitle:
        'Accepted connections first, with clearer social proof and safer follow-through.',
    analyticsValue: 'trusted',
  ),
  nearby(
    title: 'Nearby',
    subtitle:
        'Public demand and local supply ranked by urgency, speed, and distance.',
    analyticsValue: 'nearby',
  ),
  earn(
    title: 'Earn',
    subtitle:
        'High-intent requests and provider opportunities you can act on quickly.',
    analyticsValue: 'earn',
  );

  const _WelcomeSurface({
    required this.title,
    required this.subtitle,
    required this.analyticsValue,
  });

  final String title;
  final String subtitle;
  final String analyticsValue;
}

enum _WelcomeFeedEntryType {
  request,
  opportunity,
  connection,
  provider,
  empty,
  cta,
}

enum _CtaTarget { postNeed, people, earn }

_WelcomeSurface _surfaceFromServer(String value) {
  switch (value.trim().toLowerCase()) {
    case 'trusted':
      return _WelcomeSurface.trusted;
    case 'nearby':
      return _WelcomeSurface.nearby;
    case 'earn':
      return _WelcomeSurface.earn;
    default:
      return _WelcomeSurface.forYou;
  }
}

class _WelcomeFeedEntry {
  const _WelcomeFeedEntry.request({
    required this.item,
    required this.reason,
    this.fromTrustedNetwork = false,
  }) : type = _WelcomeFeedEntryType.request,
       person = null,
       title = '',
       message = '',
       primaryLabel = 'Open request',
       secondaryLabel = 'Message',
       ctaTarget = null;

  const _WelcomeFeedEntry.opportunity({
    required this.item,
    required this.reason,
    this.fromTrustedNetwork = false,
  }) : type = _WelcomeFeedEntryType.opportunity,
       person = null,
       title = '',
       message = '',
       primaryLabel = 'Respond',
       secondaryLabel = 'Save',
       ctaTarget = null;

  const _WelcomeFeedEntry.connection({required this.item, required this.reason})
    : type = _WelcomeFeedEntryType.connection,
      person = null,
      title = '',
      message = '',
      fromTrustedNetwork = true,
      primaryLabel = 'Open request',
      secondaryLabel = 'Message',
      ctaTarget = null;

  const _WelcomeFeedEntry.provider({required this.person, required this.reason})
    : type = _WelcomeFeedEntryType.provider,
      item = null,
      title = '',
      message = '',
      primaryLabel = 'View profile',
      secondaryLabel = 'Message',
      fromTrustedNetwork = false,
      ctaTarget = null;

  const _WelcomeFeedEntry.empty({required this.title, required this.message})
    : type = _WelcomeFeedEntryType.empty,
      item = null,
      person = null,
      reason = '',
      primaryLabel = '',
      secondaryLabel = '',
      fromTrustedNetwork = false,
      ctaTarget = null;

  const _WelcomeFeedEntry.cta({
    required this.title,
    required this.message,
    required this.primaryLabel,
    required this.secondaryLabel,
    required this.ctaTarget,
  }) : type = _WelcomeFeedEntryType.cta,
       item = null,
       person = null,
       reason = '',
       fromTrustedNetwork = false;

  final _WelcomeFeedEntryType type;
  final MobileFeedItem? item;
  final MobilePersonCard? person;
  final String reason;
  final String primaryLabel;
  final String secondaryLabel;
  final bool fromTrustedNetwork;
  final String title;
  final String message;
  final _CtaTarget? ctaTarget;

  String get storageKey {
    if (item != null) {
      return item!.cardKey;
    }
    if (person != null) {
      return 'provider:${person!.id}';
    }
    return type.name;
  }

  String get analyticsType {
    switch (type) {
      case _WelcomeFeedEntryType.request:
        return 'request';
      case _WelcomeFeedEntryType.opportunity:
        return 'opportunity';
      case _WelcomeFeedEntryType.connection:
        return 'connection';
      case _WelcomeFeedEntryType.provider:
        return 'provider';
      case _WelcomeFeedEntryType.empty:
        return 'empty';
      case _WelcomeFeedEntryType.cta:
        return 'cta';
    }
  }

  String get sheetTitle {
    if (item != null) {
      return item!.title;
    }
    if (person != null) {
      return person!.name;
    }
    return title;
  }
}

class _WelcomeMetric {
  const _WelcomeMetric({
    required this.label,
    required this.value,
    required this.caption,
    required this.icon,
    required this.tint,
  });

  final String label;
  final String value;
  final String caption;
  final IconData icon;
  final Color tint;
}

class _WelcomeViewModel {
  const _WelcomeViewModel({
    required this.metrics,
    required this.heroSignals,
    required this.quickCategories,
    required this.hotCategoryKeys,
    required this.trustedRailItems,
    required this.trustedRailSubtitle,
    required this.forYouEntries,
    required this.trustedEntries,
    required this.nearbyEntries,
    required this.earnEntries,
    required this.trustedCountLabel,
    required this.liveStatusLabel,
    required this.hasTrustedNetwork,
    required this.savedCardIds,
    required this.defaultSurface,
    required this.defaultSurfaceReason,
  });

  factory _WelcomeViewModel.build({
    required MobileFeedSnapshot allFeed,
    required MobileFeedSnapshot trustedFeed,
    required MobilePeopleSnapshot people,
    required Set<String> hiddenFeedIds,
    required Set<String> hiddenProviderIds,
  }) {
    final allItems = allFeed.items
        .where((item) => !hiddenFeedIds.contains(item.id))
        .toList();
    final trustedItems = trustedFeed.items
        .where((item) => !hiddenFeedIds.contains(item.id))
        .toList();
    final providers = people.people
        .where((person) => !hiddenProviderIds.contains(person.id))
        .toList();
    final savedCardIds = <String>{
      ...allFeed.savedCardIds,
      ...trustedFeed.savedCardIds,
    };
    final trustedIds = trustedItems.map((item) => item.id).toSet();
    final categoryStats = _collectCategoryStats(
      allItems,
      trustedItems,
      providers,
    );
    final hotCategoryKeys = categoryStats.keys.toList();
    final quickCategories = categoryStats.entries
        .take(8)
        .map((entry) => entry.key)
        .toList();

    final rankedTrusted = _diversifyItems(
      _sortFeedItems(
        trustedItems,
        trustedIds: trustedIds,
        hotCategories: hotCategoryKeys.toSet(),
        earnMode: false,
      ),
    );
    final rankedNearby = _diversifyItems(
      _sortFeedItems(
        allItems,
        trustedIds: trustedIds,
        hotCategories: hotCategoryKeys.toSet(),
        earnMode: false,
      ),
    );
    final rankedEarn = _diversifyItems(
      _sortFeedItems(
        allItems
            .where((item) => item.type == MobileFeedItemType.demand)
            .toList(),
        trustedIds: trustedIds,
        hotCategories: hotCategoryKeys.toSet(),
        earnMode: true,
      ),
    );
    final rankedProviders = _sortProviders(
      providers,
      hotCategories: hotCategoryKeys.toSet(),
    );

    final signals = <String>[
      if (rankedTrusted.isNotEmpty)
        '${_formatCompactCount(rankedTrusted.length)} trusted live',
      if (allFeed.stats.urgent > 0)
        '${_formatCompactCount(allFeed.stats.urgent)} urgent nearby',
      _fastestResponseLabel(allItems),
    ];

    final tokens = WelcomeThemeTokens.light;
    final metrics = <_WelcomeMetric>[
      _WelcomeMetric(
        label: 'Trusted live',
        value: _formatCompactCount(rankedTrusted.length),
        caption: rankedTrusted.isEmpty
            ? 'Grow accepted connections'
            : 'Posts from accepted people',
        icon: Icons.people_alt_rounded,
        tint: tokens.trustedTint,
      ),
      _WelcomeMetric(
        label: 'Urgent nearby',
        value: _formatCompactCount(allFeed.stats.urgent),
        caption: 'Requests people want solved today',
        icon: Icons.flash_on_rounded,
        tint: tokens.warningTint,
      ),
      _WelcomeMetric(
        label: 'Providers ready',
        value: _formatCompactCount(people.onlineCount),
        caption: '${people.verifiedCount} profiles with strong trust',
        icon: Icons.verified_user_rounded,
        tint: tokens.nearbyTint,
      ),
      _WelcomeMetric(
        label: 'Fastest response',
        value: _fastestResponseShort(allItems),
        caption: 'Best live reply signal in your area',
        icon: Icons.schedule_rounded,
        tint: tokens.earnTint,
      ),
    ];

    final trustedRailItems = rankedTrusted.take(3).toList();
    final trustedRailSubtitle = rankedTrusted.isEmpty
        ? 'Accepted connections make the feed safer and more actionable.'
        : 'A compact view of what accepted people and their circles are posting now.';

    return _WelcomeViewModel(
      metrics: metrics,
      heroSignals: signals,
      quickCategories: quickCategories,
      hotCategoryKeys: hotCategoryKeys.toSet(),
      trustedRailItems: trustedRailItems,
      trustedRailSubtitle: trustedRailSubtitle,
      forYouEntries: _buildForYouEntries(
        trusted: rankedTrusted,
        nearby: rankedNearby,
        providers: rankedProviders,
        hotCategoryKeys: hotCategoryKeys.toSet(),
      ),
      trustedEntries: _buildTrustedEntries(
        trusted: rankedTrusted,
        hotCategoryKeys: hotCategoryKeys.toSet(),
      ),
      nearbyEntries: _buildNearbyEntries(
        nearby: rankedNearby,
        providers: rankedProviders,
        trustedIds: trustedIds,
        hotCategoryKeys: hotCategoryKeys.toSet(),
      ),
      earnEntries: _buildEarnEntries(
        opportunities: rankedEarn,
        providers: rankedProviders,
        hotCategoryKeys: hotCategoryKeys.toSet(),
      ),
      trustedCountLabel: rankedTrusted.isEmpty
          ? 'Build your trusted feed'
          : '${_formatCompactCount(rankedTrusted.length)} trusted posts live',
      liveStatusLabel: _composeLiveStatus(allItems, providers),
      hasTrustedNetwork: rankedTrusted.isNotEmpty,
      savedCardIds: savedCardIds,
      defaultSurface: _surfaceFromServer(
        allFeed.defaultHomeSurface.isNotEmpty
            ? allFeed.defaultHomeSurface
            : trustedFeed.defaultHomeSurface,
      ),
      defaultSurfaceReason: allFeed.defaultHomeReason.isNotEmpty
          ? allFeed.defaultHomeReason
          : trustedFeed.defaultHomeReason,
    );
  }

  final List<_WelcomeMetric> metrics;
  final List<String> heroSignals;
  final List<String> quickCategories;
  final Set<String> hotCategoryKeys;
  final List<MobileFeedItem> trustedRailItems;
  final String trustedRailSubtitle;
  final List<_WelcomeFeedEntry> forYouEntries;
  final List<_WelcomeFeedEntry> trustedEntries;
  final List<_WelcomeFeedEntry> nearbyEntries;
  final List<_WelcomeFeedEntry> earnEntries;
  final String trustedCountLabel;
  final String liveStatusLabel;
  final bool hasTrustedNetwork;
  final Set<String> savedCardIds;
  final _WelcomeSurface defaultSurface;
  final String defaultSurfaceReason;

  List<_WelcomeFeedEntry> entriesFor(_WelcomeSurface surface) {
    switch (surface) {
      case _WelcomeSurface.forYou:
        return forYouEntries;
      case _WelcomeSurface.trusted:
        return trustedEntries;
      case _WelcomeSurface.nearby:
        return nearbyEntries;
      case _WelcomeSurface.earn:
        return earnEntries;
    }
  }

  _WelcomeSurface resolveSurface(_WelcomeSurface preferred) {
    if (entriesFor(preferred).isNotEmpty) {
      return preferred;
    }

    for (final surface in _WelcomeSurface.values) {
      if (entriesFor(surface).isNotEmpty) {
        return surface;
      }
    }

    return preferred;
  }
}

List<_WelcomeFeedEntry> _buildForYouEntries({
  required List<MobileFeedItem> trusted,
  required List<MobileFeedItem> nearby,
  required List<MobilePersonCard> providers,
  required Set<String> hotCategoryKeys,
}) {
  final entries = <_WelcomeFeedEntry>[];
  final usedFeedIds = <String>{};
  final usedProviderIds = <String>{};

  if (trusted.isNotEmpty) {
    final firstTrusted = trusted.first;
    entries.add(
      _WelcomeFeedEntry.connection(
        item: firstTrusted,
        reason: _buildFeedReason(
          firstTrusted,
          hotCategories: hotCategoryKeys,
          trusted: true,
        ),
      ),
    );
    usedFeedIds.add(firstTrusted.id);
  }

  for (final item in nearby) {
    if (usedFeedIds.contains(item.id)) {
      continue;
    }

    final isTrusted = trusted.any((trustedItem) => trustedItem.id == item.id);
    entries.add(
      isTrusted
          ? _WelcomeFeedEntry.connection(
              item: item,
              reason: _buildFeedReason(
                item,
                hotCategories: hotCategoryKeys,
                trusted: true,
              ),
            )
          : _WelcomeFeedEntry.request(
              item: item,
              reason: _buildFeedReason(
                item,
                hotCategories: hotCategoryKeys,
                trusted: false,
              ),
              fromTrustedNetwork: false,
            ),
    );
    usedFeedIds.add(item.id);

    if (entries.where((entry) => entry.item != null).length == 3 &&
        providers.isNotEmpty) {
      final person = providers.firstWhere(
        (candidate) => !usedProviderIds.contains(candidate.id),
        orElse: () => providers.first,
      );
      entries.add(
        _WelcomeFeedEntry.provider(
          person: person,
          reason: _buildProviderReason(person, hotCategories: hotCategoryKeys),
        ),
      );
      usedProviderIds.add(person.id);
    }

    if (entries.length >= 6) {
      break;
    }
  }

  if (entries.isEmpty && providers.isNotEmpty) {
    entries.addAll(
      providers
          .take(3)
          .map(
            (person) => _WelcomeFeedEntry.provider(
              person: person,
              reason: _buildProviderReason(
                person,
                hotCategories: hotCategoryKeys,
              ),
            ),
          ),
    );
  }

  if (entries.isEmpty) {
    return const [
      _WelcomeFeedEntry.cta(
        title: 'Start the local loop',
        message:
            'Post a need or explore nearby services so your home feed can learn what matters most to you.',
        primaryLabel: 'Post a need',
        secondaryLabel: 'Explore nearby',
        ctaTarget: _CtaTarget.postNeed,
      ),
    ];
  }

  return entries;
}

List<_WelcomeFeedEntry> _buildTrustedEntries({
  required List<MobileFeedItem> trusted,
  required Set<String> hotCategoryKeys,
}) {
  if (trusted.isEmpty) {
    return const [
      _WelcomeFeedEntry.cta(
        title: 'Your trusted feed is waiting',
        message:
            'Accepted connections unlock safer, more relevant posts before the wider public feed takes over.',
        primaryLabel: 'Manage people',
        secondaryLabel: 'Explore nearby',
        ctaTarget: _CtaTarget.people,
      ),
    ];
  }

  return trusted
      .take(6)
      .map(
        (item) => _WelcomeFeedEntry.connection(
          item: item,
          reason: _buildFeedReason(
            item,
            hotCategories: hotCategoryKeys,
            trusted: true,
          ),
        ),
      )
      .toList();
}

List<_WelcomeFeedEntry> _buildNearbyEntries({
  required List<MobileFeedItem> nearby,
  required List<MobilePersonCard> providers,
  required Set<String> trustedIds,
  required Set<String> hotCategoryKeys,
}) {
  if (nearby.isEmpty && providers.isEmpty) {
    return const [
      _WelcomeFeedEntry.empty(
        title: 'No live nearby posts yet',
        message:
            'Pull to refresh, widen your location later, or explore categories to warm up this area.',
      ),
    ];
  }

  final entries = <_WelcomeFeedEntry>[];
  var providerIndex = 0;
  var requestCount = 0;

  for (final item in nearby.take(8)) {
    entries.add(
      _WelcomeFeedEntry.request(
        item: item,
        reason: _buildFeedReason(
          item,
          hotCategories: hotCategoryKeys,
          trusted: trustedIds.contains(item.id),
        ),
        fromTrustedNetwork: trustedIds.contains(item.id),
      ),
    );
    requestCount += 1;

    if (providerIndex < providers.length && requestCount % 3 == 0) {
      entries.add(
        _WelcomeFeedEntry.provider(
          person: providers[providerIndex],
          reason: _buildProviderReason(
            providers[providerIndex],
            hotCategories: hotCategoryKeys,
          ),
        ),
      );
      providerIndex += 1;
    }
  }

  return entries;
}

List<_WelcomeFeedEntry> _buildEarnEntries({
  required List<MobileFeedItem> opportunities,
  required List<MobilePersonCard> providers,
  required Set<String> hotCategoryKeys,
}) {
  if (opportunities.isEmpty) {
    return [
      const _WelcomeFeedEntry.cta(
        title: 'Become visible for local work',
        message:
            'Complete provider onboarding to unlock responses, discovery, and trust ranking on this feed.',
        primaryLabel: 'Earn nearby',
        secondaryLabel: 'Explore nearby',
        ctaTarget: _CtaTarget.earn,
      ),
      ...providers
          .take(2)
          .map(
            (person) => _WelcomeFeedEntry.provider(
              person: person,
              reason: _buildProviderReason(
                person,
                hotCategories: hotCategoryKeys,
              ),
            ),
          ),
    ];
  }

  final entries = opportunities
      .take(6)
      .map(
        (item) => _WelcomeFeedEntry.opportunity(
          item: item,
          reason: _buildOpportunityReason(item, hotCategories: hotCategoryKeys),
          fromTrustedNetwork: false,
        ),
      )
      .toList();

  if (providers.isNotEmpty) {
    entries.insert(
      math.min(2, entries.length),
      _WelcomeFeedEntry.provider(
        person: providers.first,
        reason: _buildProviderReason(
          providers.first,
          hotCategories: hotCategoryKeys,
        ),
      ),
    );
  }

  return entries;
}

Map<String, int> _collectCategoryStats(
  List<MobileFeedItem> feed,
  List<MobileFeedItem> trusted,
  List<MobilePersonCard> providers,
) {
  final counts = <String, int>{};

  void addCategory(String value, {int weight = 1}) {
    final normalized = value.trim();
    if (normalized.isEmpty) {
      return;
    }
    counts.update(
      normalized,
      (current) => current + weight,
      ifAbsent: () => weight,
    );
  }

  for (final item in feed) {
    addCategory(item.category, weight: item.urgent ? 3 : 2);
  }
  for (final item in trusted) {
    addCategory(item.category, weight: 3);
  }
  for (final person in providers) {
    for (final tag in person.primaryTags) {
      addCategory(tag, weight: person.isOnline ? 2 : 1);
    }
  }

  final sortedEntries = counts.entries.toList()
    ..sort((left, right) => right.value.compareTo(left.value));
  return {for (final entry in sortedEntries) entry.key: entry.value};
}

List<MobileFeedItem> _sortFeedItems(
  List<MobileFeedItem> items, {
  required Set<String> trustedIds,
  required Set<String> hotCategories,
  required bool earnMode,
}) {
  final sorted = List<MobileFeedItem>.from(items);
  sorted.sort((left, right) {
    final leftScore = _feedScore(
      left,
      trustedIds: trustedIds,
      hotCategories: hotCategories,
      earnMode: earnMode,
    );
    final rightScore = _feedScore(
      right,
      trustedIds: trustedIds,
      hotCategories: hotCategories,
      earnMode: earnMode,
    );

    final scoreCompare = rightScore.compareTo(leftScore);
    if (scoreCompare != 0) {
      return scoreCompare;
    }

    return left.title.toLowerCase().compareTo(right.title.toLowerCase());
  });
  return sorted;
}

int _feedScore(
  MobileFeedItem item, {
  required Set<String> trustedIds,
  required Set<String> hotCategories,
  required bool earnMode,
}) {
  var score = item.priorityScore;
  if (trustedIds.contains(item.id)) {
    score += 48;
  }
  if (item.sourceType == 'accepted_connection') {
    score += 36;
  } else if (item.sourceType == 'recommended') {
    score += 18;
  }
  score += item.mutualConnectionsCount * 10;
  if (item.urgent) {
    score += 28;
  }
  if (item.type == MobileFeedItemType.demand) {
    score += earnMode ? 24 : 14;
  } else if (!earnMode) {
    score += 8;
  }
  if (item.isVerified) {
    score += 18;
  }
  if (hotCategories.contains(item.category.trim())) {
    score += 12;
  }

  final response = item.responseMinutes <= 0 ? 45 : item.responseMinutes;
  score += math.max(0, 30 - math.min(response, 30));
  score += math.min(item.completedJobs, 18);
  score += math.min(item.reviewCount, 10);
  if (item.activeNow) {
    score += 16;
  }
  score += math.max(0, 16 - _extractRelativeMinutes(item.timeLabel) ~/ 30);
  score += math.max(0, 14 - _extractDistanceKm(item.distanceLabel).round());

  return score;
}

List<MobileFeedItem> _diversifyItems(List<MobileFeedItem> items) {
  final pending = List<MobileFeedItem>.from(items);
  final results = <MobileFeedItem>[];
  var lastCategory = '';

  while (pending.isNotEmpty) {
    var nextIndex = pending.indexWhere(
      (item) => item.category.toLowerCase() != lastCategory,
    );
    if (nextIndex == -1) {
      nextIndex = 0;
    }

    final next = pending.removeAt(nextIndex);
    results.add(next);
    lastCategory = next.category.toLowerCase();
  }

  return results;
}

List<MobilePersonCard> _sortProviders(
  List<MobilePersonCard> providers, {
  required Set<String> hotCategories,
}) {
  final sorted = List<MobilePersonCard>.from(providers);
  sorted.sort((left, right) {
    final leftScore = _providerScore(left, hotCategories: hotCategories);
    final rightScore = _providerScore(right, hotCategories: hotCategories);
    final scoreCompare = rightScore.compareTo(leftScore);
    if (scoreCompare != 0) {
      return scoreCompare;
    }
    return left.name.toLowerCase().compareTo(right.name.toLowerCase());
  });
  return sorted;
}

int _providerScore(
  MobilePersonCard person, {
  required Set<String> hotCategories,
}) {
  var score = person.priorityScore;
  if (person.isAcceptedConnection) {
    score += 42;
  }
  if (person.isOnline) {
    score += 24;
  }
  score += person.mutualConnectionsCount * 8;
  score += math.min(person.completionPercent ~/ 4, 24);
  score += math.min(person.completedJobs, 18);
  score += math.min(person.reviewCount, 12);
  if ((person.averageRating ?? 0) >= 4.7) {
    score += 10;
  }
  final tagMatch = person.primaryTags.where(hotCategories.contains).length;
  score += tagMatch * 8;
  return score;
}

String _buildFeedReason(
  MobileFeedItem item, {
  required Set<String> hotCategories,
  required bool trusted,
}) {
  if (item.whyThisCard.isNotEmpty) {
    return item.whyThisCard;
  }
  if (item.feedReason.isNotEmpty) {
    return item.feedReason;
  }
  if (trusted) {
    return 'Accepted connection post with clearer trust and social context.';
  }
  if (item.urgent) {
    return 'Urgent nearby request with active response signals.';
  }
  if (item.responseMinutes > 0 && item.responseMinutes <= 20) {
    return 'High-intent post with a faster-than-average response signal.';
  }
  if (hotCategories.contains(item.category.trim())) {
    return 'Trending in ${item.category} around you right now.';
  }
  if (_extractDistanceKm(item.distanceLabel) <= 5) {
    return 'Very close to you and easier to act on quickly.';
  }
  return 'Relevant local activity ranked for trust, speed, and distance.';
}

String _buildOpportunityReason(
  MobileFeedItem item, {
  required Set<String> hotCategories,
}) {
  if (item.whyThisCard.isNotEmpty) {
    return item.whyThisCard;
  }
  if (item.feedReason.isNotEmpty) {
    return item.feedReason;
  }
  if (item.urgent) {
    return 'Urgent request with a strong chance of quick conversion.';
  }
  if (item.responseMinutes > 0 && item.responseMinutes <= 25) {
    return 'Fast-response demand signal, good for providers who can reply now.';
  }
  if (hotCategories.contains(item.category.trim())) {
    return 'Aligned with live demand in ${item.category}.';
  }
  return 'High-intent local need worth responding to today.';
}

String _buildProviderReason(
  MobilePersonCard person, {
  required Set<String> hotCategories,
}) {
  if (person.reason.isNotEmpty) {
    return person.reason;
  }
  if (person.isAcceptedConnection) {
    return 'Accepted connection with stronger marketplace context.';
  }
  if (person.isOnline) {
    return 'Active now and ready for fast follow-up.';
  }
  final matchedTag = person.primaryTags
      .where(hotCategories.contains)
      .cast<String?>()
      .firstWhere((value) => value != null, orElse: () => null);
  if (matchedTag != null) {
    return 'Strong fit for $matchedTag demand nearby.';
  }
  if (person.completedJobs > 0) {
    return 'Consistent delivery history with growing marketplace trust.';
  }
  return 'Visible local provider with enough trust signals to review.';
}

String _composeLiveStatus(
  List<MobileFeedItem> items,
  List<MobilePersonCard> providers,
) {
  final urgent = items.where((item) => item.urgent).length;
  final activeProviders = providers.where((person) => person.isOnline).length;
  if (urgent > 0 && activeProviders > 0) {
    return '$urgent urgent posts and $activeProviders providers active now.';
  }
  if (urgent > 0) {
    return '$urgent urgent posts need attention nearby.';
  }
  if (activeProviders > 0) {
    return '$activeProviders providers are active right now.';
  }
  return 'Local feed is live and updating in real time.';
}

double _extractDistanceKm(String label) {
  final match = RegExp(r'(\d+(\.\d+)?)').firstMatch(label.toLowerCase());
  if (match == null) {
    return 0;
  }
  return double.tryParse(match.group(1) ?? '') ?? 0;
}

int _extractRelativeMinutes(String value) {
  final normalized = value.trim().toLowerCase();
  if (normalized.isEmpty || normalized.contains('recent')) {
    return 5;
  }

  final minuteMatch = RegExp(r'(\d+)\s*m').firstMatch(normalized);
  if (minuteMatch != null) {
    return int.tryParse(minuteMatch.group(1) ?? '') ?? 5;
  }

  final hourMatch = RegExp(r'(\d+)\s*h').firstMatch(normalized);
  if (hourMatch != null) {
    return (int.tryParse(hourMatch.group(1) ?? '') ?? 1) * 60;
  }

  final dayMatch = RegExp(r'(\d+)\s*d').firstMatch(normalized);
  if (dayMatch != null) {
    return (int.tryParse(dayMatch.group(1) ?? '') ?? 1) * 1440;
  }

  return 180;
}

String _fastestResponseShort(List<MobileFeedItem> items) {
  final valid = items.where((item) => item.responseMinutes > 0).toList();
  if (valid.isEmpty) {
    return 'Live';
  }

  final minResponse = valid
      .map((item) => item.responseMinutes)
      .reduce(math.min);
  return '$minResponse min';
}

String _fastestResponseLabel(List<MobileFeedItem> items) {
  final valid = items.where((item) => item.responseMinutes > 0).toList();
  if (valid.isEmpty) {
    return 'Response timing is warming up';
  }

  final minResponse = valid
      .map((item) => item.responseMinutes)
      .reduce(math.min);
  return '$minResponse min fastest response';
}

String _formatCompactCount(int value) {
  if (value >= 1000) {
    final compact = value >= 10000
        ? (value / 1000).round().toString()
        : (value / 1000).toStringAsFixed(1);
    return '${compact.replaceAll('.0', '')}k';
  }
  return value.toString();
}

class _WelcomeAppBarTitle extends StatelessWidget {
  const _WelcomeAppBarTitle();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('ServiQ', style: Theme.of(context).textTheme.titleLarge),
        Text(
          'Trusted help nearby',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _AppBarAction extends StatelessWidget {
  const _AppBarAction({
    required this.icon,
    required this.onPressed,
    required this.tooltip,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: IconButton(
        tooltip: tooltip,
        onPressed: onPressed,
        icon: Icon(icon),
        style: IconButton.styleFrom(
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.ink,
          side: const BorderSide(color: AppColors.border),
        ),
      ),
    );
  }
}

class _HeroSection extends StatelessWidget {
  const _HeroSection({
    required this.greeting,
    required this.trustedCountLabel,
    required this.liveStatusLabel,
    required this.onSearchTap,
    required this.onPrimaryTap,
    required this.onEarnTap,
    required this.onPeopleTap,
    required this.heroSignals,
  });

  final String greeting;
  final String trustedCountLabel;
  final String liveStatusLabel;
  final VoidCallback onSearchTap;
  final VoidCallback onPrimaryTap;
  final VoidCallback onEarnTap;
  final VoidCallback onPeopleTap;
  final List<String> heroSignals;

  @override
  Widget build(BuildContext context) {
    final tokens =
        Theme.of(context).extension<WelcomeThemeTokens>() ??
        WelcomeThemeTokens.light;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [tokens.heroStart, tokens.heroEnd],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: tokens.heroStroke),
        boxShadow: AppShadows.card,
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _SignalPill(
                icon: Icons.people_alt_rounded,
                label: trustedCountLabel,
                backgroundColor: Colors.white,
              ),
              _SignalPill(
                icon: Icons.bolt_rounded,
                label: liveStatusLabel,
                backgroundColor: Colors.white,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            greeting,
            style: textTheme.bodySmall?.copyWith(
              color: tokens.heroAccent,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'What do you need nearby today?',
            style: textTheme.headlineMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Start with a trusted live feed, then move into the strongest nearby matches without losing context.',
            style: textTheme.bodyMedium?.copyWith(color: AppColors.ink),
          ),
          const SizedBox(height: 16),
          InkWell(
            onTap: onSearchTap,
            borderRadius: BorderRadius.circular(AppRadii.md),
            child: Ink(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadii.md),
                border: Border.all(color: AppColors.border),
              ),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                child: Row(
                  children: [
                    Icon(Icons.search_rounded, color: AppColors.inkMuted),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Search needs, providers, or categories',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: AppColors.inkMuted,
                        ),
                      ),
                    ),
                    Icon(Icons.arrow_forward_ios_rounded, size: 14),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Post a Need',
            icon: const Icon(Icons.add_rounded),
            onPressed: onPrimaryTap,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: SecondaryButton(
                  label: 'Earn Nearby',
                  icon: const Icon(Icons.workspace_premium_outlined),
                  onPressed: onEarnTap,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SecondaryButton(
                  label: 'People',
                  icon: const Icon(Icons.people_outline_rounded),
                  onPressed: onPeopleTap,
                ),
              ),
            ],
          ),
          if (heroSignals.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: heroSignals
                  .map(
                    (signal) => _SignalPill(
                      icon: Icons.circle,
                      iconSize: 8,
                      label: signal,
                      backgroundColor: Colors.white.withValues(alpha: 0.9),
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

class _SignalPill extends StatelessWidget {
  const _SignalPill({
    required this.icon,
    required this.label,
    required this.backgroundColor,
    this.iconSize = 14,
  });

  final IconData icon;
  final String label;
  final Color backgroundColor;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: iconSize, color: AppColors.ink),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _InlineWarningCard extends StatelessWidget {
  const _InlineWarningCard({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded, color: AppColors.warning),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: AppColors.ink),
            ),
          ),
          TextButton(onPressed: () => onRetry(), child: const Text('Retry')),
        ],
      ),
    );
  }
}

class _TrustSummarySection extends StatelessWidget {
  const _TrustSummarySection({required this.metrics});

  final List<_WelcomeMetric> metrics;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - 12) / 2;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: metrics
              .map(
                (metric) => SizedBox(
                  width: width,
                  child: _MetricCard(metric: metric),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.metric});

  final _WelcomeMetric metric;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: metric.tint,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            alignment: Alignment.center,
            child: Icon(metric.icon, size: 18, color: AppColors.ink),
          ),
          const SizedBox(height: 12),
          Text(metric.value, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(metric.label, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          Text(metric.caption, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _QuickCategoryRow extends StatelessWidget {
  const _QuickCategoryRow({required this.categories, required this.onPressed});

  final List<String> categories;
  final ValueChanged<String> onPressed;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: categories
            .map(
              (category) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ActionChip(
                  avatar: Icon(
                    _categoryIcon(category),
                    size: 16,
                    color: AppColors.ink,
                  ),
                  label: Text(category),
                  onPressed: () => onPressed(category),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _TrustedRail extends StatelessWidget {
  const _TrustedRail({
    required this.items,
    required this.onOpen,
    required this.onMessage,
    required this.onMore,
  });

  final List<MobileFeedItem> items;
  final ValueChanged<MobileFeedItem> onOpen;
  final ValueChanged<MobileFeedItem> onMessage;
  final ValueChanged<MobileFeedItem> onMore;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = math.min(320.0, constraints.maxWidth * 0.88);
        return SizedBox(
          height: 500,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (context, index) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final item = items[index];
              return SizedBox(
                width: width,
                child: _TrustedConnectionRailCard(
                  item: item,
                  onOpen: () => onOpen(item),
                  onMessage: () => onMessage(item),
                  onMore: () => onMore(item),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _TrustedConnectionRailCard extends StatelessWidget {
  const _TrustedConnectionRailCard({
    required this.item,
    required this.onOpen,
    required this.onMessage,
    required this.onMore,
  });

  final MobileFeedItem item;
  final VoidCallback onOpen;
  final VoidCallback onMessage;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    final tokens =
        Theme.of(context).extension<WelcomeThemeTokens>() ??
        WelcomeThemeTokens.light;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (item.hasPreviewImage) ...[
            _CardPreviewMedia(
              imageUrl: item.thumbnailUrl,
              count: item.mediaCount,
              title: item.category,
              height: 84,
            ),
            const SizedBox(height: 14),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: tokens.trustedTint,
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                      child: Text(
                        item.sourceTypeLabel,
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(color: AppColors.primary),
                      ),
                    ),
                    if (item.mutualConnectionsCount > 0)
                      _Badge(
                        label:
                            '${item.mutualConnectionsCount} mutual${item.mutualConnectionsCount == 1 ? '' : 's'}',
                        backgroundColor: AppColors.surfaceMuted,
                        foregroundColor: AppColors.ink,
                      ),
                    if (item.urgent)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.dangerSoft,
                          borderRadius: BorderRadius.circular(AppRadii.md),
                        ),
                        child: Text(
                          'Urgent',
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(color: AppColors.danger),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: onMore,
                icon: const Icon(Icons.more_horiz_rounded),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            item.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            '${item.creatorName} • ${item.distanceLabel} • ${item.timeLabel}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: tokens.trustedTint,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Text(
              item.responseLabel,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.primary),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _MetaPill(
                icon: Icons.person_outline_rounded,
                label: item.creatorName,
              ),
              _MetaPill(icon: Icons.place_outlined, label: item.distanceLabel),
              _MetaPill(
                icon: Icons.verified_user_outlined,
                label: item.socialProofLabel,
              ),
              _MetaPill(icon: Icons.history_rounded, label: item.timeLabel),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: SecondaryButton(label: 'Message', onPressed: onMessage),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: PrimaryButton(label: 'Open', onPressed: onOpen),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NetworkPromptCard extends StatelessWidget {
  const _NetworkPromptCard({
    required this.onPeopleTap,
    required this.onExploreTap,
  });

  final VoidCallback onPeopleTap;
  final VoidCallback onExploreTap;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Build a trusted local feed',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'Accepted connections should shape the first stories you see. Add people first, then let nearby discovery widen from there.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: PrimaryButton(
                  label: 'Manage people',
                  onPressed: onPeopleTap,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SecondaryButton(
                  label: 'Explore nearby',
                  onPressed: onExploreTap,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SurfaceTabsRow extends StatelessWidget {
  const _SurfaceTabsRow({required this.value, required this.onChanged});

  final _WelcomeSurface value;
  final ValueChanged<_WelcomeSurface> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _WelcomeSurface.values
            .map(
              (surface) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(surface.title),
                  selected: value == surface,
                  onSelected: (selected) => onChanged(surface),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _WelcomeRequestCard extends StatelessWidget {
  const _WelcomeRequestCard({
    required this.item,
    required this.reason,
    required this.isSaved,
    required this.fromTrustedNetwork,
    required this.primaryLabel,
    required this.secondaryLabel,
    required this.onPrimaryTap,
    required this.onSecondaryTap,
    required this.onSaveTap,
    required this.onMoreTap,
    this.accentColor = AppColors.primary,
    this.accentBackground = AppColors.primarySoft,
  });

  final MobileFeedItem item;
  final String reason;
  final bool isSaved;
  final bool fromTrustedNetwork;
  final String primaryLabel;
  final String secondaryLabel;
  final VoidCallback onPrimaryTap;
  final VoidCallback onSecondaryTap;
  final VoidCallback onSaveTap;
  final VoidCallback onMoreTap;
  final Color accentColor;
  final Color accentBackground;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _Badge(
                      label: item.sourceTypeLabel,
                      backgroundColor: fromTrustedNetwork
                          ? AppColors.primarySoft
                          : AppColors.surfaceMuted,
                      foregroundColor: fromTrustedNetwork
                          ? AppColors.primary
                          : AppColors.ink,
                    ),
                    _Badge(
                      label: item.category,
                      backgroundColor: accentBackground,
                      foregroundColor: accentColor,
                    ),
                    if (item.mutualConnectionsCount > 0)
                      _Badge(
                        label:
                            '${item.mutualConnectionsCount} mutual${item.mutualConnectionsCount == 1 ? '' : 's'}',
                        backgroundColor: AppColors.surfaceMuted,
                        foregroundColor: AppColors.ink,
                      ),
                    if (item.urgent)
                      const _Badge(
                        label: 'Urgent',
                        backgroundColor: AppColors.dangerSoft,
                        foregroundColor: AppColors.danger,
                      ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onMoreTap,
                icon: const Icon(Icons.more_horiz_rounded),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(item.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            item.description,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (item.hasPreviewImage || item.hasMedia) ...[
            const SizedBox(height: 14),
            _CardPreviewMedia(
              imageUrl: item.thumbnailUrl,
              count: item.mediaCount,
              title: item.category,
            ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _MetaPill(
                icon: Icons.person_outline_rounded,
                label: item.creatorName,
              ),
              _MetaPill(icon: Icons.place_outlined, label: item.distanceLabel),
              _MetaPill(
                icon: Icons.schedule_rounded,
                label: item.responseLabel,
              ),
              _MetaPill(icon: Icons.payments_outlined, label: item.priceLabel),
              _MetaPill(icon: Icons.history_rounded, label: item.timeLabel),
              _MetaPill(
                icon: Icons.verified_user_outlined,
                label: item.trustLabel,
              ),
              if (item.lastActiveLabel.isNotEmpty)
                _MetaPill(
                  icon: item.activeNow
                      ? Icons.circle
                      : Icons.access_time_rounded,
                  label: item.lastActiveLabel,
                ),
              if (item.responseReliability.isNotEmpty)
                _MetaPill(
                  icon: Icons.bolt_rounded,
                  label: item.responseReliability,
                ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: accentBackground,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Text(
              reason,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: accentColor),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _SaveIconButton(isSaved: isSaved, onTap: onSaveTap),
              const SizedBox(width: 8),
              Expanded(
                child: SecondaryButton(
                  label: secondaryLabel,
                  onPressed: onSecondaryTap,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: PrimaryButton(
                  label: primaryLabel,
                  onPressed: onPrimaryTap,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TrustedConnectionCard extends StatelessWidget {
  const _TrustedConnectionCard({
    required this.item,
    required this.reason,
    required this.isSaved,
    required this.onSave,
    required this.onOpen,
    required this.onMessage,
    required this.onMore,
  });

  final MobileFeedItem item;
  final String reason;
  final bool isSaved;
  final VoidCallback onSave;
  final VoidCallback onOpen;
  final VoidCallback onMessage;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    return _WelcomeRequestCard(
      item: item,
      reason: reason,
      isSaved: isSaved,
      fromTrustedNetwork: true,
      primaryLabel: 'Open request',
      secondaryLabel: 'Message',
      onPrimaryTap: onOpen,
      onSecondaryTap: onMessage,
      onSaveTap: onSave,
      onMoreTap: onMore,
    );
  }
}

class _WelcomeProviderCard extends StatelessWidget {
  const _WelcomeProviderCard({
    required this.person,
    required this.reason,
    required this.isSaved,
    required this.onSaveTap,
    required this.onMessageTap,
    required this.onOpenTap,
    required this.onMoreTap,
  });

  final MobilePersonCard person;
  final String reason;
  final bool isSaved;
  final VoidCallback onSaveTap;
  final VoidCallback onMessageTap;
  final VoidCallback onOpenTap;
  final VoidCallback onMoreTap;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: AppColors.primarySoft,
                backgroundImage: person.avatarUrl.trim().isNotEmpty
                    ? CachedNetworkImageProvider(person.avatarUrl)
                    : null,
                child: person.avatarUrl.trim().isNotEmpty
                    ? null
                    : Text(
                        _initialsFor(person.name),
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      person.name,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      person.headline,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onMoreTap,
                icon: const Icon(Icons.more_horiz_rounded),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (person.hasPreviewImage) ...[
            _CardPreviewMedia(
              imageUrl: person.previewImageUrl,
              count: person.previewMediaCount,
              title: person.previewTitle.isEmpty
                  ? person.name
                  : person.previewTitle,
            ),
            const SizedBox(height: 14),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Badge(
                label: person.socialLabel,
                backgroundColor: person.isAcceptedConnection
                    ? AppColors.primarySoft
                    : AppColors.surfaceMuted,
                foregroundColor: person.isAcceptedConnection
                    ? AppColors.primary
                    : AppColors.ink,
              ),
              _Badge(
                label: person.isOnline ? 'Active now' : person.activityLabel,
                backgroundColor: person.isOnline
                    ? AppColors.primarySoft
                    : AppColors.surfaceMuted,
                foregroundColor: person.isOnline
                    ? AppColors.primary
                    : AppColors.ink,
              ),
              _Badge(
                label: person.verificationLabel,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
              _Badge(
                label: person.ratingLabel,
                backgroundColor: AppColors.warningSoft,
                foregroundColor: AppColors.warning,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _MetaPill(
                icon: Icons.place_outlined,
                label: person.locationLabel,
              ),
              _MetaPill(icon: Icons.task_alt_rounded, label: person.workLabel),
              _MetaPill(
                icon: Icons.payments_outlined,
                label: person.priceLabel,
              ),
              if (person.mutualConnectionsCount > 0)
                _MetaPill(
                  icon: Icons.people_alt_outlined,
                  label:
                      '${person.mutualConnectionsCount} mutual${person.mutualConnectionsCount == 1 ? '' : 's'}',
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
                    (tag) => _Badge(
                      label: tag,
                      backgroundColor: AppColors.surfaceMuted,
                      foregroundColor: AppColors.ink,
                    ),
                  )
                  .toList(),
            ),
          ],
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Text(
              reason,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.primary),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _SaveIconButton(isSaved: isSaved, onTap: onSaveTap),
              const SizedBox(width: 8),
              Expanded(
                child: SecondaryButton(
                  label: 'Message',
                  onPressed: onMessageTap,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: PrimaryButton(
                  label: 'View profile',
                  onPressed: onOpenTap,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CardPreviewMedia extends StatelessWidget {
  const _CardPreviewMedia({
    required this.imageUrl,
    required this.count,
    required this.title,
    this.height = 164,
  });

  final String imageUrl;
  final int count;
  final String title;
  final double height;

  @override
  Widget build(BuildContext context) {
    final hasImage = imageUrl.trim().isNotEmpty;

    return Container(
      height: height,
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (hasImage)
            CachedNetworkImage(
              imageUrl: imageUrl,
              fit: BoxFit.cover,
              placeholder: (context, _) => const LoadingShimmer(),
              errorWidget: (context, _, _) => _PreviewFallback(title: title),
            )
          else
            _PreviewFallback(title: title),
          Positioned(
            left: 12,
            right: 12,
            bottom: 12,
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(AppRadii.md),
                    ),
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ),
                ),
                if (count > 1) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(AppRadii.md),
                    ),
                    child: Text(
                      '$count photos',
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PreviewFallback extends StatelessWidget {
  const _PreviewFallback({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceMuted,
      alignment: Alignment.center,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.photo_library_outlined, color: AppColors.inkMuted),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _WelcomeCtaCard extends StatelessWidget {
  const _WelcomeCtaCard({
    required this.title,
    required this.message,
    required this.primaryLabel,
    required this.secondaryLabel,
    required this.onPrimaryTap,
    required this.onSecondaryTap,
  });

  final String title;
  final String message;
  final String primaryLabel;
  final String secondaryLabel;
  final VoidCallback onPrimaryTap;
  final VoidCallback onSecondaryTap;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: PrimaryButton(
                  label: primaryLabel,
                  onPressed: onPrimaryTap,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SecondaryButton(
                  label: secondaryLabel,
                  onPressed: onSecondaryTap,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(
          context,
        ).textTheme.labelMedium?.copyWith(color: foregroundColor),
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceRaised,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.inkMuted),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _SaveIconButton extends StatelessWidget {
  const _SaveIconButton({required this.isSaved, required this.onTap});

  final bool isSaved;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 44,
      height: 44,
      child: IconButton(
        onPressed: onTap,
        icon: Icon(
          isSaved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
        ),
        style: IconButton.styleFrom(
          backgroundColor: Colors.white,
          side: const BorderSide(color: AppColors.border),
        ),
      ),
    );
  }
}

class _WelcomeLoadingState extends StatelessWidget {
  const _WelcomeLoadingState();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(color: AppColors.border),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              LoadingShimmer(height: 18, width: 160),
              SizedBox(height: 12),
              LoadingShimmer(height: 28, width: 260),
              SizedBox(height: 8),
              LoadingShimmer(height: 14),
              SizedBox(height: 6),
              LoadingShimmer(height: 14, width: 220),
              SizedBox(height: 18),
              LoadingShimmer(height: 48),
              SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: LoadingShimmer(height: 48)),
                  SizedBox(width: 12),
                  Expanded(child: LoadingShimmer(height: 48)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: List.generate(
            4,
            (index) => SizedBox(
              width: 164,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    LoadingShimmer(height: 34, width: 34),
                    SizedBox(height: 12),
                    LoadingShimmer(height: 18, width: 80),
                    SizedBox(height: 8),
                    LoadingShimmer(height: 12),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        ...List.generate(
          3,
          (index) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  LoadingShimmer(height: 18, width: 180),
                  SizedBox(height: 12),
                  LoadingShimmer(height: 22, width: 260),
                  SizedBox(height: 8),
                  LoadingShimmer(height: 14),
                  SizedBox(height: 6),
                  LoadingShimmer(height: 14, width: 220),
                  SizedBox(height: 16),
                  LoadingShimmer(height: 42),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

IconData _categoryIcon(String category) {
  final value = category.toLowerCase();
  if (value.contains('clean')) {
    return Icons.cleaning_services_rounded;
  }
  if (value.contains('electric')) {
    return Icons.electrical_services_rounded;
  }
  if (value.contains('repair') || value.contains('appliance')) {
    return Icons.build_circle_outlined;
  }
  if (value.contains('plumb')) {
    return Icons.plumbing_rounded;
  }
  if (value.contains('paint')) {
    return Icons.format_paint_rounded;
  }
  return Icons.home_repair_service_rounded;
}

String _initialsFor(String value) {
  final parts = value
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) {
    return 'S';
  }
  if (parts.length == 1) {
    return parts.first.substring(0, 1).toUpperCase();
  }
  return '${parts.first.substring(0, 1)}${parts[1].substring(0, 1)}'
      .toUpperCase();
}

const _emptyFeedSnapshot = MobileFeedSnapshot(
  currentUserId: '',
  stats: MobileFeedStats(
    total: 0,
    urgent: 0,
    demand: 0,
    service: 0,
    product: 0,
  ),
  items: [],
);

const _emptyPeopleSnapshot = MobilePeopleSnapshot(
  currentUserId: '',
  people: [],
);
