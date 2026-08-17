part of 'welcome_page.dart';

/// Paginated "View all" screen for a home feed surface. Pushed as a full page
/// (outside the shell) so it keeps a back button. Reuses the exact same
/// ranking/dedup/status rules as the home feed via [_WelcomeViewModel.build];
/// cards use the shared [FeedCard] with status-driven primary labels.
class WelcomeFeedAllPage extends ConsumerStatefulWidget {
  WelcomeFeedAllPage({super.key, required String surface})
      : _surface = _surfaceFromRouteValue(surface);

  final _WelcomeSurface _surface;

  @override
  ConsumerState<WelcomeFeedAllPage> createState() =>
      _WelcomeFeedAllPageState();
}

class _WelcomeFeedAllPageState extends ConsumerState<WelcomeFeedAllPage> {
  static const _pageSize = 20;
  static const _emptyStats = MobileFeedStats(
    total: 0,
    urgent: 0,
    demand: 0,
    service: 0,
    product: 0,
  );

  int _visibleCount = _pageSize;
  String? _busyFeedActionId;

  @override
  void didUpdateWidget(covariant WelcomeFeedAllPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget._surface != widget._surface) {
      _visibleCount = _pageSize;
    }
  }

  Future<void> _refresh() async {
    await Future.wait([
      ref.refresh(feedSnapshotProvider(MobileFeedScope.all).future),
      ref.refresh(feedSnapshotProvider(MobileFeedScope.connected).future),
      ref.refresh(peopleSnapshotProvider.future),
    ]);
  }

  void _loadMore() {
    setState(() => _visibleCount += _pageSize);
  }

  void _openItem(MobileFeedItem item) {
    if (item.providerId.trim().isNotEmpty) {
      context.push(AppRoutes.provider(item.providerId));
      return;
    }
    context.go(AppRoutes.explore);
  }

  void _showNoProfileMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Messaging opens when a visible profile is attached.'),
      ),
    );
  }

  void _openChat(MobileFeedItem item) {
    if (item.providerId.trim().isEmpty) {
      _showNoProfileMessage();
      return;
    }
    context.push(
      AppRoutes.chatDirect(
        recipientId: item.providerId,
        contextTitle: item.title,
        contextTaskId: item.id,
        contextStatus: item.statusLabel,
        source: 'home_feed_view_all',
      ),
    );
  }

  void _messageItem(MobileFeedItem item) {
    if (item.providerId.trim().isEmpty) {
      _showNoProfileMessage();
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
        source: 'home_feed_view_all',
      ),
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

  /// Matches the home feed's status rules: closed items get no primary CTA,
  /// matched/accepted items open the chat thread, open help requests support
  /// express-interest, and other open items send a request.
  VoidCallback? _primaryActionFor(MobileFeedItem item) {
    if (item.isClosed) {
      return null;
    }
    if (item.isAccepted || item.statusKey == 'matched') {
      return () => _openChat(item);
    }
    if (item.helpRequestId != null) {
      return () => _sendInterest(item);
    }
    return () => _openItem(item);
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

  _WelcomeViewModel _buildModel({
    required MobileFeedSnapshot allFeed,
    required MobileFeedSnapshot trustedFeed,
    required MobilePeopleSnapshot people,
  }) {
    return _WelcomeViewModel.build(
      allFeed: allFeed,
      trustedFeed: trustedFeed,
      people: people,
      hiddenFeedIds: const {},
      hiddenProviderIds: const {},
    );
  }

  @override
  Widget build(BuildContext context) {
    final allFeedAsync =
        ref.watch(feedSnapshotProvider(MobileFeedScope.all));
    final trustedFeedAsync =
        ref.watch(feedSnapshotProvider(MobileFeedScope.connected));
    final peopleAsync = ref.watch(peopleSnapshotProvider);

    final allFeed = allFeedAsync.asData?.value;
    final trustedFeed = trustedFeedAsync.asData?.value;
    final people = peopleAsync.asData?.value;
    final hasAnyData =
        allFeed != null || trustedFeed != null || people != null;

    _WelcomeSurface resolvedSurface = widget._surface;
    if (hasAnyData) {
      resolvedSurface = _buildModel(
        allFeed:
            allFeed ??
            const MobileFeedSnapshot(
              currentUserId: '',
              stats: _emptyStats,
              items: [],
            ),
        trustedFeed:
            trustedFeed ??
            const MobileFeedSnapshot(
              currentUserId: '',
              stats: _emptyStats,
              items: [],
            ),
        people:
            people ??
            const MobilePeopleSnapshot(currentUserId: '', people: []),
      ).resolveSurface(widget._surface);
    }

    Widget body;
    if (!hasAnyData &&
        (allFeedAsync.isLoading ||
            trustedFeedAsync.isLoading ||
            peopleAsync.isLoading)) {
      body = const Center(child: CircularProgressIndicator());
    } else if (!hasAnyData && (allFeedAsync.hasError ||
        trustedFeedAsync.hasError ||
        peopleAsync.hasError)) {
      final message = allFeedAsync.hasError
          ? AppErrorMapper.toMessage(allFeedAsync.error ?? 'Unknown error')
          : trustedFeedAsync.hasError
          ? AppErrorMapper.toMessage(trustedFeedAsync.error ?? 'Unknown error')
          : AppErrorMapper.toMessage(peopleAsync.error ?? 'Unknown error');
      body = Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: ErrorStateView(
          title: 'Unable to load ${resolvedSurface.title.toLowerCase()}',
          message: message,
          onRetry: _refresh,
        ),
      );
    } else {
      final model = _buildModel(
        allFeed:
            allFeed ??
            const MobileFeedSnapshot(
              currentUserId: '',
              stats: _emptyStats,
              items: [],
            ),
        trustedFeed:
            trustedFeed ??
            const MobileFeedSnapshot(
              currentUserId: '',
              stats: _emptyStats,
              items: [],
            ),
        people:
            people ??
            const MobilePeopleSnapshot(currentUserId: '', people: []),
      );
      final items = model.feedItemsFor(resolvedSurface);
      final visible = items.take(_visibleCount).toList();

      body = items.isEmpty
          ? Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: EmptyStateView(
                title: 'Nothing here yet',
                message:
                    'No ${resolvedSurface.title.toLowerCase()} posts are '
                    'available right now. Pull to refresh.',
              ),
            )
          : NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification.metrics.pixels >=
                    notification.metrics.maxScrollExtent - 400) {
                  _loadMore();
                }
                return false;
              },
              child: RefreshIndicator(
                onRefresh: _refresh,
                edgeOffset: 12,
                color: AppColors.primary,
                backgroundColor: Theme.of(context).colorScheme.surface,
                child: ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics(),
                  ),
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.sm,
                    AppSpacing.md,
                    AppSpacing.xl,
                  ),
                  itemCount: visible.length,
                  itemBuilder: (context, index) {
                    final item = visible[index];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: FeedCard(
                        item: item,
                        primaryLabel: _primaryLabelFor(item),
                        onPrimaryTap: _primaryActionFor(item),
                        onSecondaryTap: () => _messageItem(item),
                      ),
                    );
                  },
                ),
              ),
            );
    }

    return ServiqScaffold(
      appBar: ServiqTopBar(
        title: resolvedSurface.title,
        subtitle: hasAnyData ? 'All ${resolvedSurface.title.toLowerCase()} posts' : null,
      ),
      body: body,
    );
  }
}

class _WelcomeAppBarTitle extends StatelessWidget {
  const _WelcomeAppBarTitle();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: AppGradients.premiumDark,
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: const Text(
            'S',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text('ServiQ', style: Theme.of(context).textTheme.titleLarge),
      ],
    );
  }
}

class _AppBarActionCluster extends StatelessWidget {
  const _AppBarActionCluster({
    required this.onSearch,
    required this.onNotifications,
    required this.onChat,
    this.notificationCount = 0,
    this.chatCount = 0,
  });

  final VoidCallback onSearch;
  final VoidCallback onNotifications;
  final VoidCallback onChat;
  final int notificationCount;
  final int chatCount;

  @override
  Widget build(BuildContext context) {
    final divider = Container(
      width: 1,
      height: 22,
      color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.35),
    );
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(
          context,
        ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.45),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ClusterAction(
            icon: Icons.search_rounded,
            tooltip: 'Search',
            onPressed: onSearch,
          ),
          divider,
          _ClusterAction(
            icon: Icons.notifications_none_rounded,
            tooltip: 'Notifications',
            onPressed: onNotifications,
            badgeCount: notificationCount,
          ),
          divider,
          _ClusterAction(
            icon: Icons.chat_bubble_outline_rounded,
            tooltip: 'Chat',
            onPressed: onChat,
            badgeCount: chatCount,
          ),
        ],
      ),
    );
  }
}

class _ClusterAction extends StatelessWidget {
  const _ClusterAction({
    required this.icon,
    required this.onPressed,
    required this.tooltip,
    this.badgeCount = 0,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          tooltip: tooltip,
          onPressed: onPressed,
          icon: Icon(icon, size: 20),
          constraints: const BoxConstraints(minWidth: 42, minHeight: 42),
          padding: EdgeInsets.zero,
        ),
        if (badgeCount > 0)
          Positioned(
            top: 2,
            right: 1,
            child: CountBadge(count: badgeCount),
          ),
      ],
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
                padding: const EdgeInsets.only(right: AppSpacing.xs),
                child: ActionChip(
                  avatar: Icon(
                    _categoryIcon(category),
                    size: 16,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                  label: Text(category),
                  visualDensity: VisualDensity.standard,
                  materialTapTargetSize: MaterialTapTargetSize.padded,
                  onPressed: () => onPressed(category),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  side: BorderSide(
                    color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.4),
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

/// Map shortcut on the home feed. Single-purpose card: "Explore nearby on a map".
class _ExploreMapCard extends StatelessWidget {
  const _ExploreMapCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Material(
      color: colorScheme.surface,
      borderRadius: BorderRadius.circular(AppRadii.xl),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(color: colorScheme.outlineVariant),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: AppGradients.explore,
                  borderRadius: BorderRadius.circular(AppRadii.lg),
                ),
                child: const Icon(
                  Icons.map_outlined,
                  size: AppIconSize.md,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Explore on map',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    Text(
                      'Find providers near you',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: AppIconSize.md,
                color: colorScheme.onSurface.withValues(alpha: 0.45),
              ),
            ],
          ),
        ),
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
        final cardWidth = math.min(280.0, constraints.maxWidth * 0.78);
        final gap = AppSpacing.sm.toDouble();
        return SizedBox(
          height: 280,
          child: PageView.builder(
            controller: PageController(viewportFraction: (cardWidth + gap) / constraints.maxWidth),
            itemCount: items.length,
            padEnds: false,
            itemBuilder: (context, index) {
              final item = items[index];
              return Padding(
                padding: EdgeInsets.only(
                  left: index == 0 ? AppSpacing.md : gap / 2,
                  right: index == items.length - 1 ? AppSpacing.md : gap / 2,
                ),
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
    return ServiqSurface(
      variant: ServiqSurfaceVariant.glass,
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (item.hasPreviewImage) ...[
            _CardPreviewMedia(
              imageUrl: item.thumbnailUrl,
              count: item.mediaCount,
              title: item.category,
              height: 56,
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: AppSpacing.xxs,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.accentSoft,
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                      child: Text(
                        item.sourceTypeLabel,
                        style: Theme.of(context)
                            .textTheme
                            .labelMedium
                            ?.copyWith(color: AppColors.accent),
                      ),
                    ),
                    if (item.mutualConnectionsCount > 0)
                      AppPill(
                        label:
                            '${item.mutualConnectionsCount} mutual${item.mutualConnectionsCount == 1 ? '' : 's'}',
                        backgroundColor: AppColors.surfaceAlt,
                        foregroundColor: Theme.of(context).colorScheme.onSurface,
                      ),
                    if (item.urgent)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: AppSpacing.xxs,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.dangerSoft,
                          borderRadius: BorderRadius.circular(AppRadii.md),
                        ),
                        child: Text(
                          'Urgent',
                          style: Theme.of(context)
                              .textTheme
                              .labelMedium
                              ?.copyWith(color: AppColors.danger),
                        ),
                      ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onMore,
                icon: const Icon(Icons.more_horiz_rounded),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const Spacer(),
          Text(
            item.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.xxs),
          Row(
            children: [
              AppAvatar(
                name: item.creatorName,
                avatarUrl: item.avatarUrl,
                radius: 10,
                showVerifiedBadge: item.isVerified,
              ),
              const SizedBox(width: AppSpacing.xxs),
              Expanded(
                child: Text(
                  '${item.creatorName} • ${item.distanceLabel}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              if (!item.isClosed) ...[
                Expanded(
                  child: PrimaryButton(
                    label: _railPrimaryLabel(item),
                    onPressed: onOpen,
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
              ],
              Tooltip(
                message: 'Message',
                child: IconButton.outlined(
                  onPressed: onMessage,
                  icon: const Icon(Icons.chat_bubble_outline_rounded),
                  style: IconButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadii.lg),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _railPrimaryLabel(MobileFeedItem item) {
    final label = statusDrivenPrimaryLabel(item);
    if (label == 'Send Request') {
      if (item.helpRequestId != null) {
        return item.viewerHasExpressedInterest ? 'Withdraw' : 'Express';
      }
      return 'Send';
    }
    return label ?? 'Open';
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
    return ServiqSurface(
      variant: ServiqSurfaceVariant.glass,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: AppGradients.premiumAccent,
                  borderRadius: BorderRadius.circular(AppRadii.lg),
                ),
                child: const Icon(Icons.people_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Build your network',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Connect with trusted people to see their posts first. Your network shapes your feed.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: PrimaryButton(
                  label: 'Manage people',
                  onPressed: onPeopleTap,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: SecondaryButton(
                  label: 'Explore',
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

class _WelcomeRequestCard extends StatelessWidget {
  const _WelcomeRequestCard({
    required this.item,
    required this.reason,
    required this.isSaved,
    required this.primaryLabel,
    required this.secondaryLabel,
    required this.onPrimaryTap,
    required this.onSecondaryTap,
    required this.onSaveTap,
    required this.onMoreTap,
  });

  final MobileFeedItem item;
  final String reason;
  final bool isSaved;
  final String? primaryLabel;
  final String secondaryLabel;
  final VoidCallback? onPrimaryTap;
  final VoidCallback onSecondaryTap;
  final VoidCallback onSaveTap;
  final VoidCallback onMoreTap;

  @override
  Widget build(BuildContext context) {
    return FeedCard(
      item: item,
      onPrimaryTap: onPrimaryTap,
      onSecondaryTap: onSecondaryTap,
      primaryLabel: primaryLabel,
      secondaryLabel: secondaryLabel,
      secondaryIcon: secondaryLabel.toLowerCase().contains('save')
          ? Icons.bookmark_border_rounded
          : Icons.chat_bubble_outline_rounded,
      reason: reason,
      isSaved: isSaved,
      onSaveTap: onSaveTap,
      onMoreTap: onMoreTap,
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
    this.primaryLabel,
  });

  final MobileFeedItem item;
  final String reason;
  final bool isSaved;
  final VoidCallback? onOpen;
  final VoidCallback onMessage;
  final VoidCallback onSave;
  final VoidCallback onMore;
  final String? primaryLabel;

  @override
  Widget build(BuildContext context) {
    return _WelcomeRequestCard(
      item: item,
      reason: reason,
      isSaved: isSaved,
      primaryLabel: primaryLabel,
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
    return ProviderCard(
      person: person,
      reason: reason,
      isSaved: isSaved,
      onSave: onSaveTap,
      onMore: onMoreTap,
      onMessage: onMessageTap,
      onOpenProfile: onOpenTap,
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
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadii.lg),
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
            left: AppSpacing.sm,
            right: AppSpacing.sm,
            bottom: AppSpacing.sm,
            child: Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: AppSpacing.xs,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.85),
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
                  ),
                ),
                if (count > 1) ...[
                  const SizedBox(width: AppSpacing.xs),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: AppSpacing.xs,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(AppRadii.md),
                        ),
                        child: Text(
                          '$count photos',
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      ),
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
      color: AppColors.surfaceAlt,
      alignment: Alignment.center,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.photo_library_outlined,
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
          ),
          const SizedBox(height: AppSpacing.xs),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
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
    return ServiqSurface(
      variant: ServiqSurfaceVariant.glass,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: AppGradients.premiumAccent,
                  borderRadius: BorderRadius.circular(AppRadii.lg),
                ),
                child: const Icon(Icons.lightbulb_outline_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(title, style: Theme.of(context).textTheme.titleLarge),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: PrimaryButton(
                  label: primaryLabel,
                  onPressed: onPrimaryTap,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
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

class _WelcomeRecoveryScaffold extends StatelessWidget {
  const _WelcomeRecoveryScaffold({
    required this.message,
    required this.onRetry,
    required this.onPostNeed,
    required this.onFindHelp,
    required this.onEarnNearby,
    this.actionLabel = 'Retry',
    this.bodyTitle,
    this.bodyMessage,
    this.devHint,
  });

  final String message;
  final Future<void> Function() onRetry;
  final VoidCallback onPostNeed;
  final VoidCallback onFindHelp;
  final VoidCallback onEarnNearby;
  final String actionLabel;
  final String? bodyTitle;
  final String? bodyMessage;
  final String? devHint;

  @override
  Widget build(BuildContext context) {
    final debugMessage = devHint?.trim();

    return Scaffold(
      appBar: AppBar(
        title: const _WelcomeAppBarTitle(),
      ),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: onRetry,
          color: AppColors.accent,
          backgroundColor: AppColors.surface,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, 120),
            children: [
              ServiqSurface(
                padding: EdgeInsets.zero,
                variant: ServiqSurfaceVariant.raised,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: Theme.of(context).extension<ServiqThemeTokens>()?.exploreGradient ?? ServiqThemeTokens.light.exploreGradient,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: AppColors.dangerSoft,
                            borderRadius: BorderRadius.circular(AppRadii.xl),
                          ),
                          child: Icon(
                            Icons.wifi_tethering_error_rounded,
                            color: AppColors.danger,
                            size: 24,
                          ),
                        ),
                        const SizedBox(height: 18),
                        Text(
                          'ServiQ is reconnecting',
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'We could not refresh Home just now. You can retry, or keep moving with the main marketplace actions below.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 14),
                        ServiqRecoveryBanner(
                          tone: ServiqRecoveryTone.neutral,
                          icon: Icons.cloud_sync_outlined,
                          message: message,
                          actionLabel: actionLabel,
                          onAction: () => onRetry(),
                        ),
                        if (debugMessage != null && debugMessage.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(AppSpacing.sm),
                            decoration: BoxDecoration(
                              color: AppColors.surface.withValues(alpha: 0.72),
                              borderRadius: BorderRadius.circular(AppRadii.lg),
                              border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.3)),
                            ),
                            child: Text(
                              'Debug hint: $debugMessage',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              ServiqSurface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      bodyTitle ?? 'While we reconnect',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      bodyMessage ??
                          'These actions are available as soon as live ServiQ data responds again.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    PrimaryButton(
                      label: 'Post a Need',
                      icon: const Icon(Icons.add_rounded),
                      onPressed: onPostNeed,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: SecondaryButton(
                            label: 'Find help',
                            icon: const Icon(Icons.people_outline_rounded),
                            onPressed: onFindHelp,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: SecondaryButton(
                            label: 'Earn nearby',
                            icon: const Icon(Icons.workspace_premium_outlined),
                            onPressed: onEarnNearby,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const _RecoveryFallbackSkeleton(),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecoveryFallbackSkeleton extends StatelessWidget {
  const _RecoveryFallbackSkeleton();

  @override
  Widget build(BuildContext context) {
    return ServiqSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          LoadingShimmer(height: 16, width: 140),
          SizedBox(height: 14),
          LoadingShimmer(height: 118),
          SizedBox(height: AppSpacing.sm),
          LoadingShimmer(height: 16, width: 240),
          SizedBox(height: AppSpacing.xs),
          LoadingShimmer(height: 14),
        ],
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
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, 120),
      children: [
        // AI prompt bar skeleton
        Container(
          height: 52,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Theme.of(context).colorScheme.surface,
                AppColors.primarySoft.withValues(alpha: 0.3),
              ],
            ),
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(
              color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.3),
            ),
          ),
          child: const Row(
            children: [
              SizedBox(width: AppSpacing.md),
              LoadingShimmer(height: 18, width: 18, borderRadius: 9),
              SizedBox(width: AppSpacing.sm),
              LoadingShimmer(height: 16, width: 180),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        // Greeting skeleton
        const LoadingShimmer(height: 28, width: 220),
        const SizedBox(height: AppSpacing.sm),
        // Quick actions skeleton
        Row(
          children: [
            Expanded(
              child: _QuickActionSkeleton(),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _QuickActionSkeleton(),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        // Feed section header skeleton
        const LoadingShimmer(height: 18, width: 140),
        const SizedBox(height: AppSpacing.sm),
        // Feed card skeletons with image placeholders
        ...List.generate(
          3,
          (index) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: _FeedCardSkeleton(),
          ),
        ),
      ],
    );
  }
}

class _QuickActionSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 88),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.3),
        ),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LoadingShimmer(height: 34, width: 34, borderRadius: 8),
          SizedBox(height: AppSpacing.sm),
          LoadingShimmer(height: 22, width: 36),
          SizedBox(height: AppSpacing.xs),
          LoadingShimmer(height: 12, width: 64),
        ],
      ),
    );
  }
}

class _FeedCardSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(
            color: AppColors.warm.withValues(alpha: 0.3),
            width: 3,
          ),
        ),
      ),
      child: ServiqSurface(
        variant: ServiqSurfaceVariant.glass,
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image placeholder with category gradient feel
            LoadingShimmer(height: 96, borderRadius: 12),
            const SizedBox(height: AppSpacing.sm),
            // Pills row
            const Row(
              children: [
                LoadingShimmer(height: 22, width: 72, borderRadius: 11),
                SizedBox(width: AppSpacing.xs),
                LoadingShimmer(height: 22, width: 56, borderRadius: 11),
                SizedBox(width: AppSpacing.xs),
                LoadingShimmer(height: 22, width: 64, borderRadius: 11),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            // Title
            const LoadingShimmer(height: 18, width: 240),
            const SizedBox(height: AppSpacing.xxs),
            // Description
            const LoadingShimmer(height: 14, width: 180),
            const SizedBox(height: AppSpacing.sm),
            // Avatar + name row
            const Row(
              children: [
                LoadingShimmer(height: 28, width: 28, borderRadius: 14),
                SizedBox(width: AppSpacing.xs),
                LoadingShimmer(height: 14, width: 100),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            // Trust row
            const Row(
              children: [
                LoadingShimmer(height: 14, width: 60),
                SizedBox(width: AppSpacing.sm),
                LoadingShimmer(height: 14, width: 80),
                SizedBox(width: AppSpacing.sm),
                LoadingShimmer(height: 14, width: 70),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeQuickActions extends StatelessWidget {
  const _HomeQuickActions({
    required this.isLoaded,
    required this.needCount,
    required this.workCount,
    required this.onOpen,
    required this.onPostNeed,
    required this.onBrowse,
  });

  final bool isLoaded;
  final int needCount;
  final int workCount;
  final VoidCallback onOpen;
  final VoidCallback onPostNeed;
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isEmpty = isLoaded && needCount == 0 && workCount == 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: l10n.homeQuickActions,
          actionLabel: l10n.viewAll,
          onAction: onOpen,
        ),
        const SizedBox(height: AppSpacing.xs),
        if (isEmpty)
          SectionCard(
            child: _WorkEmptyState(onPostNeed: onPostNeed, onBrowse: onBrowse),
          )
        else
          SectionCard(
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _WorkHomeTile(
                        icon: Icons.shopping_bag_outlined,
                        label: l10n.myNeeds,
                        count: needCount,
                        onTap: onOpen,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: _WorkHomeTile(
                        icon: Icons.work_outline_rounded,
                        label: l10n.myWork,
                        count: workCount,
                        onTap: onOpen,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: PrimaryButton(
                        label: l10n.postNeed,
                        icon: const Icon(Icons.add_rounded, size: 18),
                        onPressed: onPostNeed,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: SecondaryButton(
                        label: l10n.browseNearby,
                        icon: const Icon(Icons.explore_rounded, size: 18),
                        onPressed: onBrowse,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _WorkEmptyState extends StatelessWidget {
  const _WorkEmptyState({
    required this.onPostNeed,
    required this.onBrowse,
  });

  final VoidCallback onPostNeed;
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppRadii.lg),
          ),
          child: const Icon(
            Icons.rocket_launch_outlined,
            color: AppColors.primary,
            size: 24,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          l10n.nothingInMotion,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          l10n.nothingInMotionSubtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: muted),
        ),
        const SizedBox(height: AppSpacing.md),
        PrimaryButton(
          label: l10n.postYourFirstNeed,
          icon: const Icon(Icons.add_rounded, size: 18),
          onPressed: onPostNeed,
        ),
        const SizedBox(height: AppSpacing.xs),
        Center(
          child: TextButton(
            onPressed: onBrowse,
            child: Text(l10n.browseMyTasks),
          ),
        ),
      ],
    );
  }
}

class _WorkHomeTile extends StatelessWidget {
  const _WorkHomeTile({
    required this.icon,
    required this.label,
    required this.count,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isActive = count > 0;
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          constraints: const BoxConstraints(minHeight: 88),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            gradient: isActive
                ? LinearGradient(
                    colors: [
                      AppColors.accentSoft.withValues(alpha: 0.6),
                      AppColors.primarySoft.withValues(alpha: 0.4),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            color: isActive
                ? null
                : Theme.of(context)
                    .colorScheme
                    .surfaceContainerHighest
                    .withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(
              color: isActive
                  ? AppColors.accent.withValues(alpha: 0.2)
                  : Theme.of(context).colorScheme.outline,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  gradient: isActive
                      ? const LinearGradient(
                          colors: [AppColors.accent, AppColors.accentDeep],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  color: isActive
                      ? null
                      : Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Icon(
                  icon,
                  size: 17,
                  color: isActive ? Colors.white : muted,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                '$count',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                  height: 1,
                  color: isActive
                      ? AppColors.accent
                      : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.6),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WhoAreYouCard extends StatelessWidget {
  const _WhoAreYouCard({
    required this.onSelect,
    required this.onDismiss,
  });

  final Future<void> Function(MobileOnboardingIntent intent) onSelect;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final options = [
      (
        intent: MobileOnboardingIntent.findHelp,
        icon: Icons.manage_search_rounded,
        title: l10n.intentFindHelp,
        subtitle: l10n.intentFindHelpSubtitle,
      ),
      (
        intent: MobileOnboardingIntent.earnNearby,
        icon: Icons.work_outline_rounded,
        title: l10n.intentEarnNearby,
        subtitle: l10n.intentEarnNearbySubtitle,
      ),
      (
        intent: MobileOnboardingIntent.businessSetup,
        icon: Icons.storefront_outlined,
        title: l10n.intentBusinessSetup,
        subtitle: l10n.intentBusinessSetupSubtitle,
      ),
    ];

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: AppGradients.premiumAccent,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: const Icon(
                  Icons.swipe_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.whoAreYouTitle,
                      style: Theme.of(
                        context,
                      ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      l10n.whoAreYouSubtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(
                          context,
                        ).colorScheme.onSurface.withValues(alpha: 0.6),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          for (final option in options) ...[
            _WhoAreYouOptionRow(
              icon: option.icon,
              title: option.title,
              subtitle: option.subtitle,
              onTap: () => onSelect(option.intent),
            ),
            if (option != options.last) const SizedBox(height: AppSpacing.xs),
          ],
          const SizedBox(height: AppSpacing.xs),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: onDismiss,
              child: Text(l10n.notNow),
            ),
          ),
        ],
      ),
    );
  }
}

class _WhoAreYouOptionRow extends StatelessWidget {
  const _WhoAreYouOptionRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 10),
        decoration: BoxDecoration(
          color: Theme.of(
            context,
          ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(
            color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.5),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.primary),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(
                        context,
                      ).colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
            ),
          ],
        ),
      ),
    );
  }
}
