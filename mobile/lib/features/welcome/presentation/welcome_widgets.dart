part of 'welcome_page.dart';

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
    required this.activeTaskCount,
    required this.unreadChatCount,
    required this.onInboxTap,
    required this.onTasksTap,
    required this.onFindPeopleTap,
    required this.onPrimaryTap,
  });

  final String greeting;
  final int activeTaskCount;
  final int unreadChatCount;
  final VoidCallback onInboxTap;
  final VoidCallback onTasksTap;
  final VoidCallback onFindPeopleTap;
  final VoidCallback onPrimaryTap;

  @override
  Widget build(BuildContext context) {
    final nextAction = unreadChatCount > 0
        ? (
            label: 'Open Inbox',
            icon: Icons.chat_bubble_outline_rounded,
            tap: onInboxTap,
          )
        : activeTaskCount > 0
        ? (
            label: 'Open Work',
            icon: Icons.assignment_turned_in_outlined,
            tap: onTasksTap,
          )
        : (label: 'Post Need', icon: Icons.add_rounded, tap: onPrimaryTap);
    final compactActions = <({String label, IconData icon, VoidCallback tap})>[
      if (nextAction.label != 'Post Need')
        (label: 'Post Need', icon: Icons.add_rounded, tap: onPrimaryTap),
      (
        label: 'Find People',
        icon: Icons.person_search_outlined,
        tap: onFindPeopleTap,
      ),
      if (nextAction.label != 'Open Work')
        (
          label: 'Work',
          icon: Icons.assignment_turned_in_outlined,
          tap: onTasksTap,
        ),
      if (nextAction.label != 'Open Inbox')
        (
          label: 'Inbox',
          icon: Icons.chat_bubble_outline_rounded,
          tap: onInboxTap,
        ),
    ].take(3).toList();
    return SectionCard(
      variant: ServiqSurfaceVariant.raised,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(greeting, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 6),
          Text(
            'What should I do now?',
            style: Theme.of(context)
                .textTheme
                .bodyLarge
                ?.copyWith(color: AppColors.inkSubtle),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: nextAction.tap,
              icon: Icon(nextAction.icon),
              label: Text(nextAction.label),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: compactActions
                .map(
                  (action) => Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        right: action != compactActions.last ? 8 : 0,
                      ),
                      child: _CompactActionButton(
                        icon: action.icon,
                        label: action.label,
                        onTap: action.tap,
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}

class _CompactActionButton extends StatelessWidget {
  const _CompactActionButton({
    required this.icon,
    required this.label,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 18),
        label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
        ),
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
          height: 264,
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
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(12),
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
            const SizedBox(height: 6),
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
                        color: AppColors.primarySoft,
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                      child: Text(
                        item.sourceTypeLabel,
                        style: Theme.of(context)
                            .textTheme
                            .labelMedium
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
                          style: Theme.of(context)
                              .textTheme
                              .labelMedium
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
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          Text(
            '${item.creatorName} • ${item.distanceLabel} • ${item.timeLabel}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: PrimaryButton(label: 'Open', onPressed: onOpen),
              ),
              const SizedBox(width: 8),
              Tooltip(
                message: 'Message',
                child: IconButton.outlined(
                  onPressed: onMessage,
                  icon: const Icon(Icons.chat_bubble_outline_rounded),
                ),
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
  final String primaryLabel;
  final String secondaryLabel;
  final VoidCallback onPrimaryTap;
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
        style: Theme.of(context)
            .textTheme
            .labelMedium
            ?.copyWith(color: foregroundColor),
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
      appBar: AppBar(title: const Text('ServiQ')),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: onRetry,
          color: AppColors.primary,
          backgroundColor: AppColors.surface,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
            children: [
              SectionCard(
                padding: EdgeInsets.zero,
                variant: ServiqSurfaceVariant.raised,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: ServiqThemeTokens.light.exploreGradient,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: AppColors.dangerSoft,
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: const Icon(
                            Icons.wifi_tethering_error_rounded,
                            color: AppColors.danger,
                          ),
                        ),
                        const SizedBox(height: 18),
                        Text(
                          'ServiQ is reconnecting',
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        const SizedBox(height: 8),
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
                        if (debugMessage != null &&
                            debugMessage.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surface.withValues(alpha: 0.72),
                              borderRadius: BorderRadius.circular(AppRadii.md),
                              border: Border.all(color: AppColors.border),
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
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      bodyTitle ?? 'While we reconnect',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      bodyMessage ??
                          'These actions are available as soon as live ServiQ data responds again.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    PrimaryButton(
                      label: 'Post a Need',
                      icon: const Icon(Icons.add_rounded),
                      onPressed: onPostNeed,
                    ),
                    const SizedBox(height: 10),
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
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          LoadingShimmer(height: 16, width: 140),
          SizedBox(height: 14),
          LoadingShimmer(height: 118),
          SizedBox(height: 12),
          LoadingShimmer(height: 16, width: 240),
          SizedBox(height: 8),
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
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      children: [
        SectionCard(
          padding: EdgeInsets.zero,
          variant: ServiqSurfaceVariant.raised,
          child: Container(
            decoration: BoxDecoration(
              gradient: ServiqThemeTokens.light.heroGradient,
            ),
            padding: const EdgeInsets.all(18),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LoadingShimmer(height: 18, width: 104),
                SizedBox(height: 16),
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
                    Expanded(child: LoadingShimmer(height: 78)),
                    SizedBox(width: 8),
                    Expanded(child: LoadingShimmer(height: 78)),
                  ],
                ),
                SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: LoadingShimmer(height: 78)),
                    SizedBox(width: 8),
                    Expanded(child: LoadingShimmer(height: 78)),
                  ],
                ),
              ],
            ),
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
