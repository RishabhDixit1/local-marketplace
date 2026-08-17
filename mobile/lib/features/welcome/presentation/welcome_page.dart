import 'dart:math' as math;
import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/firebase/app_firebase.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../features/chat/data/chat_repository.dart';
import '../../../features/chat/domain/chat_models.dart';
import '../../../features/auth/data/onboarding_handoff.dart';
import '../../../features/feed/data/feed_interactions_repository.dart';
import '../../../features/reporting/domain/report_models.dart';
import '../../../features/reporting/presentation/report_sheet.dart';
import '../../../core/api/mobile_api_client.dart';
import '../../../features/feed/data/feed_repository.dart';
import '../../../features/feed/domain/feed_snapshot.dart';
import '../../../features/notifications/data/notification_repository.dart';
import '../../../features/people/data/people_repository.dart';
import '../../../features/people/domain/people_snapshot.dart';
import '../../../features/profile/data/profile_repository.dart';
import '../../../features/profile/domain/mobile_profile_snapshot.dart';
import '../../../features/tasks/data/task_repository.dart';
import '../../../features/tasks/domain/task_snapshot.dart';
import '../../../l10n/l10n.dart';
import '../../../shared/components/feed_card.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/section_header.dart';
import '../../../shared/widgets/ai_prompt_bar.dart';

part 'welcome_widgets.dart';

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
  _WelcomeSurface _resolvedSurface = _WelcomeSurface.forYou;
  final DateTime _openedAt = DateTime.now();
  bool _trackedFirstEngagement = false;
  final Set<String> _savedAddedIds = <String>{};
  final Set<String> _savedRemovedIds = <String>{};
  final Set<String> _hiddenFeedIds = <String>{};
  final Set<String> _hiddenProviderIds = <String>{};
  String? _busyFeedActionId;

  // --- Memoization cache for _WelcomeViewModel ---
  // Keyed on identity of feed/people AsyncValues + value-equality of hidden-id sets.
  // When chatConversationsProvider or taskSnapshotProvider fire (the common case),
  // the feed AsyncValues are the same objects so this skips the expensive
  // rank/score/diversify pipeline entirely.
  AsyncValue<MobileFeedSnapshot>? _cachedAllFeedAsync;
  AsyncValue<MobileFeedSnapshot>? _cachedTrustedFeedAsync;
  AsyncValue<MobilePeopleSnapshot>? _cachedPeopleAsync;
  Set<String> _cachedHiddenFeedIds = const <String>{};
  Set<String> _cachedHiddenProviderIds = const <String>{};
  _WelcomeViewModel? _cachedViewModel;

  // --- End memoization cache ---

  _WelcomeViewModel _buildCachedViewModel({
    required AsyncValue<MobileFeedSnapshot> allFeedAsync,
    required AsyncValue<MobileFeedSnapshot> trustedFeedAsync,
    required AsyncValue<MobilePeopleSnapshot> peopleAsync,
  }) {
    // identical() is safe here because FutureProvider returns the same
    // AsyncValue instance until the provider is actually re-fetched/invalidated.
    // When chatConversationsProvider or taskSnapshotProvider fire, the feed
    // AsyncValues are unchanged objects — identical() detects this and we skip
    // the expensive rebuild. When a feed provider *does* change, Riverpod
    // produces a new AsyncValue and identical() returns false, so the cache
    // is correctly invalidated.
    final hiddenIdsEqual = _cachedViewModel != null &&
        _setEquals(_hiddenFeedIds, _cachedHiddenFeedIds) &&
        _setEquals(_hiddenProviderIds, _cachedHiddenProviderIds);

    if (_cachedViewModel != null &&
        identical(allFeedAsync, _cachedAllFeedAsync) &&
        identical(trustedFeedAsync, _cachedTrustedFeedAsync) &&
        identical(peopleAsync, _cachedPeopleAsync) &&
        hiddenIdsEqual) {
      return _cachedViewModel!;
    }

    final model = _WelcomeViewModel.build(
      allFeed: allFeedAsync.asData?.value ?? _emptyFeedSnapshot,
      trustedFeed: trustedFeedAsync.asData?.value ?? _emptyFeedSnapshot,
      people: peopleAsync.asData?.value ?? _emptyPeopleSnapshot,
      hiddenFeedIds: _hiddenFeedIds,
      hiddenProviderIds: _hiddenProviderIds,
    );

    _cachedAllFeedAsync = allFeedAsync;
    _cachedTrustedFeedAsync = trustedFeedAsync;
    _cachedPeopleAsync = peopleAsync;
    _cachedHiddenFeedIds = Set<String>.from(_hiddenFeedIds);
    _cachedHiddenProviderIds = Set<String>.from(_hiddenProviderIds);
    _cachedViewModel = model;

    return model;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Await the shared Firebase init future so the first screen event on a
      // cold start is not dropped (analytics requires an initialized app).
      ref.read(appFirebaseProvider.future).then((_) {
        if (!mounted) {
          return;
        }
        ref
            .read(analyticsServiceProvider)
            .trackScreen(
              'home_welcome',
              extras: {'surface': _resolvedSurface.analyticsValue},
            );
      });
    });
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

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }

    ServiqToast.show(context, message: message);
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

      ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.connected));
      await Future.wait([
        ref.read(feedSnapshotProvider(MobileFeedScope.all).future),
        ref.read(feedSnapshotProvider(MobileFeedScope.connected).future),
      ]);
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

  Future<void> _selectIntent(MobileOnboardingIntent intent) async {
    _trackFirstEngagement('choose_intent');
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'home_intent_chosen',
          extras: {
            'intent': intent.analyticsValue,
            'destination': intent.destinationRoute,
          },
        );
    await ref.read(onboardingHandoffControllerProvider).selectIntent(intent);
    if (!mounted) return;
    context.push(intent.destinationRoute);
  }

  void _dismissIntentPrompt() {
    ref
        .read(onboardingHandoffControllerProvider)
        .dismissIntentPrompt();
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
                (DateTime.now().difference(_openedAt).inMilliseconds <= 2000).toString(),
          },
        );
  }

  Future<void> _toggleSave(
    _WelcomeFeedEntry entry, {
    required Set<String> backendSavedIds,
  }) async {
    HapticFeedback.lightImpact();
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
    HapticFeedback.lightImpact();
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

  Future<void> _shareEntry(_WelcomeFeedEntry entry) async {
    HapticFeedback.lightImpact();
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

  Future<void> _shareViaWhatsApp(_WelcomeFeedEntry entry) async {
    HapticFeedback.mediumImpact();
    final card = _buildInteractionContext(entry);
    final config = ref.read(appBootstrapProvider).config;
    final shareUrl = _resolveShareUrl(config.apiBaseUrl, card.actionPath);
    final text = shareUrl == null
        ? card.title
        : '$card.title\n\n$shareUrl';
    final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ServiqToast.show(context, message: 'Could not open WhatsApp', tone: ServiqToastTone.warning);
      }
    }
    ref.read(analyticsServiceProvider).trackEvent(
      'home_item_whatsapp_share',
      extras: {'item_id': entry.storageKey, 'surface': _resolvedSurface.analyticsValue},
    );
  }

  String? _debugRecoveryHint(String publicMessage) {
    if (!kDebugMode) {
      return null;
    }

    final bootstrap = ref.read(appBootstrapProvider);
    final apiBaseUrl = bootstrap.config.apiBaseUrl.trim();
    final bootstrapError = bootstrap.initializationError?.trim();
    return [
      if (apiBaseUrl.isEmpty)
        'API_BASE_URL is missing.'
      else
        'API_BASE_URL: $apiBaseUrl',
      if (bootstrapError != null && bootstrapError.isNotEmpty)
        bootstrapError
      else
        publicMessage,
    ].join(' ');
  }

  bool _isSessionRecoveryMessage(String message) {
    final normalized = message.toLowerCase();
    return normalized.contains('session is missing') ||
        normalized.contains('sign in again') ||
        normalized.contains('bearer token') ||
        normalized.contains('expired session');
  }

  Future<void> _callEntry(_WelcomeFeedEntry entry) async {
    HapticFeedback.lightImpact();
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
          child: SingleChildScrollView(
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
                const SizedBox(height: AppSpacing.sm),
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
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.chat_rounded),
                  title: const Text('Share on WhatsApp'),
                  onTap: () async {
                    Navigator.of(context).pop();
                    await _shareViaWhatsApp(entry);
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
                  onTap: () {
                    Navigator.of(context).pop();
                    ReportSheet.show(
                      context: context,
                      targetType: entry.item != null
                          ? ReportTargetType.feedItem
                          : ReportTargetType.provider,
                      targetId: entry.storageKey,
                      targetTitle: entry.sheetTitle,
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Resolves the name used in the greeting. Prefers the verified profile's
  /// full name, then the account display name. Falls back to no name when the
  /// only available value is a raw handle (e.g. "dixit4119") so the greeting
  /// never reads like a username.
  String? _resolveGreetingName(MobileProfileSnapshot? snapshot) {
    if (snapshot == null) {
      return null;
    }

    final fullName = snapshot.profile.fullName.trim();
    if (fullName.isNotEmpty && !_looksLikeHandle(fullName)) {
      return fullName.split(' ').first;
    }

    final displayName = snapshot.displayName.trim();
    if (displayName.isNotEmpty &&
        displayName != 'ServiQ member' &&
        !_looksLikeHandle(displayName)) {
      return displayName.split(' ').first;
    }

    return null;
  }

  /// Handles are single tokens that mix letters and digits (with optional
  /// separators). A real name never looks like this.
  bool _looksLikeHandle(String value) {
    if (!value.contains(' ')) {
      final singleToken = RegExp(r'^[A-Za-z0-9._-]+$').hasMatch(value);
      final hasDigit = RegExp(r'\d').hasMatch(value);
      return singleToken && hasDigit;
    }
    return false;
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
          ? AppErrorMapper.toMessage(allFeedAsync.error ?? 'Unknown error')
          : trustedFeedAsync.hasError
          ? AppErrorMapper.toMessage(trustedFeedAsync.error ?? 'Unknown error')
          : peopleAsync.hasError
          ? AppErrorMapper.toMessage(peopleAsync.error ?? 'Unknown error')
          : 'Unable to load home right now.';
      final needsSignIn = _isSessionRecoveryMessage(message);

      return _WelcomeRecoveryScaffold(
        message: message,
        devHint: _debugRecoveryHint(message),
        actionLabel: needsSignIn ? 'Sign in' : 'Retry',
        bodyTitle: needsSignIn ? 'Sign in to continue' : null,
        bodyMessage: needsSignIn
            ? 'Your account session is needed before Home, People, Work, and Inbox can load live marketplace data.'
            : null,
        onRetry: needsSignIn
            ? () async => context.go(AppRoutes.signIn)
            : _refresh,
        onPostNeed: () => context.push(AppRoutes.createRequest),
        onFindHelp: () => context.go(AppRoutes.people),
        onEarnNearby: () => context.push(AppRoutes.providerOnboarding),
      );
    }

    final model = _buildCachedViewModel(
      allFeedAsync: allFeedAsync,
      trustedFeedAsync: trustedFeedAsync,
      peopleAsync: peopleAsync,
    );

    final profileSnapshot = ref.watch(profileSnapshotProvider).asData?.value;
    final userName = _resolveGreetingName(profileSnapshot);
    final greeting = userName == null
        ? _greetingPrefix()
        : '${_greetingPrefix()}, $userName';
    _resolvedSurface = model.resolveSurface(model.defaultSurface);
    final conversations =
        ref.watch(chatConversationsProvider).asData?.value ??
        const <ChatConversation>[];
    final chatUnread = conversations.fold<int>(
      0,
      (sum, conversation) => sum + conversation.unreadCount,
    );
    final notificationCount =
        ref.watch(unreadNotificationCountProvider);
    final taskSnapshot = ref.watch(taskSnapshotProvider).asData?.value;
    final handoff = ref.watch(onboardingHandoffControllerProvider);
    final welcomeChildren = _welcomeSliverChildren(
      greeting: greeting,
      model: model,
      taskSnapshot: taskSnapshot,
      showIntentPrompt: handoff.storeReady &&
          !handoff.hasChosenIntent &&
          !handoff.intentPromptDismissed,
    );

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _refresh,
          edgeOffset: 12,
          color: AppColors.primary,
          backgroundColor: Theme.of(context).colorScheme.surface,
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
                backgroundColor: Theme.of(context).colorScheme.surface,
                surfaceTintColor: Colors.transparent,
                title: const _WelcomeAppBarTitle(),
                actions: [
                  Padding(
                    padding: const EdgeInsets.only(right: AppSpacing.xs),
                    child: _AppBarActionCluster(
                      notificationCount: notificationCount,
                      chatCount: chatUnread,
                      onSearch: () {
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
                      onNotifications: () =>
                          context.push(AppRoutes.notifications),
                      onChat: () => context.push(AppRoutes.chat),
                    ),
                  ),
                ],
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 300),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => welcomeChildren[index],
                    childCount: welcomeChildren.length,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _welcomeSliverChildren({
    required String greeting,
    required _WelcomeViewModel model,
    required MobileTaskSnapshot? taskSnapshot,
    required bool showIntentPrompt,
  }) {
    return [
      if (showIntentPrompt) ...[
        _WhoAreYouCard(
          onSelect: _selectIntent,
          onDismiss: _dismissIntentPrompt,
        ),
        const SizedBox(height: AppSpacing.md),
      ],
      Padding(
        padding: const EdgeInsets.only(
          top: 8,
          bottom: 4,
        ),
        child: AiPromptBar(
          rotatingPlaceholders: const [
            'Need a plumber?',
            'Need an electrician?',
            'Need a mover?',
            'Need a tutor?',
            'Need a cleaner?',
            'Need a carpenter?',
            'Need an AC repair?',
          ],
          placeholderInterval: const Duration(seconds: 3),
          enableDebounce: true,
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(
          top: AppSpacing.xs,
          bottom: AppSpacing.xs,
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                greeting,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
      _HomeQuickActions(
        isLoaded: taskSnapshot != null,
        needCount: taskSnapshot == null
            ? 0
            : taskSnapshot.items.where((item) {
                return item.role == MobileTaskRole.posted &&
                    (item.status == MobileTaskStatus.active ||
                        item.status == MobileTaskStatus.inProgress);
              }).length,
        workCount: taskSnapshot == null
            ? 0
            : taskSnapshot.items.where((item) {
                return item.role == MobileTaskRole.accepted &&
                    (item.status == MobileTaskStatus.active ||
                        item.status == MobileTaskStatus.inProgress);
              }).length,
        onOpen: () => context.push(AppRoutes.tasks),
        onPostNeed: () => context.push(AppRoutes.createRequest),
        onBrowse: () => context.push(
          Uri(
            path: AppRoutes.search,
            queryParameters: const {'browse': '1'},
          ).toString(),
        ),
      ),
      const SizedBox(height: AppSpacing.lg),
      SectionHeader(
        title: _resolvedSurface.title,
        subtitle: model.liveStatusLabel,
        actionLabel:
            model.feedItemsFor(_resolvedSurface).length > 5 ? 'View all' : null,
        onAction: model.feedItemsFor(_resolvedSurface).length > 5
            ? () => _openAllPosts(model)
            : null,
      ),
      const SizedBox(height: AppSpacing.sm),
      for (final entry in model.entriesFor(_resolvedSurface).take(8).toList().asMap().entries)
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: AppAnimated.fadeSlideIn(
            index: entry.key,
            total: math.min(model.entriesFor(_resolvedSurface).length, 8),
            child: _buildEntryCard(entry.value, model),
          ),
        ),
      if (model.quickCategories.isNotEmpty) ...[
        const SizedBox(height: AppSpacing.lg),
        SectionHeader(
          title: 'Live near you',
          actionLabel: 'Search',
          onAction: () => context.push(AppRoutes.search),
        ),
        const SizedBox(height: AppSpacing.sm),
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
      const SizedBox(height: AppSpacing.lg),
      _ExploreMapCard(onTap: () => context.push(AppRoutes.mapDiscovery)),
      const SizedBox(height: AppSpacing.lg),
      SectionHeader(
        title: 'Recommended',
        actionLabel: model.hasTrustedNetwork
            ? 'People'
            : 'Grow network',
        onAction: () => context.go(AppRoutes.people),
      ),
      const SizedBox(height: AppSpacing.sm),
      if (model.hasTrustedNetwork)
        _TrustedRail(
          items: model.trustedRailItems,
          onOpen: (item) {
            ref
                .read(analyticsServiceProvider)
                .trackEvent(
                  'home_trusted_card_opened',
                  extras: {'item_id': item.id},
                );
            _primaryActionFor(
              item,
              fallback: () => _openFeedItem(item),
            )?.call();
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
      else
        _NetworkPromptCard(
          onPeopleTap: () => context.go(AppRoutes.people),
          onExploreTap: () => context.go(AppRoutes.explore),
        ),
    ];
  }

  Widget _buildEntryCard(_WelcomeFeedEntry entry, _WelcomeViewModel model) {
    switch (entry.type) {
      case _WelcomeFeedEntryType.connection:
        return _TrustedConnectionCard(
          item: entry.item!,
          reason: entry.reason,
          isSaved: _isSavedCard(entry.storageKey, model.savedCardIds),
          primaryLabel: _primaryLabelFor(entry.item!),
          onSave: () => _toggleSave(entry, backendSavedIds: model.savedCardIds),
          onOpen: _primaryActionFor(
            entry.item!,
            fallback: () => _openFeedItem(entry.item!),
          ),
          onMessage: () => _messageFeedItem(entry.item!),
          onMore: () =>
              _showItemActionsSheet(entry, backendSavedIds: model.savedCardIds),
        );
      case _WelcomeFeedEntryType.request:
        return _WelcomeRequestCard(
          item: entry.item!,
          reason: entry.reason,
          isSaved: _isSavedCard(entry.storageKey, model.savedCardIds),
          primaryLabel: _primaryLabelFor(entry.item!),
          secondaryLabel: entry.secondaryLabel,
          onPrimaryTap: _primaryActionFor(
            entry.item!,
            fallback: () => _openFeedItem(entry.item!),
          ),
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
          primaryLabel: entry.item!.isClosed ? null : entry.primaryLabel,
          secondaryLabel: entry.secondaryLabel,
          onPrimaryTap: entry.item!.isClosed
              ? null
              : () => _messageFeedItem(entry.item!),
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
          primaryLabel: entry.primaryLabel ?? '',
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

  /// Status-driven primary action for post cards: matched/accepted opens the
  /// chat thread, open help requests support express-interest, open posts fall
  /// back to the caller's surface action, and closed (cancelled/completed) items
  /// expose no primary CTA.
  VoidCallback? _primaryActionFor(
    MobileFeedItem item, {
    required VoidCallback fallback,
  }) {
    if (item.isClosed) {
      return null;
    }
    if (item.isAccepted || item.statusKey == 'matched') {
      return () => _openItemChat(item);
    }
    if (item.helpRequestId != null) {
      return () => _sendInterest(item);
    }
    return fallback;
  }

  /// Single source of truth for the primary CTA label on welcome feed cards.
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

  void _openItemChat(MobileFeedItem item) {
    if (item.providerId.trim().isEmpty) {
      _showSnack('Messaging opens when a visible profile is attached.');
      return;
    }
    context.push(
      AppRoutes.chatDirect(
        recipientId: item.providerId,
        contextTitle: item.title,
        contextTaskId: item.id,
        contextStatus: item.statusLabel,
        source: 'home_feed_card',
      ),
    );
  }

  void _openAllPosts(_WelcomeViewModel model) {
    ref
        .read(analyticsServiceProvider)
        .trackEvent('home_feed_view_all', extras: {
          'surface': _resolvedSurface.analyticsValue,
        });
    context.push(
      Uri(
        path: AppRoutes.feedAll,
        queryParameters: {'surface': _resolvedSurface.routeValue},
      ).toString(),
    );
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
      AppRoutes.chatDirect(
        recipientId: item.providerId,
        draft: draft,
        contextTitle: item.title,
        contextTaskId: item.id,
        contextStatus: item.statusLabel,
        source: 'home_feed_card',
      ),
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
      AppRoutes.chatDirect(
        recipientId: person.id,
        draft: draft,
        contextTitle: person.name,
        source: 'home_provider_card',
      ),
    );
  }
}

enum _WelcomeSurface {
  forYou(title: 'For you', analyticsValue: 'for_you'),
  trusted(title: 'Trusted', analyticsValue: 'trusted'),
  nearby(title: 'Nearby', analyticsValue: 'nearby'),
  earn(title: 'Earn', analyticsValue: 'earn');

  const _WelcomeSurface({required this.title, required this.analyticsValue});

  final String title;
  final String analyticsValue;

  /// Stable URL value for the "View all" route.
  String get routeValue => analyticsValue;
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

_WelcomeSurface _surfaceFromRouteValue(String value) {
  switch (value.trim().toLowerCase()) {
    case 'trusted':
      return _WelcomeSurface.trusted;
    case 'nearby':
      return _WelcomeSurface.nearby;
    case 'earn':
      return _WelcomeSurface.earn;
    case 'for_you':
      return _WelcomeSurface.forYou;
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
       primaryLabel = null,
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
      primaryLabel = null,
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
  final String? primaryLabel;
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

class _WelcomeViewModel {
  const _WelcomeViewModel({
    required this.quickCategories,
    required this.hotCategoryKeys,
    required this.trustedRailItems,
    required this.forYouEntries,
    required this.trustedEntries,
    required this.nearbyEntries,
    required this.earnEntries,
    required this.forYouItems,
    required this.trustedItems,
    required this.nearbyItems,
    required this.earnItems,
    required this.liveStatusLabel,
    required this.hasTrustedNetwork,
    required this.isFirstRun,
    required this.savedCardIds,
    required this.defaultSurface,
  });

  factory _WelcomeViewModel.build({
    required MobileFeedSnapshot allFeed,
    required MobileFeedSnapshot trustedFeed,
    required MobilePeopleSnapshot people,
    required Set<String> hiddenFeedIds,
    required Set<String> hiddenProviderIds,
  }) {
    final currentUserId = allFeed.currentUserId.isNotEmpty
        ? allFeed.currentUserId
        : trustedFeed.currentUserId;
    final allItems = allFeed.items
        .where((item) =>
            !hiddenFeedIds.contains(item.id) &&
            !item.isClosed &&
            item.providerId != currentUserId)
        .toList();
    final trustedItems = trustedFeed.items
        .where((item) =>
            !hiddenFeedIds.contains(item.id) &&
            !item.isClosed &&
            item.providerId != currentUserId)
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

    final trustedRailItems = rankedTrusted.take(3).toList();
    return _WelcomeViewModel(
      quickCategories: quickCategories,
      hotCategoryKeys: hotCategoryKeys.toSet(),
      trustedRailItems: trustedRailItems,
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
      forYouItems: _dedupFeedItems(rankedTrusted, rankedNearby),
      trustedItems: rankedTrusted,
      nearbyItems: rankedNearby,
      earnItems: rankedEarn,
      liveStatusLabel: _composeLiveStatus(allItems, providers),
      hasTrustedNetwork: rankedTrusted.isNotEmpty,
      isFirstRun:
          rankedTrusted.isEmpty &&
          rankedNearby.isEmpty &&
          rankedProviders.isEmpty,
      savedCardIds: savedCardIds,
      // Always default to "for_you" which mixes trusted + nearby (all) posts,
      // rather than trusting the server's "trusted" suggestion which only shows
      // posts from accepted connections and defeats discovery for new users.
      defaultSurface: _WelcomeSurface.forYou,
    );
  }

  final List<String> quickCategories;
  final Set<String> hotCategoryKeys;
  final List<MobileFeedItem> trustedRailItems;
  final List<_WelcomeFeedEntry> forYouEntries;
  final List<_WelcomeFeedEntry> trustedEntries;
  final List<_WelcomeFeedEntry> nearbyEntries;
  final List<_WelcomeFeedEntry> earnEntries;
  final List<MobileFeedItem> forYouItems;
  final List<MobileFeedItem> trustedItems;
  final List<MobileFeedItem> nearbyItems;
  final List<MobileFeedItem> earnItems;
  final String liveStatusLabel;
  final bool hasTrustedNetwork;
  final bool isFirstRun;
  final Set<String> savedCardIds;
  final _WelcomeSurface defaultSurface;

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

  /// Full (uncapped) post pool for a surface, closed items already excluded.
  List<MobileFeedItem> feedItemsFor(_WelcomeSurface surface) {
    switch (surface) {
      case _WelcomeSurface.forYou:
        return forYouItems;
      case _WelcomeSurface.trusted:
        return trustedItems;
      case _WelcomeSurface.nearby:
        return nearbyItems;
      case _WelcomeSurface.earn:
        return earnItems;
    }
  }
}

/// Merge two ranked item pools, de-duplicating by id (trusted wins).
List<MobileFeedItem> _dedupFeedItems(
  List<MobileFeedItem> primary,
  List<MobileFeedItem> secondary,
) {
  final usedIds = <String>{};
  final result = <MobileFeedItem>[];
  for (final item in [...primary, ...secondary]) {
    if (usedIds.add(item.id)) {
      result.add(item);
    }
  }
  return result;
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

    if (entries.length >= 5) {
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
            'Post a need or explore nearby to personalize your feed.',
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
            'Connect with people to see their posts here first.',
        primaryLabel: 'Manage people',
        secondaryLabel: 'Explore nearby',
        ctaTarget: _CtaTarget.people,
      ),
    ];
  }

  return trusted
      .take(5)
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
            'Try refreshing or browsing a different category.',
      ),
    ];
  }

  final entries = <_WelcomeFeedEntry>[];
  var providerIndex = 0;
  var requestCount = 0;

  for (final item in nearby.take(5)) {
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
            'Complete your provider profile to unlock opportunities.',
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
      .take(5)
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
    return 'From your trusted network';
  }
  if (item.urgent) {
    return 'Urgent request nearby';
  }
  if (item.responseMinutes > 0 && item.responseMinutes <= 20) {
    return 'Fast response expected';
  }
  if (hotCategories.contains(item.category.trim())) {
    return 'Trending in ${item.category} around you right now.';
  }
  if (_extractDistanceKm(item.distanceLabel) <= 5) {
    return 'Very close to you and easier to act on quickly.';
  }
  return 'Recommended for you';
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
    return 'Urgent - respond soon';
  }
  if (item.responseMinutes > 0 && item.responseMinutes <= 25) {
    return 'Quick turnaround expected';
  }
  if (hotCategories.contains(item.category.trim())) {
    return 'Aligned with live demand in ${item.category}.';
  }
  return 'Active nearby request';
}

String _buildProviderReason(
  MobilePersonCard person, {
  required Set<String> hotCategories,
}) {
  if (person.reason.isNotEmpty) {
    return person.reason;
  }
  if (person.isAcceptedConnection) {
    return 'From your trusted network';
  }
  if (person.isOnline) {
    return 'Active now';
  }
  final matchedTag = person.primaryTags
      .where(hotCategories.contains)
      .cast<String?>()
      .firstWhere((value) => value != null, orElse: () => null);
  if (matchedTag != null) {
    return 'Strong fit for $matchedTag demand nearby.';
  }
  if (person.completedJobs > 0) {
    return 'Experienced provider';
  }
  return 'Available provider nearby';
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

IconData _categoryIcon(String category) {
  final value = category.toLowerCase();
  if (value.contains('clean') || value.contains('housekeep')) {
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
  if (value.contains('carpent') || value.contains('wood') || value.contains('furniture')) {
    return Icons.carpenter_rounded;
  }
  if (value.contains('ac') || value.contains('cool') || value.contains('air')) {
    return Icons.ac_unit_rounded;
  }
  if (value.contains('ro') || value.contains('water')) {
    return Icons.water_drop_rounded;
  }
  if (value.contains('mobile') || value.contains('phone')) {
    return Icons.smartphone_rounded;
  }
  if (value.contains('computer') || value.contains('laptop')) {
    return Icons.computer_rounded;
  }
  if (value.contains('tutor') || value.contains('teach') || value.contains('educat')) {
    return Icons.school_rounded;
  }
  if (value.contains('deliver')) {
    return Icons.local_shipping_rounded;
  }
  if (value.contains('tailor') || value.contains('sew')) {
    return Icons.checkroom_rounded;
  }
  if (value.contains('beaut') || value.contains('salon') || value.contains('hair')) {
    return Icons.content_cut_rounded;
  }
  if (value.contains('photo') || value.contains('camera')) {
    return Icons.photo_camera_rounded;
  }
  if (value.contains('cctv') || value.contains('security')) {
    return Icons.videocam_rounded;
  }
  if (value.contains('internet') || value.contains('wifi')) {
    return Icons.wifi_rounded;
  }
  if (value.contains('mechanic') || value.contains('auto') || value.contains('vehicle') || value.contains('bike')) {
    return Icons.two_wheeler_rounded;
  }
  if (value.contains('food') || value.contains('cook') || value.contains('cater')) {
    return Icons.restaurant_rounded;
  }
  if (value.contains('garden') || value.contains('landscap')) {
    return Icons.yard_rounded;
  }
  if (value.contains('real estate') || value.contains('property') || value.contains('rent')) {
    return Icons.apartment_rounded;
  }
  if (value.contains('product') || value.contains('perfume')) {
    return Icons.inventory_2_rounded;
  }
  return Icons.home_repair_service_rounded;
}

bool _setEquals<T>(Set<T> a, Set<T> b) {
  if (identical(a, b)) return true;
  if (a.length != b.length) return false;
  for (final element in a) {
    if (!b.contains(element)) return false;
  }
  return true;
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
