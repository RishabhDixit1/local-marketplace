import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../data/promotions_repository.dart';
import '../domain/promotion_models.dart';

class ProviderBoostsPage extends ConsumerStatefulWidget {
  const ProviderBoostsPage({super.key});

  @override
  ConsumerState<ProviderBoostsPage> createState() => _ProviderBoostsPageState();
}

class _ProviderBoostsPageState extends ConsumerState<ProviderBoostsPage> {
  late Razorpay _razorpay;
  BoostPurchaseOrder? _pendingOrder;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(boostDataProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Boosts')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(boostDataProvider);
          await ref.read(boostDataProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            ServiqAsyncBody<BoostData>(
              value: async,
              errorTitle: 'Unable to load boosts',
              errorMessageFor: (e, _) => AppErrorMapper.toMessage(e),
              onRetry: () => ref.invalidate(boostDataProvider),
              loadingBuilder: () => const _Loading(),
              data: (data) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Hero(remaining: data.remainingBoosts),
                  const SizedBox(height: 16),
                  _PlacementSection(
                    title: 'Active',
                    placements: data.active,
                    emptyMessage: 'No active boosts.',
                    icon: Icons.trending_up_rounded,
                    color: AppColors.verified,
                  ),
                  const SizedBox(height: 16),
                  _PlacementSection(
                    title: 'Upcoming',
                    placements: data.upcoming,
                    emptyMessage: 'No upcoming boosts.',
                    icon: Icons.schedule_rounded,
                    color: AppColors.accent,
                  ),
                  const SizedBox(height: 16),
                  _PlacementSection(
                    title: 'Expired',
                    placements: data.expired,
                    emptyMessage: 'No expired boosts.',
                    icon: Icons.history_rounded,
                    color: AppColors.inkFaint,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Purchase a boost',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  ...data.plans.map(
                    (plan) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _BoostPlanCard(
                        plan: plan,
                        onPurchase: () => _purchaseBoost(plan),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _purchaseBoost(BoostPlanOption plan) async {
    try {
      final order = await ref.read(promotionsRepositoryProvider).createBoostOrder(plan.duration);
      setState(() => _pendingOrder = order);

      _razorpay.open({
        'key': order.keyId,
        'order_id': order.orderId,
        'amount': order.amount,
        'currency': order.currency,
        'name': 'ServiQ Boost',
        'description': '${plan.label} Boost Promotion',
        'prefill': {'contact': '', 'email': ''},
      });
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (e) {
      _showError(AppErrorMapper.toMessage(e));
    }
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) {
    final order = _pendingOrder;
    if (order == null) return;
    setState(() => _pendingOrder = null);

    ref.read(promotionsRepositoryProvider).verifyBoostPayment(
      razorpayOrderId: response.orderId ?? order.orderId,
      razorpayPaymentId: response.paymentId ?? '',
      razorpaySignature: response.signature ?? '',
    ).then((_) {
      ref.invalidate(boostDataProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Boost activated successfully!')),
        );
      }
    }).catchError((e) {
      if (mounted) {
        _showError(AppErrorMapper.toMessage(e));
      }
    });
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    setState(() => _pendingOrder = null);
    _showError(response.message ?? 'Payment cancelled');
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    _showError('External wallet selected: ${response.walletName}');
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.danger,
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.remaining});
  final int remaining;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Boost your listings',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 4),
                Text(
                  'Get featured placement in search results and the feed.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: [
                Text(
                  '$remaining',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
                Text(
                  'remaining',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PlacementSection extends StatelessWidget {
  const _PlacementSection({
    required this.title,
    required this.placements,
    required this.emptyMessage,
    required this.icon,
    required this.color,
  });

  final String title;
  final List<BoostPlacement> placements;
  final String emptyMessage;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 6),
            Text(
              title,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${placements.length}',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (placements.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              emptyMessage,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.inkSubtle,
              ),
            ),
          )
        else
          ...placements.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: _PlacementTile(placement: p),
            ),
          ),
      ],
    );
  }
}

class _PlacementTile extends StatelessWidget {
  const _PlacementTile({required this.placement});
  final BoostPlacement placement;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('d MMM');
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(placement.placementType.replaceAll('_', ' ')),
                const SizedBox(height: 4),
                Text(
                  '${fmt.format(placement.startsAt)} – ${fmt.format(placement.endsAt)}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.inkSubtle,
                  ),
                ),
              ],
            ),
          ),
          if (placement.pricePaise != null)
            Text(
              '₹${(placement.pricePaise! / 100).toStringAsFixed(0)}',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
        ],
      ),
    );
  }
}

class _BoostPlanCard extends StatelessWidget {
  const _BoostPlanCard({required this.plan, required this.onPurchase});
  final BoostPlanOption plan;
  final VoidCallback onPurchase;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plan.label,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  plan.priceLabel,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          FilledButton(
            onPressed: onPurchase,
            child: const Text('Buy'),
          ),
        ],
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
        4,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 20, width: 160),
                SizedBox(height: 12),
                LoadingShimmer(height: 50),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
