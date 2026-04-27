import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/section_card.dart';
import '../../features/people/domain/people_snapshot.dart';
import 'app_buttons.dart';
import 'profile_avatar_tile.dart';

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
    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ProfileAvatarTile(
            name: person.name,
            subtitle: person.headline,
            avatarUrl: person.avatarUrl,
            trailing: _AvailabilityPill(online: person.isOnline),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoPill(
                icon: Icons.place_outlined,
                label: person.locationLabel,
              ),
              _InfoPill(icon: Icons.star_rounded, label: person.ratingLabel),
              _InfoPill(
                icon: Icons.payments_outlined,
                label: person.priceLabel,
              ),
            ],
          ),
          if (person.primaryTags.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: person.primaryTags.take(3).map((tag) {
                return _TagPill(label: tag);
              }).toList(),
            ),
          ],
          if (onOpenProfile != null || onMessage != null) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                if (onOpenProfile != null)
                  Expanded(
                    child: PrimaryButton(
                      label: 'Open profile',
                      onPressed: onOpenProfile,
                    ),
                  ),
                if (onMessage != null) ...[
                  const SizedBox(width: 10),
                  Tooltip(
                    message: 'Message',
                    child: IconButton.outlined(
                      onPressed: onMessage,
                      icon: const Icon(Icons.chat_bubble_outline_rounded),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _AvailabilityPill extends StatelessWidget {
  const _AvailabilityPill({required this.online});

  final bool online;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: online ? AppColors.primarySoft : AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        online ? 'Active' : 'Later',
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: online ? AppColors.primary : AppColors.inkMuted,
        ),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 180),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: AppColors.inkMuted),
            const SizedBox(width: 5),
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

class _TagPill extends StatelessWidget {
  const _TagPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 180),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelMedium,
        ),
      ),
    );
  }
}
