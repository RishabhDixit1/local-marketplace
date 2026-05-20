import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design_system/design_system.dart';
import '../../../core/theme/app_theme.dart';
import '../data/report_repository.dart';
import '../domain/report_models.dart';

enum _SheetPhase { form, submitting, success }

class ReportSheet extends ConsumerStatefulWidget {
  const ReportSheet({
    super.key,
    required this.targetType,
    required this.targetId,
    this.targetTitle,
  });

  final ReportTargetType targetType;
  final String targetId;
  final String? targetTitle;

  static Future<void> show({
    required BuildContext context,
    required ReportTargetType targetType,
    required String targetId,
    String? targetTitle,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ReportSheet(
        targetType: targetType,
        targetId: targetId,
        targetTitle: targetTitle,
      ),
    );
  }

  @override
  ConsumerState<ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<ReportSheet> {
  _SheetPhase _phase = _SheetPhase.form;
  ReportReason? _selectedReason;
  final _descriptionController = TextEditingController();

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reason = _selectedReason;
    if (reason == null) return;

    setState(() => _phase = _SheetPhase.submitting);

    try {
      await ref.read(reportRepositoryProvider).submitReport(
        ReportSubmission(
          targetType: widget.targetType,
          targetId: widget.targetId,
          reason: reason,
          description: reason == ReportReason.other
              ? _descriptionController.text
              : null,
        ),
      );
      if (!mounted) return;
      setState(() => _phase = _SheetPhase.success);
    } catch (e) {
      if (!mounted) return;
      setState(() => _phase = _SheetPhase.form);
      ServiqToast.show(context, message: 'Failed to submit report.', tone: ServiqToastTone.danger);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_phase == _SheetPhase.success) {
      return _buildSuccess(context);
    }

    final reason = _selectedReason;
    final canSubmit = reason != null;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.88,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.xxs,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Report', style: Theme.of(context).textTheme.titleLarge),
                  if (widget.targetTitle != null) ...[
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      widget.targetTitle!,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ],
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  0,
                  AppSpacing.md,
                  AppSpacing.sm,
                ),
                children: [
                  RadioGroup<ReportReason>(
                    groupValue: reason,
                    onChanged: (v) => setState(() => _selectedReason = v),
                    child: Column(
                      children: [
                        for (final r in ReportReason.values)
                          RadioListTile<ReportReason>(
                            value: r,
                            title: Text(r.label),
                            activeColor: AppColors.primary,
                            contentPadding: EdgeInsets.zero,
                          ),
                      ],
                    ),
                  ),
                  if (reason == ReportReason.other) ...[
                    const SizedBox(height: AppSpacing.xs),
                    TextField(
                      controller: _descriptionController,
                      decoration: const InputDecoration(
                        hintText: 'Describe the issue...',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 3,
                      minLines: 2,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                  ],
                ],
              ),
            ),
            Container(
              width: double.infinity,
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                MediaQuery.paddingOf(context).bottom + AppSpacing.sm,
              ),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: FilledButton(
                onPressed: canSubmit && _phase != _SheetPhase.submitting
                    ? _submit
                    : null,
                child: _phase == _SheetPhase.submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Submit report'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuccess(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.paddingOf(context).bottom,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          maxHeight: 280,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Spacer(),
            const Icon(
              Icons.check_circle_outline_rounded,
              size: 56,
              color: AppColors.success,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Report submitted',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Thanks for helping keep the community safe.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.inkSubtle,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Done'),
                ),
              ),
            ),
            const Spacer(),
          ],
        ),
      ),
    );
  }
}
