part of 'welcome_page.dart';

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
      padding: const EdgeInsets.only(right: AppSpacing.xxs),
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.5)),
        ),
        child: IconButton(
          tooltip: tooltip,
          onPressed: onPressed,
          icon: Icon(icon, size: 20),
          constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
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
                padding: const EdgeInsets.only(right: AppSpacing.xs),
                child: ActionChip(
                  avatar: Icon(
                    _categoryIcon(category),
                    size: 16,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                  label: Text(category),
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
        final width = math.min(300.0, constraints.maxWidth * 0.82);
        return SizedBox(
          height: 280,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (context, index) => const SizedBox(width: AppSpacing.sm),
            padding: const EdgeInsets.only(right: AppSpacing.md),
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
          Text(
            '${item.creatorName} • ${item.distanceLabel} • ${item.timeLabel}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: PrimaryButton(label: 'Open', onPressed: onOpen),
              ),
              const SizedBox(width: AppSpacing.xs),
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
        ServiqSurface(
          padding: EdgeInsets.zero,
          variant: ServiqSurfaceVariant.raised,
          child: Container(
            decoration: BoxDecoration(
              gradient: Theme.of(context).extension<ServiqThemeTokens>()?.heroGradient ?? ServiqThemeTokens.light.heroGradient,
            ),
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LoadingShimmer(height: 18, width: 104),
                SizedBox(height: AppSpacing.md),
                LoadingShimmer(height: 28, width: 260),
                SizedBox(height: AppSpacing.xs),
                LoadingShimmer(height: 14),
                SizedBox(height: 6),
                LoadingShimmer(height: 14, width: 220),
                SizedBox(height: 18),
                LoadingShimmer(height: 48),
                SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(child: LoadingShimmer(height: 78)),
                    SizedBox(width: AppSpacing.xs),
                    Expanded(child: LoadingShimmer(height: 78)),
                  ],
                ),
                SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    Expanded(child: LoadingShimmer(height: 78)),
                    SizedBox(width: AppSpacing.xs),
                    Expanded(child: LoadingShimmer(height: 78)),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: List.generate(
            4,
            (index) => SizedBox(
              width: 164,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(AppRadii.xl),
                  border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.4)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    LoadingShimmer(height: 34, width: 34),
                    SizedBox(height: AppSpacing.sm),
                    LoadingShimmer(height: 18, width: 80),
                    SizedBox(height: AppSpacing.xs),
                    LoadingShimmer(height: 12),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        ...List.generate(
          3,
          (index) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: ServiqSurface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  LoadingShimmer(height: 18, width: 180),
                  SizedBox(height: AppSpacing.sm),
                  LoadingShimmer(height: 22, width: 260),
                  SizedBox(height: AppSpacing.xs),
                  LoadingShimmer(height: 14),
                  SizedBox(height: 6),
                  LoadingShimmer(height: 14, width: 220),
                  SizedBox(height: AppSpacing.md),
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
