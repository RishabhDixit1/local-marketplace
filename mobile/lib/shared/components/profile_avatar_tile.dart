import 'package:flutter/material.dart';

import '../../core/utils/app_formatters.dart';

class ProfileAvatarTile extends StatelessWidget {
  const ProfileAvatarTile({
    super.key,
    required this.name,
    required this.subtitle,
    this.avatarUrl = '',
    this.trailing,
  });

  final String name;
  final String subtitle;
  final String avatarUrl;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 24,
          backgroundColor: const Color(0xFFE7EEF6),
          backgroundImage: avatarUrl.trim().isEmpty ? null : NetworkImage(avatarUrl),
          child: avatarUrl.trim().isEmpty
              ? Text(AppFormatters.initials(name))
              : null,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 12),
          trailing!,
        ],
      ],
    );
  }
}
