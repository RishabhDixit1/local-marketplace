import 'package:flutter/material.dart';

import '../../core/design_system/design_system.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/section_card.dart';
import '../../features/people/domain/people_snapshot.dart';
import 'profile_avatar_tile.dart';

class ProviderCard extends StatelessWidget {
  const ProviderCard({
    super.key,
    required this.person,
    this.onOpenProfile,
    this.onMessage,
    this.reason,
    this.isSaved = false,
    this.onSave,
    this.onMore,
  });

  final MobilePersonCard person;
  final VoidCallback? onOpenProfile;
  final VoidCallback? onMessage;
  final String? reason;
  final bool isSaved;
  final VoidCallback? onSave;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    final reasonText = reason?.trim() ?? '';

    return SectionCard(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (person.hasPreviewImage) ...[
            _ProviderPreview(person: person),
            const SizedBox(height: AppSpacing.sm),
          ],
          ProfileAvatarTile(
            name: person.name,
            subtitle: person.headline,
            avatarUrl: person.avatarUrl,
            trailing: onSave == null && onMore == null
                ? _AvailabilityPill(online: person.isOnline)
                : _ProviderActions(
                    online: person.isOnline,
                    isSaved: isSaved,
                    onSave: onSave,
                    onMore: onMore,
                  ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TrustSnapshot(
            dense: true,
            items: [
              TrustSnapshotItem(
                icon: Icons.place_outlined,
                label: 'Area',
                value: person.locationLabel,
              ),
              TrustSnapshotItem(
                icon: Icons.star_rounded,
                label: 'Rating',
                value: person.ratingLabel,
                tone: person.reviewCount > 0
                    ? TrustSnapshotTone.warning
                    : TrustSnapshotTone.neutral,
              ),
              TrustSnapshotItem(
                icon: Icons.verified_user_outlined,
                label: 'Trust',
                value: person.socialLabel,
                tone:
                    person.isAcceptedConnection ||
                        person.completionPercent >= 80
                    ? TrustSnapshotTone.trust
                    : TrustSnapshotTone.neutral,
              ),
              TrustSnapshotItem(
                icon: Icons.work_outline_rounded,
                label: 'Work',
                value: person.workLabel,
                tone: person.completedJobs > 0
                    ? TrustSnapshotTone.success
                    : TrustSnapshotTone.neutral,
              ),
            ],
          ),
          if (person.primaryTags.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: person.primaryTags.take(3).map((tag) {
                return _TagPill(label: tag);
              }).toList(),
            ),
          ],
          if (reasonText.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(AppRadii.md),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                reasonText,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: AppColors.primary),
              ),
            ),
          ],
          if (onOpenProfile != null || onMessage != null) ...[
            const SizedBox(height: AppSpacing.sm),
            ServiqActionBar(
              primaryLabel: 'Open profile',
              primaryIcon: Icons.person_outline_rounded,
              onPrimary: onOpenProfile,
              secondaryActions: [
                ServiqCompactAction(
                  icon: Icons.chat_bubble_outline_rounded,
                  tooltip: 'Message',
                  onPressed: onMessage,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ProviderPreview extends StatelessWidget {
  const _ProviderPreview({required this.person});

  final MobilePersonCard person;

  @override
  Widget build(BuildContext context) {
    final title = person.previewTitle.trim().isEmpty
        ? person.primaryTags.take(2).join(', ')
        : person.previewTitle;

    return Container(
      height: 118,
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
          Image.network(
            person.previewImageUrl,
            fit: BoxFit.cover,
            errorBuilder: (context, _, _) =>
                _ProviderPreviewFallback(title: title),
          ),
          Positioned(
            left: AppSpacing.sm,
            right: AppSpacing.sm,
            bottom: AppSpacing.sm,
            child: Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                if (title.trim().isNotEmpty) _PreviewChip(label: title),
                if (person.previewMediaCount > 1)
                  _PreviewChip(label: '${person.previewMediaCount} photos'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProviderPreviewFallback extends StatelessWidget {
  const _ProviderPreviewFallback({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceMuted,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.photo_library_outlined, color: AppColors.inkMuted),
          const SizedBox(height: AppSpacing.xs),
          Text(
            title.trim().isEmpty ? 'Provider work preview' : title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

class _PreviewChip extends StatelessWidget {
  const _PreviewChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelMedium,
      ),
    );
  }
}

class ProviderDirectoryCard extends StatelessWidget {
  const ProviderDirectoryCard({
    super.key,
    required this.person,
    this.onOpenProfile,
    this.onMessage,
    this.onConnect,
    this.connecting = false,
  });

  final MobilePersonCard person;
  final VoidCallback? onOpenProfile;
  final VoidCallback? onMessage;
  final VoidCallback? onConnect;
  final bool connecting;

  @override
  Widget build(BuildContext context) {
    final headline = _directoryHeadline(person);
    final statusLabel = _directoryStatusLabel(person);
    final visibleTags = person.primaryTags.take(2).toList();

    return SectionCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: const Color(0xFFE7EEF6),
                backgroundImage: person.avatarUrl.trim().isEmpty
                    ? null
                    : NetworkImage(person.avatarUrl),
                child: person.avatarUrl.trim().isEmpty
                    ? Text(
                        _initials(person.name),
                        style: Theme.of(context).textTheme.labelLarge,
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      person.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      headline,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.inkSubtle,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _DirectoryMetaPill(
                  icon: Icons.place_outlined,
                  label: person.locationLabel,
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: _DirectoryMetaPill(
                  icon: person.isOnline
                      ? Icons.bolt_rounded
                      : Icons.verified_user_outlined,
                  label: statusLabel,
                  emphasized: person.isOnline || statusLabel == 'Verified',
                ),
              ),
            ],
          ),
          if (visibleTags.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: visibleTags.map((tag) {
                return _DirectoryTagPill(label: tag);
              }).toList(),
            ),
          ],
          if (onOpenProfile != null || onMessage != null) ...[
            const SizedBox(height: 12),
            SizedBox(
              height: 44,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (onOpenProfile != null)
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: onOpenProfile,
                        icon: const Icon(Icons.person_outline_rounded),
                        label: const Text(
                          'Open profile',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(44),
                        ),
                      ),
                    ),
                  if (onMessage != null) ...[
                    const SizedBox(width: 8),
                    Tooltip(
                      message: 'Message',
                      child: SizedBox.square(
                        dimension: 44,
                        child: IconButton.outlined(
                          onPressed: onMessage,
                          icon: const Icon(Icons.chat_bubble_outline_rounded),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
          if (onConnect != null) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: connecting ? null : onConnect,
                icon: connecting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.person_add_alt_1_outlined),
                label: Text(connecting ? 'Sending…' : 'Connect'),
              ),
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
      constraints: const BoxConstraints(minHeight: AppTouchTargets.minimum),
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

class _ProviderActions extends StatelessWidget {
  const _ProviderActions({
    required this.online,
    required this.isSaved,
    this.onSave,
    this.onMore,
  });

  final bool online;
  final bool isSaved;
  final VoidCallback? onSave;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        _AvailabilityPill(online: online),
        const SizedBox(height: 6),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (onSave != null)
              Tooltip(
                message: isSaved ? 'Saved' : 'Save',
                child: SizedBox.square(
                  dimension: AppTouchTargets.minimum,
                  child: IconButton.outlined(
                    onPressed: onSave,
                    icon: Icon(
                      isSaved
                          ? Icons.bookmark_rounded
                          : Icons.bookmark_border_rounded,
                    ),
                  ),
                ),
              ),
            if (onMore != null) ...[
              if (onSave != null) const SizedBox(width: 4),
              Tooltip(
                message: 'More actions',
                child: SizedBox.square(
                  dimension: AppTouchTargets.minimum,
                  child: IconButton.outlined(
                    onPressed: onMore,
                    icon: const Icon(Icons.more_horiz_rounded),
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _DirectoryMetaPill extends StatelessWidget {
  const _DirectoryMetaPill({
    required this.icon,
    required this.label,
    this.emphasized = false,
  });

  final IconData icon;
  final String label;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final foreground = emphasized ? AppColors.primary : AppColors.inkMuted;

    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 9),
      decoration: BoxDecoration(
        color: emphasized ? AppColors.primarySoft : AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: foreground),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: foreground),
            ),
          ),
        ],
      ),
    );
  }
}

class _DirectoryTagPill extends StatelessWidget {
  const _DirectoryTagPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 132),
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(
            context,
          ).textTheme.labelMedium?.copyWith(color: AppColors.inkSubtle),
        ),
      ),
    );
  }
}

String _directoryHeadline(MobilePersonCard person) {
  final headline = person.headline.trim();
  if (headline.isEmpty && person.primaryTags.isNotEmpty) {
    return _tagSummary(person.primaryTags);
  }
  if (_looksLikeDirectoryNoise(headline) && person.primaryTags.isNotEmpty) {
    return _tagSummary(person.primaryTags);
  }
  if (headline.length > 96 && person.primaryTags.isNotEmpty) {
    return _tagSummary(person.primaryTags);
  }
  if (headline.length <= 96) {
    return headline.isEmpty ? 'Local services nearby' : headline;
  }

  final words = headline.split(RegExp(r'\s+'));
  final buffer = StringBuffer();
  for (final word in words) {
    final next = buffer.isEmpty ? word : '${buffer.toString()} $word';
    if (next.length > 84) {
      break;
    }
    buffer
      ..clear()
      ..write(next);
  }

  final compact = buffer.toString().trim();
  return compact.isEmpty ? 'Local services nearby' : compact;
}

bool _looksLikeDirectoryNoise(String value) {
  final normalized = value.toLowerCase();
  return normalized.contains('linkedin') ||
      normalized.contains('client acquisition') ||
      normalized.contains('sponsorship manager') ||
      normalized.startsWith('as a ') ||
      normalized.startsWith('i am ') ||
      normalized.startsWith("i'm ");
}

String _directoryStatusLabel(MobilePersonCard person) {
  if (person.isOnline) {
    return 'Active';
  }
  final activity = person.activityLabel.trim();
  if (activity.toLowerCase().startsWith('replies in')) {
    return activity;
  }
  if (person.reviewCount > 0 && person.averageRating != null) {
    return person.ratingLabel;
  }
  if (person.completionPercent >= 80) {
    return 'Verified';
  }
  return 'Available';
}

String _tagSummary(List<String> tags) {
  final visibleTags = tags
      .map((tag) => tag.trim())
      .where((tag) => tag.isNotEmpty)
      .take(2)
      .toList();
  if (visibleTags.isEmpty) {
    return 'Local services nearby';
  }
  if (visibleTags.length == 1) {
    return '${visibleTags.first} support nearby';
  }
  return visibleTags.join(', ');
}

String _initials(String name) {
  final parts = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) {
    return 'S';
  }
  return parts.take(2).map((part) => part[0].toUpperCase()).join();
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
