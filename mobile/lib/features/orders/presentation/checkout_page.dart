import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../cart/application/cart_notifier.dart';
import '../../tasks/data/task_repository.dart';
import '../data/order_repository.dart';
import '../domain/order_models.dart';

enum _CheckoutStep { review, address, payment, confirm, done }

class CheckoutPage extends ConsumerStatefulWidget {
  const CheckoutPage({
    super.key,
    required this.item,
    this.fromCart = false,
  });

  final MobileCheckoutItem? item;
  final bool fromCart;

  @override
  ConsumerState<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends ConsumerState<CheckoutPage> {
  final _addressController = TextEditingController();
  final _notesController = TextEditingController();
  late final Razorpay _razorpay;
  var _step = _CheckoutStep.review;
  var _paymentMethod = MobileOrderPaymentMethod.cod;
  var _fulfillmentMethod = MobileOrderFulfillmentMethod.onsite;
  _PendingRazorpayCheckout? _pendingRazorpayCheckout;
  var _placing = false;
  String? _checkoutRecoveryMessage;
  String? _promoError;
  String? _successOrderId;

  static const _steps = [_CheckoutStep.review, _CheckoutStep.address, _CheckoutStep.payment, _CheckoutStep.confirm];

  List<MobileCheckoutItem> _resolveLines() {
    if (widget.item != null) {
      return [widget.item!];
    }
    if (widget.fromCart) {
      return (ref.read(cartProvider).value ?? [])
          .map((e) => e.toCheckoutItem())
          .toList();
    }
    return [];
  }

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
    if (widget.item?.itemType == 'product') {
      _fulfillmentMethod = MobileOrderFulfillmentMethod.delivery;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final cartLines =
          (ref.read(cartProvider).value ?? []).map((e) => e.toCheckoutItem());
      if (widget.fromCart &&
          cartLines.any((l) => l.itemType == 'product')) {
        setState(() => _fulfillmentMethod = MobileOrderFulfillmentMethod.delivery);
      }
      final lines = widget.item != null ? [widget.item!] : cartLines;
      if (lines.isEmpty) return;
      ref.read(analyticsServiceProvider).trackEvent(
            'checkout_started',
            extras: {
              'source': widget.fromCart ? 'cart' : 'direct',
              'line_count': lines.length,
              'item_type': lines.first.itemType,
              'provider_id': lines.first.providerId,
              'quantity': lines.fold<int>(0, (a, b) => a + b.quantity),
              'payment_method': _paymentMethod.apiValue,
            },
          );
    });
  }

  @override
  void dispose() {
    _razorpay.clear();
    _addressController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _maybeClearCart() async {
    if (widget.fromCart) {
      await ref.read(cartProvider.notifier).clear();
    }
  }

  void _goNext() {
    final idx = _steps.indexOf(_step);
    if (idx < _steps.length - 1) {
      setState(() => _step = _steps[idx + 1]);
    }
  }

  void _goBack() {
    if (_step == _CheckoutStep.review) {
      context.pop();
      return;
    }
    final idx = _steps.indexOf(_step);
    if (idx > 0) {
      setState(() => _step = _steps[idx - 1]);
    }
  }

  bool _validateStep() {
    setState(() => _checkoutRecoveryMessage = null);
    if (_step == _CheckoutStep.address) {
      if (_addressController.text.trim().isEmpty) {
        setState(() => _checkoutRecoveryMessage = 'Please enter an address or meeting point.');
        return false;
      }
    }
    return true;
  }

  Future<void> _placeOrder() async {
    final lines = _resolveLines();
    if (lines.isEmpty) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _placing = true;
      _checkoutRecoveryMessage = null;
      _promoError = null;
    });
    try {
      String? razorpayOrderId;
      MobileRazorpayOrder? paymentOrder;
      if (_paymentMethod == MobileOrderPaymentMethod.razorpay) {
        final amountPaise = lines
            .fold<double>(0, (a, b) => a + b.price * b.quantity)
            .clamp(0.0, 1e9);
        final paise = (amountPaise * 100).round();
        paymentOrder = await ref.read(orderRepositoryProvider).createRazorpayOrder(
              amountPaise: paise <= 0 ? 100 : paise,
              receipt: 'serviq-${DateTime.now().millisecondsSinceEpoch}',
            );
        razorpayOrderId = paymentOrder.orderId;
        if (paymentOrder.promoError != null) {
          setState(() => _promoError = paymentOrder!.promoError);
        }
      }

      final bulk = MobileBulkCheckoutRequest(
        items: lines,
        address: _addressController.text.trim(),
        notes: _notesController.text.trim(),
        paymentMethod: _paymentMethod,
        fulfillmentMethod: _fulfillmentMethod,
        razorpayOrderId: razorpayOrderId,
      );

      final result =
          await ref.read(orderRepositoryProvider).createBulkOrder(bulk);
      ref.invalidate(taskSnapshotProvider);
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      ref.read(analyticsServiceProvider).trackEvent(
            'order_created',
            extras: {
              'source': widget.fromCart ? 'cart' : 'direct',
              'order_count': result.orderIds.length,
              'payment_method': _paymentMethod.apiValue,
            },
          );
      final orderId = result.orderIds.isEmpty ? '' : result.orderIds.first;
      if (_paymentMethod == MobileOrderPaymentMethod.razorpay &&
          paymentOrder != null &&
          razorpayOrderId != null) {
        _pendingRazorpayCheckout = _PendingRazorpayCheckout(
          paymentOrder: paymentOrder,
          orderIds: result.orderIds,
          fallbackOrderId: orderId,
        );
        _openRazorpayCheckout(paymentOrder, lines);
        return;
      }

      await _maybeClearCart();
      if (!mounted) return;
      setState(() {
        _successOrderId = orderId;
        _step = _CheckoutStep.done;
        _placing = false;
      });
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _checkoutRecoveryMessage = error.message);
        ServiqToast.show(context, message: error.message, tone: ServiqToastTone.danger);
      }
    } catch (error) {
      if (mounted) {
        final mapped = AppErrorMapper.toMessage(error);
        setState(() => _checkoutRecoveryMessage = mapped);
        ServiqToast.show(context, message: mapped, tone: ServiqToastTone.danger);
      }
    } finally {
      if (mounted) {
        setState(() => _placing = false);
      }
    }
  }

  void _openRazorpayCheckout(
    MobileRazorpayOrder paymentOrder,
    List<MobileCheckoutItem> lines,
  ) {
    final primary = lines.isEmpty ? null : lines.first;
    final description = lines.length <= 1
        ? (primary?.title ?? 'ServiQ order')
        : 'ServiQ order (${lines.length} items)';

    final options = <String, Object?>{
      'key': paymentOrder.keyId,
      'amount': paymentOrder.amount,
      'currency': paymentOrder.currency,
      'name': 'ServiQ',
      'description': description,
      'order_id': paymentOrder.orderId,
      'timeout': 300,
      'retry': {'enabled': true, 'max_count': 1},
      'theme': {'color': '#0EA5A4'},
      'notes': {
        'source': 'serviq_mobile',
        if (primary != null) 'item_id': primary.itemId,
        if (primary != null) 'item_type': primary.itemType,
        'line_count': lines.length,
      },
    };

    try {
      _razorpay.open(options);
    } catch (error) {
      _pendingRazorpayCheckout = null;
      if (!mounted) return;
      final mapped =
          'Unable to open Razorpay: ${AppErrorMapper.toMessage(error)}';
      setState(() {
        _placing = false;
        _checkoutRecoveryMessage = mapped;
      });
      ref.read(analyticsServiceProvider).trackEvent(
            'payment_failure',
            extras: {'stage': 'open_razorpay', 'method': 'razorpay'},
          );
      ServiqToast.show(context, message: mapped, tone: ServiqToastTone.danger);
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final pending = _pendingRazorpayCheckout;
    final paymentId = _trim(response.paymentId);
    final callbackOrderId = _trim(response.orderId);
    final orderId = callbackOrderId.isEmpty
        ? pending?.paymentOrder.orderId ?? ''
        : callbackOrderId;
    final signature = _trim(response.signature);

    if (pending == null || paymentId.isEmpty || orderId.isEmpty || signature.isEmpty) {
      if (!mounted) return;
      setState(() => _placing = false);
      ref.read(analyticsServiceProvider).trackEvent(
            'payment_failure',
            extras: {'stage': 'incomplete_response', 'method': 'razorpay'},
          );
      ServiqToast.show(
        context,
        message: 'Razorpay returned an incomplete payment response.',
        tone: ServiqToastTone.danger,
      );
      return;
    }

    setState(() => _placing = true);
    try {
      await ref.read(orderRepositoryProvider).verifyRazorpayPayment(
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: signature,
            serviQOrderIds: pending.orderIds,
          );
      _pendingRazorpayCheckout = null;
      ref.invalidate(taskSnapshotProvider);
      for (final serviQOrderId in pending.orderIds) {
        ref.invalidate(orderDetailProvider(serviQOrderId));
      }

      if (!mounted) return;
      await _maybeClearCart();
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      ref.read(analyticsServiceProvider).trackEvent(
            'payment_success',
            extras: {
              'method': 'razorpay',
              'order_count': pending.orderIds.length,
            },
          );
      setState(() {
        _successOrderId = pending.fallbackOrderId;
        _step = _CheckoutStep.done;
        _placing = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      ServiqToast.show(context, message: error.message, tone: ServiqToastTone.danger);
      ref.read(analyticsServiceProvider).trackEvent(
            'payment_failure',
            extras: {'stage': 'verify_api', 'method': 'razorpay'},
          );
      _goToPendingOrder(pending);
    } catch (error) {
      if (!mounted) return;
      ServiqToast.show(context, message: AppErrorMapper.toMessage(error), tone: ServiqToastTone.danger);
      ref.read(analyticsServiceProvider).trackEvent(
            'payment_failure',
            extras: {'stage': 'verify_unknown', 'method': 'razorpay'},
          );
      _goToPendingOrder(pending);
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    final pending = _pendingRazorpayCheckout;
    _pendingRazorpayCheckout = null;
    if (!mounted) return;
    setState(() => _placing = false);
    final rawMessage = _trim(response.message);
    final message = rawMessage.isEmpty ? 'Payment was not completed.' : rawMessage;
    ref.read(analyticsServiceProvider).trackEvent(
          'payment_failure',
          extras: {'stage': 'razorpay_callback', 'method': 'razorpay', 'code': response.code ?? 0},
        );
    ServiqToast.show(context, message: message, tone: ServiqToastTone.danger);
    _goToPendingOrder(pending);
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    final wallet = _trim(response.walletName);
    ref.read(analyticsServiceProvider).trackEvent(
          'payment_external_wallet',
          extras: {'wallet': wallet.isEmpty ? 'unknown' : wallet},
        );
    ServiqToast.show(
      context,
      message: wallet.isEmpty
          ? 'Continue in the selected wallet to complete payment.'
          : 'Continue in $wallet to complete payment.',
      tone: ServiqToastTone.neutral,
    );
  }

  void _goToPendingOrder(_PendingRazorpayCheckout? pending) {
    if (pending == null || !mounted) return;
    if (pending.fallbackOrderId.isNotEmpty) {
      context.go(AppRoutes.orderDetail(pending.fallbackOrderId));
    } else {
      context.go(AppRoutes.orders);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.fromCart) {
      ref.watch(cartProvider);
    }
    final lines = _resolveLines();
    final empty = lines.isEmpty;

    final canGoNext = !empty && _canAdvance();

    return ServiqScaffold(
      appBar: ServiqTopBar(
        title: _stepTitle(),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: _goBack,
        ),
      ),
      body: SafeArea(
        child: _step == _CheckoutStep.done
            ? _buildConfirmation(lines)
            : Column(
                children: [
                  _StepIndicator(
                    currentStep: _step,
                    steps: _steps,
                    lineCount: lines.length,
                  ),
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                      children: [
                        if (empty)
                          SectionCard(
                            child: EmptyStateView(
                              title: widget.fromCart ? 'Cart is empty' : 'Checkout item missing',
                              message: widget.fromCart
                                  ? 'Add listings from the feed, then open checkout again.'
                                  : 'Open checkout from a live service or product card.',
                              actionLabel: widget.fromCart ? 'Browse feed' : null,
                              onAction: widget.fromCart ? () => context.go(AppRoutes.explore) : null,
                            ),
                          )
                        else ...[
                          if (_step == _CheckoutStep.review) _buildReviewStep(lines),
                          if (_step == _CheckoutStep.address) _buildAddressStep(),
                          if (_step == _CheckoutStep.payment) _buildPaymentStep(lines),
                          if (_step == _CheckoutStep.confirm) _buildConfirmStep(lines),
                          if ((_checkoutRecoveryMessage ?? '').trim().isNotEmpty) ...[
                            const SizedBox(height: AppSpacing.md),
                            ServiqRecoveryBanner(
                              message: _checkoutRecoveryMessage!.trim(),
                              tone: ServiqRecoveryTone.danger,
                              icon: Icons.payments_outlined,
                              actionLabel: 'Dismiss',
                              onAction: () => setState(() => _checkoutRecoveryMessage = null),
                            ),
                          ],
                          if ((_promoError ?? '').trim().isNotEmpty) ...[
                            const SizedBox(height: AppSpacing.md),
                            ServiqRecoveryBanner(
                              message: _promoError!.trim(),
                              tone: ServiqRecoveryTone.warning,
                              icon: Icons.local_offer_outlined,
                              actionLabel: 'Dismiss',
                              onAction: () => setState(() => _promoError = null),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),
                  if (!empty && _step != _CheckoutStep.done)
                    _buildBottomBar(canGoNext),
                ],
              ),
      ),
    );
  }

  String _stepTitle() {
    switch (_step) {
      case _CheckoutStep.review:
        return 'Review order';
      case _CheckoutStep.address:
        return 'Delivery details';
      case _CheckoutStep.payment:
        return 'Payment';
      case _CheckoutStep.confirm:
        return 'Confirm & pay';
      case _CheckoutStep.done:
        return 'Order placed';
    }
  }

  bool _canAdvance() {
    switch (_step) {
      case _CheckoutStep.review:
        return true;
      case _CheckoutStep.address:
        return _addressController.text.trim().isNotEmpty;
      case _CheckoutStep.payment:
        return true;
      case _CheckoutStep.confirm:
        return true;
      case _CheckoutStep.done:
        return false;
    }
  }

  Widget _buildBottomBar(bool canGoNext) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SafeArea(
      top: false,
      child: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark
                    ? [AppColors.darkSurface.withValues(alpha: 0.9), AppColors.darkSurfaceAlt.withValues(alpha: 0.75)]
                    : [Colors.white.withValues(alpha: 0.9), Colors.white.withValues(alpha: 0.75)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border(top: BorderSide(color: isDark ? AppColors.glassStrokeDark : AppColors.glassStroke)),
            ),
            child: Row(
              children: [
                if (_step != _CheckoutStep.review)
                  Expanded(
                    child: SecondaryButton(
                      label: 'Back',
                      onPressed: _goBack,
                      expanded: true,
                    ),
                  ),
                if (_step != _CheckoutStep.review) const SizedBox(width: AppSpacing.sm),
                Expanded(
                  flex: 2,
                  child: PrimaryButton(
                    label: _step == _CheckoutStep.confirm
                        ? (_placing ? 'Placing...' : 'Place order')
                        : _step == _CheckoutStep.payment
                            ? 'Continue'
                            : _step == _CheckoutStep.address
                                ? 'Continue to payment'
                                : 'Continue',
                    icon: _step == _CheckoutStep.confirm && _placing
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : null,
                    onPressed: canGoNext && !_placing
                        ? () {
                            if (_step == _CheckoutStep.confirm) {
                              _placeOrder();
                            } else if (_validateStep()) {
                              _goNext();
                            }
                          }
                        : null,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildReviewStep(List<MobileCheckoutItem> lines) {
    final grandTotal = lines.fold<double>(0, (a, b) => a + b.price * b.quantity);
    final byProvider = <String, List<MobileCheckoutItem>>{};
    for (final line in lines) {
      byProvider.putIfAbsent(line.providerId, () => []).add(line);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.shopping_bag_outlined, size: 20, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'Order summary',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                    ),
                    child: Text(
                      '${lines.length} item${lines.length != 1 ? 's' : ''}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryDeep,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              for (final entry in byProvider.entries) ...[
                if (entry.key != byProvider.entries.first.key) const Divider(height: 24),
                for (final line in entry.value) ...[
                  _ItemRow(
                    item: line,
                    onRemove: widget.fromCart
                        ? () => ref.read(cartProvider.notifier).remove(line.cartKey)
                        : null,
                    onQuantityChange: widget.fromCart
                        ? (qty) => ref.read(cartProvider.notifier).setQuantity(line.cartKey, qty)
                        : null,
                  ),
                  if (line != entry.value.last) const SizedBox(height: AppSpacing.xs),
                ],
              ],
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Subtotal', style: Theme.of(context).textTheme.titleMedium),
                  Text(
                    'INR ${grandTotal.round()}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAddressStep() {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_shipping_outlined, size: 20, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
              const SizedBox(width: AppSpacing.xs),
              Text('Fulfillment', style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _FulfillmentChips(
            selected: _fulfillmentMethod,
            onChanged: (m) => setState(() => _fulfillmentMethod = m),
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            controller: _addressController,
            enabled: !_placing,
            minLines: 3,
            maxLines: 5,
            label: _fulfillmentMethod == MobileOrderFulfillmentMethod.pickup
                ? 'Pickup or meeting point'
                : 'Delivery or service address',
            hint: _fulfillmentMethod == MobileOrderFulfillmentMethod.pickup
                ? 'Where should the provider meet you?'
                : 'Full address for delivery or service',
            textCapitalization: TextCapitalization.sentences,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppTextField(
            controller: _notesController,
            enabled: !_placing,
            minLines: 2,
            maxLines: 4,
            label: 'Notes (optional)',
            hint: 'Landmark, gate code, timing preferences...',
            textCapitalization: TextCapitalization.sentences,
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentStep(List<MobileCheckoutItem> lines) {
    final grandTotal = lines.fold<double>(0, (a, b) => a + b.price * b.quantity);
    return Column(
      children: [
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.credit_card_outlined, size: 20, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                  const SizedBox(width: AppSpacing.xs),
                  Text('Payment method', style: Theme.of(context).textTheme.titleLarge),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              _PaymentMethodCard(
                method: MobileOrderPaymentMethod.cod,
                selected: _paymentMethod == MobileOrderPaymentMethod.cod,
                onTap: () => setState(() => _paymentMethod = MobileOrderPaymentMethod.cod),
              ),
              const SizedBox(height: AppSpacing.xs),
              _PaymentMethodCard(
                method: MobileOrderPaymentMethod.razorpay,
                selected: _paymentMethod == MobileOrderPaymentMethod.razorpay,
                onTap: () => setState(() => _paymentMethod = MobileOrderPaymentMethod.razorpay),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Price summary', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              _PriceRow(label: 'Items', value: 'INR ${grandTotal.round()}'),
              _PriceRow(label: 'Delivery', value: 'Free'),
              _PriceRow(
                label: 'Total',
                value: 'INR ${grandTotal.round()}',
                bold: true,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildConfirmStep(List<MobileCheckoutItem> lines) {
    final grandTotal = lines.fold<double>(0, (a, b) => a + b.price * b.quantity);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.receipt_long_outlined, size: 20, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                  const SizedBox(width: AppSpacing.xs),
                  Text('Order summary', style: Theme.of(context).textTheme.titleLarge),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              _DetailRow(label: 'Items', value: '${lines.length}'),
              _DetailRow(label: 'Fulfillment', value: _humanize(_fulfillmentMethod.apiValue)),
              _DetailRow(label: 'Payment', value: _paymentMethod == MobileOrderPaymentMethod.cod ? 'Cash on delivery' : 'Online (Razorpay)'),
              _DetailRow(
                label: 'Address',
                value: _addressController.text.trim().isEmpty ? 'Not entered' : _addressController.text.trim(),
              ),
              if (_notesController.text.trim().isNotEmpty)
                _DetailRow(label: 'Notes', value: _notesController.text.trim()),
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Total',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    'INR ${grandTotal.round()}',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildConfirmation(List<MobileCheckoutItem> lines) {
    final orderId = _successOrderId ?? '';
    return Center(
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: [
          Column(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(40),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.success.withValues(alpha: 0.3), AppColors.success.withValues(alpha: 0.1)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                    ),
                    child: Icon(Icons.check_rounded, color: AppColors.success, size: 44),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              Text(
                'Order placed!',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Your order has been placed successfully.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                ),
                textAlign: TextAlign.center,
              ),
              if (orderId.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(color: AppColors.glassStroke),
                  ),
                  child: Text(
                    '#${orderId.length > 8 ? orderId.substring(0, 8).toUpperCase() : orderId}',
                    style: TextStyle(
                      fontSize: 13,
                      fontFamily: 'monospace',
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xxl),
              PrimaryButton(
                label: 'View order status',
                icon: const Icon(Icons.visibility_outlined),
                onPressed: () {
                  if (orderId.isNotEmpty) {
                    context.go(AppRoutes.orderDetail(orderId));
                  } else {
                    context.go(AppRoutes.orders);
                  }
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              SecondaryButton(
                label: 'Back to home',
                icon: const Icon(Icons.home_outlined),
                onPressed: () => context.go(AppRoutes.welcome),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({
    required this.currentStep,
    required this.steps,
    required this.lineCount,
  });

  final _CheckoutStep currentStep;
  final List<_CheckoutStep> steps;
  final int lineCount;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isDark
                  ? [AppColors.darkSurface.withValues(alpha: 0.85), AppColors.darkSurfaceAlt.withValues(alpha: 0.6)]
                  : [Colors.white.withValues(alpha: 0.9), Colors.white.withValues(alpha: 0.6)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border(bottom: BorderSide(color: isDark ? AppColors.glassStrokeDark : AppColors.glassStroke)),
          ),
          child: Row(
            children: [
              for (var i = 0; i < steps.length; i++) ...[
                if (i > 0) Expanded(child: Divider(height: 1, color: Theme.of(context).colorScheme.outline)),
                _StepDot(
                  label: _stepLabel(steps[i]),
                  active: steps[i] == currentStep,
                  completed: steps.indexOf(currentStep) > i,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _stepLabel(_CheckoutStep step) {
    switch (step) {
      case _CheckoutStep.review:
        return 'Review';
      case _CheckoutStep.address:
        return 'Address';
      case _CheckoutStep.payment:
        return 'Payment';
      case _CheckoutStep.confirm:
        return 'Confirm';
      case _CheckoutStep.done:
        return '';
    }
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({
    required this.label,
    required this.active,
    required this.completed,
  });

  final String label;
  final bool active;
  final bool completed;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final color = completed
        ? AppColors.primary
        : active
            ? AppColors.primary
            : cs.onSurface.withValues(alpha: 0.3);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxs),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: completed || active ? color : Colors.transparent,
              shape: BoxShape.circle,
              border: Border.all(color: color, width: 2),
            ),
            child: completed
                ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                : active
                    ? Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                      )
                    : null,
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: active || completed ? cs.onSurface : cs.onSurface.withValues(alpha: 0.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({
    required this.item,
    this.onRemove,
    this.onQuantityChange,
  });

  final MobileCheckoutItem item;
  final VoidCallback? onRemove;
  final void Function(int quantity)? onQuantityChange;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppColors.primarySoft.withValues(alpha: 0.7),
                AppColors.primarySoft.withValues(alpha: 0.3),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
          ),
          child: Icon(
            item.itemType == 'product' ? Icons.inventory_2_outlined : Icons.build_outlined,
            color: AppColors.primaryDeep,
            size: 22,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: AppSpacing.xxxs),
              Text(
                'INR ${item.price.round()} each',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
              ),
            ],
          ),
        ),
        if (onQuantityChange != null)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
                  IconButton(
                    onPressed: item.quantity <= 1 ? null : () => onQuantityChange!(item.quantity - 1),
                    icon: Icon(Icons.remove_rounded, size: 20),
                    visualDensity: VisualDensity.compact,
                  ),
                  SizedBox(
                    width: 24,
                    child: Text(
                      '${item.quantity}',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  IconButton(
                    onPressed: () => onQuantityChange!(item.quantity + 1),
                    icon: Icon(Icons.add_rounded, size: 20),
                    visualDensity: VisualDensity.compact,
                  ),
                  ],
          )
        else
          Text(
            '×${item.quantity}',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
          ),
        const SizedBox(width: AppSpacing.xs),
        Text(
          'INR ${(item.price * item.quantity).round()}',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        if (onRemove != null) ...[
          const SizedBox(width: AppSpacing.xxs),
          IconButton(
            onPressed: onRemove,
            icon: Icon(Icons.close_rounded, size: 18, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ],
    );
  }
}

class _FulfillmentChips extends StatelessWidget {
  const _FulfillmentChips({
    required this.selected,
    required this.onChanged,
  });

  final MobileOrderFulfillmentMethod selected;
  final ValueChanged<MobileOrderFulfillmentMethod> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: MobileOrderFulfillmentMethod.values.map((method) {
        final isSelected = method == selected;
        return ChoiceChip(
          label: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                method == MobileOrderFulfillmentMethod.pickup
                    ? Icons.store_outlined
                    : method == MobileOrderFulfillmentMethod.delivery
                        ? Icons.local_shipping_outlined
                        : Icons.handyman_outlined,
                size: 16,
              ),
              const SizedBox(width: 6),
              Text(method.label),
            ],
          ),
          selected: isSelected,
          onSelected: (_) => onChanged(method),
        );
      }).toList(),
    );
  }
}

class _PaymentMethodCard extends StatelessWidget {
  const _PaymentMethodCard({
    required this.method,
    required this.selected,
    required this.onTap,
  });

  final MobileOrderPaymentMethod method;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySoft : AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(
            color: selected ? AppColors.primary : Theme.of(context).colorScheme.outline,
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              method == MobileOrderPaymentMethod.cod
                  ? Icons.payments_outlined
                  : Icons.credit_card_rounded,
              color: selected ? AppColors.primary : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
              size: 24,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    method.label,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: selected ? AppColors.primaryDeep : Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  Text(
                    method == MobileOrderPaymentMethod.cod
                        ? 'Pay when you receive'
                        : 'UPI, Cards, NetBanking',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? AppColors.primary : Theme.of(context).colorScheme.outlineVariant,
                  width: selected ? 2 : 1.5,
                ),
                color: selected ? AppColors.primary : Colors.transparent,
              ),
              child: selected
                  ? Icon(Icons.check_rounded, size: 14, color: Colors.white)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.bold = false,
  });

  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
              color: bold ? Theme.of(context).colorScheme.onSurface : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
              color: bold ? AppColors.primary : Theme.of(context).colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PendingRazorpayCheckout {
  const _PendingRazorpayCheckout({
    required this.paymentOrder,
    required this.orderIds,
    required this.fallbackOrderId,
  });

  final MobileRazorpayOrder paymentOrder;
  final List<String> orderIds;
  final String fallbackOrderId;
}

String _humanize(String raw) {
  final normalized = raw.trim();
  if (normalized.isEmpty) return 'Not set';
  return normalized
      .split('_')
      .map((part) => part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

String _trim(String? value) => value?.trim() ?? '';
