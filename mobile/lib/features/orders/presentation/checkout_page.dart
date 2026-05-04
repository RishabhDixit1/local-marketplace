import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_recovery_banner.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../cart/application/cart_notifier.dart';
import '../../tasks/data/task_repository.dart';
import '../data/order_repository.dart';
import '../domain/order_models.dart';

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
  final _formKey = GlobalKey<FormState>();
  final _addressController = TextEditingController();
  final _notesController = TextEditingController();
  late final Razorpay _razorpay;
  MobileOrderPaymentMethod _paymentMethod = MobileOrderPaymentMethod.cod;
  MobileOrderFulfillmentMethod _fulfillmentMethod =
      MobileOrderFulfillmentMethod.onsite;
  _PendingRazorpayCheckout? _pendingRazorpayCheckout;
  bool _placing = false;
  String? _checkoutRecoveryMessage;

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
      if (!mounted) {
        return;
      }
      final cartLines =
          (ref.read(cartProvider).value ?? []).map((e) => e.toCheckoutItem());
      if (widget.fromCart &&
          cartLines.any((l) => l.itemType == 'product')) {
        setState(() => _fulfillmentMethod = MobileOrderFulfillmentMethod.delivery);
      }
      final lines = widget.item != null ? [widget.item!] : cartLines;
      if (lines.isEmpty) {
        return;
      }
      ref.read(analyticsServiceProvider).trackEvent(
            'checkout_started',
            extras: {
              'source': widget.fromCart ? 'cart' : 'direct',
              'line_count': lines.length,
              'item_type': lines.first.itemType,
              'provider_id': lines.first.providerId,
              'quantity': lines.fold<int>(
                0,
                (a, b) => a + b.quantity,
              ),
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

  Future<void> _placeOrder() async {
    final lines = _resolveLines();
    if (lines.isEmpty || !_formKey.currentState!.validate()) {
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _placing = true;
      _checkoutRecoveryMessage = null;
    });
    try {
      String? razorpayOrderId;
      MobileRazorpayOrder? paymentOrder;
      if (_paymentMethod == MobileOrderPaymentMethod.razorpay) {
        final amountPaise = lines
            .fold<double>(
              0,
              (a, b) => a + b.price * b.quantity,
            )
            .clamp(0.0, 1e9);
        final paise = (amountPaise * 100).round();
        paymentOrder = await ref.read(orderRepositoryProvider).createRazorpayOrder(
              amountPaise: paise <= 0 ? 100 : paise,
              receipt: 'serviq-${DateTime.now().millisecondsSinceEpoch}',
            );
        razorpayOrderId = paymentOrder.orderId;
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
      if (!mounted) {
        return;
      }
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
      if (!mounted) {
        return;
      }
      if (orderId.isNotEmpty) {
        context.go(AppRoutes.orderDetail(orderId));
      } else {
        context.go(AppRoutes.orders);
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _checkoutRecoveryMessage = error.message);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (error) {
      if (mounted) {
        final mapped = AppErrorMapper.toMessage(error);
        setState(() => _checkoutRecoveryMessage = mapped);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(mapped)),
        );
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
      'theme': {'color': '#2563EB'},
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
      if (!mounted) {
        return;
      }
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(mapped)),
      );
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

    if (pending == null ||
        paymentId.isEmpty ||
        orderId.isEmpty ||
        signature.isEmpty) {
      if (!mounted) {
        return;
      }
      setState(() => _placing = false);
      ref.read(analyticsServiceProvider).trackEvent(
            'payment_failure',
            extras: {'stage': 'incomplete_response', 'method': 'razorpay'},
          );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Razorpay returned an incomplete payment response.'),
        ),
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

      if (!mounted) {
        return;
      }
      await _maybeClearCart();
      if (!mounted) {
        return;
      }
      HapticFeedback.mediumImpact();
      ref.read(analyticsServiceProvider).trackEvent(
            'payment_success',
            extras: {
              'method': 'razorpay',
              'order_count': pending.orderIds.length,
            },
          );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment verified. Order marked paid.')),
      );
      _goToPendingOrder(pending);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
      ref.read(analyticsServiceProvider).trackEvent(
            'payment_failure',
            extras: {'stage': 'verify_api', 'method': 'razorpay'},
          );
      _goToPendingOrder(pending);
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(AppErrorMapper.toMessage(error))));
      ref.read(analyticsServiceProvider).trackEvent(
            'payment_failure',
            extras: {'stage': 'verify_unknown', 'method': 'razorpay'},
          );
      _goToPendingOrder(pending);
    } finally {
      if (mounted) {
        setState(() => _placing = false);
      }
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    final pending = _pendingRazorpayCheckout;
    _pendingRazorpayCheckout = null;
    if (!mounted) {
      return;
    }
    setState(() => _placing = false);
    final rawMessage = _trim(response.message);
    final message = rawMessage.isEmpty
        ? 'Payment was not completed.'
        : rawMessage;
    ref.read(analyticsServiceProvider).trackEvent(
          'payment_failure',
          extras: {
            'stage': 'razorpay_callback',
            'method': 'razorpay',
            'code': response.code ?? 0,
          },
        );
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
    _goToPendingOrder(pending);
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) {
      return;
    }
    final wallet = _trim(response.walletName);
    ref.read(analyticsServiceProvider).trackEvent(
          'payment_external_wallet',
          extras: {'wallet': wallet.isEmpty ? 'unknown' : wallet},
        );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          wallet.isEmpty
              ? 'Continue in the selected wallet to complete payment.'
              : 'Continue in $wallet to complete payment.',
        ),
      ),
    );
  }

  void _goToPendingOrder(_PendingRazorpayCheckout? pending) {
    if (pending == null || !mounted) {
      return;
    }
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

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: SafeArea(
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
                  onAction: widget.fromCart
                      ? () => context.go(AppRoutes.explore)
                      : null,
                ),
              )
            else ...[
              _CheckoutLinesSummary(lines: lines),
              if ((_checkoutRecoveryMessage ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 16),
                ServiqRecoveryBanner(
                  message: _checkoutRecoveryMessage!.trim(),
                  tone: ServiqRecoveryTone.danger,
                  icon: Icons.payments_outlined,
                  actionLabel: 'Dismiss',
                  onAction: () =>
                      setState(() => _checkoutRecoveryMessage = null),
                ),
              ],
              const SizedBox(height: 16),
              SectionCard(
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Fulfillment',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<MobileOrderFulfillmentMethod>(
                        initialValue: _fulfillmentMethod,
                        decoration: const InputDecoration(labelText: 'Mode'),
                        items: MobileOrderFulfillmentMethod.values
                            .map(
                              (method) => DropdownMenuItem(
                                value: method,
                                child: Text(method.label),
                              ),
                            )
                            .toList(),
                        onChanged: _placing
                            ? null
                            : (method) {
                                if (method != null) {
                                  setState(() => _fulfillmentMethod = method);
                                }
                              },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _addressController,
                        enabled: !_placing,
                        minLines: 2,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          labelText: 'Address or meeting point',
                        ),
                        validator: (value) {
                          if ((value ?? '').trim().isEmpty) {
                            return 'Add an address or pickup note.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _notesController,
                        enabled: !_placing,
                        minLines: 2,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          labelText: 'Fulfillment notes',
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Payment',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 12),
                      SegmentedButton<MobileOrderPaymentMethod>(
                        segments: MobileOrderPaymentMethod.values
                            .map(
                              (method) => ButtonSegment(
                                value: method,
                                label: Text(
                                  method == MobileOrderPaymentMethod.cod
                                      ? 'COD'
                                      : 'Razorpay',
                                ),
                                icon: Icon(
                                  method == MobileOrderPaymentMethod.cod
                                      ? Icons.payments_outlined
                                      : Icons.credit_card_rounded,
                                ),
                              ),
                            )
                            .toList(),
                        selected: {_paymentMethod},
                        onSelectionChanged: _placing
                            ? null
                            : (selection) {
                                setState(
                                  () => _paymentMethod = selection.first,
                                );
                                ref.read(analyticsServiceProvider).trackEvent(
                                      'payment_method_selected',
                                      extras: {
                                        'payment_method':
                                            _paymentMethod.apiValue,
                                      },
                                    );
                              },
                      ),
                      const SizedBox(height: 18),
                      PrimaryButton(
                        label: _placing ? 'Placing order...' : 'Place order',
                        icon: _placing
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.shopping_bag_outlined),
                        onPressed: _placing ? null : _placeOrder,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CheckoutLinesSummary extends StatelessWidget {
  const _CheckoutLinesSummary({required this.lines});

  final List<MobileCheckoutItem> lines;

  @override
  Widget build(BuildContext context) {
    final grandTotal =
        lines.fold<double>(0, (a, b) => a + b.price * b.quantity);
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            lines.length > 1 ? 'Order summary (${lines.length})' : 'Order summary',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          ...lines.map(
            (line) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    line.title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      Chip(label: Text(_humanize(line.itemType))),
                      Chip(label: Text('Qty ${line.quantity}')),
                      Chip(
                        label: Text(
                          'INR ${(line.price * line.quantity).round()}',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 24),
          Text(
            'Total · INR ${grandTotal.round()}',
            style: Theme.of(context).textTheme.titleLarge,
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
  if (normalized.isEmpty) {
    return 'Item';
  }
  return normalized
      .split('_')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
}

String _trim(String? value) => value?.trim() ?? '';
