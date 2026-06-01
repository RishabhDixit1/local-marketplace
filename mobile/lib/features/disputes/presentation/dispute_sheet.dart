import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../data/dispute_repository.dart';
import '../domain/dispute_models.dart';

enum _SheetPhase { form, submitting, success, error }

class DisputeSheet extends ConsumerStatefulWidget {
  const DisputeSheet({super.key, required this.orderId});

  final String orderId;

  static Future<void> show({required BuildContext context, required String orderId}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => DisputeSheet(orderId: orderId),
    );
  }

  @override
  ConsumerState<DisputeSheet> createState() => _DisputeSheetState();
}

class _DisputeSheetState extends ConsumerState<DisputeSheet> {
  _SheetPhase _phase = _SheetPhase.form;
  DisputeReason? _selectedReason;
  final _descriptionController = TextEditingController();
  String? _errorMessage;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _selectedReason != null &&
      _descriptionController.text.trim().length >= 10;

  Future<void> _submit() async {
    final reason = _selectedReason;
    if (!_canSubmit || reason == null) return;

    setState(() {
      _phase = _SheetPhase.submitting;
      _errorMessage = null;
    });

    try {
      await ref.read(disputeRepositoryProvider).fileDispute(
        DisputeSubmission(
          orderId: widget.orderId,
          reason: reason,
          description: _descriptionController.text.trim(),
        ),
      );
      if (!mounted) return;
      setState(() => _phase = _SheetPhase.success);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _phase = _SheetPhase.error;
        _errorMessage = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_phase == _SheetPhase.success) {
      return _buildSuccess(context);
    }

    final reason = _selectedReason;
    final canSubmit = reason != null && _descriptionController.text.trim().length >= 10;

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
              child: Text(
                'Raise a Dispute',
                style: Theme.of(context).textTheme.titleLarge,
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
                  Text(
                    'Reason',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppColors.inkMuted,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<DisputeReason>(
                        value: reason,
                        hint: const Text('Select a reason'),
                        isExpanded: true,
                        items: [
                          for (final r in DisputeReason.values)
                            DropdownMenuItem(
                              value: r,
                              child: Text(r.label),
                            ),
                        ],
                        onChanged: (v) => setState(() => _selectedReason = v),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Description',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppColors.inkMuted,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  TextField(
                    controller: _descriptionController,
                    decoration: const InputDecoration(
                      hintText: 'Describe the issue in detail (min 10 characters)...',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 5,
                    minLines: 3,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      '${_descriptionController.text.length}/2000',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                  if (_phase == _SheetPhase.error && _errorMessage != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: AppColors.dangerSoft,
                        borderRadius: BorderRadius.circular(AppRadii.sm),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppColors.danger,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
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
                    : const Text('Submit Dispute'),
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
        constraints: const BoxConstraints(maxHeight: 280),
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
              'Dispute submitted',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'An admin will review and follow up.',
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
