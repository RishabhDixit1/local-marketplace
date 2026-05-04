import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../tasks/data/task_repository.dart';
import '../data/quote_repository.dart';
import '../domain/quote_models.dart';

class QuoteRoomPage extends ConsumerStatefulWidget {
  const QuoteRoomPage({
    super.key,
    required this.mode,
    required this.targetId,
    this.conversationId,
  });

  final MobileQuoteTargetMode mode;
  final String targetId;
  final String? conversationId;

  @override
  ConsumerState<QuoteRoomPage> createState() => _QuoteRoomPageState();
}

class _QuoteRoomPageState extends ConsumerState<QuoteRoomPage> {
  final _formKey = GlobalKey<FormState>();
  final _summaryController = TextEditingController();
  final _notesController = TextEditingController();
  final _taxController = TextEditingController(text: '0');
  final _expiresDaysController = TextEditingController(text: '7');
  final List<_LineItemControllers> _lineItems = [];

  String? _hydratedKey;
  bool _saving = false;
  bool _sending = false;
  bool _accepting = false;

  QuoteWorkspaceRequest get _request =>
      QuoteWorkspaceRequest(mode: widget.mode, targetId: widget.targetId);

  @override
  void dispose() {
    _summaryController.dispose();
    _notesController.dispose();
    _taxController.dispose();
    _expiresDaysController.dispose();
    for (final item in _lineItems) {
      item.dispose();
    }
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(quoteWorkspaceProvider(_request));
    await ref.read(quoteWorkspaceProvider(_request).future);
  }

  void _hydrate(MobileQuoteWorkspace workspace) {
    final draft = workspace.draft;
    final key = draft?.id ?? 'empty:${widget.mode.name}:${widget.targetId}';
    if (_hydratedKey == key) {
      return;
    }
    _hydratedKey = key;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      for (final item in _lineItems) {
        item.dispose();
      }
      _lineItems.clear();

      _summaryController.text = draft?.summary.isNotEmpty == true
          ? draft!.summary
          : 'Quote for ${workspace.context.taskTitle}';
      _notesController.text = draft?.notes ?? '';
      _taxController.text = draft == null || draft.taxAmount <= 0
          ? '0'
          : draft.taxAmount.round().toString();

      final expiresAt = draft?.expiresAt;
      if (expiresAt != null) {
        final days = expiresAt.difference(DateTime.now()).inDays.clamp(1, 30);
        _expiresDaysController.text = days.toString();
      }

      if (draft != null && draft.lineItems.isNotEmpty) {
        _lineItems.addAll(draft.lineItems.map(_LineItemControllers.fromItem));
      } else {
        _lineItems.add(
          _LineItemControllers(
            label: workspace.context.taskTitle,
            description: workspace.context.taskDescription,
            quantity: '1',
            unitPrice: workspace.context.suggestedAmount == null
                ? ''
                : workspace.context.suggestedAmount!.round().toString(),
          ),
        );
      }
      setState(() {});
    });
  }

  MobileQuoteDraftInput? _readInput() {
    if (!_formKey.currentState!.validate()) {
      return null;
    }
    final items = _lineItems.map((item) => item.toItem()).toList();
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one quote line.')),
      );
      return null;
    }

    final expiresDays = int.tryParse(_expiresDaysController.text.trim()) ?? 7;
    return MobileQuoteDraftInput(
      mode: widget.mode,
      targetId: widget.targetId,
      summary: _summaryController.text.trim(),
      notes: _notesController.text.trim(),
      taxAmount: double.tryParse(_taxController.text.trim()) ?? 0,
      expiresAt: DateTime.now().add(Duration(days: expiresDays.clamp(1, 30))),
      lineItems: items,
      conversationId: widget.conversationId,
    );
  }

  Future<void> _saveDraft() async {
    final input = _readInput();
    if (input == null) {
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(quoteRepositoryProvider).saveDraft(input);
      ref.invalidate(quoteWorkspaceProvider(_request));
      if (!mounted) {
        return;
      }
      ref
          .read(analyticsServiceProvider)
          .trackEvent(
            'quote_draft_saved',
            extras: {
              'mode': widget.mode.apiValue,
              'target_id': widget.targetId,
              'line_count': input.lineItems.length,
            },
          );
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Quote draft saved.')));
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
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _sendQuote() async {
    final input = _readInput();
    if (input == null) {
      return;
    }
    setState(() => _sending = true);
    try {
      await ref.read(quoteRepositoryProvider).sendQuote(input);
      ref.invalidate(quoteWorkspaceProvider(_request));
      ref.invalidate(taskSnapshotProvider);
      if (!mounted) {
        return;
      }
      HapticFeedback.mediumImpact();
      ref
          .read(analyticsServiceProvider)
          .trackEvent(
            'quote_sent',
            extras: {
              'mode': widget.mode.apiValue,
              'target_id': widget.targetId,
              'line_count': input.lineItems.length,
            },
          );
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Quote sent.')));
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
        setState(() => _sending = false);
      }
    }
  }

  Future<void> _acceptQuote(MobileQuoteDraft draft) async {
    setState(() => _accepting = true);
    try {
      await ref.read(quoteRepositoryProvider).acceptQuote(draft.id);
      ref.invalidate(quoteWorkspaceProvider(_request));
      ref.invalidate(taskSnapshotProvider);
      if (!mounted) {
        return;
      }
      HapticFeedback.mediumImpact();
      ref
          .read(analyticsServiceProvider)
          .trackEvent(
            'quote_accepted',
            extras: {'mode': widget.mode.apiValue, 'quote_id': draft.id},
          );
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Quote accepted.')));
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _accepting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final targetId = widget.targetId.trim();
    if (targetId.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Quote')),
        body: const SafeArea(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: SectionCard(
              child: EmptyStateView(
                title: 'Quote target missing',
                message: 'Open a task or conversation with a linked request.',
              ),
            ),
          ),
        ),
      );
    }

    final workspaceAsync = ref.watch(quoteWorkspaceProvider(_request));
    return Scaffold(
      appBar: AppBar(title: const Text('Deal room')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              ServiqAsyncBody<MobileQuoteWorkspace>(
                value: workspaceAsync,
                errorTitle: 'Unable to load quote',
                errorMessageFor: (error, _) =>
                    AppErrorMapper.toMessage(error),
                onRetry: _refresh,
                loadingBuilder: () => const _QuoteLoading(),
                data: (workspace) {
                  _hydrate(workspace);
                  final draft = workspace.draft;
                  final canEdit = workspace.context.canEdit;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _QuoteContextCard(workspace: workspace),
                      const SizedBox(height: 16),
                      if (draft != null)
                        _QuoteStatusCard(
                          draft: draft,
                          canAccept:
                              draft.isAcceptable &&
                              workspace.context.actorRole ==
                                  MobileQuoteActorRole.consumer,
                          accepting: _accepting,
                          onAccept: () => _acceptQuote(draft),
                        ),
                      if (draft != null) const SizedBox(height: 16),
                      _QuoteForm(
                        formKey: _formKey,
                        summaryController: _summaryController,
                        notesController: _notesController,
                        taxController: _taxController,
                        expiresDaysController: _expiresDaysController,
                        lineItems: _lineItems,
                        canEdit: canEdit,
                        saving: _saving,
                        sending: _sending,
                        onAddLine: () {
                          setState(() {
                            _lineItems.add(_LineItemControllers());
                          });
                        },
                        onRemoveLine: (index) {
                          setState(() {
                            final removed = _lineItems.removeAt(index);
                            removed.dispose();
                          });
                        },
                        onSave: _saveDraft,
                        onSend: _sendQuote,
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuoteContextCard extends StatelessWidget {
  const _QuoteContextCard({required this.workspace});

  final MobileQuoteWorkspace workspace;

  @override
  Widget build(BuildContext context) {
    final quoteContext = workspace.context;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            quoteContext.taskTitle,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            quoteContext.taskDescription.isEmpty
                ? 'Scope, price, acceptance, and task conversion stay linked here.'
                : quoteContext.taskDescription,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text(quoteContext.mode.label)),
              Chip(label: Text(_humanize(quoteContext.currentStatus))),
              Chip(label: Text(quoteContext.locationLabel)),
              Chip(label: Text(quoteContext.counterpartyName)),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuoteStatusCard extends StatelessWidget {
  const _QuoteStatusCard({
    required this.draft,
    required this.canAccept,
    required this.accepting,
    required this.onAccept,
  });

  final MobileQuoteDraft draft;
  final bool canAccept;
  final bool accepting;
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  draft.status.label,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              Text(
                _formatInr(draft.total),
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            draft.sentAt == null
                ? 'Draft saved locally to this deal.'
                : 'Sent ${_relativeTime(draft.sentAt!)}.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (canAccept) ...[
            const SizedBox(height: 14),
            PrimaryButton(
              label: accepting ? 'Accepting...' : 'Accept quote',
              icon: accepting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check_circle_outline_rounded),
              onPressed: accepting ? null : onAccept,
            ),
          ],
        ],
      ),
    );
  }
}

class _QuoteForm extends StatelessWidget {
  const _QuoteForm({
    required this.formKey,
    required this.summaryController,
    required this.notesController,
    required this.taxController,
    required this.expiresDaysController,
    required this.lineItems,
    required this.canEdit,
    required this.saving,
    required this.sending,
    required this.onAddLine,
    required this.onRemoveLine,
    required this.onSave,
    required this.onSend,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController summaryController;
  final TextEditingController notesController;
  final TextEditingController taxController;
  final TextEditingController expiresDaysController;
  final List<_LineItemControllers> lineItems;
  final bool canEdit;
  final bool saving;
  final bool sending;
  final VoidCallback onAddLine;
  final ValueChanged<int> onRemoveLine;
  final VoidCallback onSave;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final subtotal = lineItems.fold<double>(
      0,
      (sum, item) => sum + item.amount,
    );
    final tax = double.tryParse(taxController.text.trim()) ?? 0;
    final total = subtotal + tax;

    return SectionCard(
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Quote draft', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            TextFormField(
              controller: summaryController,
              enabled: canEdit,
              decoration: const InputDecoration(labelText: 'Summary'),
              validator: _required('Add a quote summary.'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: notesController,
              enabled: canEdit,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'Notes'),
            ),
            const SizedBox(height: 16),
            Text('Line items', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            ...lineItems.asMap().entries.map(
              (entry) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _LineItemCard(
                  controllers: entry.value,
                  enabled: canEdit,
                  canRemove: lineItems.length > 1,
                  onRemove: () => onRemoveLine(entry.key),
                ),
              ),
            ),
            if (canEdit)
              SecondaryButton(
                label: 'Add line',
                icon: const Icon(Icons.add_rounded),
                onPressed: onAddLine,
              ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: taxController,
                    enabled: canEdit,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Tax'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: expiresDaysController,
                    enabled: canEdit,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Expires days',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(AppRadii.sm),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _AmountRow(label: 'Subtotal', value: subtotal),
                  _AmountRow(label: 'Tax', value: tax),
                  const Divider(),
                  _AmountRow(label: 'Total', value: total, strong: true),
                ],
              ),
            ),
            if (canEdit) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: SecondaryButton(
                      label: saving ? 'Saving...' : 'Save draft',
                      onPressed: saving || sending ? null : onSave,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PrimaryButton(
                      label: sending ? 'Sending...' : 'Send quote',
                      onPressed: saving || sending ? null : onSend,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LineItemCard extends StatefulWidget {
  const _LineItemCard({
    required this.controllers,
    required this.enabled,
    required this.canRemove,
    required this.onRemove,
  });

  final _LineItemControllers controllers;
  final bool enabled;
  final bool canRemove;
  final VoidCallback onRemove;

  @override
  State<_LineItemCard> createState() => _LineItemCardState();
}

class _LineItemCardState extends State<_LineItemCard> {
  @override
  void initState() {
    super.initState();
    widget.controllers.quantity.addListener(_refresh);
    widget.controllers.unitPrice.addListener(_refresh);
  }

  @override
  void dispose() {
    widget.controllers.quantity.removeListener(_refresh);
    widget.controllers.unitPrice.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final item = widget.controllers;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: item.label,
                  enabled: widget.enabled,
                  decoration: const InputDecoration(labelText: 'Item'),
                  validator: _required('Add an item label.'),
                ),
              ),
              if (widget.enabled && widget.canRemove) ...[
                const SizedBox(width: 8),
                IconButton.outlined(
                  tooltip: 'Remove line',
                  onPressed: widget.onRemove,
                  icon: const Icon(Icons.delete_outline_rounded),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: item.description,
            enabled: widget.enabled,
            decoration: const InputDecoration(labelText: 'Description'),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: item.quantity,
                  enabled: widget.enabled,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Qty'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: item.unitPrice,
                  enabled: widget.enabled,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Unit price'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              _formatInr(item.amount),
              style: Theme.of(context).textTheme.labelLarge,
            ),
          ),
        ],
      ),
    );
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({
    required this.label,
    required this.value,
    this.strong = false,
  });

  final String label;
  final double value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final style = strong
        ? Theme.of(context).textTheme.titleMedium
        : Theme.of(context).textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          Text(_formatInr(value), style: style),
        ],
      ),
    );
  }
}

class _QuoteLoading extends StatelessWidget {
  const _QuoteLoading();

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
                LoadingShimmer(height: 20, width: 180),
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

class _LineItemControllers {
  _LineItemControllers({
    String label = '',
    String description = '',
    String quantity = '1',
    String unitPrice = '',
  }) : label = TextEditingController(text: label),
       description = TextEditingController(text: description),
       quantity = TextEditingController(text: quantity),
       unitPrice = TextEditingController(text: unitPrice);

  factory _LineItemControllers.fromItem(MobileQuoteLineItem item) {
    return _LineItemControllers(
      label: item.label,
      description: item.description,
      quantity: _formatNumber(item.quantity),
      unitPrice: _formatNumber(item.unitPrice),
    );
  }

  final TextEditingController label;
  final TextEditingController description;
  final TextEditingController quantity;
  final TextEditingController unitPrice;

  double get amount {
    final qty = double.tryParse(quantity.text.trim()) ?? 1;
    final price = double.tryParse(unitPrice.text.trim()) ?? 0;
    return qty * price;
  }

  MobileQuoteLineItem toItem() {
    return MobileQuoteLineItem(
      label: label.text.trim(),
      description: description.text.trim(),
      quantity: double.tryParse(quantity.text.trim()) ?? 1,
      unitPrice: double.tryParse(unitPrice.text.trim()) ?? 0,
    );
  }

  void dispose() {
    label.dispose();
    description.dispose();
    quantity.dispose();
    unitPrice.dispose();
  }
}

String? Function(String?) _required(String message) {
  return (value) {
    if ((value ?? '').trim().isEmpty) {
      return message;
    }
    return null;
  };
}

String _formatInr(double value) => 'INR ${value.round()}';

String _formatNumber(double value) {
  if (value == value.roundToDouble()) {
    return value.round().toString();
  }
  return value.toStringAsFixed(2);
}

String _humanize(String raw) {
  return raw
      .split('_')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
}

String _relativeTime(DateTime value) {
  final diff = DateTime.now().difference(value.toLocal());
  if (diff.inMinutes < 1) {
    return 'just now';
  }
  if (diff.inHours < 1) {
    return '${diff.inMinutes}m ago';
  }
  if (diff.inDays < 1) {
    return '${diff.inHours}h ago';
  }
  return '${diff.inDays}d ago';
}
