import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/section_card.dart';
import '../../features/people/domain/people_snapshot.dart';
import 'app_buttons.dart';
import 'profile_avatar_tile.dart';
import 'trust_badge.dart';

class ProviderCard extends StatelessWidget {
  const ProviderCard({
    super.key,
    required this.person,
    this.onOpenProfile,
    this.onMessage,
  });

  final MobilePersonCard person;
  final VoidCallback? onOpenProfile;
  final VoidCallback? onMessage;

  @override
  Widget build(BuildContext context) {
    final reason = person.reason.trim().isNotEmpty
        ? person.reason.trim()
        : person.socialLabel;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ProfileAvatarTile(
            name: person.name,
            subtitle: person.headline,
            avatarUrl: person.avatarUrl,
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: person.isOnline
                    ? AppColors.primarySoft
                    : AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Text(
                person.isOnline ? 'Active now' : 'Available later',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: person.isOnline
                      ? AppColors.primary
                      : AppColors.inkMuted,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.auto_awesome_outlined,
                  size: 16,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    reason,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.primaryDeep,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TrustBadge(label: person.verificationLabel),
              TrustBadge(
                label: person.ratingLabel,
                icon: Icons.star_rounded,
                backgroundColor: AppColors.warningSoft,
                foregroundColor: AppColors.warning,
              ),
              TrustBadge(
                label: person.workLabel,
                icon: Icons.task_alt_rounded,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _MetaLine(
                icon: Icons.place_outlined,
                label: person.locationLabel,
              ),
              _MetaLine(
                icon: Icons.schedule_rounded,
                label: person.activityLabel,
              ),
              _MetaLine(
                icon: Icons.payments_outlined,
                label: person.priceLabel,
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
                    (tag) => ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 220),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceMuted,
                          borderRadius: BorderRadius.circular(AppRadii.md),
                        ),
                        child: Text(
                          tag,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (onOpenProfile != null || onMessage != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                if (onMessage != null) ...[
                  Expanded(
                    child: SecondaryButton(
                      label: 'Message',
                      onPressed: onMessage,
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                if (onOpenProfile != null)
                  Expanded(
                    child: PrimaryButton(
                      label: 'Open profile',
                      onPressed: onOpenProfile,
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _MetaLine extends StatelessWidget {
  const _MetaLine({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 220),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: AppColors.inkMuted),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
