import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/mobile_api_provider.dart';
import '../../core/theme/design_tokens.dart';
import '../../features/ai_prompt/domain/ai_prompt_models.dart';

const _actionLabels = {
  'find_service': 'Browse results',
  'find_provider': 'Browse results',
  'buy_product': 'View products',
  'post_need': 'Create post',
  'sell_product': 'List product',
  'manage_inventory': 'Manage',
  'check_orders': 'View orders',
  'list_services': 'View services',
  'manage_business': 'Dashboard',
  'get_help': 'Get help',
};

class AiPromptBar extends ConsumerStatefulWidget {
  const AiPromptBar({
    super.key,
    this.placeholder = 'Ask ServiQ to find, post, buy, sell or manage...',
    this.initialQuery,
    this.onResult,
  });

  final String placeholder;
  final String? initialQuery;
  final void Function(AiPromptResponse result)? onResult;

  @override
  ConsumerState<AiPromptBar> createState() => _AiPromptBarState();
}

class _AiPromptBarState extends ConsumerState<AiPromptBar> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  bool _loading = false;
  @override
  void initState() {
    super.initState();
    final initial = widget.initialQuery?.trim() ?? '';
    _controller.text = initial;
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _submit(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;

    setState(() => _loading = true);

    try {
      final client = ref.read(mobileApiClientProvider);
      final json = await client.sendPrompt(query: trimmed);
      final result = AiPromptResponse.fromJson(json);

      if (mounted) {
        setState(() => _loading = false);
        widget.onResult?.call(result);
        _showResultSheet(result, trimmed);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        _showError(e);
      }
    }
  }

  void _showError(Object e) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 40, color: AppColors.danger),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Something went wrong',
                style: Theme.of(ctx).textTheme.titleMedium,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                e.toString(),
                style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                  color: AppColors.inkSubtle,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton.tonal(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('OK'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showResultSheet(AiPromptResponse result, String query) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => _AiResultSheet(
        result: result,
        query: query,
        onNavigate: (redirect) {
          Navigator.pop(ctx);
          if (redirect.startsWith('/')) {
            context.push(redirect);
          } else {
            context.push('/search?q=${Uri.encodeComponent(query)}');
          }
        },
        onSuggestionTap: (suggestion) {
          Navigator.pop(ctx);
          _controller.text = suggestion;
          _submit(suggestion);
        },
        onDismiss: () => Navigator.pop(ctx),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.soft,
          ),
          child: TextField(
            controller: _controller,
            focusNode: _focusNode,
            decoration: InputDecoration(
              hintText: widget.placeholder,
              hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.inkFaint,
              ),
              prefixIcon: _loading
                  ? Padding(
                      padding: const EdgeInsets.all(12),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primary,
                        ),
                      ),
                    )
                  : const Padding(
                      padding: EdgeInsets.all(12),
                      child: Icon(Icons.auto_awesome_rounded,
                          size: 18, color: AppColors.inkFaint),
                    ),
              suffixIcon: _controller.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.close_rounded, size: 16),
                      onPressed: () {
                        _controller.clear();
                        setState(() {});
                      },
                    )
                  : null,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
            ),
            textInputAction: TextInputAction.search,
            onChanged: (_) => setState(() {}),
            onSubmitted: _submit,
          ),
        ),
      ],
    );
  }
}

class _AiResultSheet extends StatelessWidget {
  final AiPromptResponse result;
  final String query;
  final ValueChanged<String> onNavigate;
  final ValueChanged<String> onSuggestionTap;
  final VoidCallback onDismiss;

  const _AiResultSheet({
    required this.result,
    required this.query,
    required this.onNavigate,
    required this.onSuggestionTap,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      minChildSize: 0.3,
      maxChildSize: 0.85,
      expand: false,
      builder: (ctx, scrollController) => Column(
        children: [
          // Handle
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Container(
              width: 32,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.inkFaint.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              children: [
                // AI response card
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppColors.primarySoft,
                        AppColors.surface,
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.15),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                        ),
                        child: const Icon(
                          Icons.auto_awesome_rounded,
                          size: 16,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              result.response,
                              style: Theme.of(ctx)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(fontWeight: FontWeight.w500),
                            ),
                            if (result.redirect != null) ...[
                              const SizedBox(height: AppSpacing.sm),
                              FilledButton.icon(
                                onPressed: () =>
                                    onNavigate(result.redirect!),
                                icon: Icon(
                                  Icons.search_rounded,
                                  size: 16,
                                ),
                                label: Text(
                                  _actionLabels[result.action] ?? 'Go',
                                  style: const TextStyle(fontSize: 13),
                                ),
                                style: FilledButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: AppSpacing.md,
                                    vertical: AppSpacing.xs,
                                  ),
                                  minimumSize: Size.zero,
                                  tapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                if (result.suggestions.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Try asking',
                    style: Theme.of(ctx).textTheme.labelLarge?.copyWith(
                      color: AppColors.inkSubtle,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ...result.suggestions.map(
                    (s) => ListTile(
                      dense: true,
                      leading: Icon(
                        Icons.trending_up_rounded,
                        size: 16,
                        color: AppColors.inkFaint,
                      ),
                      title: Text(s, style: const TextStyle(fontSize: 14)),
                      trailing: Icon(
                        Icons.arrow_upward_rounded,
                        size: 14,
                        color: AppColors.primary,
                      ),
                      onTap: () => onSuggestionTap(s),
                      contentPadding: EdgeInsets.zero,
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
