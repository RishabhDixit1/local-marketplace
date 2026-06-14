import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../features/blocking/data/block_repository_provider.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../features/feed/data/feed_repository.dart';
import '../../../features/feed/domain/feed_snapshot.dart';
import '../../../features/people/data/people_repository.dart';
import '../../../features/people/domain/people_snapshot.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/feed_card.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/premium_primitives.dart';
import '../../../shared/components/profile_avatar_tile.dart';
import '../../../shared/components/section_header.dart';
import '../../../shared/components/sticky_bottom_cta.dart';
import '../../../shared/components/trust_badge.dart';
import '../../profile/data/profile_repository.dart';
import '../../reviews/data/review_repository.dart';
import '../../reviews/presentation/review_card.dart';

class ProviderProfilePage extends ConsumerWidget {
  const ProviderProfilePage({super.key, required this.providerId});

  final String providerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final peopleAsync = ref.watch(peopleSnapshotProvider);
    final feedAsync = ref.watch(feedSnapshotProvider(MobileFeedScope.all));
    final providerForCta = _findProvider(peopleAsync.asData?.value);
    final primaryOffer = _firstStoreOffer(feedAsync.asData?.value);

    return Scaffold(
      extendBody: true,
      appBar: AppBar(
        title: const Text('Provider profile'),
        actions: [
          IconButton(
            tooltip: 'Copy provider',
            onPressed: providerForCta == null
                ? null
                : () => _copyProvider(context, providerForCta, primaryOffer),
            icon: const Icon(Icons.ios_share_rounded),
          ),
        ],
      ),
      bottomNavigationBar: providerForCta == null
          ? null
          : StickyBottomCTA(
              title: providerForCta.priceLabel,
              subtitle:
                  '${providerForCta.activityLabel} · ${providerForCta.locationLabel}',
              primaryLabel: _primaryOfferLabel(primaryOffer),
              onPrimary: () {
                HapticFeedback.mediumImpact();
                _openPrimaryOffer(context, primaryOffer);
              },
              secondaryLabel: 'Message',
              onSecondary: () {
                HapticFeedback.selectionClick();
                _messageProvider(context, providerForCta);
              },
            ),
      body: SafeArea(
        child: ServiqAsyncBody<MobilePeopleSnapshot>(
          value: peopleAsync,
          errorTitle: 'Unable to load storefront',
          errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
          onRetry: () => ref.invalidate(peopleSnapshotProvider),
          loadingBuilder: () => const _StorefrontLoading(),
          data: (peopleSnapshot) {
            final provider = _findProvider(peopleSnapshot);

            if (provider == null) {
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: const [
                  SectionCard(
                    child: EmptyStateView(
                      title: 'Provider not found',
                      message:
                          'This profile is no longer available in the nearby network.',
                    ),
                  ),
                ],
              );
            }

            final relatedItems = _relatedItems(feedAsync.asData?.value);
            final offers = relatedItems
                .where((item) => item.type != MobileFeedItemType.demand)
                .toList();
            final requests = relatedItems
                .where((item) => item.type == MobileFeedItemType.demand)
                .toList();

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(peopleSnapshotProvider);
                ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
                await ref.read(peopleSnapshotProvider.future);
              },
              color: AppColors.primary,
              backgroundColor: AppColors.surface,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 168),
                children: [
                  _StorefrontHero(
                    provider: provider,
                    primaryOffer: primaryOffer,
                  ),
                  const SizedBox(height: 14),
                  _StorefrontActionRow(
                    provider: provider,
                    primaryOffer: primaryOffer,
                    onMessage: () => _messageProvider(context, provider),
                    onPrimary: () => _openPrimaryOffer(context, primaryOffer),
                    onCopy: () =>
                        _copyProvider(context, provider, primaryOffer),
                    onMore: () => _showMoreOptions(context, ref, provider),
                  ),
                  const SizedBox(height: 16),
                  _StorefrontMetrics(
                    provider: provider,
                    offerCount: offers.length,
                  ),
                  const SizedBox(height: 16),
                  _AvailabilityDistanceCard(
                    provider: provider,
                    primaryOffer: primaryOffer,
                  ),
                  const SizedBox(height: 16),
                  _OfferShelf(
                    offers: offers,
                    providerId: provider.id,
                    onOpenOffer: (item) => _openOfferCheckout(context, item),
                    onRequestCustom: () =>
                        context.push(AppRoutes.createRequest),
                  ),
                  const SizedBox(height: 16),
                  _TrustProofCard(provider: provider),
                  const SizedBox(height: 16),
                  _ReviewsCard(provider: provider),
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => _writeReview(context, ref, provider.id),
                        icon: const Icon(Icons.rate_review_outlined),
                        label: const Text('Write a Review'),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _RelatedActivitySection(
                    providerId: provider.id,
                    requests: requests,
                    offers: offers,
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  MobilePersonCard? _findProvider(MobilePeopleSnapshot? snapshot) {
    if (snapshot == null) {
      return null;
    }
    for (final person in snapshot.people) {
      if (person.id == providerId) {
        return person;
      }
    }
    return null;
  }

  List<MobileFeedItem> _relatedItems(MobileFeedSnapshot? snapshot) {
    if (snapshot == null) {
      return const <MobileFeedItem>[];
    }
    return snapshot.items
        .where((item) => item.providerId == providerId)
        .toList();
  }

  MobileFeedItem? _firstStoreOffer(MobileFeedSnapshot? snapshot) {
    for (final item in _relatedItems(snapshot)) {
      if (item.type == MobileFeedItemType.service ||
          item.type == MobileFeedItemType.product) {
        return item;
      }
    }
    return null;
  }

  void _messageProvider(BuildContext context, MobilePersonCard provider) {
    context.push(
      AppRoutes.chatDirect(
        recipientId: provider.id,
        contextTitle: provider.name,
        source: 'provider_storefront',
      ),
    );
  }

  void _showMoreOptions(
    BuildContext context,
    WidgetRef ref,
    MobilePersonCard provider,
  ) {
    showModalBottomSheet(
      context: context,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.outlined_flag_rounded),
                  title: const Text('Report'),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _showReportDialog(context, ref, provider);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.shield_outlined),
                  title: const Text('Block'),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _showBlockConfirm(context, ref, provider);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showReportDialog(
    BuildContext context,
    WidgetRef ref,
    MobilePersonCard provider,
  ) {
    var selectedReason = 0;
    var description = '';
    var submitting = false;

    final reasons = [
      'Spam or suspicious',
      'Inappropriate content',
      'Harassment or bullying',
      'Fake profile or identity',
      'Scam or fraud',
      'Other',
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  20, 12, 20,
                  20 + MediaQuery.viewInsetsOf(context).bottom,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Report ${provider.name}',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Why are you reporting this user?',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.inkMuted,
                          ),
                    ),
                    const SizedBox(height: 12),
                    RadioGroup<int>(
                      groupValue: selectedReason,
                      onChanged: (v) {
                        if (v != null) setSheetState(() => selectedReason = v);
                      },
                      child: Column(
                        children: [
                          for (var i = 0; i < reasons.length; i++)
                            RadioListTile<int>(
                              value: i,
                              title: Text(reasons[i]),
                              contentPadding: EdgeInsets.zero,
                              dense: true,
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Additional details (optional)',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 2,
                      onChanged: (v) => description = v,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: submitting
                            ? null
                            : () async {
                          setSheetState(() => submitting = true);
                          try {
                            final reasonKey = [
                              'spam',
                              'inappropriate',
                              'harassment',
                              'fake',
                              'scam',
                              'other',
                            ][selectedReason];
                            final client =
                                ref.read(mobileApiClientProvider);
                            await client.postJson('/api/reports', body: {
                              'targetType': 'provider',
                              'targetId': provider.id,
                              'reason': reasonKey,
                              if (description.trim().isNotEmpty)
                                'description': description.trim(),
                            });
                            if (sheetContext.mounted) {
                              Navigator.of(sheetContext).pop();
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content:
                                      Text('Report submitted. Our team will review it.'),
                                ),
                              );
                            }
                          } catch (e) {
                            setSheetState(() => submitting = false);
                            if (sheetContext.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Failed to submit report. ${AppErrorMapper.toMessage(e)}'),
                                ),
                              );
                            }
                          }
                        },
                        child: submitting
                            ? const SizedBox(
                                height: 18, width: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('Submit report'),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showBlockConfirm(
    BuildContext context,
    WidgetRef ref,
    MobilePersonCard provider,
  ) {
    var blocking = false;

    showModalBottomSheet(
      context: context,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.shield_outlined, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      'Block ${provider.name}?',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'They won\'t be able to message you or interact with your content.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.inkMuted,
                          ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.danger,
                        ),
                        onPressed: blocking
                            ? null
                            : () async {
                          setSheetState(() => blocking = true);
                          try {
                            await ref.read(blockRepositoryProvider).blockUser(provider.id);
                            if (sheetContext.mounted) {
                              Navigator.of(sheetContext).pop();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                      '${provider.name} has been blocked.'),
                                ),
                              );
                            }
                          } catch (e) {
                            setSheetState(() => blocking = false);
                            if (sheetContext.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Failed to block user. ${AppErrorMapper.toMessage(e)}'),
                                ),
                              );
                            }
                          }
                        },
                        child: blocking
                            ? const SizedBox(
                                height: 18, width: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('Block'),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: blocking ? null : () => Navigator.of(sheetContext).pop(),
                        child: const Text('Cancel'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _openPrimaryOffer(BuildContext context, MobileFeedItem? offer) {
    if (offer == null) {
      context.push(AppRoutes.createRequest);
      return;
    }
    _openOfferCheckout(context, offer);
  }

  void _openOfferCheckout(BuildContext context, MobileFeedItem offer) {
    if (offer.type == MobileFeedItemType.service ||
        offer.type == MobileFeedItemType.product) {
      context.push(
        AppRoutes.checkoutItem(
          providerId: providerId,
          itemType: offer.type == MobileFeedItemType.product
              ? 'product'
              : 'service',
          itemId: offer.id,
          title: offer.title,
          price: offer.price,
        ),
      );
      return;
    }

    context.push(AppRoutes.createRequest);
  }

  void _writeReview(BuildContext context, WidgetRef ref, String providerId) {
    var rating = 5;
    var comment = '';

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  20,
                  4,
                  20,
                  20 + MediaQuery.viewInsetsOf(context).bottom,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Write a Review',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final star = index + 1;
                        return IconButton(
                          icon: Icon(
                            star <= rating
                                ? Icons.star_rounded
                                : Icons.star_outline_rounded,
                            color: star <= rating
                                ? AppColors.warning
                                : AppColors.inkMuted,
                            size: 36,
                          ),
                          onPressed: () =>
                              setSheetState(() => rating = star),
                        );
                      }),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Review (optional)',
                        hintText: 'Share your experience...',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 3,
                      onChanged: (v) => comment = v,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () async {
                          Navigator.of(sheetContext).pop();
                          try {
                            await ref
                                .read(profileRepositoryProvider)
                                .submitReview(
                                  providerId: providerId,
                                  rating: rating,
                                  comment: comment,
                                );
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Review submitted.'),
                              ),
                            );
                          } on ApiException catch (error) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(error.message),
                                backgroundColor:
                                    Theme.of(context).colorScheme.error,
                              ),
                            );
                          } catch (error) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(error.toString()),
                                backgroundColor:
                                    Theme.of(context).colorScheme.error,
                              ),
                            );
                          }
                        },
                        child: const Text('Submit'),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _copyProvider(
    BuildContext context,
    MobilePersonCard provider,
    MobileFeedItem? offer,
  ) async {
    final publicPath = offer?.publicProfilePath.trim() ?? '';
    await Clipboard.setData(
      ClipboardData(text: publicPath.isEmpty ? provider.id : publicPath),
    );
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          publicPath.isEmpty ? 'Provider ID copied.' : 'Public profile copied.',
        ),
      ),
    );
  }
}

class _StorefrontHero extends StatelessWidget {
  const _StorefrontHero({required this.provider, required this.primaryOffer});

  final MobilePersonCard provider;
  final MobileFeedItem? primaryOffer;

  @override
  Widget build(BuildContext context) {
    final imageUrl = provider.previewImageUrl.trim().isNotEmpty
        ? provider.previewImageUrl
        : primaryOffer?.thumbnailUrl ?? '';
    final offerTitle = primaryOffer?.title.trim() ?? provider.previewTitle;

    return PremiumSurface(
      padding: EdgeInsets.zero,
      backgroundColor: AppColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(AppRadii.md),
            ),
            child: AspectRatio(
              aspectRatio: 16 / 10,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (imageUrl.trim().isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: imageUrl,
                      fit: BoxFit.cover,
                      errorWidget: (context, url, error) =>
                          const _StorefrontHeroFallback(),
                      placeholder: (context, url) => const _StorefrontHeroFallback(),
                    )
                  else
                    const _StorefrontHeroFallback(),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.60),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 14,
                    right: 14,
                    bottom: 14,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            PremiumPill(
                              label: provider.isOnline
                                  ? 'Available now'
                                  : provider.activityLabel,
                              icon: provider.isOnline
                                  ? Icons.bolt_rounded
                                  : Icons.schedule_rounded,
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.94,
                              ),
                              foregroundColor: provider.isOnline
                                  ? AppColors.primary
                                  : AppColors.ink,
                              borderColor: Colors.white.withValues(alpha: 0.32),
                            ),
                            PremiumPill(
                              label: provider.ratingLabel,
                              icon: Icons.star_rounded,
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.94,
                              ),
                              foregroundColor: AppColors.warning,
                              borderColor: Colors.white.withValues(alpha: 0.32),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          provider.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.headlineMedium
                              ?.copyWith(color: Colors.white),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          offerTitle.trim().isEmpty
                              ? provider.headline
                              : offerTitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: Colors.white70),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ProfileAvatarTile(
                  name: provider.name,
                  subtitle: provider.headline,
                  avatarUrl: provider.avatarUrl,
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    TrustBadge(label: provider.verificationLabel),
                    TrustBadge(
                      label: provider.locationLabel,
                      icon: Icons.place_outlined,
                      backgroundColor: AppColors.surfaceMuted,
                      foregroundColor: AppColors.ink,
                    ),
                    TrustBadge(
                      label: provider.priceLabel,
                      icon: Icons.payments_outlined,
                      backgroundColor: AppColors.warningSoft,
                      foregroundColor: AppColors.warning,
                    ),
                  ],
                ),
                if (provider.primaryTags.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: provider.primaryTags
                        .map(
                          (tag) => PremiumPill(
                            label: tag,
                            backgroundColor: AppColors.surfaceAlt,
                            foregroundColor: AppColors.ink,
                          ),
                        )
                        .toList(),
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

class _StorefrontHeroFallback extends StatelessWidget {
  const _StorefrontHeroFallback();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primarySoft, AppColors.warmSoft],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Container(
          width: 74,
          height: 74,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.76),
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Icon(
            Icons.storefront_rounded,
            color: AppColors.primary,
            size: 34,
          ),
        ),
      ),
    );
  }
}

class _StorefrontActionRow extends StatelessWidget {
  const _StorefrontActionRow({
    required this.provider,
    required this.primaryOffer,
    required this.onMessage,
    required this.onPrimary,
    required this.onCopy,
    required this.onMore,
  });

  final MobilePersonCard provider;
  final MobileFeedItem? primaryOffer;
  final VoidCallback onMessage;
  final VoidCallback onPrimary;
  final VoidCallback onCopy;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: PrimaryButton(
            label: _primaryOfferLabel(primaryOffer),
            icon: const Icon(Icons.shopping_bag_outlined),
            onPressed: onPrimary,
          ),
        ),
        const SizedBox(width: 10),
        _SquareStorefrontButton(
          tooltip: 'Message',
          icon: Icons.chat_bubble_outline_rounded,
          onTap: onMessage,
        ),
        const SizedBox(width: 8),
        _SquareStorefrontButton(
          tooltip: 'Copy profile',
          icon: Icons.ios_share_rounded,
          onTap: onCopy,
        ),
        const SizedBox(width: 8),
        _SquareStorefrontButton(
          tooltip: 'More',
          icon: Icons.more_vert_rounded,
          onTap: onMore,
        ),
      ],
    );
  }
}

class _SquareStorefrontButton extends StatelessWidget {
  const _SquareStorefrontButton({
    required this.tooltip,
    required this.icon,
    required this.onTap,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          side: const BorderSide(color: AppColors.border),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.md),
          onTap: onTap,
          child: SizedBox(
            width: 48,
            height: 48,
            child: Icon(icon, color: AppColors.ink),
          ),
        ),
      ),
    );
  }
}

class _StorefrontMetrics extends StatelessWidget {
  const _StorefrontMetrics({required this.provider, required this.offerCount});

  final MobilePersonCard provider;
  final int offerCount;

  @override
  Widget build(BuildContext context) {
    final items = [
      (
        'Rating',
        provider.reviewCount == 0
            ? 'New'
            : provider.averageRating?.toStringAsFixed(1) ?? '—',
        '${provider.reviewCount} reviews',
        Icons.star_rounded,
      ),
      (
        'Jobs',
        provider.completedJobs.toString(),
        provider.workLabel,
        Icons.task_alt_rounded,
      ),
      (
        'Offers',
        offerCount.toString(),
        'Services and products',
        Icons.store_mall_directory_outlined,
      ),
      (
        'Trust',
        '${provider.completionPercent}%',
        provider.verificationLabel,
        Icons.verified_user_outlined,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final width = constraints.maxWidth < 360
            ? constraints.maxWidth
            : (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: items
              .map(
                (item) => SizedBox(
                  width: width,
                  child: MetricTile(
                    label: item.$1,
                    value: item.$2,
                    caption: item.$3,
                    icon: item.$4,
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _AvailabilityDistanceCard extends StatelessWidget {
  const _AvailabilityDistanceCard({
    required this.provider,
    required this.primaryOffer,
  });

  final MobilePersonCard provider;
  final MobileFeedItem? primaryOffer;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Availability nearby',
            subtitle: 'Fast signals before you message or book.',
          ),
          const SizedBox(height: 14),
          _SignalRow(
            icon: provider.isOnline
                ? Icons.bolt_rounded
                : Icons.schedule_rounded,
            label: provider.activityLabel,
            detail: provider.isOnline
                ? 'High intent provider currently reachable.'
                : 'Message first to confirm exact timing.',
          ),
          _SignalRow(
            icon: Icons.place_outlined,
            label: provider.locationLabel,
            detail: primaryOffer?.distanceLabel ?? 'Distance confirms in chat.',
          ),
          _SignalRow(
            icon: Icons.payments_outlined,
            label: provider.priceLabel,
            detail: primaryOffer == null
                ? 'Quote after scope is confirmed.'
                : 'Checkout-ready listing attached.',
          ),
        ],
      ),
    );
  }
}

class _OfferShelf extends StatelessWidget {
  const _OfferShelf({
    required this.offers,
    required this.providerId,
    required this.onOpenOffer,
    required this.onRequestCustom,
  });

  final List<MobileFeedItem> offers;
  final String providerId;
  final ValueChanged<MobileFeedItem> onOpenOffer;
  final VoidCallback onRequestCustom;

  @override
  Widget build(BuildContext context) {
    if (offers.isEmpty) {
      return SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader(
              title: 'Services and signals',
              subtitle: 'This storefront is ready for a custom request.',
            ),
            const SizedBox(height: 14),
            const EmptyStateView(
              icon: Icons.inventory_2_outlined,
              title: 'No checkout listings yet',
              message:
                  'Message the provider or request a quote while their catalog is being filled in.',
            ),
            const SizedBox(height: 12),
            SecondaryButton(
              label: 'Request custom work',
              icon: const Icon(Icons.receipt_long_outlined),
              onPressed: onRequestCustom,
            ),
          ],
        ),
      );
    }

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: 'Services and signals',
            subtitle:
                '${offers.length} storefront item${offers.length == 1 ? '' : 's'} ready to inspect.',
          ),
          const SizedBox(height: 14),
          ...offers
              .take(4)
              .map(
                (offer) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _OfferTile(
                    offer: offer,
                    onTap: () => onOpenOffer(offer),
                  ),
                ),
              ),
          if (offers.length > 4)
            Text(
              '+${offers.length - 4} more listings in marketplace discovery.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}

class _OfferTile extends StatelessWidget {
  const _OfferTile({required this.offer, required this.onTap});

  final MobileFeedItem offer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surfaceAlt,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.md),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                clipBehavior: Clip.antiAlias,
                child: offer.thumbnailUrl.trim().isEmpty
                    ? Icon(
                        offer.type == MobileFeedItemType.product
                            ? Icons.inventory_2_outlined
                            : Icons.design_services_outlined,
                        color: AppColors.primary,
                      )
                    : CachedNetworkImage(
                        imageUrl: offer.thumbnailUrl,
                        fit: BoxFit.cover,
                        errorWidget: (context, url, error) =>
                            const Icon(
                              Icons.storefront_outlined,
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
                      offer.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 5),
                    Text(
                      offer.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        TrustBadge(
                          label: offer.priceLabel,
                          icon: Icons.payments_outlined,
                          backgroundColor: AppColors.warningSoft,
                          foregroundColor: AppColors.warning,
                        ),
                        TrustBadge(
                          label: offer.distanceLabel,
                          icon: Icons.route_rounded,
                          backgroundColor: AppColors.surface,
                          foregroundColor: AppColors.ink,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.inkMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TrustProofCard extends StatelessWidget {
  const _TrustProofCard({required this.provider});

  final MobilePersonCard provider;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            title: 'Trust proof',
            subtitle: 'Why this provider is safer to contact.',
          ),
          const SizedBox(height: 14),
          _SignalRow(
            icon: Icons.verified_user_outlined,
            label: provider.verificationLabel,
            detail: '${provider.completionPercent}% profile readiness.',
          ),
          _SignalRow(
            icon: Icons.task_alt_rounded,
            label: provider.workLabel,
            detail: provider.completedJobs > 0
                ? 'Completed jobs are visible across the marketplace.'
                : 'Early marketplace profile with growing activity.',
          ),
          _SignalRow(
            icon: Icons.diversity_3_outlined,
            label: provider.socialLabel,
            detail: provider.reason.trim().isEmpty
                ? 'Ranked by local availability and trust signals.'
                : provider.reason,
          ),
        ],
      ),
    );
  }
}

class _ReviewsCard extends ConsumerWidget {
  const _ReviewsCard({required this.provider});

  final MobilePersonCard provider;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncReviews = ref.watch(providerReviewsProvider(provider.id));

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: 'Reviews',
            subtitle: provider.reviewCount > 0
                ? '${provider.reviewCount} review${provider.reviewCount == 1 ? '' : 's'}'
                : 'Review history will grow as marketplace work completes.',
          ),
          const SizedBox(height: 14),
          if (asyncReviews.isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (asyncReviews.hasError)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Unable to load reviews.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.danger),
              ),
            )
          else if (asyncReviews.hasValue && asyncReviews.value!.isEmpty)
            const EmptyStateView(
              icon: Icons.rate_review_outlined,
              title: 'No reviews yet',
              message: 'Ask for scope, timing, and quote details in chat before booking.',
            )
          else
            Column(
              children: [
                ...?asyncReviews.value?.map((review) => ReviewCard(
                      review: review,
                      userId: provider.id,
                    )),
              ],
            ),
        ],
      ),
    );
  }
}

class _RelatedActivitySection extends StatelessWidget {
  const _RelatedActivitySection({
    required this.providerId,
    required this.requests,
    required this.offers,
  });

  final String providerId;
  final List<MobileFeedItem> requests;
  final List<MobileFeedItem> offers;

  @override
  Widget build(BuildContext context) {
    final visibleItems = [...requests, ...offers].take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(
          title: 'Recent marketplace activity',
          subtitle: 'Latest cards linked to this storefront.',
        ),
        const SizedBox(height: 12),
        if (visibleItems.isEmpty)
          const SectionCard(
            child: EmptyStateView(
              icon: Icons.dynamic_feed_outlined,
              title: 'No recent activity yet',
              message:
                  'The provider is visible in People, but no recent feed cards are attached.',
            ),
          )
        else
          ...visibleItems.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: FeedCard(
                item: item,
                onPrimaryTap: () {
                  if (item.type == MobileFeedItemType.service ||
                      item.type == MobileFeedItemType.product) {
                    context.push(
                      AppRoutes.checkoutItem(
                        providerId: providerId,
                        itemType: item.type == MobileFeedItemType.product
                            ? 'product'
                            : 'service',
                        itemId: item.id,
                        title: item.title,
                        price: item.price,
                      ),
                    );
                  } else {
                    context.push(AppRoutes.createRequest);
                  }
                },
                onSecondaryTap: () => context.push(
                  AppRoutes.chatDirect(
                    recipientId: providerId,
                    contextTitle: item.title,
                    contextTaskId: item.id,
                    contextStatus: item.statusLabel,
                    source: 'provider_storefront_card',
                  ),
                ),
                primaryLabel: item.type == MobileFeedItemType.product
                    ? 'Buy'
                    : item.type == MobileFeedItemType.service
                    ? 'Book'
                    : 'Request service',
                secondaryLabel: 'Message',
              ),
            ),
          ),
      ],
    );
  }
}

class _SignalRow extends StatelessWidget {
  const _SignalRow({
    required this.icon,
    required this.label,
    required this.detail,
  });

  final IconData icon;
  final String label;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Icon(icon, color: AppColors.primary, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 3),
                Text(detail, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StorefrontLoading extends StatelessWidget {
  const _StorefrontLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        SectionCard(
          padding: EdgeInsets.zero,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              LoadingShimmer(height: 220),
              Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    LoadingShimmer(height: 22, width: 220),
                    SizedBox(height: 10),
                    LoadingShimmer(height: 14),
                    SizedBox(height: 14),
                    LoadingShimmer(height: 34, width: 260),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        ...List.generate(
          3,
          (_) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  LoadingShimmer(height: 18, width: 180),
                  SizedBox(height: 12),
                  LoadingShimmer(height: 14),
                  SizedBox(height: 8),
                  LoadingShimmer(height: 14, width: 220),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

String _primaryOfferLabel(MobileFeedItem? offer) {
  if (offer == null) {
    return 'Request quote';
  }
  return offer.type == MobileFeedItemType.product ? 'Buy item' : 'Book service';
}
