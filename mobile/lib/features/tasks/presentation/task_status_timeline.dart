import 'package:flutter/material.dart';

import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/app_formatters.dart';

class TaskStatusTimeline extends StatelessWidget {
  const TaskStatusTimeline({super.key, required this.entries});

  final List<TaskTimelineEntry> entries;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: entries.map((entry) {
        final isLast = entry == entries.last;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: entry.isCurrent
                        ? AppColors.primary
                        : entry.isComplete
                        ? AppColors.success
                        : AppColors.surfaceAlt,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    entry.icon,
                    color: entry.isCurrent || entry.isComplete
                        ? Colors.white
                        : AppColors.inkSubtle,
                    size: 14,
                  ),
                ),
                if (!isLast)
                  Container(
                    width: 2,
                    height: 46,
                    color: AppColors.border,
                    margin: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  ),
              ],
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xxxs),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: entry.isCurrent ? AppColors.ink : AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      entry.subtitle,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      AppFormatters.relativeTime(entry.time),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (!isLast) const SizedBox(height: AppSpacing.sm),
                  ],
                ),
              ),
            ),
          ],
        );
      }).toList(),
    );
  }
}
