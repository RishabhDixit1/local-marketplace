import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/components/error_state_view.dart';
import '../theme/design_tokens.dart';
import '../widgets/section_card.dart';

/// Standard [AsyncValue] → loading / error / data for feature bodies.
class ServiqAsyncBody<T> extends StatelessWidget {
  const ServiqAsyncBody({
    super.key,
    required this.value,
    required this.data,
    this.loadingBuilder,
    this.errorTitle = 'Something went wrong',
    this.errorMessageFor,
    this.onRetry,
    this.wrapErrorInCard = true,
    this.errorBuilder,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final Widget Function()? loadingBuilder;
  final String errorTitle;
  final String Function(Object error, StackTrace stack)? errorMessageFor;
  final VoidCallback? onRetry;
  final bool wrapErrorInCard;

  /// When set, replaces the default [ErrorStateView] (e.g. tasks with richer diagnostics).
  final Widget Function(Object error, StackTrace stack)? errorBuilder;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: AppDurations.fast,
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      layoutBuilder: (currentChild, previousChildren) {
        return currentChild ?? const SizedBox.shrink();
      },
      child: value.when(
        data: (payload) => KeyedSubtree(
          key: const ValueKey('serviq-async-data'),
          child: data(payload),
        ),
        loading: () => Semantics(
          key: const ValueKey('serviq-async-loading'),
          liveRegion: true,
          label: 'Loading content',
          child:
              loadingBuilder?.call() ??
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
                  child: CircularProgressIndicator(),
                ),
              ),
        ),
        error: (error, stack) {
          if (errorBuilder != null) {
            return KeyedSubtree(
              key: const ValueKey('serviq-async-custom-error'),
              child: errorBuilder!(error, stack),
            );
          }
          final message = errorMessageFor != null
              ? errorMessageFor!(error, stack)
              : error.toString();
          final body = Semantics(
            liveRegion: true,
            label: '$errorTitle. $message',
            child: ErrorStateView(
              title: errorTitle,
              message: message,
              onRetry: onRetry,
            ),
          );
          if (!wrapErrorInCard) {
            return KeyedSubtree(
              key: const ValueKey('serviq-async-error'),
              child: body,
            );
          }
          return SectionCard(
            key: const ValueKey('serviq-async-error-card'),
            child: body,
          );
        },
      ),
    );
  }
}
