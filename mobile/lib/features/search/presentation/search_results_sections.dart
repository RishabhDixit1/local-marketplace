import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';
import '../../../shared/widgets/section_header.dart';

class SearchResultsSection extends StatelessWidget {
  const SearchResultsSection({
    super.key,
    required this.title,
    required this.subtitle,
    required this.items,
  });

  final String title;
  final String subtitle;
  final List<SearchResultItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppSectionHeader(title: title, subtitle: subtitle),
        const SizedBox(height: AppSpacing.sm),
        ...items.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: AppCard(
              onTap: () => context.push(item.route),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                    ),
                    child: Icon(item.icon, color: AppColors.ink),
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
                                item.title,
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                            ),
                            if (item.trusted)
                              const AppPill(
                                label: 'Trusted',
                                backgroundColor: AppColors.primarySoft,
                                foregroundColor: AppColors.primaryDeep,
                              ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          item.subtitle,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          item.meta,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
