import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../data/payouts_repository.dart';
import '../domain/payout_models.dart';
import 'payout_status_chip.dart';
import 'payout_summary_card.dart';

final _currencyFormat = NumberFormat.currency(
  locale: 'en_IN',
  symbol: '₹',
  decimalDigits: 0,
);

String _inr(int paise) => _currencyFormat.format(paise / 100);

class PayoutsPage extends ConsumerStatefulWidget {
  const PayoutsPage({super.key});

  @override
  ConsumerState<PayoutsPage> createState() => _PayoutsPageState();
}

class _PayoutsPageState extends ConsumerState<PayoutsPage> {
  final _amountController = TextEditingController();
  String _selectedMethod = 'bank';
  bool _submitting = false;

  final _showAddAccount = ValueNotifier(false);
  String _newAccountType = 'bank';
  final _holderController = TextEditingController();
  final _bankNameController = TextEditingController();
  final _accountNumController = TextEditingController();
  final _ifscController = TextEditingController();
  final _upiController = TextEditingController();
  bool _addingAccount = false;

  @override
  void dispose() {
    _amountController.dispose();
    _holderController.dispose();
    _bankNameController.dispose();
    _accountNumController.dispose();
    _ifscController.dispose();
    _upiController.dispose();
    _showAddAccount.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(payoutsBundleProvider);
    ref.invalidate(payoutAccountsProvider);
    await Future.wait([
      ref.read(payoutsBundleProvider.future),
      ref.read(payoutAccountsProvider.future),
    ]);
  }

  Future<void> _requestPayout(int availablePaise) async {
    final amountText = _amountController.text.trim();
    final amount = int.tryParse(amountText);
    if (amount == null || amount < 1) {
      ServiqToast.show(context, message: 'Enter a valid amount (minimum ₹1).', tone: ServiqToastTone.danger);
      return;
    }
    final amountPaise = amount * 100;
    if (amountPaise > availablePaise) {
      ServiqToast.show(context, message: 'Insufficient balance. Available: ${_inr(availablePaise)}', tone: ServiqToastTone.danger);
      return;
    }

    setState(() => _submitting = true);
    try {
      await ref.read(payoutsRepositoryProvider).requestPayout(
            amountPaise: amountPaise,
            payoutMethod: _selectedMethod,
          );
      _amountController.clear();
      if (mounted) ServiqToast.show(context, message: 'Payout requested successfully.', tone: ServiqToastTone.success);
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) ServiqToast.show(context, message: e.message, tone: ServiqToastTone.danger);
    } catch (e) {
      if (mounted) ServiqToast.show(context, message: 'Failed to request payout.', tone: ServiqToastTone.danger);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _addAccount() async {
    final body = <String, dynamic>{
      'account_type': _newAccountType,
    };

    if (_newAccountType == 'bank') {
      final holder = _holderController.text.trim();
      final bank = _bankNameController.text.trim();
      final number = _accountNumController.text.trim();
      final ifsc = _ifscController.text.trim();
      if (holder.isEmpty || bank.isEmpty || number.isEmpty || ifsc.isEmpty) {
        ServiqToast.show(context, message: 'Fill all bank account fields.', tone: ServiqToastTone.danger);
        return;
      }
      body['account_holder_name'] = holder;
      body['bank_name'] = bank;
      body['account_number'] = number;
      body['ifsc_code'] = ifsc;
    } else {
      final upi = _upiController.text.trim();
      if (upi.isEmpty) {
        ServiqToast.show(context, message: 'Enter your UPI handle.', tone: ServiqToastTone.danger);
        return;
      }
      body['upi_handle'] = upi;
    }

    setState(() => _addingAccount = true);
    try {
      await ref.read(payoutsRepositoryProvider).addAccount(body);
      _holderController.clear();
      _bankNameController.clear();
      _accountNumController.clear();
      _ifscController.clear();
      _upiController.clear();
      _showAddAccount.value = false;
      if (mounted) ServiqToast.show(context, message: 'Account added.', tone: ServiqToastTone.success);
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) ServiqToast.show(context, message: e.message, tone: ServiqToastTone.danger);
    } catch (e) {
      if (mounted) ServiqToast.show(context, message: 'Failed to add account.', tone: ServiqToastTone.danger);
    } finally {
      if (mounted) setState(() => _addingAccount = false);
    }
  }

  Future<void> _deleteAccount(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(payoutsRepositoryProvider).deleteAccount(id);
      if (mounted) ServiqToast.show(context, message: 'Account deleted.', tone: ServiqToastTone.success);
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) ServiqToast.show(context, message: e.message, tone: ServiqToastTone.danger);
    } catch (e) {
      if (mounted) ServiqToast.show(context, message: 'Failed to delete account.', tone: ServiqToastTone.danger);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bundleAsync = ref.watch(payoutsBundleProvider);
    final accountsAsync = ref.watch(payoutAccountsProvider);

    return ServiqScaffold(
      appBar: ServiqTopBar(title: 'Payouts'),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              ServiqAsyncBody<PayoutsBundle>(
                value: bundleAsync,
                errorTitle: 'Unable to load payouts',
                onRetry: _refresh,
                data: (bundle) => _buildContent(bundle, accountsAsync),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(PayoutsBundle bundle, AsyncValue<List<PayoutAccount>> accountsAsync) {
    final summary = bundle.summary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSummaryGrid(summary),
        const SizedBox(height: AppSpacing.lg),
        _buildWithdrawSection(summary.availablePaise),
        const SizedBox(height: AppSpacing.lg),
        _buildAccountsSection(accountsAsync),
        const SizedBox(height: AppSpacing.lg),
        _buildHistorySection(bundle.payouts),
      ],
    );
  }

  Widget _buildSummaryGrid(PayoutSummary s) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Overview', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: PayoutSummaryCard(label: 'Total earned', paise: s.totalEarnedPaise, accentColor: AppColors.primary)),
            const SizedBox(width: 10),
            Expanded(child: PayoutSummaryCard(label: 'Paid out', paise: s.totalPaidOutPaise, accentColor: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: PayoutSummaryCard(label: 'Pending', paise: s.totalPendingPaise, accentColor: AppColors.warning)),
            const SizedBox(width: 10),
            Expanded(child: PayoutSummaryCard(label: 'Available', paise: s.availablePaise, accentColor: AppColors.success)),
          ],
        ),
      ],
    );
  }

  Widget _buildWithdrawSection(int availablePaise) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Request withdrawal', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: AppSpacing.sm),
          AppTextField(
            label: 'Amount (₹)',
            controller: _amountController,
            keyboardType: TextInputType.number,
            hint: 'e.g. 500',
            suffixText: 'Available: ${_inr(availablePaise)}',
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            // ignore: deprecated_member_use – reactive value needed; initialValue is read-once
            value: _selectedMethod,
            items: const [
              DropdownMenuItem(value: 'bank', child: Text('Bank transfer')),
              DropdownMenuItem(value: 'upi', child: Text('UPI')),
            ],
            onChanged: (v) {
              if (v != null) setState(() => _selectedMethod = v);
            },
            decoration: InputDecoration(
              labelText: 'Payout method',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _submitting ? null : () => _requestPayout(availablePaise),
              child: _submitting
                  ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary))
                  : const Text('Withdraw'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountsSection(AsyncValue<List<PayoutAccount>> accountsAsync) {
    return accountsAsync.when(
      data: (accounts) {
        final list = accounts;
        return SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Payout accounts', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  TextButton.icon(
                    onPressed: () => _showAddAccount.value = !_showAddAccount.value,
                    icon: Icon(_showAddAccount.value ? Icons.close : Icons.add, size: 18),
                    label: Text(_showAddAccount.value ? 'Cancel' : 'Add'),
                  ),
                ],
              ),
              if (list.isEmpty && !_showAddAccount.value)
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text('No payout accounts yet.', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6), fontSize: 13)),
                ),
              ...list.map((a) => _accountTile(a)),
              ValueListenableBuilder<bool>(
                valueListenable: _showAddAccount,
                builder: (_, show, _) {
                  if (!show) return const SizedBox.shrink();
                  return _addAccountForm();
                },
              ),
            ],
          ),
        );
      },
      loading: () => const Center(child: Padding(
        padding: EdgeInsets.all(16),
        child: CircularProgressIndicator(),
      )),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(8),
        child: Text('Could not load accounts.', style: TextStyle(color: AppColors.danger, fontSize: 13)),
      ),
    );
  }

  Widget _accountTile(PayoutAccount a) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(
            a.accountType == 'upi' ? Icons.mobile_friendly_rounded : Icons.account_balance_rounded,
            size: 20,
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(a.displayName, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    if (a.isDefault) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(AppRadii.md),
                        ),
                        child: const Text('Default', style: TextStyle(fontSize: 9, color: AppColors.primary, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ],
                ),
                if (a.accountHolderName != null && a.accountHolderName!.isNotEmpty)
                  Text(a.accountHolderName!, style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.danger),
            onPressed: () => _deleteAccount(a.id),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }

  Widget _addAccountForm() {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _typeToggle('Bank', 'bank'),
              const SizedBox(width: AppSpacing.xs),
              _typeToggle('UPI', 'upi'),
            ],
          ),
          const SizedBox(height: 10),
          if (_newAccountType == 'bank') ...[
            AppTextField(controller: _holderController, label: 'Account holder name'),
            const SizedBox(height: AppSpacing.xs),
            AppTextField(controller: _bankNameController, label: 'Bank name'),
            const SizedBox(height: AppSpacing.xs),
            AppTextField(controller: _accountNumController, label: 'Account number', keyboardType: TextInputType.number),
            const SizedBox(height: AppSpacing.xs),
            AppTextField(controller: _ifscController, label: 'IFSC code'),
          ] else ...[
            AppTextField(controller: _upiController, label: 'UPI handle (e.g. name@upi)'),
          ],
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _addingAccount ? null : _addAccount,
              child: _addingAccount
                  ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary))
                  : const Text('Save account'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _typeToggle(String label, String value) {
    final selected = _newAccountType == value;
    return Expanded(
      child: OutlinedButton(
        onPressed: () => setState(() => _newAccountType = value),
        style: OutlinedButton.styleFrom(
          backgroundColor: selected ? AppColors.primarySoft : null,
          side: BorderSide(color: selected ? AppColors.primary : Theme.of(context).colorScheme.outline),
        ),
        child: Text(label, style: TextStyle(color: selected ? AppColors.primary : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
      ),
    );
  }

  Widget _buildHistorySection(List<PayoutTransaction> payouts) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Withdrawal history', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          if (payouts.isEmpty)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('No withdrawals yet.', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6), fontSize: 13)),
            )
          else
            ...payouts.map((p) => _historyRow(p)),
        ],
      ),
    );
  }

  Widget _historyRow(PayoutTransaction p) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_inr(p.amountPaise), style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(height: AppSpacing.xxxs),
                Text(
                  '${_methodLabel(p.payoutMethod)} · ${_formatDate(p.createdAt)}',
                  style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                ),
              ],
            ),
          ),
          PayoutStatusChip(status: p.status),
        ],
      ),
    );
  }

  String _methodLabel(String method) {
    switch (method) {
      case 'upi':
        return 'UPI';
      case 'bank':
        return 'Bank';
      case 'wallet':
        return 'Wallet';
      default:
        return method;
    }
  }

  String _formatDate(DateTime dt) {
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}
