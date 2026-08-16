import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';
import 'app_avatar.dart';

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
    return Semantics(
      label: '$name, $subtitle',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppAvatar(name: name, avatarUrl: avatarUrl, radius: 24),
          const SizedBox(width: AppSpacing.sm),
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
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  subtitle,
                  maxLines: subtitleMaxLines,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: AppSpacing.sm), trailing!],
        ],
      ),
    );
  }
}
