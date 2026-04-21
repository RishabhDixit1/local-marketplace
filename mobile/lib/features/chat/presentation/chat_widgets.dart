import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/app_formatters.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';

class ChatThreadTile extends StatelessWidget {
  const ChatThreadTile({super.key, required this.thread, required this.onPin});

  final ChatThread thread;
  final VoidCallback onPin;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => context.push(AppRoutes.chatThread(thread.id)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: AppColors.primarySoft,
                child: Text(AppFormatters.initials(thread.counterpartName)),
              ),
              if (thread.online)
                Positioned(
                  right: 1,
                  bottom: 1,
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: AppColors.success,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.surface, width: 2),
                    ),
                  ),
                ),
            ],
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
                        thread.counterpartName,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    Text(
                      AppFormatters.relativeTime(thread.lastMessageAt),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  thread.subtitle,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        thread.lastMessagePreview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.ink,
                          fontWeight: thread.unreadCount > 0
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    IconButton(
                      onPressed: onPin,
                      icon: Icon(
                        thread.pinned
                            ? Icons.push_pin_rounded
                            : Icons.push_pin_outlined,
                      ),
                    ),
                    CountBadge(count: thread.unreadCount),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class MessageBubble extends StatelessWidget {
  const MessageBubble({super.key, required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final bubbleColor = message.isSystem
        ? AppColors.surfaceAlt
        : message.isMine
        ? AppColors.primary
        : AppColors.surface;
    final textColor = message.isSystem
        ? AppColors.ink
        : message.isMine
        ? Colors.white
        : AppColors.ink;

    return Align(
      alignment: message.isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 300),
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: bubbleColor,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(
            color: message.isMine ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.text,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: textColor),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              AppFormatters.relativeTime(message.sentAt),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: message.isMine
                    ? Colors.white.withValues(alpha: 0.72)
                    : AppColors.inkSubtle,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TaskContextBanner extends StatelessWidget {
  const TaskContextBanner({super.key, this.taskId, required this.safetyLabel});

  final String? taskId;
  final String safetyLabel;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      backgroundColor: AppColors.surfaceAlt,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.shield_outlined, color: AppColors.primaryDeep),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Trust context',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  safetyLabel,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                if (taskId != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  TextButton(
                    onPressed: () =>
                        context.push(AppRoutes.taskDetail(taskId!)),
                    child: const Text('Open linked task'),
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
