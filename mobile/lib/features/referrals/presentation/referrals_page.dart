import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../data/referrals_repository.dart';
import '../domain/referral_models.dart';

final _currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
String _inr(int n) => _currencyFormat.format(n);

class ReferralsPage extends ConsumerStatefulWidget {
  const ReferralsPage({super.key});

  @override
  ConsumerState<ReferralsPage> createState() => _ReferralsPageState();
}

class _ReferralsPageState extends ConsumerState<ReferralsPage> {
  bool _creating = false;
  bool _requestingPayout = false;
  int _payoutPoints = 50;
  String _payoutMsg = '';

  Future<void> _refresh() async {
    ref.invalidate(referralBundleProvider);
    await ref.read(referralBundleProvider.future);
  }

  Future<void> _createCode() async {
    setState(() => _creating = true);
    try {
      await ref.read(referralsRepositoryProvider).createCode();
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) _showError(e.message);
    } catch (e) {
      if (mounted) _showError('Failed to generate code.');
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  void _shareCode(String code) {
    ref.read(referralsRepositoryProvider).shareCode(code);
  }

  Future<void> _requestPayout(int availablePoints) async {
    if (_payoutPoints < 50) {
      _showError('Minimum 50 points required.');
      return;
    }
    if (_payoutPoints > availablePoints) {
      _showError('You only have $availablePoints points available.');
      return;
    }

    setState(() {
      _requestingPayout = true;
      _payoutMsg = '';
    });
    try {
      final msg = await ref.read(referralsRepositoryProvider).requestPayout(_payoutPoints);
      if (mounted) setState(() => _payoutMsg = msg);
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) setState(() => _payoutMsg = e.message);
    } catch (e) {
      if (mounted) setState(() => _payoutMsg = 'Failed to request payout.');
    } finally {
      if (mounted) setState(() => _requestingPayout = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.danger),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bundleAsync = ref.watch(referralBundleProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Referrals')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              Text('Invite providers, earn \u{20B9}50 per signup.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.inkSubtle)),
              const SizedBox(height: 16),
              ServiqAsyncBody<ReferralBundle>(
                value: bundleAsync,
                errorTitle: 'Unable to load referrals',
                onRetry: _refresh,
                data: (bundle) => _buildContent(bundle),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(ReferralBundle bundle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader(bundle),
        const SizedBox(height: 16),
        _buildStats(bundle),
        const SizedBox(height: 16),
        _buildPayoutSection(bundle.availablePoints),
        const SizedBox(height: 16),
        _buildCodesSection(bundle.codes),
        if (bundle.referrals.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildReferralHistory(bundle.referrals),
        ],
        if (bundle.payouts.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildPayoutHistory(bundle.payouts),
        ],
      ],
    );
  }

  Widget _buildHeader(ReferralBundle bundle) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Referrals', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          ],
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.warningSoft,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              const Text('Available', style: TextStyle(fontSize: 10, color: AppColors.warning)),
              Text(_inr(bundle.availablePoints), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.warning)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStats(ReferralBundle bundle) {
    return Row(
      children: [
        Expanded(child: _statCard(Icons.card_giftcard, 'Codes', '${bundle.codes.length}')),
        const SizedBox(width: 10),
        Expanded(child: _statCard(Icons.people_outline, 'Referred', '${bundle.referrals.length}')),
        const SizedBox(width: 10),
        Expanded(child: _statCard(Icons.account_balance_wallet_outlined, 'Earned', _inr(bundle.totalRewards))),
      ],
    );
  }

  Widget _statCard(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Icon(icon, size: 24, color: AppColors.primary),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.ink)),
        ],
      ),
    );
  }

  Widget _buildPayoutSection(int availablePoints) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Request Payout', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('1 point = \u{20B9}1. Minimum 50 points to withdraw.',
              style: TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
          const SizedBox(height: 12),
          Row(
            children: [
              SizedBox(
                width: 100,
                child: TextField(
                  keyboardType: TextInputType.number,
                  controller: TextEditingController(text: '$_payoutPoints'),
                  onChanged: (v) {
                    final parsed = int.tryParse(v);
                    if (parsed != null) setState(() => _payoutPoints = parsed < 50 ? 50 : parsed);
                  },
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text('points = ${_inr(_payoutPoints)}',
                  style: const TextStyle(fontSize: 13, color: AppColors.inkSubtle)),
              const Spacer(),
              FilledButton(
                onPressed: (_requestingPayout || _payoutPoints < 50 || _payoutPoints > availablePoints)
                    ? null
                    : () => _requestPayout(availablePoints),
                child: _requestingPayout
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Request'),
              ),
            ],
          ),
          if (_payoutMsg.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(_payoutMsg, style: const TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCodesSection(List<ReferralCode> codes) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Referral Codes', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              FilledButton.tonalIcon(
                onPressed: _creating ? null : _createCode,
                icon: _creating
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.add, size: 16),
                label: Text(_creating ? 'Creating...' : 'Generate'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (codes.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: EmptyStateView(
                title: 'No codes yet',
                message: 'Generate your first referral code to start earning.',
              ),
            )
          else
            ...codes.map((c) => _codeRow(c)),
        ],
      ),
    );
  }

  Widget _codeRow(ReferralCode c) {
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
                Text(c.code, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.primary)),
                const SizedBox(height: 2),
                Text('${c.timesUsed} used · ${_inr(c.rewardPoints)} each',
                    style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
              ],
            ),
          ),
          OutlinedButton.icon(
            onPressed: () => _shareCode(c.code),
            icon: const Icon(Icons.share, size: 14),
            label: const Text('Share'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              minimumSize: Size.zero,
              textStyle: const TextStyle(fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReferralHistory(List<ReferralEvent> referrals) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Referral History', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          ...referrals.map((r) => _referralRow(r)),
        ],
      ),
    );
  }

  Widget _referralRow(ReferralEvent r) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
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
                Text('${r.referredName ?? "Someone"} joined',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 2),
                Text('${r.createdAt.day}/${r.createdAt.month}/${r.createdAt.year}',
                    style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.successSoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text('+${_inr(r.rewardPoints)}',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.success)),
          ),
        ],
      ),
    );
  }

  Widget _buildPayoutHistory(List<ReferralPayout> payouts) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Payout History', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          ...payouts.map((p) => _payoutRow(p)),
        ],
      ),
    );
  }

  Widget _payoutRow(ReferralPayout p) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
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
                Text(_inr(p.amountPaise ~/ 100),
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(height: 2),
                Text('${p.pointsRedeemed} pts · ${p.createdAt.day}/${p.createdAt.month}/${p.createdAt.year}',
                    style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
              ],
            ),
          ),
          _payoutStatusChip(p.status),
        ],
      ),
    );
  }

  Widget _payoutStatusChip(String status) {
    Color bg;
    Color fg;
    switch (status) {
      case 'pending':
        bg = AppColors.warningSoft; fg = AppColors.warning;
      case 'processing':
        bg = AppColors.accentSoft; fg = AppColors.accent;
      case 'completed':
        bg = AppColors.successSoft; fg = AppColors.success;
      case 'failed':
        bg = AppColors.dangerSoft; fg = AppColors.danger;
      default:
        bg = AppColors.surfaceAlt; fg = AppColors.inkSubtle;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(status[0].toUpperCase() + status.substring(1),
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
    );
  }
}
