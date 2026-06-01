import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/serviq_async_state.dart';
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
      _showError('Enter a valid amount (minimum ₹1).');
      return;
    }
    final amountPaise = amount * 100;
    if (amountPaise > availablePaise) {
      _showError('Insufficient balance. Available: ${_inr(availablePaise)}');
      return;
    }

    setState(() => _submitting = true);
    try {
      await ref.read(payoutsRepositoryProvider).requestPayout(
            amountPaise: amountPaise,
            payoutMethod: _selectedMethod,
          );
      _amountController.clear();
      if (mounted) _showSuccess('Payout requested successfully.');
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) _showError(e.message);
    } catch (e) {
      if (mounted) _showError('Failed to request payout.');
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
        _showError('Fill all bank account fields.');
        return;
      }
      body['account_holder_name'] = holder;
      body['bank_name'] = bank;
      body['account_number'] = number;
      body['ifsc_code'] = ifsc;
    } else {
      final upi = _upiController.text.trim();
      if (upi.isEmpty) {
        _showError('Enter your UPI handle.');
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
      if (mounted) _showSuccess('Account added.');
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) _showError(e.message);
    } catch (e) {
      if (mounted) _showError('Failed to add account.');
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
      if (mounted) _showSuccess('Account deleted.');
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) _showError(e.message);
    } catch (e) {
      if (mounted) _showError('Failed to delete account.');
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.danger),
    );
  }

  void _showSuccess(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.success),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bundleAsync = ref.watch(payoutsBundleProvider);
    final accountsAsync = ref.watch(payoutAccountsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Payouts')),
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
        const SizedBox(height: 20),
        _buildWithdrawSection(summary.availablePaise),
        const SizedBox(height: 20),
        _buildAccountsSection(accountsAsync),
        const SizedBox(height: 20),
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
            Expanded(child: PayoutSummaryCard(label: 'Paid out', paise: s.totalPaidOutPaise, accentColor: AppColors.inkSubtle)),
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
          const SizedBox(height: 12),
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Amount (₹)',
              hintText: 'e.g. 500',
              border: const OutlineInputBorder(),
              suffixText: 'Available: ${_inr(availablePaise)}',
              suffixStyle: const TextStyle(fontSize: 11, color: AppColors.inkSubtle),
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _selectedMethod,
            items: const [
              DropdownMenuItem(value: 'bank', child: Text('Bank transfer')),
              DropdownMenuItem(value: 'upi', child: Text('UPI')),
            ],
            onChanged: (v) {
              if (v != null) setState(() => _selectedMethod = v);
            },
            decoration: const InputDecoration(
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
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
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
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text('No payout accounts yet.', style: TextStyle(color: AppColors.inkSubtle, fontSize: 13)),
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
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(
            a.accountType == 'upi' ? Icons.mobile_friendly_rounded : Icons.account_balance_rounded,
            size: 20,
            color: AppColors.inkSubtle,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(a.displayName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    if (a.isDefault) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text('Default', style: TextStyle(fontSize: 9, color: AppColors.primary, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ],
                ),
                if (a.accountHolderName != null && a.accountHolderName!.isNotEmpty)
                  Text(a.accountHolderName!, style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
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
              const SizedBox(width: 8),
              _typeToggle('UPI', 'upi'),
            ],
          ),
          const SizedBox(height: 10),
          if (_newAccountType == 'bank') ...[
            TextField(controller: _holderController, decoration: const InputDecoration(labelText: 'Account holder name', border: OutlineInputBorder()),),
            const SizedBox(height: 8),
            TextField(controller: _bankNameController, decoration: const InputDecoration(labelText: 'Bank name', border: OutlineInputBorder()),),
            const SizedBox(height: 8),
            TextField(controller: _accountNumController, decoration: const InputDecoration(labelText: 'Account number', border: OutlineInputBorder()), keyboardType: TextInputType.number,),
            const SizedBox(height: 8),
            TextField(controller: _ifscController, decoration: const InputDecoration(labelText: 'IFSC code', border: OutlineInputBorder()),),
          ] else ...[
            TextField(controller: _upiController, decoration: const InputDecoration(labelText: 'UPI handle (e.g. name@upi)', border: OutlineInputBorder()),),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _addingAccount ? null : _addAccount,
              child: _addingAccount
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
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
          side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Text(label, style: TextStyle(color: selected ? AppColors.primary : AppColors.inkSubtle)),
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
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('No withdrawals yet.', style: TextStyle(color: AppColors.inkSubtle, fontSize: 13)),
            )
          else
            ...payouts.map((p) => _historyRow(p)),
        ],
      ),
    );
  }

  Widget _historyRow(PayoutTransaction p) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
                Text(_inr(p.amountPaise), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(height: 2),
                Text(
                  '${_methodLabel(p.payoutMethod)} · ${_formatDate(p.createdAt)}',
                  style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle),
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
