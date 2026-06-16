import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../data/invoices_repository.dart';
import '../domain/invoice_models.dart';

class InvoicesPage extends ConsumerWidget {
  const InvoicesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(invoiceListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Invoices')),
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
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.receipt_long_rounded, size: 20, color: AppColors.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Total invoiced',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.inkSubtle,
                  ),
                ),
                const SizedBox(height: 2),
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
            style: const TextStyle(fontSize: 12, color: AppColors.inkSubtle),
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
              _StatusChip(status: invoice.status),
            ],
          ),
          const SizedBox(height: 6),
          if (invoice.serviceLabel != null && invoice.serviceLabel!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                invoice.serviceLabel!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.inkSubtle,
                ),
              ),
            ),
          Row(
            children: [
              Icon(Icons.calendar_today_rounded, size: 12, color: AppColors.inkFaint),
              const SizedBox(width: 4),
              Text(
                fmt.format(invoice.invoiceDate),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.inkSubtle,
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
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (status) {
      'paid' => (AppColors.successSoft, AppColors.success),
      'cancelled' => (AppColors.dangerSoft, AppColors.danger),
      'refunded' => (AppColors.accentSoft, AppColors.accent),
      _ => (AppColors.primarySoft, AppColors.primary),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: fg,
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
