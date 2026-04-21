import 'package:flutter/material.dart';

import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/chips.dart';

class ExploreFilterSheetResult {
  const ExploreFilterSheetResult({
    required this.sort,
    required this.urgentOnly,
    required this.verifiedOnly,
  });

  final ExploreSort sort;
  final bool urgentOnly;
  final bool verifiedOnly;
}

Future<ExploreFilterSheetResult?> showExploreFiltersSheet(
  BuildContext context, {
  required ExploreSort currentSort,
  required bool urgentOnly,
  required bool verifiedOnly,
}) {
  var selectedSort = currentSort;
  var nextUrgent = urgentOnly;
  var nextVerified = verifiedOnly;

  return showModalBottomSheet<ExploreFilterSheetResult>(
    context: context,
    showDragHandle: true,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setState) {
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.pageInset,
                AppSpacing.xs,
                AppSpacing.pageInset,
                AppSpacing.pageInset,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Refine explore',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Balance urgency, trust, and local closeness without losing speed.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Sort by',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: ExploreSort.values
                        .map(
                          (sort) => ChoiceChip(
                            label: Text(sort.label),
                            selected: selectedSort == sort,
                            onSelected: (_) =>
                                setState(() => selectedSort = sort),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Trust filters',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      AppFilterChip(
                        label: 'Urgent only',
                        selected: nextUrgent,
                        leading: Icons.local_fire_department_outlined,
                        onSelected: (value) =>
                            setState(() => nextUrgent = value),
                      ),
                      AppFilterChip(
                        label: 'Verified only',
                        selected: nextVerified,
                        leading: Icons.verified_outlined,
                        onSelected: (value) =>
                            setState(() => nextVerified = value),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: FilledButton(
                          onPressed: () {
                            Navigator.of(context).pop(
                              ExploreFilterSheetResult(
                                sort: selectedSort,
                                urgentOnly: nextUrgent,
                                verifiedOnly: nextVerified,
                              ),
                            );
                          },
                          child: const Text('Apply'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}
