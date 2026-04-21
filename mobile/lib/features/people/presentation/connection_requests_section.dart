import 'package:flutter/material.dart';

import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/app_formatters.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';
import '../../../shared/widgets/section_header.dart';

class ConnectionRequestsSection extends StatelessWidget {
  const ConnectionRequestsSection({
    super.key,
    required this.incoming,
    required this.outgoing,
    required this.resolvePerson,
    required this.onAcceptIncoming,
  });

  final List<ConnectionRequest> incoming;
  final List<ConnectionRequest> outgoing;
  final PersonSummary? Function(String personId) resolvePerson;
  final Future<void> Function(String requestId) onAcceptIncoming;

  @override
  Widget build(BuildContext context) {
    if (incoming.isEmpty && outgoing.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const AppSectionHeader(
          title: 'Requests',
          subtitle: 'Keep network growth explicit and trust-preserving.',
        ),
        const SizedBox(height: AppSpacing.sm),
        ...incoming.map((request) {
          final person = resolvePerson(request.personId);
          if (person == null) {
            return const SizedBox.shrink();
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: AppCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    backgroundColor: AppColors.primarySoft,
                    child: Text(AppFormatters.initials(person.name)),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          person.name,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          request.message,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xs,
                          children: [
                            AppPill(
                              label:
                                  '${person.mutualConnections} mutual connections',
                              backgroundColor: AppColors.surfaceAlt,
                              foregroundColor: AppColors.ink,
                            ),
                            AppPill(
                              label: person.verificationLevel.label,
                              backgroundColor: AppColors.verifiedSoft,
                              foregroundColor: AppColors.verified,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton(
                    onPressed: () => onAcceptIncoming(request.id),
                    child: const Text('Accept'),
                  ),
                ],
              ),
            ),
          );
        }),
        ...outgoing.map((request) {
          final person = resolvePerson(request.personId);
          if (person == null) {
            return const SizedBox.shrink();
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: AppCard(
              backgroundColor: AppColors.surfaceAlt,
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Pending with ${person.name}',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          'Sent ${AppFormatters.relativeTime(request.createdAt)}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const AppPill(
                    label: 'Awaiting response',
                    backgroundColor: AppColors.warningSoft,
                    foregroundColor: AppColors.warning,
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}
