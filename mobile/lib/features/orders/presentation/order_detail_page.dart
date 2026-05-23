import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../profile/data/profile_repository.dart';
import '../../quotes/domain/quote_models.dart';
import '../../tasks/data/task_repository.dart';
import '../data/order_repository.dart';
import '../domain/order_models.dart';

class OrderDetailPage extends ConsumerStatefulWidget {
  const OrderDetailPage({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends ConsumerState<OrderDetailPage> {
  bool _busy = false;

  Future<void> _refresh() async {
    ref.invalidate(orderDetailProvider(widget.orderId));
    await ref.read(orderDetailProvider(widget.orderId).future);
  }

  Future<void> _updateStatus(String status) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(orderRepositoryProvider)
          .updateStatus(orderId: widget.orderId, status: status);
      ref.invalidate(orderDetailProvider(widget.orderId));
      ref.invalidate(taskSnapshotProvider);
      await ref.read(orderDetailProvider(widget.orderId).future);
      if (!mounted) {
        return;
      }
      HapticFeedback.mediumImpact();
      ref
          .read(analyticsServiceProvider)
          .trackEvent(
            'order_status_update',
            extras: {'order_id': widget.orderId, 'status': status},
          );
      if (status == 'completed') {
        ref
            .read(analyticsServiceProvider)
            .trackEvent(
              'order_completed',
              extras: {'order_id': widget.orderId},
            );
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Order marked ${_humanize(status)}.')),
      );
      if (status == 'completed') {
        _promptReview();
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
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _promptReview() async {
    final asyncOrder = ref.read(orderDetailProvider(widget.orderId));
    final providerId = asyncOrder.hasValue ? asyncOrder.value!.providerId : null;
    if (providerId == null || providerId.isEmpty) return;

    var rating = 5;
    var comment = '';

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  20, 4, 20,
                  20 + MediaQuery.viewInsetsOf(context).bottom,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'How was your experience?',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final star = index + 1;
                        return IconButton(
                          icon: Icon(
                            star <= rating
                                ? Icons.star_rounded
                                : Icons.star_outline_rounded,
                            color: star <= rating
                                ? AppColors.warning
                                : AppColors.inkMuted,
                            size: 36,
                          ),
                          onPressed: () =>
                              setSheetState(() => rating = star),
                        );
                      }),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Review (optional)',
                        hintText: 'Share your experience...',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 3,
                      onChanged: (v) => comment = v,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () =>
                            Navigator.of(sheetContext).pop(),
                        child: const Text('Submit'),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (!mounted) return;

    try {
      await ref.read(profileRepositoryProvider).submitReview(
        providerId: providerId,
        rating: rating,
        comment: comment,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Review submitted.')),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final orderAsync = ref.watch(orderDetailProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Order detail')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              ServiqAsyncBody<MobileOrderRecord>(
                value: orderAsync,
                errorTitle: 'Unable to load order',
                errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
                onRetry: _refresh,
                loadingBuilder: () => const _OrderDetailLoading(),
                data: (order) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _OrderSummary(order: order),
                    const SizedBox(height: 16),
                    _PaymentCard(order: order),
                    const SizedBox(height: 16),
                    _FulfillmentCard(order: order),
                    const SizedBox(height: 16),
                    _OrderActions(
                      order: order,
                      busy: _busy,
                      onUpdateStatus: _updateStatus,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrderSummary extends StatelessWidget {
  const _OrderSummary({required this.order});

  final MobileOrderRecord order;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(order.title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(
            order.notes.isEmpty
                ? 'Order details, payment, and fulfillment notes stay attached here.'
                : order.notes,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text(_humanize(order.status))),
              Chip(label: Text(_humanize(order.listingType))),
              Chip(label: Text('INR ${order.price.round()}')),
              Chip(label: Text('Qty ${order.quantity}')),
            ],
          ),
        ],
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({required this.order});

  final MobileOrderRecord order;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Payment', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          _InfoRow(
            label: 'Method',
            value: order.paymentMethod.isEmpty
                ? 'Not recorded'
                : _humanize(order.paymentMethod),
          ),
          _InfoRow(label: 'Status', value: _humanize(order.paymentStatus)),
          if ((order.metadata['razorpay_order_id'] as String?)?.isNotEmpty ==
              true)
            _InfoRow(
              label: 'Razorpay order',
              value: order.metadata['razorpay_order_id'] as String,
            ),
          if ((order.metadata['razorpay_payment_id'] as String?)?.isNotEmpty ==
              true)
            _InfoRow(
              label: 'Razorpay payment',
              value: order.metadata['razorpay_payment_id'] as String,
            ),
        ],
      ),
    );
  }
}

class _FulfillmentCard extends StatelessWidget {
  const _FulfillmentCard({required this.order});

  final MobileOrderRecord order;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Fulfillment', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          _InfoRow(
            label: 'Mode',
            value: order.fulfillmentMethod.isEmpty
                ? 'Confirm in chat'
                : _humanize(order.fulfillmentMethod),
          ),
          _InfoRow(
            label: 'Progress',
            value: order.fulfillmentStatusLabel.isNotEmpty
                ? order.fulfillmentStatusLabel
                : order.fulfillmentStatus.isEmpty
                ? 'Waiting for provider review'
                : _humanize(order.fulfillmentStatus),
          ),
          _InfoRow(
            label: 'Address',
            value: order.address.isEmpty ? 'Not added' : order.address,
          ),
          _InfoRow(label: 'Created', value: _dateLabel(order.createdAt)),
        ],
      ),
    );
  }
}

class _OrderActions extends StatelessWidget {
  const _OrderActions({
    required this.order,
    required this.busy,
    required this.onUpdateStatus,
  });

  final MobileOrderRecord order;
  final bool busy;
  final ValueChanged<String> onUpdateStatus;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Next actions', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          PrimaryButton(
            label: 'Open quote',
            icon: const Icon(Icons.request_quote_outlined),
            onPressed: () => context.push(
              AppRoutes.quoteRoom(
                mode: MobileQuoteTargetMode.order.apiValue,
                targetId: order.id,
              ),
            ),
          ),
          const SizedBox(height: 10),
          if (order.status == 'new_lead' || order.status == 'quoted')
            SecondaryButton(
              label: busy ? 'Updating...' : 'Mark accepted',
              icon: const Icon(Icons.check_circle_outline_rounded),
              onPressed: busy ? null : () => onUpdateStatus('accepted'),
            ),
          if (order.status == 'accepted') ...[
            SecondaryButton(
              label: busy ? 'Updating...' : 'Start work',
              icon: const Icon(Icons.play_circle_outline_rounded),
              onPressed: busy ? null : () => onUpdateStatus('in_progress'),
            ),
          ],
          if (order.status == 'accepted' || order.status == 'in_progress') ...[
            const SizedBox(height: 10),
            SecondaryButton(
              label: busy ? 'Updating...' : 'Mark completed',
              icon: const Icon(Icons.task_alt_rounded),
              onPressed: busy ? null : () => onUpdateStatus('completed'),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(color: AppColors.inkMuted),
          ),
          const SizedBox(height: 4),
          Text(value, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}

class _OrderDetailLoading extends StatelessWidget {
  const _OrderDetailLoading();

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
                LoadingShimmer(height: 20, width: 160),
                SizedBox(height: 12),
                LoadingShimmer(height: 14),
                SizedBox(height: 10),
                LoadingShimmer(height: 80),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _humanize(String raw) {
  final normalized = raw.trim();
  if (normalized.isEmpty) {
    return 'Not set';
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

String _dateLabel(DateTime? value) {
  if (value == null) {
    return 'Recently';
  }
  return '${value.day}/${value.month}/${value.year}';
}
