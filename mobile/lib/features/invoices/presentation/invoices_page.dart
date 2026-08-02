import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../data/invoices_repository.dart';
import '../domain/invoice_models.dart';

final _invoiceStatusColorMap = <String, (Color, Color)>{
  'paid': (AppColors.successSoft, AppColors.success),
  'cancelled': (AppColors.dangerSoft, AppColors.danger),
  'refunded': (AppColors.accentSoft, AppColors.accent),
};

class InvoicesPage extends ConsumerWidget {
  const InvoicesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(invoiceListProvider);

    return ServiqScaffold(
      appBar: ServiqTopBar(title: 'Invoices'),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(invoiceListProvider);
          await ref.read(invoiceListProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            ServiqAsyncBody<List<InvoiceRecord>>(
              value: async,
              errorTitle: 'Unable to load invoices',
              errorMessageFor: (e, _) => AppErrorMapper.toMessage(e),
              onRetry: () => ref.invalidate(invoiceListProvider),
              loadingBuilder: () => const _Loading(),
              data: (invoices) {
                if (invoices.isEmpty) {
                  return const SectionCard(
                    child: EmptyStateView(
                      title: 'No invoices yet',
                      message:
                          'Invoices are generated when an order is completed.',
                    ),
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Summary(invoices: invoices),
                    const SizedBox(height: 16),
                    ...invoices.map(
                      (inv) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _InvoiceTile(invoice: inv),
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.invoices});
  final List<InvoiceRecord> invoices;

  @override
  Widget build(BuildContext context) {
    final totalPaid = invoices
        .where((i) => i.isPaid)
        .fold<int>(0, (sum, i) => sum + i.totalPaise);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Row(
        children: [
          Icon(Icons.receipt_long_rounded, size: 20, color: AppColors.primary),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Total invoiced',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: AppSpacing.xxxs),
                Text(
                  '₹${(totalPaid / 100).toStringAsFixed(0)}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '${invoices.length} invoice${invoices.length == 1 ? '' : 's'}',
            style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
          ),
        ],
      ),
    );
  }
}

class _InvoiceTile extends StatelessWidget {
  const _InvoiceTile({required this.invoice});
  final InvoiceRecord invoice;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('d MMM yyyy');
    return SectionCard(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        onTap: () => context.push(AppRoutes.invoiceDetail(invoice.id)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    invoice.invoiceNumber,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                AppStatusChip(label: invoice.status, colorMap: _invoiceStatusColorMap),
              ],
            ),
            const SizedBox(height: 6),
            if (invoice.serviceLabel != null && invoice.serviceLabel!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  invoice.serviceLabel!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ),
            Row(
              children: [
                Icon(Icons.calendar_today_rounded, size: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                const SizedBox(width: 4),
                Text(
                  fmt.format(invoice.invoiceDate),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
                const Spacer(),
                Text(
                  invoice.amountLabel,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 18, width: 160),
                SizedBox(height: 10),
                LoadingShimmer(height: 14),
                SizedBox(height: 8),
                LoadingShimmer(height: 14, width: 80),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
