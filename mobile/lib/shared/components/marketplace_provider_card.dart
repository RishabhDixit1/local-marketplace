import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../core/theme/design_tokens.dart';
import 'nameplate_card.dart';

/// A provider card for marketplace contexts (zone detail, market detail).
/// Shows avatar, name, location, rating, response time, jobs, and verified badge.
class MarketplaceProviderCard extends StatelessWidget {
  const MarketplaceProviderCard({
    required this.name,
    this.location,
    this.avatarUrl,
    this.bio,
    this.avgRating,
    this.reviewCount = 0,
    this.completedJobs = 0,
    this.responseMinutes,
    this.verified = false,
    this.priceMin,
    this.priceMax,
    this.onTap,
    super.key,
  });

  final String name;
  final String? location;
  final String? avatarUrl;
  final String? bio;
  final double? avgRating;
  final int reviewCount;
  final int completedJobs;
  final int? responseMinutes;
  final bool verified;
  final num? priceMin;
  final num? priceMax;
  final VoidCallback? onTap;

  String? get _priceLabel {
    if (priceMin == null) return null;
    if (priceMax != null && priceMax! > priceMin!) {
      return '₹$priceMin – ₹$priceMax';
    }
    return 'From ₹$priceMin';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textSecondary = theme.colorScheme.onSurface.withValues(alpha: 0.55);
    final textTertiary = theme.colorScheme.onSurface.withValues(alpha: 0.45);

    return NameplateCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildAvatar(theme),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (verified) ...[
                          const SizedBox(width: AppSpacing.xxs),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.successSoft,
                              borderRadius: BorderRadius.circular(AppRadii.pill),
                              border: Border.all(
                                color: AppColors.success.withValues(alpha: 0.2),
                              ),
                            ),
                            child: Text(
                              'Verified',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: AppColors.success,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (location != null && location!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Icon(Icons.location_on_rounded, size: 12, color: textTertiary),
                          const SizedBox(width: 2),
                          Expanded(
                            child: Text(
                              location!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 11, color: textSecondary),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          // Signal chips
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xxs,
            children: [
              if (avgRating != null)
                _SignalChip(
                  icon: Icons.star_rounded,
                  iconColor: AppColors.marigold,
                  label: '${avgRating!.toStringAsFixed(1)} ($reviewCount)',
                ),
              if (responseMinutes != null)
                _SignalChip(
                  icon: Icons.bolt_rounded,
                  iconColor: AppColors.primary,
                  label: '~$responseMinutes min',
                ),
              if (completedJobs > 0)
                _SignalChip(
                  icon: Icons.check_circle_outline_rounded,
                  iconColor: textTertiary,
                  label: '$completedJobs jobs',
                ),
            ],
          ),
          if (bio != null && bio!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              bio!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: textSecondary, height: 1.4),
            ),
          ],
          if (_priceLabel != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              _priceLabel!,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.primaryDeep,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAvatar(ThemeData theme) {
    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: CachedNetworkImage(
          imageUrl: avatarUrl!,
          width: 44,
          height: 44,
          fit: BoxFit.cover,
          errorWidget: (context, url, error) => _avatarFallback(theme),
        ),
      );
    }
    return _avatarFallback(theme);
  }

  Widget _avatarFallback(ThemeData theme) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 16,
            color: AppColors.primaryDeep,
          ),
        ),
      ),
    );
  }
}

class _SignalChip extends StatelessWidget {
  const _SignalChip({
    required this.icon,
    required this.iconColor,
    required this.label,
  });

  final IconData icon;
  final Color iconColor;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: iconColor),
        const SizedBox(width: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55),
          ),
        ),
      ],
    );
  }
}
