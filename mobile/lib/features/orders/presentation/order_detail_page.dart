import 'dart:io';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/design_tokens.dart';
import '../../disputes/presentation/dispute_sheet.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
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
      final result = await ref
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
      ServiqToast.show(context, message: 'Order marked ${_humanize(status)}.', tone: ServiqToastTone.success);
      for (final warning in result.warnings) {
        if (!mounted) break;
        ServiqToast.show(context, message: warning, tone: ServiqToastTone.danger);
      }
      if (status == 'completed') {
        _promptReview();
      }
    } on ApiException catch (error) {
      if (mounted) {
        ServiqToast.show(context, message: error.message, tone: ServiqToastTone.danger);
      }
    } catch (error) {
      if (mounted) {
        ServiqToast.show(context, message: AppErrorMapper.toMessage(error), tone: ServiqToastTone.danger);
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
      final result = await ref.read(orderRepositoryProvider).updateDeliveryStatus(
            orderId: widget.orderId,
            status: status,
            extra: extra,
          );
      ref.invalidate(orderDetailProvider(widget.orderId));
      await ref.read(orderDetailProvider(widget.orderId).future);
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      ServiqToast.show(context, message: 'Delivery marked ${_humanize(status)}.', tone: ServiqToastTone.success);
      for (final warning in result.warnings) {
        if (!mounted) return;
        ServiqToast.show(context, message: warning, tone: ServiqToastTone.warning);
      }
    } on ApiException catch (error) {
      if (mounted) {
        ServiqToast.show(context, message: error.message, tone: ServiqToastTone.danger);
      }
    } catch (error) {
      if (mounted) {
        ServiqToast.show(context, message: AppErrorMapper.toMessage(error), tone: ServiqToastTone.danger);
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
      ServiqToast.show(context, message: 'Photo uploaded.', tone: ServiqToastTone.success);
    } catch (error) {
      if (mounted) {
        ServiqToast.show(context, message: AppErrorMapper.toMessage(error), tone: ServiqToastTone.danger);
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
            const SizedBox(height: AppSpacing.sm),
            AppTextField(
              controller: driverNameCtrl,
              label: 'Driver name',
            ),
            const SizedBox(height: AppSpacing.xs),
            AppTextField(
              controller: driverPhoneCtrl,
              label: 'Driver phone',
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: AppSpacing.xs),
            AppTextField(
              controller: trackingCtrl,
              label: 'Tracking number',
            ),
            const SizedBox(height: AppSpacing.xs),
            AppTextField(
              controller: carrierCtrl,
              label: 'Carrier (e.g. Delhivery)',
            ),
            const SizedBox(height: AppSpacing.sm),
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
                  ? SizedBox(
                      height: 18,
                      width: 18,
                      child:
                          CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary),
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
                      const SizedBox(height: AppSpacing.md),

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
                                  : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                              size: 36,
                            ),
                            onPressed: () =>
                                setSheetState(() => rating = star),
                          );
                        }),
                      ),
                      const SizedBox(height: AppSpacing.sm),

                      // Rating breakdown
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(AppRadii.xl),
                          border: Border.all(color: Theme.of(context).colorScheme.outline),
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
                                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                                    letterSpacing: 1.2,
                                  ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
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
                      const SizedBox(height: AppSpacing.sm),

                      // Would recommend toggle
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(AppRadii.xl),
                          border: Border.all(color: Theme.of(context).colorScheme.outline),
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
                            const SizedBox(width: AppSpacing.xs),
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
                      const SizedBox(height: AppSpacing.sm),

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
                                    borderRadius: BorderRadius.circular(AppRadii.lg),
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
                                borderRadius: BorderRadius.circular(AppRadii.lg),
                                child: Container(
                                  width: 72,
                                  height: 72,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(AppRadii.lg),
                                    border: Border.all(
                                      color: Theme.of(context).colorScheme.outline,
                                      width: 2,
                                      strokeAlign: BorderSide.strokeAlignInside,
                                    ),
                                    color: AppColors.surfaceAlt,
                                  ),
                                  child: Icon(Icons.camera_alt_outlined,
                                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6), size: 28),
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
                                ?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                          ),
                        ),
                      const SizedBox(height: AppSpacing.sm),

                      // Comment
                      AppTextField(
                        label: 'Review (optional)',
                        hint: 'Share your experience...',
                        maxLines: 3,
                        onChanged: (v) => comment = v,
                      ),
                      const SizedBox(height: AppSpacing.sm),

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
                                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
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
                                ServiqToast.show(context, message: 'Review submitted.', tone: ServiqToastTone.success);
                              }
                            } on ApiException catch (error) {
                              setSheetState(() => submitting = false);
                              if (sheetContext.mounted) {
                                ServiqToast.show(sheetContext, message: error.message, tone: ServiqToastTone.danger);
                              }
                            } catch (error) {
                              setSheetState(() => submitting = false);
                              if (sheetContext.mounted) {
                                ServiqToast.show(sheetContext, message: error.toString(), tone: ServiqToastTone.danger);
                              }
                            }
                          },
                          child: submitting
                              ? SizedBox(
                                  height: 18, width: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary),
                                )
                              : const Text('Submit'),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
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
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
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
          const SizedBox(width: AppSpacing.xs),
          ...List.generate(5, (index) {
            final star = index + 1;
            return GestureDetector(
              onTap: () => onChanged(star),
              child: Icon(
                star <= value
                    ? Icons.star_rounded
                    : Icons.star_outline_rounded,
                color: star <= value ? AppColors.warning : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
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

    return ServiqScaffold(
      appBar: ServiqTopBar(title: 'Order detail'),
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
                    const SizedBox(height: AppSpacing.md),
                    _OrderSummary(order: order),
                    const SizedBox(height: AppSpacing.md),
                    _PaymentCard(order: order),
                    const SizedBox(height: AppSpacing.md),
                    _FulfillmentCard(order: order),
                    if (order.needsDeliveryTracking) ...[
                      const SizedBox(height: AppSpacing.md),
                      _DeliveryCard(
                        order: order,
                        viewerId: viewerId,
                        onUploadPhoto: () => _pickDeliveryPhoto(order),
                      ),
                      if (order.deliveryInfo != null &&
                          viewerId == order.providerId &&
                          !order.deliveryInfo!.isFinal) ...[
                        const SizedBox(height: AppSpacing.md),
                        _ProviderDeliveryUpdateCard(
                          order: order,
                          busy: _busy,
                          onUpdateDelivery: _updateDeliveryStatus,
                        ),
                      ],
                      if (order.deliveryInfo == null &&
                          viewerId == order.providerId) ...[
                        const SizedBox(height: AppSpacing.md),
                        _AssignDeliveryCard(
                          busy: _busy,
                          onAssign: _showAssignDeliverySheet,
                        ),
                      ],
                    ],
                    const SizedBox(height: AppSpacing.md),
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  gradient: AppGradients.premiumAccent,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: const Icon(Icons.route_rounded, size: 14, color: Colors.white),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text('Progress', style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
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
                : Theme.of(context).colorScheme.outline;
    final foreground = (isDone || isActive || isError) ? Colors.white : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5);

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
                      margin: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
                      color: step.state == _StepState.done
                          ? AppColors.success
                          : Theme.of(context).colorScheme.outline,
                    ),
                  ),
              ],
            ),
            const SizedBox(width: AppSpacing.sm),
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
                        color: isActive ? Theme.of(context).colorScheme.onSurface : null,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxxs),
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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(order.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.headlineSmall),
              ),
              const SizedBox(width: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  gradient: AppGradients.premiumAccent,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                  boxShadow: AppShadows.glow,
                ),
                child: Text(
                  '₹${order.price.round()}',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            order.notes.isEmpty
                ? 'Order details, payment, and fulfillment notes stay attached here.'
                : order.notes,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _StatusPill(label: _humanize(order.status)),
              _StatusPill(label: _humanize(order.listingType)),
              _StatusPill(label: 'Qty ${order.quantity}'),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: AppColors.primaryDeep,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({required this.order});

  final MobileOrderRecord order;

  @override
  Widget build(BuildContext context) {
    final isPaid = order.paymentStatus == 'completed' || order.paymentStatus == 'captured';
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  gradient: isPaid ? AppGradients.premiumAccent : const LinearGradient(
                    colors: [AppColors.warning, AppColors.warning],
                  ),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(
                  isPaid ? Icons.payment_rounded : Icons.pending_outlined,
                  size: 14, color: Colors.white,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text('Payment', style: Theme.of(context).textTheme.titleLarge),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isPaid ? AppColors.success.withValues(alpha: 0.1) : AppColors.warning.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                  border: Border.all(
                    color: isPaid ? AppColors.success.withValues(alpha: 0.3) : AppColors.warning.withValues(alpha: 0.3),
                  ),
                ),
                child: Text(
                  _humanize(order.paymentStatus),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: isPaid ? AppColors.success : AppColors.warning,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          _InfoRow(
            label: 'Method',
            value: order.paymentMethod.isEmpty
                ? 'Not recorded'
                : _humanize(order.paymentMethod),
          ),
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  gradient: AppGradients.premiumAccent,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: const Icon(Icons.inventory_2_rounded, size: 14, color: Colors.white),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text('Fulfillment', style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
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
      return AppColors.success;
    case 'failed':
      return AppColors.danger;
    default:
      return AppColors.warning;
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
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  gradient: AppGradients.premiumAccent,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: const Icon(Icons.local_shipping_rounded, size: 14, color: Colors.white),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text('Delivery Tracking',
                  style: Theme.of(context).textTheme.titleLarge),
              const Spacer(),
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.pill),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _deliveryStatusColor(delivery.status).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                      border: Border.all(
                        color: _deliveryStatusColor(delivery.status).withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      _deliveryStatusLabel(delivery.status),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: _deliveryStatusColor(delivery.status),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          if (delivery.trackingNumber.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadii.lg),
                color: AppColors.surfaceAlt,
                border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                    ),
                    child: const Icon(Icons.local_shipping_outlined,
                        size: 16, color: AppColors.primaryDeep),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Tracking #${delivery.trackingNumber}',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              )),
                      if (delivery.carrier.isNotEmpty)
                        Text('via ${delivery.carrier}',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                                )),
                    ],
                  ),
                ],
              ),
            ),

          const SizedBox(height: AppSpacing.sm),

          // Delivery photos
          if (delivery.photoUrls.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: delivery.photoUrls.map((url) {
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                    child: Image.network(
                      url,
                      width: 80,
                      height: 80,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(AppRadii.lg),
                          color: AppColors.surfaceAlt,
                        ),
                        child: Icon(Icons.broken_image_outlined,
                            size: 24, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),

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
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: done
                                ? AppGradients.premiumAccent
                                : null,
                            color: done ? null : Theme.of(context).colorScheme.surface,
                            border: Border.all(
                              color: done
                                  ? Colors.transparent
                                  : active
                                      ? AppColors.primary.withValues(alpha: 0.6)
                                      : Theme.of(context).colorScheme.outline.withValues(alpha: 0.4),
                              width: 2,
                            ),
                            boxShadow: done ? AppShadows.glow : null,
                          ),
                          child: done
                              ? const Icon(Icons.check_rounded,
                                  size: 14, color: Colors.white)
                              : active
                                  ? Container(
                                      width: 10,
                                      height: 10,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        gradient: AppGradients.premiumAccent,
                                        boxShadow: AppShadows.glow,
                                      ),
                                    )
                                  : null,
                        ),
                        if (i < _deliveryTimelineSteps.length - 1)
                          Expanded(
                            child: Container(
                              width: 2,
                              decoration: BoxDecoration(
                                gradient: done
                                    ? AppGradients.premiumAccent
                                    : null,
                                color: done ? null : Theme.of(context).colorScheme.outline.withValues(alpha: 0.3),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
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
                                      done ? FontWeight.w700 : FontWeight.w500,
                                   color: done
                                       ? Theme.of(context).colorScheme.onSurface
                                       : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                                ),
                          ),
                          const SizedBox(height: AppSpacing.xxxs),
                          Text(
                            _deliveryStatusDescription(step),
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5)),
                          ),
                          if (update.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                _formatTimestamp(update.first.timestamp),
                                style: Theme.of(context)
                                    .textTheme
                                    .labelSmall
                                ?.copyWith(color: AppColors.primary.withValues(alpha: 0.8)),
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

          if (viewerId == order.providerId && !delivery.isFinal)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: SizedBox(
                width: double.infinity,
                child: SecondaryButton(
                  label: 'Add Photo',
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  onPressed: onUploadPhoto,
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  gradient: AppGradients.premiumAccent,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: const Icon(Icons.delivery_dining_rounded, size: 14, color: Colors.white),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text('Update Delivery',
                  style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          ...allowedTransitions.map((status) {
            IconData icon;
            Color color;
            switch (status) {
              case 'delivered':
                icon = Icons.check_circle_outline;
                color = AppColors.success;
                break;
              case 'picked_up':
                icon = Icons.inventory_2_outlined;
                color = AppColors.primary;
                break;
              case 'in_transit':
                icon = Icons.navigation_outlined;
                color = AppColors.accent;
                break;
              case 'failed':
                icon = Icons.cancel_outlined;
                color = AppColors.danger;
                break;
              default:
                icon = Icons.schedule_outlined;
                color = AppColors.warning;
            }
            return Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: SizedBox(
                width: double.infinity,
                child: SecondaryButton(
                  label: 'Mark ${_deliveryStatusLabel(status)}',
                  icon: Icon(icon, size: 18, color: color),
                  onPressed: busy ? null : () => onUpdateDelivery(status),
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  gradient: AppGradients.premiumAccent,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: const Icon(Icons.local_shipping_rounded, size: 14, color: Colors.white),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text('Assign Delivery',
                  style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Assign a delivery partner to start tracking this order.',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: PrimaryButton(
              label: busy ? 'Saving...' : 'Assign Delivery Partner',
              icon: busy
                  ? SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary),
                    )
                  : const Icon(Icons.local_shipping_outlined, size: 18),
              onPressed: busy ? null : onAssign,
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  gradient: AppGradients.premiumAccent,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: const Icon(Icons.touch_app_rounded, size: 14, color: Colors.white),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text('Next actions', style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
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
            const SizedBox(height: AppSpacing.sm),
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
              const SizedBox(height: AppSpacing.sm),
              SecondaryButton(
                label: busy ? 'Updating...' : 'Mark completed',
                icon: const Icon(Icons.task_alt_rounded),
                onPressed: busy ? null : () => onUpdateStatus('completed'),
              ),
            ],
          ],
          if (isFinal && onRaiseDispute != null) ...[
            const SizedBox(height: AppSpacing.md),
            const Divider(),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Need help?',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
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
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
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
