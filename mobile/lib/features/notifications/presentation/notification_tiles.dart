import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/app_formatters.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';

class NotificationTile extends StatelessWidget {
  const NotificationTile({
    super.key,
    required this.notification,
    required this.onRead,
  });

  final AppNotification notification;
  final Future<void> Function() onRead;

  @override
  Widget build(BuildContext context) {
    final icon = switch (notification.kind) {
      NotificationKind.task => Icons.assignment_outlined,
      NotificationKind.connection => Icons.people_outline_rounded,
      NotificationKind.providerResponse => Icons.reply_all_rounded,
      NotificationKind.reminder => Icons.alarm_rounded,
      NotificationKind.safety => Icons.shield_outlined,
      NotificationKind.system => Icons.info_outline_rounded,
      NotificationKind.message => Icons.chat_bubble_outline_rounded,
    };

    return AppCard(
      onTap: () async {
        await onRead();
        if (!context.mounted) {
          return;
        }
        context.push(notification.route);
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: notification.read
                  ? AppColors.surfaceAlt
                  : AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Icon(icon, color: AppColors.ink),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        notification.title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    Text(
                      AppFormatters.relativeTime(notification.createdAt),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    AppPill(
                      label: notification.kind.label,
                      backgroundColor: AppColors.surfaceAlt,
                      foregroundColor: AppColors.ink,
                    ),
                    if (!notification.read)
                      const AppPill(
                        label: 'Unread',
                        backgroundColor: AppColors.primarySoft,
                        foregroundColor: AppColors.primaryDeep,
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  notification.message,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton(
                  onPressed: () async {
                    await onRead();
                    if (!context.mounted) {
                      return;
                    }
                    context.push(notification.route);
                  },
                  child: Text(notification.actionLabel),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
