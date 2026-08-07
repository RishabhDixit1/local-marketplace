import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/mobile_api_provider.dart';
import '../../core/constants/app_routes.dart';
import '../../core/theme/design_tokens.dart';
import '../../features/ai_prompt/domain/ai_prompt_models.dart';
import '../../l10n/l10n.dart';
import '../components/voice_input_button.dart';

class AiPromptBar extends ConsumerStatefulWidget {
  const AiPromptBar({
    super.key,
    this.placeholder,
    this.initialQuery,
    this.onResult,
    this.enableDebounce = false,
  });

  final String? placeholder;
  final String? initialQuery;
  final void Function(AiPromptResponse result)? onResult;
  final bool enableDebounce;

  @override
  ConsumerState<AiPromptBar> createState() => _AiPromptBarState();
}

class _AiPromptBarState extends ConsumerState<AiPromptBar> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  bool _loading = false;
  AiPromptResponse? _debounceResult;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialQuery?.trim() ?? '';
    _controller.text = initial;
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() {});
    if (!widget.enableDebounce) return;
    _debounceTimer?.cancel();
    if (value.trim().length < 3) {
      setState(() => _debounceResult = null);
      return;
    }
    _debounceTimer = Timer(const Duration(milliseconds: 400), () {
      _debounceSearch(value.trim());
    });
  }

  Future<void> _debounceSearch(String query) async {
    if (query.isEmpty) return;
    try {
      final client = ref.read(mobileApiClientProvider);
      final json = await client.sendPrompt(query: query);
      if (mounted) {
        setState(() => _debounceResult = AiPromptResponse.fromJson(json));
      }
    } catch (_) {
      if (mounted) setState(() => _debounceResult = null);
    }
  }

  Future<void> _submit(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;

    _debounceTimer?.cancel();
    setState(() {
      _loading = true;
      _debounceResult = null;
    });

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
    final l10n = AppLocalizations.of(context);
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
                l10n.aiErrorTitle,
                style: Theme.of(ctx).textTheme.titleMedium,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                e.toString(),
                style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton.tonal(
                onPressed: () => Navigator.pop(ctx),
                child: Text(l10n.retry),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showResultSheet(AiPromptResponse result, String query) {
    final l10n = AppLocalizations.of(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => _AiResultSheet(
        result: result,
        query: query,
        l10n: l10n,
        onNavigate: (redirect) {
          Navigator.pop(ctx);
          final params = result.redirectParams;
          if (params != null && params.isNotEmpty) {
            final searchQuery = params['q'] ?? params['query'] ?? query;
            final searchParams = <String, String>{};
            if (searchQuery.isNotEmpty) searchParams['q'] = searchQuery;
            if (params.containsKey('category')) searchParams['category'] = params['category']!;
            context.push(Uri(path: AppRoutes.publicBrowse, queryParameters: searchParams).toString());
          } else if (redirect.startsWith('/app/')) {
            context.push(redirect);
          } else {
            context.push('${AppRoutes.publicBrowse}?q=${Uri.encodeComponent(query)}');
          }
        },
        onPostRequirement: () {
          Navigator.pop(ctx);
          final params = <String, String>{};
          if (query.isNotEmpty) params['title'] = query;
          final uri = Uri(path: AppRoutes.createNeed, queryParameters: params);
          context.push(uri.toString());
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
    final l10n = AppLocalizations.of(context);
    final placeholder = widget.placeholder ?? l10n.aiPlaceholder;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(color: Theme.of(context).colorScheme.outline),
            boxShadow: AppShadows.soft,
          ),
          child: TextField(
            controller: _controller,
            focusNode: _focusNode,
            decoration: InputDecoration(
              hintText: placeholder,
              hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45),
              ),
              prefixIcon: _loading
                  ? Padding(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primary,
                        ),
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      child: Icon(Icons.auto_awesome_rounded,
                          size: 18, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                    ),
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_controller.text.isNotEmpty)
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 16),
                      onPressed: () {
                        _controller.clear();
                        setState(() => _debounceResult = null);
                      },
                    ),
                  VoiceInputButton(controller: _controller, iconSize: 18),
                ],
              ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
            ),
            textInputAction: TextInputAction.search,
            onChanged: _onChanged,
            onSubmitted: _submit,
          ),
        ),
        if (_debounceResult != null) ...[
          const SizedBox(height: 6),
          _InlineAiResult(
            result: _debounceResult!,
            query: _controller.text.trim(),
            l10n: l10n,
            onTap: () => _submit(_controller.text.trim()),
          ),
        ],
      ],
    );
  }
}

class AiFloatingAssistant extends ConsumerWidget {
  const AiFloatingAssistant({super.key});

  static Future<void> openSheet(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AiPromptSheet(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FloatingActionButton.small(
      heroTag: 'ai-assistant-fab',
      onPressed: () => openSheet(context),
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      tooltip: 'Ask AI',
      child: const Icon(Icons.auto_awesome_rounded),
    );
  }
}

class _AiPromptSheet extends ConsumerStatefulWidget {
  @override
  ConsumerState<_AiPromptSheet> createState() => _AiPromptSheetState();
}

class _AiPromptSheetState extends ConsumerState<_AiPromptSheet> {
  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return DraggableScrollableSheet(
      initialChildSize: 0.45,
      minChildSize: 0.3,
      maxChildSize: 0.85,
      expand: false,
      builder: (ctx, scrollController) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      gradient: AppGradients.premiumAccent,
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                    ),
                    child: const Icon(Icons.auto_awesome_rounded, size: 16, color: Colors.white),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'Ask ServiQ AI',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollController,
                padding: EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, bottomInset + AppSpacing.lg),
                child: AiPromptBar(
                  onResult: (result) {
                    Navigator.pop(ctx);
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InlineAiResult extends StatelessWidget {
  final AiPromptResponse result;
  final String query;
  final AppLocalizations l10n;
  final VoidCallback onTap;

  const _InlineAiResult({
    required this.result,
    required this.query,
    required this.l10n,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final count = result.providerCount;
    final label = result.hasProviders
        ? '$count ${count == 1 ? 'provider' : 'providers'} found'
        : l10n.aiNoProvidersFound;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
        decoration: BoxDecoration(
          color: result.hasProviders ? AppColors.primarySoft : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(
            color: result.hasProviders
                ? AppColors.primary.withValues(alpha: 0.2)
                : Theme.of(context).colorScheme.outline,
          ),
        ),
        child: Row(
          children: [
            Icon(
              result.hasProviders ? Icons.check_circle_outline : Icons.info_outline,
              size: 14,
              color: result.hasProviders ? AppColors.primary : AppColors.warning,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
                ),
              ),
            ),
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 12,
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
            ),
          ],
        ),
      ),
    );
  }
}

class _AiResultSheet extends StatelessWidget {
  final AiPromptResponse result;
  final String query;
  final AppLocalizations l10n;
  final ValueChanged<String> onNavigate;
  final VoidCallback onPostRequirement;
  final ValueChanged<String> onSuggestionTap;
  final VoidCallback onDismiss;

  const _AiResultSheet({
    required this.result,
    required this.query,
    required this.l10n,
    required this.onNavigate,
    required this.onPostRequirement,
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
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Container(
              width: 32,
              height: 4,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45).withValues(alpha: 0.4),
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
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.primarySoft, AppColors.surface],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
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
                        child: const Icon(Icons.auto_awesome_rounded, size: 16, color: AppColors.primary),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              result.response,
                              style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                            ),
                            if (result.redirect != null) ...[
                              const SizedBox(height: AppSpacing.sm),
                              Row(
                                children: [
                                  FilledButton.icon(
                                    onPressed: () => onNavigate(result.redirect!),
                                    icon: const Icon(Icons.search_rounded, size: 16),
                                    label: Text(l10n.aiBrowseResults, style: const TextStyle(fontSize: 13)),
                                    style: FilledButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
                                      minimumSize: Size.zero,
                                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    ),
                                  ),
                                  if (result.isRequirementPost || !result.hasProviders) ...[
                                    const SizedBox(width: 8),
                                    OutlinedButton.icon(
                                      onPressed: onPostRequirement,
                                      icon: const Icon(Icons.post_add_rounded, size: 16),
                                      label: Text(l10n.aiPostRequirement, style: const TextStyle(fontSize: 13)),
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
                                        minimumSize: Size.zero,
                                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                      ),
                                    ),
                                  ],
                                ],
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
                    l10n.aiTryAsking,
                    style: Theme.of(ctx).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ...result.suggestions.map(
                    (s) => ListTile(
                      dense: true,
                      leading: Icon(Icons.trending_up_rounded, size: 16,
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                      title: Text(s, style: const TextStyle(fontSize: 14)),
                      trailing: Icon(Icons.arrow_upward_rounded, size: 14, color: AppColors.primary),
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
