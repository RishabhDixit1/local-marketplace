import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../data/invoices_repository.dart';
import '../domain/invoice_models.dart';

class InvoiceDetailPage extends ConsumerWidget {
  const InvoiceDetailPage({super.key, required this.invoiceId});
  final String invoiceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(
      FutureProvider.autoDispose<InvoiceDetail>((ref) async {
        return ref
            .read(invoicesRepositoryProvider)
            .fetchInvoice(invoiceId: invoiceId);
      }),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Invoice')),
      body: SafeArea(
        child: async.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: _Loading(),
          ),
          error: (e, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 40, color: AppColors.danger),
                const SizedBox(height: 12),
                Text(AppErrorMapper.toMessage(e)),
                const SizedBox(height: 12),
                FilledButton.tonal(
                  onPressed: () => ref.invalidate(
                    FutureProvider.autoDispose<InvoiceDetail>((ref) async {
                      return ref
                          .read(invoicesRepositoryProvider)
                          .fetchInvoice(invoiceId: invoiceId);
                    }),
                  ),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (invoice) => _InvoiceDetail(invoice: invoice),
        ),
      ),
    );
  }
}

class _InvoiceDetail extends StatelessWidget {
  const _InvoiceDetail({required this.invoice});
  final InvoiceDetail invoice;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('d MMMM yyyy');
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      invoice.invoiceNumber,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  _StatusChip(status: invoice.status),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                fmt.format(invoice.invoiceDate),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              if (invoice.serviceLabel != null &&
                  invoice.serviceLabel!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  invoice.serviceLabel!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tax Invoice',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Valid under GST',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 16),
              _LineItem(label: 'Subtotal', value: invoice.subtotalLabel),
              _LineItem(
                label: 'Platform commission (12.5%)',
                value: invoice.commissionLabel,
              ),
              const Divider(height: 20),
              _LineItem(
                label: 'CGST @ ${invoice.gstRateLabel}',
                value: invoice.gstCgstLabel,
              ),
              _LineItem(
                label: 'SGST @ ${invoice.gstRateLabel}',
                value: invoice.gstSgstLabel,
              ),
              if (invoice.gstIgstPaise > 0)
                _LineItem(
                  label: 'IGST',
                  value: invoice.gstIgstLabel,
                ),
              const Divider(height: 20),
              _LineItem(
                label: 'Total',
                value: invoice.totalLabel,
                bold: true,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LineItem extends StatelessWidget {
  const _LineItem({
    required this.label,
    required this.value,
    this.bold = false,
  });

  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final style = bold
        ? Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          )
        : Theme.of(context).textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          Text(value, style: style),
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
        2,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 20, width: 200),
                SizedBox(height: 12),
                LoadingShimmer(height: 14),
                SizedBox(height: 8),
                LoadingShimmer(height: 14, width: 120),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
