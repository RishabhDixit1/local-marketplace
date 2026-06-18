import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../disputes/presentation/dispute_sheet.dart';
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

  Future<void> _updateDeliveryStatus(
    String status, {
    Map<String, dynamic>? extra,
  }) async {
    setState(() => _busy = true);
    try {
      await ref.read(orderRepositoryProvider).updateDeliveryStatus(
            orderId: widget.orderId,
            status: status,
            extra: extra,
          );
      ref.invalidate(orderDetailProvider(widget.orderId));
      await ref.read(orderDetailProvider(widget.orderId).future);
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Delivery marked ${_humanize(status)}.')),
      );
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickDeliveryPhoto(MobileOrderRecord order) async {
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
    );
    if (file == null) return;
    setState(() => _busy = true);
    try {
      final apiClient = ref.read(mobileApiClientProvider);
      await apiClient.uploadFile(
        '/api/orders/${order.id}/delivery/photos',
        filePath: file.path,
        fileName: file.path.split('/').last,
        mediaType: 'image/jpeg',
        fieldName: 'file',
      );
      ref.invalidate(orderDetailProvider(widget.orderId));
      await ref.read(orderDetailProvider(widget.orderId).future);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Photo uploaded.')),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _showAssignDeliverySheet() async {
    final driverNameCtrl = TextEditingController();
    final driverPhoneCtrl = TextEditingController();
    final trackingCtrl = TextEditingController();
    final carrierCtrl = TextEditingController();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Assign Delivery',
                style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 12),
            TextField(
              controller: driverNameCtrl,
              decoration: const InputDecoration(
                labelText: 'Driver name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: driverPhoneCtrl,
              decoration: const InputDecoration(
                labelText: 'Driver phone',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: trackingCtrl,
              decoration: const InputDecoration(
                labelText: 'Tracking number',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: carrierCtrl,
              decoration: const InputDecoration(
                labelText: 'Carrier (e.g. Delhivery)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy
                  ? null
                  : () {
                      final extra = <String, dynamic>{};
                      if (driverNameCtrl.text.trim().isNotEmpty) {
                        extra['driverName'] = driverNameCtrl.text.trim();
                      }
                      if (driverPhoneCtrl.text.trim().isNotEmpty) {
                        extra['driverPhone'] = driverPhoneCtrl.text.trim();
                      }
                      if (trackingCtrl.text.trim().isNotEmpty) {
                        extra['trackingNumber'] = trackingCtrl.text.trim();
                      }
                      if (carrierCtrl.text.trim().isNotEmpty) {
                        extra['carrier'] = carrierCtrl.text.trim();
                      }
                      Navigator.of(ctx).pop();
                      _updateDeliveryStatus('assigned', extra: extra);
                    },
              child: _busy
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child:
                          CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Start Delivery'),
            ),
          ],
        ),
      ),
    );

    driverNameCtrl.dispose();
    driverPhoneCtrl.dispose();
    trackingCtrl.dispose();
    carrierCtrl.dispose();
  }

  Future<void> _raiseDispute() async {
    await DisputeSheet.show(context: context, orderId: widget.orderId);
  }

  Future<void> _promptReview() async {
    final asyncOrder = ref.read(orderDetailProvider(widget.orderId));
    final providerId = asyncOrder.hasValue ? asyncOrder.value!.providerId : null;
    if (providerId == null || providerId.isEmpty) return;

    var rating = 5;
    var comment = '';
    var quality = 5;
    var communication = 5;
    var timeliness = 5;
    var value = 5;
    var wouldRecommend = true;
    var submitting = false;
    var uploadProgress = '';
    final photoPaths = <String>[];
    final picker = ImagePicker();

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
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'How was your experience?',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 16),

                      // Overall rating
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

                      // Rating breakdown
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'BREAKDOWN',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: AppColors.inkMuted,
                                    letterSpacing: 1.2,
                                  ),
                            ),
                            const SizedBox(height: 8),
                            _breakdownRow(context, 'Quality', quality,
                                (v) => setSheetState(() => quality = v)),
                            _breakdownRow(
                                context, 'Communication', communication,
                                (v) => setSheetState(() => communication = v)),
                            _breakdownRow(
                                context, 'Timeliness', timeliness,
                                (v) => setSheetState(() => timeliness = v)),
                            _breakdownRow(context, 'Value', value,
                                (v) => setSheetState(() => value = v)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Would recommend toggle
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              wouldRecommend
                                  ? Icons.thumb_up_alt_rounded
                                  : Icons.thumb_down_alt_rounded,
                              color: wouldRecommend
                                  ? AppColors.success
                                  : AppColors.danger,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                wouldRecommend
                                    ? 'Would recommend'
                                    : 'Would not recommend',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(fontWeight: FontWeight.w500),
                              ),
                            ),
                            Switch(
                              value: wouldRecommend,
                              activeThumbColor: AppColors.success,
                              onChanged: (v) =>
                                  setSheetState(() => wouldRecommend = v),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Photos
                      SizedBox(
                        width: double.infinity,
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            ...photoPaths.map((path) {
                              final index = photoPaths.indexOf(path);
                              return Stack(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child:                                       Image.file(
                                      File(path),
                                      width: 72,
                                      height: 72,
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                  Positioned(
                                    right: 2,
                                    top: 2,
                                    child: GestureDetector(
                                      onTap: () => setSheetState(
                                          () => photoPaths.removeAt(index)),
                                      child: Container(
                                        width: 22,
                                        height: 22,
                                        decoration: const BoxDecoration(
                                          color: Colors.black54,
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(Icons.close,
                                            size: 14, color: Colors.white),
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            }),
                            if (photoPaths.length < 5)
                              InkWell(
                                onTap: () async {
                                  final file = await picker.pickImage(
                                    source: ImageSource.gallery,
                                    imageQuality: 85,
                                  );
                                  if (file != null) {
                                    setSheetState(
                                        () => photoPaths.add(file.path));
                                  }
                                },
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  width: 72,
                                  height: 72,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: AppColors.border,
                                      width: 2,
                                      strokeAlign: BorderSide.strokeAlignInside,
                                    ),
                                    color: AppColors.surfaceAlt,
                                  ),
                                  child: Icon(Icons.camera_alt_outlined,
                                      color: AppColors.inkMuted, size: 28),
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (photoPaths.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            '${photoPaths.length}/5 photos',
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(color: AppColors.inkMuted),
                          ),
                        ),
                      const SizedBox(height: 12),

                      // Comment
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

                      if (submitting)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              const SizedBox(
                                height: 16, width: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                uploadProgress.isEmpty ? 'Submitting...' : uploadProgress,
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.inkMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: submitting
                              ? null
                              : () async {
                            setSheetState(() => submitting = true);
                            try {
                              final metadata = <String, dynamic>{
                                'quality': quality,
                                'communication': communication,
                                'timeliness': timeliness,
                                'value': value,
                                'wouldRecommend': wouldRecommend,
                              };

                              final reviewId = await ref.read(profileRepositoryProvider).submitReview(
                                providerId: providerId,
                                rating: rating,
                                comment: comment,
                                metadata: metadata,
                              );

                              if (reviewId != null && photoPaths.isNotEmpty) {
                                final repo = ref.read(profileRepositoryProvider);
                                for (var i = 0; i < photoPaths.length; i++) {
                                  setSheetState(() => uploadProgress = 'Uploading photo ${i + 1} of ${photoPaths.length}...');
                                  await repo.uploadReviewPhoto(
                                    reviewId: reviewId,
                                    filePath: photoPaths[i],
                                  );
                                }
                              }

                              if (sheetContext.mounted) {
                                Navigator.of(sheetContext).pop();
                              }
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Review submitted.')),
                                );
                              }
                            } on ApiException catch (error) {
                              setSheetState(() => submitting = false);
                              if (sheetContext.mounted) {
                                ScaffoldMessenger.of(sheetContext).showSnackBar(
                                  SnackBar(
                                    content: Text(error.message),
                                    backgroundColor: Theme.of(context).colorScheme.error,
                                  ),
                                );
                              }
                            } catch (error) {
                              setSheetState(() => submitting = false);
                              if (sheetContext.mounted) {
                                ScaffoldMessenger.of(sheetContext).showSnackBar(
                                  SnackBar(
                                    content: Text(error.toString()),
                                    backgroundColor: Theme.of(context).colorScheme.error,
                                  ),
                                );
                              }
                            }
                          },
                          child: submitting
                              ? const SizedBox(
                                  height: 18, width: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('Submit'),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _breakdownRow(
    BuildContext context,
    String label,
    int value,
    void Function(int) onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(fontWeight: FontWeight.w500),
            ),
          ),
          const SizedBox(width: 8),
          ...List.generate(5, (index) {
            final star = index + 1;
            return GestureDetector(
              onTap: () => onChanged(star),
              child: Icon(
                star <= value
                    ? Icons.star_rounded
                    : Icons.star_outline_rounded,
                color: star <= value ? AppColors.warning : AppColors.inkMuted,
                size: 22,
              ),
            );
          }),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final orderAsync = ref.watch(orderDetailProvider(widget.orderId));
    final viewerId =
        Supabase.instance.client.auth.currentUser?.id ?? '';

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
                    _OrderTimelineStepper(order: order),
                    const SizedBox(height: 16),
                    _OrderSummary(order: order),
                    const SizedBox(height: 16),
                    _PaymentCard(order: order),
                    const SizedBox(height: 16),
                    _FulfillmentCard(order: order),
                    if (order.needsDeliveryTracking) ...[
                      const SizedBox(height: 16),
                      _DeliveryCard(
                        order: order,
                        viewerId: viewerId,
                        onUploadPhoto: () => _pickDeliveryPhoto(order),
                      ),
                      if (order.deliveryInfo != null &&
                          viewerId == order.providerId &&
                          !order.deliveryInfo!.isFinal) ...[
                        const SizedBox(height: 16),
                        _ProviderDeliveryUpdateCard(
                          order: order,
                          busy: _busy,
                          onUpdateDelivery: _updateDeliveryStatus,
                        ),
                      ],
                      if (order.deliveryInfo == null &&
                          viewerId == order.providerId) ...[
                        const SizedBox(height: 16),
                        _AssignDeliveryCard(
                          busy: _busy,
                          onAssign: _showAssignDeliverySheet,
                        ),
                      ],
                    ],
                    const SizedBox(height: 16),
                    _OrderActions(
                      order: order,
                      busy: _busy,
                      onUpdateStatus: _updateStatus,
                      onRaiseDispute: _raiseDispute,
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

// ── Order Timeline Stepper ──────────────────────────────────────────

class _OrderTimelineStepper extends StatelessWidget {
  const _OrderTimelineStepper({required this.order});

  final MobileOrderRecord order;

  @override
  Widget build(BuildContext context) {
    final steps = _timelineSteps(order.status);
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Progress', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          ...List.generate(steps.length, (i) {
            final isLast = i == steps.length - 1;
            return _OrderTrackerStep(
              step: steps[i],
              showConnector: !isLast,
            );
          }),
        ],
      ),
    );
  }
}

class _OrderStepData {
  const _OrderStepData({
    required this.title,
    required this.subtitle,
    required this.state,
  });

  final String title;
  final String subtitle;
  final _StepState state;
}

enum _StepState { done, active, upcoming, error }

List<_OrderStepData> _timelineSteps(String status) {
  if (status == 'cancelled') {
    return [
      const _OrderStepData(
        title: 'Ordered',
        subtitle: 'Request submitted',
        state: _StepState.done,
      ),
      const _OrderStepData(
        title: 'Cancelled',
        subtitle: 'This order was cancelled',
        state: _StepState.error,
      ),
    ];
  }
  if (status == 'rejected') {
    return [
      const _OrderStepData(
        title: 'Ordered',
        subtitle: 'Request submitted',
        state: _StepState.done,
      ),
      const _OrderStepData(
        title: 'Rejected',
        subtitle: 'Provider did not accept',
        state: _StepState.error,
      ),
    ];
  }
  if (status == 'closed') {
    return [
      const _OrderStepData(
        title: 'Ordered',
        subtitle: 'Request submitted',
        state: _StepState.done,
      ),
      const _OrderStepData(
        title: 'Closed',
        subtitle: 'Order was closed',
        state: _StepState.error,
      ),
    ];
  }

  final accepted = status == 'accepted' || status == 'in_progress' || status == 'completed';
  final inProgress = status == 'in_progress' || status == 'completed';
  final completed = status == 'completed';

  return [
    const _OrderStepData(
      title: 'Ordered',
      subtitle: 'Request submitted',
      state: _StepState.done,
    ),
    _OrderStepData(
      title: 'Accepted',
      subtitle: accepted ? 'Provider accepted the order' : 'Awaiting provider',
      state: accepted ? _StepState.done : _StepState.upcoming,
    ),
    _OrderStepData(
      title: 'In Progress',
      subtitle: inProgress ? 'Work is underway' : 'Not yet started',
      state: inProgress
          ? (completed ? _StepState.done : _StepState.active)
          : _StepState.upcoming,
    ),
    _OrderStepData(
      title: 'Completed',
      subtitle: completed ? 'Order is done' : 'Pending completion',
      state: completed ? _StepState.done : _StepState.upcoming,
    ),
  ];
}

class _OrderTrackerStep extends StatelessWidget {
  const _OrderTrackerStep({required this.step, required this.showConnector});

  final _OrderStepData step;
  final bool showConnector;

  @override
  Widget build(BuildContext context) {
    final isDone = step.state == _StepState.done;
    final isActive = step.state == _StepState.active;
    final isError = step.state == _StepState.error;

    final fill = isError
        ? AppColors.danger
        : isDone
            ? AppColors.success
            : isActive
                ? AppColors.primary
                : AppColors.border;
    final foreground = (isDone || isActive || isError) ? Colors.white : AppColors.inkMuted;

    return Padding(
      padding: EdgeInsets.only(bottom: showConnector ? 2 : 0),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: fill,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isDone
                        ? Icons.check_rounded
                        : isError
                            ? Icons.close_rounded
                            : Icons.circle,
                    color: foreground,
                    size: isDone || isError ? 15 : 8,
                  ),
                ),
                if (showConnector)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: step.state == _StepState.done
                          ? AppColors.success
                          : AppColors.border,
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 3, bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      step.title,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: isActive ? AppColors.ink : null,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      step.subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isError ? AppColors.danger : null,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
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

const _deliveryTimelineSteps = [
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
];

String _deliveryStatusLabel(String status) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'assigned':
      return 'Assigned';
    case 'picked_up':
      return 'Picked Up';
    case 'in_transit':
      return 'In Transit';
    case 'delivered':
      return 'Delivered';
    case 'failed':
      return 'Failed';
    default:
      return _humanize(status);
  }
}

String _deliveryStatusDescription(String status) {
  switch (status) {
    case 'pending':
      return 'Awaiting assignment';
    case 'assigned':
      return 'Delivery partner assigned';
    case 'picked_up':
      return 'Item has been picked up';
    case 'in_transit':
      return 'On the way to destination';
    case 'delivered':
      return 'Order delivered successfully';
    case 'failed':
      return 'Delivery could not be completed';
    default:
      return '';
  }
}

Color _deliveryStatusColor(String status) {
  switch (status) {
    case 'delivered':
      return Colors.green;
    case 'failed':
      return Colors.red;
    default:
      return Colors.orange;
  }
}

// ── Delivery Card ──────────────────────────────────────────────────

class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard({
    required this.order,
    required this.viewerId,
    this.onUploadPhoto,
  });

  final MobileOrderRecord order;
  final String viewerId;
  final VoidCallback? onUploadPhoto;

  @override
  Widget build(BuildContext context) {
    final delivery = order.deliveryInfo;
    if (delivery == null) return const SizedBox.shrink();

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Delivery Tracking',
                  style: Theme.of(context).textTheme.titleLarge),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  color: _deliveryStatusColor(delivery.status).withValues(alpha: 0.1),
                  border: Border.all(
                    color: _deliveryStatusColor(delivery.status).withValues(alpha: 0.3),
                  ),
                ),
                child: Text(
                  _deliveryStatusLabel(delivery.status),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: _deliveryStatusColor(delivery.status),
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (delivery.trackingNumber.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: AppColors.surfaceAlt,
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_shipping_outlined,
                      size: 18, color: AppColors.inkMuted),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Tracking #${delivery.trackingNumber}',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w600,
                              )),
                      if (delivery.carrier.isNotEmpty)
                        Text('via ${delivery.carrier}',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.inkMuted,
                                )),
                    ],
                  ),
                ],
              ),
            ),

          const SizedBox(height: 12),

          // Delivery photos
          if (delivery.photoUrls.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: delivery.photoUrls.map((url) {
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      url,
                      width: 80,
                      height: 80,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: AppColors.surfaceAlt,
                        ),
                        child: const Icon(Icons.broken_image_outlined,
                            size: 24, color: AppColors.inkMuted),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),

          // Timeline
          ...List.generate(_deliveryTimelineSteps.length, (i) {
            final step = _deliveryTimelineSteps[i];
            final currentIdx = _deliveryTimelineSteps
                .indexOf(delivery.status);
            final done = currentIdx >= i;
            final active = step == delivery.status;
            final update = delivery.updates.where(
              (u) => u.status == step,
            );

            return IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 32,
                    child: Column(
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: done ? AppColors.primary : Colors.white,
                            border: Border.all(
                              color: done
                                  ? AppColors.primary
                                  : AppColors.border,
                              width: 2,
                            ),
                          ),
                          child: done
                              ? const Icon(Icons.check,
                                  size: 14, color: Colors.white)
                              : active
                                  ? Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: AppColors.primary,
                                      ),
                                    )
                                  : null,
                        ),
                        if (i < _deliveryTimelineSteps.length - 1)
                          Expanded(
                            child: Container(
                              width: 2,
                              color: done
                                  ? AppColors.primary
                                  : AppColors.border,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _deliveryStatusLabel(step),
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  fontWeight:
                                      done ? FontWeight.w600 : FontWeight.normal,
                                  color: done
                                      ? AppColors.ink
                                      : AppColors.inkMuted,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _deliveryStatusDescription(step),
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: AppColors.inkMuted),
                          ),
                          if (update.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                _formatTimestamp(update.first.timestamp),
                                style: Theme.of(context)
                                    .textTheme
                                    .labelSmall
                                    ?.copyWith(color: AppColors.inkMuted),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),

          // Photo upload button (provider only)
          if (viewerId == order.providerId && !delivery.isFinal)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: onUploadPhoto,
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  label: const Text('Add Photo'),
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _formatTimestamp(String ts) {
    final dt = DateTime.tryParse(ts)?.toLocal();
    if (dt == null) return '';
    return '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

// ── Provider Delivery Update Card ─────────────────────────────────

class _ProviderDeliveryUpdateCard extends StatelessWidget {
  const _ProviderDeliveryUpdateCard({
    required this.order,
    required this.busy,
    required this.onUpdateDelivery,
  });

  final MobileOrderRecord order;
  final bool busy;
  final void Function(String status, {Map<String, dynamic>? extra})
      onUpdateDelivery;

  @override
  Widget build(BuildContext context) {
    final delivery = order.deliveryInfo;
    if (delivery == null) return const SizedBox.shrink();

    final allowedTransitions = _allowedDeliveryTransitions(delivery.status);

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Update Delivery',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          ...allowedTransitions.map((status) {
            IconData icon;
            switch (status) {
              case 'delivered':
                icon = Icons.check_circle_outline;
                break;
              case 'picked_up':
                icon = Icons.inventory_2_outlined;
                break;
              case 'in_transit':
                icon = Icons.navigation_outlined;
                break;
              case 'failed':
                icon = Icons.cancel_outlined;
                break;
              default:
                icon = Icons.schedule_outlined;
            }
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: busy
                      ? null
                      : () => onUpdateDelivery(status),
                  icon: Icon(icon, size: 18),
                  label: Text('Mark ${_deliveryStatusLabel(status)}'),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  List<String> _allowedDeliveryTransitions(String current) {
    switch (current) {
      case 'pending':
        return ['assigned'];
      case 'assigned':
        return ['picked_up', 'failed'];
      case 'picked_up':
        return ['in_transit', 'failed'];
      case 'in_transit':
        return ['delivered', 'failed'];
      default:
        return [];
    }
  }
}

// ── Assign Delivery Card ────────────────────────────────────────────

class _AssignDeliveryCard extends StatelessWidget {
  const _AssignDeliveryCard({
    required this.busy,
    required this.onAssign,
  });

  final bool busy;
  final VoidCallback onAssign;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Assign Delivery',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            'Assign a delivery partner to start tracking this order.',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.inkMuted),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: busy ? null : onAssign,
              icon: busy
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.local_shipping_outlined, size: 18),
              label: Text(busy ? 'Saving...' : 'Assign Delivery Partner'),
            ),
          ),
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
    this.onRaiseDispute,
  });

  final MobileOrderRecord order;
  final bool busy;
  final ValueChanged<String> onUpdateStatus;
  final VoidCallback? onRaiseDispute;

  static const _finalStatuses = {'completed', 'closed', 'cancelled', 'rejected'};

  @override
  Widget build(BuildContext context) {
    final isFinal = _finalStatuses.contains(order.status);
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
          if (!isFinal) ...[
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
          if (isFinal && onRaiseDispute != null) ...[
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 8),
            Text(
              'Need help?',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: AppColors.inkMuted,
              ),
            ),
            const SizedBox(height: 8),
            SecondaryButton(
              label: busy ? 'Submitting...' : 'Raise Dispute',
              icon: const Icon(Icons.gavel_outlined),
              onPressed: busy ? null : onRaiseDispute,
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
