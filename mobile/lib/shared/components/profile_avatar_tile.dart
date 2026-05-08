import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';
import '../../core/utils/app_formatters.dart';

class ProfileAvatarTile extends StatelessWidget {
  const ProfileAvatarTile({
    super.key,
    required this.name,
    required this.subtitle,
    this.avatarUrl = '',
    this.trailing,
    this.subtitleMaxLines = 2,
  });

  final String name;
  final String subtitle;
  final String avatarUrl;
  final Widget? trailing;
  final int subtitleMaxLines;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 24,
          backgroundColor: AppColors.surfaceTint,
          foregroundImage: avatarUrl.trim().isEmpty
              ? null
              : NetworkImage(avatarUrl),
          onForegroundImageError: avatarUrl.trim().isEmpty ? null : (_, _) {},
          child: Text(AppFormatters.initials(name)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                maxLines: subtitleMaxLines,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ],
    );
  }
}
