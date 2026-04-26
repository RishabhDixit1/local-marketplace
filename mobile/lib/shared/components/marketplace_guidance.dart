import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'app_buttons.dart';

class MarketplaceLoopHero extends StatelessWidget {
  const MarketplaceLoopHero({
    super.key,
    required this.title,
    required this.message,
    required this.searchLabel,
    required this.primaryLabel,
    required this.onSearchTap,
    required this.onPrimaryTap,
    this.secondaryLabel,
    this.onSecondaryTap,
    this.signalLabels = const <String>[],
  });

  final String title;
  final String message;
  final String searchLabel;
  final String primaryLabel;
  final VoidCallback onSearchTap;
  final VoidCallback onPrimaryTap;
  final String? secondaryLabel;
  final VoidCallback? onSecondaryTap;
  final List<String> signalLabels;

  @override
  Widget build(BuildContext context) {
    final tokens =
        Theme.of(context).extension<ServiqThemeTokens>() ??
        ServiqThemeTokens.light;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        gradient: tokens.heroGradient,
        boxShadow: AppShadows.card,
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (signalLabels.isNotEmpty) ...[
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: signalLabels
                  .take(3)
                  .map((label) => _HeroSignal(label: label))
                  .toList(),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          Text(
            title,
            style: textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            message,
            style: textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.86),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _HeroSearchButton(label: searchLabel, onTap: onSearchTap),
          const SizedBox(height: AppSpacing.md),
          MarketplaceLoopSteps(
            activeIndex: 0,
            foregroundColor: Colors.white,
            mutedColor: Colors.white.withValues(alpha: 0.72),
            surfaceColor: Colors.white.withValues(alpha: 0.12),
            borderColor: Colors.white.withValues(alpha: 0.20),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: onPrimaryTap,
                  icon: const Icon(Icons.add_rounded),
                  label: Text(primaryLabel),
                ),
              ),
              if (secondaryLabel != null && onSecondaryTap != null) ...[
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: SecondaryButton(
                    label: secondaryLabel!,
                    icon: const Icon(Icons.assignment_outlined),
                    onPressed: onSecondaryTap,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class MarketplaceLoopSteps extends StatelessWidget {
  const MarketplaceLoopSteps({
    super.key,
    this.activeIndex,
    this.foregroundColor = AppColors.ink,
    this.mutedColor = AppColors.inkMuted,
    this.surfaceColor = AppColors.surfaceMuted,
    this.borderColor = AppColors.border,
  });

  final int? activeIndex;
  final Color foregroundColor;
  final Color mutedColor;
  final Color surfaceColor;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    const steps = [
      _LoopStep(Icons.search_rounded, 'Search'),
      _LoopStep(Icons.add_circle_outline_rounded, 'Post'),
      _LoopStep(Icons.chat_bubble_outline_rounded, 'Message'),
      _LoopStep(Icons.assignment_turned_in_outlined, 'Track'),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 360;
        return Row(
          children: [
            for (var index = 0; index < steps.length; index++) ...[
              Expanded(
                child: _LoopStepTile(
                  step: steps[index],
                  active: activeIndex == index,
                  compact: compact,
                  foregroundColor: foregroundColor,
                  mutedColor: mutedColor,
                  surfaceColor: surfaceColor,
                  borderColor: borderColor,
                ),
              ),
              if (index < steps.length - 1)
                Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: compact ? AppSpacing.xxs : AppSpacing.xs,
                  ),
                  child: Icon(
                    Icons.chevron_right_rounded,
                    size: compact ? 16 : 18,
                    color: mutedColor,
                  ),
                ),
            ],
          ],
        );
      },
    );
  }
}

class _HeroSearchButton extends StatelessWidget {
  const _HeroSearchButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.md,
          ),
          child: Row(
            children: [
              const Icon(Icons.search_rounded, color: AppColors.inkMuted),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: AppColors.inkMuted),
                ),
              ),
              const Icon(
                Icons.arrow_forward_ios_rounded,
                size: 14,
                color: AppColors.inkMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroSignal extends StatelessWidget {
  const _HeroSignal({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.20)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _LoopStep {
  const _LoopStep(this.icon, this.label);

  final IconData icon;
  final String label;
}

class _LoopStepTile extends StatelessWidget {
  const _LoopStepTile({
    required this.step,
    required this.active,
    required this.compact,
    required this.foregroundColor,
    required this.mutedColor,
    required this.surfaceColor,
    required this.borderColor,
  });

  final _LoopStep step;
  final bool active;
  final bool compact;
  final Color foregroundColor;
  final Color mutedColor;
  final Color surfaceColor;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    final color = active ? foregroundColor : mutedColor;
    return Container(
      height: compact ? 48 : 54,
      padding: EdgeInsets.symmetric(
        horizontal: compact ? AppSpacing.xxs : AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: active ? surfaceColor.withValues(alpha: 0.88) : surfaceColor,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(step.icon, size: compact ? 16 : 18, color: color),
          const SizedBox(height: AppSpacing.xxxs),
          Text(
            step.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: color,
              fontSize: compact ? 10 : 11,
            ),
          ),
        ],
      ),
    );
  }
}
