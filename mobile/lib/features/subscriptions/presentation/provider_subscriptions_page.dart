import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../data/subscriptions_repository.dart';
import '../domain/subscription_models.dart';

class ProviderSubscriptionsPage extends ConsumerStatefulWidget {
  const ProviderSubscriptionsPage({super.key});

  @override
  ConsumerState<ProviderSubscriptionsPage> createState() =>
      _ProviderSubscriptionsPageState();
}

class _ProviderSubscriptionsPageState
    extends ConsumerState<ProviderSubscriptionsPage> {
  late Razorpay _razorpay;
  SubscriptionPurchaseOrder? _pendingOrder;

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
    final plansAsync = ref.watch(subscriptionPlansProvider);
    final currentAsync = ref.watch(currentSubscriptionProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Subscriptions')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(subscriptionPlansProvider);
          ref.invalidate(currentSubscriptionProvider);
          await Future.wait([
            ref.read(subscriptionPlansProvider.future),
            ref.read(currentSubscriptionProvider.future),
          ]);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            ServiqAsyncBody<List<SubscriptionPlan>>(
              value: plansAsync,
              errorTitle: 'Unable to load plans',
              errorMessageFor: (e, _) => AppErrorMapper.toMessage(e),
              onRetry: () => ref.invalidate(subscriptionPlansProvider),
              loadingBuilder: () => const _Loading(),
              data: (plans) {
                final current = currentAsync.asData?.value;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (current != null) _CurrentSubscriptionBanner(subscription: current),
                    if (current != null) const SizedBox(height: 16),
                    Text(
                      'Choose a plan',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      current == null
                          ? 'You are not subscribed yet. Pick a plan to get started.'
                          : 'Upgrade or switch your plan anytime.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.inkSubtle,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ...plans.map(
                      (plan) => Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: _PlanCard(
                          plan: plan,
                          isCurrentPlan: current?.planId == plan.id,
                          onSubscribe: plan.isFree
                              ? null
                              : () => _purchaseSubscription(plan),
                        ),
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

  Future<void> _purchaseSubscription(SubscriptionPlan plan) async {
    try {
      final order = await ref
          .read(subscriptionsRepositoryProvider)
          .createSubscriptionOrder(plan.id);
      setState(() => _pendingOrder = order);

      _razorpay.open({
        'key': order.keyId,
        'order_id': order.orderId,
        'amount': order.amount,
        'currency': order.currency,
        'name': 'ServiQ ${plan.name}',
        'description': '${plan.name} subscription',
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

    ref
        .read(subscriptionsRepositoryProvider)
        .verifySubscriptionPayment(
          razorpayOrderId: response.orderId ?? order.orderId,
          razorpayPaymentId: response.paymentId ?? '',
          razorpaySignature: response.signature ?? '',
          planId: order.plan.id,
        )
        .then((_) {
      ref.invalidate(subscriptionPlansProvider);
      ref.invalidate(currentSubscriptionProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Subscription activated!')),
        );
      }
    }).catchError((e) {
      if (mounted) _showError(AppErrorMapper.toMessage(e));
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

class _CurrentSubscriptionBanner extends StatelessWidget {
  const _CurrentSubscriptionBanner({required this.subscription});
  final ProviderSubRecord subscription;

  @override
  Widget build(BuildContext context) {
    final planName = subscription.plan?.name ?? 'Unknown';
    final statusColor = subscription.isActive ? AppColors.verified : AppColors.accent;
    final fmt = subscription.currentPeriodEnd != null
        ? '${subscription.currentPeriodEnd!.day}/${subscription.currentPeriodEnd!.month}/${subscription.currentPeriodEnd!.year}'
        : '—';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [statusColor.withValues(alpha: 0.12), AppColors.surface],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              subscription.isActive
                  ? Icons.verified_rounded
                  : Icons.warning_amber_rounded,
              color: statusColor,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$planName · ${subscription.statusLabel}',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Renews on $fmt',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.inkSubtle,
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

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.isCurrentPlan,
    this.onSubscribe,
  });

  final SubscriptionPlan plan;
  final bool isCurrentPlan;
  final VoidCallback? onSubscribe;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (plan.highlighted)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'Most popular',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          Row(
            children: [
              Expanded(
                child: Text(
                  plan.name,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    plan.priceLabel,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                  if (plan.intervalLabel.isNotEmpty)
                    Text(
                      plan.intervalLabel,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.inkSubtle,
                      ),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            plan.description,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          ...plan.features.map(
            (f) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.check_circle, size: 16, color: AppColors.verified),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(f, style: Theme.of(context).textTheme.bodySmall),
                  ),
                ],
              ),
            ),
          ),
          if (onSubscribe != null || isCurrentPlan) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: isCurrentPlan
                  ? OutlinedButton.icon(
                      onPressed: null,
                      icon: const Icon(Icons.check_rounded),
                      label: const Text('Current plan'),
                    )
                  : FilledButton.icon(
                      onPressed: onSubscribe!,
                      icon: const Icon(Icons.lock_open_rounded),
                      label: Text('Subscribe to ${plan.name}'),
                    ),
            ),
          ],
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
        3,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 20, width: 140),
                SizedBox(height: 12),
                LoadingShimmer(height: 14),
                SizedBox(height: 8),
                LoadingShimmer(height: 60),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
