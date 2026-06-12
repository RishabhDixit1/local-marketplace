import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/components/empty_state_view.dart';
import '../data/payment_repository.dart';
import '../domain/payment_models.dart';

class TransactionsPage extends ConsumerWidget {
  const TransactionsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(transactionHistoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Transactions')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 40, color: AppColors.danger),
              const SizedBox(height: 12),
              Text('Unable to load transactions',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.inkSubtle)),
              const SizedBox(height: 12),
              FilledButton.tonal(
                onPressed: () => ref.invalidate(transactionHistoryProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (transactions) {
          if (transactions.isEmpty) {
            return const Center(
              child: EmptyStateView(
                title: 'No transactions yet',
                message: 'Your payment history will appear here after you place an order.',
              ),
            );
          }

          final total = transactions.fold<double>(0, (sum, t) => sum + (t.isPaid ? t.amount : 0));

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              // Summary card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.account_balance_wallet, size: 20, color: AppColors.primary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Total spent',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.inkSubtle)),
                          const SizedBox(height: 2),
                          Text('₹${total.toStringAsFixed(0)}',
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                    Text('${transactions.length} order${transactions.length == 1 ? '' : 's'}',
                        style: const TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              ...transactions.map((t) => _TransactionTile(transaction: t)),
            ],
          );
        },
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final TransactionRecord transaction;

  const _TransactionTile({required this.transaction});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        onTap: () => context.push(AppRoutes.orderDetail(transaction.orderId)),
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: transaction.isPaid
                      ? AppColors.primarySoft
                      : transaction.isRefunded
                          ? AppColors.dangerSoft
                          : AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  transaction.isPaid ? Icons.check_circle : transaction.isRefunded ? Icons.replay : Icons.access_time,
                  size: 18,
                  color: transaction.isPaid ? AppColors.primary : transaction.isRefunded ? AppColors.danger : AppColors.inkSubtle,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(transaction.title,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(
                      '${transaction.paymentMethod.toUpperCase()} · ${transaction.statusLabel}',
                      style: TextStyle(fontSize: 11, color: transaction.isPaid ? AppColors.primary : transaction.isRefunded ? AppColors.danger : AppColors.inkSubtle),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('₹${transaction.amount.toStringAsFixed(0)}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  if (transaction.createdAt != null)
                    Text(
                      '${transaction.createdAt!.day}/${transaction.createdAt!.month}/${transaction.createdAt!.year}',
                      style: const TextStyle(fontSize: 10, color: AppColors.inkFaint),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
