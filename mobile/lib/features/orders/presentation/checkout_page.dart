import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../tasks/data/task_repository.dart';
import '../data/order_repository.dart';
import '../domain/order_models.dart';

class CheckoutPage extends ConsumerStatefulWidget {
  const CheckoutPage({super.key, required this.item});

  final MobileCheckoutItem? item;

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
  }

  @override
  void dispose() {
    _razorpay.clear();
    _addressController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _placeOrder() async {
    final item = widget.item;
    if (item == null || !_formKey.currentState!.validate()) {
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _placing = true);
    try {
      String? razorpayOrderId;
      MobileRazorpayOrder? paymentOrder;
      if (_paymentMethod == MobileOrderPaymentMethod.razorpay) {
        final amountPaise = (item.price * item.quantity * 100).round();
        paymentOrder = await ref
            .read(orderRepositoryProvider)
            .createRazorpayOrder(
              amountPaise: amountPaise <= 0 ? 100 : amountPaise,
              receipt: 'serviq-${DateTime.now().millisecondsSinceEpoch}',
            );
        razorpayOrderId = paymentOrder.orderId;
      }

      final result = await ref
          .read(orderRepositoryProvider)
          .createOrder(
            MobileCheckoutRequest(
              item: item,
              address: _addressController.text.trim(),
              notes: _notesController.text.trim(),
              paymentMethod: _paymentMethod,
              fulfillmentMethod: _fulfillmentMethod,
              razorpayOrderId: razorpayOrderId,
            ),
          );
      ref.invalidate(taskSnapshotProvider);
      if (!mounted) {
        return;
      }
      HapticFeedback.mediumImpact();
      final orderId = result.orderIds.isEmpty ? '' : result.orderIds.first;
      if (_paymentMethod == MobileOrderPaymentMethod.razorpay &&
          paymentOrder != null &&
          razorpayOrderId != null) {
        _pendingRazorpayCheckout = _PendingRazorpayCheckout(
          paymentOrder: paymentOrder,
          orderIds: result.orderIds,
          fallbackOrderId: orderId,
        );
        _openRazorpayCheckout(paymentOrder, item);
        return;
      }

      if (orderId.isNotEmpty) {
        context.go(AppRoutes.orderDetail(orderId));
      } else {
        context.go(AppRoutes.orders);
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
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
    MobileCheckoutItem item,
  ) {
    final options = <String, Object?>{
      'key': paymentOrder.keyId,
      'amount': paymentOrder.amount,
      'currency': paymentOrder.currency,
      'name': 'ServiQ',
      'description': item.title,
      'order_id': paymentOrder.orderId,
      'timeout': 300,
      'retry': {'enabled': true, 'max_count': 1},
      'theme': {'color': '#2563EB'},
      'notes': {
        'source': 'serviq_mobile',
        'item_id': item.itemId,
        'item_type': item.itemType,
      },
    };

    try {
      _razorpay.open(options);
    } catch (error) {
      _pendingRazorpayCheckout = null;
      if (!mounted) {
        return;
      }
      setState(() => _placing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Unable to open Razorpay: ${AppErrorMapper.toMessage(error)}',
          ),
        ),
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Razorpay returned an incomplete payment response.'),
        ),
      );
      return;
    }

    setState(() => _placing = true);
    try {
      await ref
          .read(orderRepositoryProvider)
          .verifyRazorpayPayment(
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
      HapticFeedback.mediumImpact();
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
      _goToPendingOrder(pending);
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(AppErrorMapper.toMessage(error))));
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
    final item = widget.item;
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            if (item == null)
              const SectionCard(
                child: EmptyStateView(
                  title: 'Checkout item missing',
                  message: 'Open checkout from a live service or product card.',
                ),
              )
            else ...[
              _CheckoutSummary(item: item),
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
                            : (selection) => setState(
                                () => _paymentMethod = selection.first,
                              ),
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

class _CheckoutSummary extends StatelessWidget {
  const _CheckoutSummary({required this.item});

  final MobileCheckoutItem item;

  @override
  Widget build(BuildContext context) {
    final total = item.price * item.quantity;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(
            item.itemType == 'product'
                ? 'Product order from a local provider.'
                : 'Service booking from a local provider.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text(_humanize(item.itemType))),
              Chip(label: Text('Qty ${item.quantity}')),
              Chip(label: Text('INR ${total.round()}')),
            ],
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
