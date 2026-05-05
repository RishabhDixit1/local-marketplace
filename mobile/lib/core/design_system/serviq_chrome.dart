import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';

class ServiqTopBar extends StatelessWidget implements PreferredSizeWidget {
  const ServiqTopBar({
    super.key,
    required this.title,
    this.subtitle,
    this.actions = const <Widget>[],
    this.leading,
    this.centerTitle = false,
  });

  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final Widget? leading;
  final bool centerTitle;

  @override
  Size get preferredSize => Size.fromHeight(subtitle == null ? 64 : 76);

  @override
  Widget build(BuildContext context) {
    final subtitleText = subtitle?.trim();

    return AppBar(
      leading: leading,
      centerTitle: centerTitle,
      titleSpacing: leading == null ? AppSpacing.md : 0,
      title: Column(
        crossAxisAlignment: centerTitle
            ? CrossAxisAlignment.center
            : CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
          if (subtitleText != null && subtitleText.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xxxs),
            Text(
              subtitleText,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
      actions: actions,
      backgroundColor: AppColors.background,
      surfaceTintColor: Colors.transparent,
    );
  }
}

class ServiqBottomSheet extends StatelessWidget {
  const ServiqBottomSheet({
    super.key,
    required this.title,
    required this.children,
    this.subtitle,
    this.footer,
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;
  final Widget? footer;

  static Future<T?> show<T>({
    required BuildContext context,
    required String title,
    String? subtitle,
    required List<Widget> children,
    Widget? footer,
    bool isScrollControlled = true,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: isScrollControlled,
      showDragHandle: true,
      builder: (context) {
        return ServiqBottomSheet(
          title: title,
          subtitle: subtitle,
          footer: footer,
          children: children,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final bottomPadding = MediaQuery.paddingOf(context).bottom;
    final subtitleText = subtitle?.trim();

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
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
                    Text(title, style: Theme.of(context).textTheme.titleLarge),
                    if (subtitleText != null && subtitleText.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        subtitleText,
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
                  children: children,
                ),
              ),
              if (footer != null)
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.sm,
                    AppSpacing.md,
                    bottomPadding + AppSpacing.sm,
                  ),
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    border: Border(top: BorderSide(color: AppColors.border)),
                  ),
                  child: footer,
                )
              else
                SizedBox(height: bottomPadding + AppSpacing.xs),
            ],
          ),
        ),
      ),
    );
  }
}

class ServiqActionBar extends StatelessWidget {
  const ServiqActionBar({
    super.key,
    this.primaryLabel,
    this.primaryIcon,
    this.onPrimary,
    this.secondaryActions = const <ServiqCompactAction>[],
  });

  final String? primaryLabel;
  final IconData? primaryIcon;
  final VoidCallback? onPrimary;
  final List<ServiqCompactAction> secondaryActions;

  @override
  Widget build(BuildContext context) {
    final primaryText = primaryLabel?.trim();
    final hasPrimary = primaryText != null && primaryText.isNotEmpty;
    final visibleActions = secondaryActions
        .where((action) => action.onPressed != null)
        .toList(growable: false);

    if (!hasPrimary && visibleActions.isEmpty) {
      return const SizedBox.shrink();
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (hasPrimary)
          Expanded(
            child: FilledButton.icon(
              onPressed: onPrimary,
              icon: Icon(primaryIcon ?? Icons.arrow_forward_rounded),
              label: Text(
                primaryText,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        if (hasPrimary && visibleActions.isNotEmpty)
          const SizedBox(width: AppSpacing.xs),
        for (final action in visibleActions) ...[
          Tooltip(
            message: action.tooltip,
            child: SizedBox.square(
              dimension: AppTouchTargets.minimum,
              child: IconButton.outlined(
                onPressed: action.onPressed,
                icon: Icon(action.icon),
              ),
            ),
          ),
          if (action != visibleActions.last)
            const SizedBox(width: AppSpacing.xs),
        ],
      ],
    );
  }
}

@immutable
class ServiqCompactAction {
  const ServiqCompactAction({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
}

class TrustSnapshot extends StatelessWidget {
  const TrustSnapshot({super.key, required this.items, this.dense = false});

  final List<TrustSnapshotItem> items;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final visibleItems = items
        .where((item) => item.value.trim().isNotEmpty)
        .toList(growable: false);
    if (visibleItems.isEmpty) {
      return const SizedBox.shrink();
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 330;
        final columns = compact || visibleItems.length < 2 ? 1 : 2;
        final gap = dense ? AppSpacing.xs : AppSpacing.sm;
        final tileWidth = columns == 1
            ? constraints.maxWidth
            : (constraints.maxWidth - gap) / 2;

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final item in visibleItems)
              SizedBox(
                width: tileWidth,
                child: _TrustSnapshotTile(item: item, dense: dense),
              ),
          ],
        );
      },
    );
  }
}

@immutable
class TrustSnapshotItem {
  const TrustSnapshotItem({
    required this.icon,
    required this.label,
    required this.value,
    this.tone = TrustSnapshotTone.neutral,
  });

  final IconData icon;
  final String label;
  final String value;
  final TrustSnapshotTone tone;
}

enum TrustSnapshotTone { neutral, trust, success, warning, danger }

class _TrustSnapshotTile extends StatelessWidget {
  const _TrustSnapshotTile({required this.item, required this.dense});

  final TrustSnapshotItem item;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = switch (item.tone) {
      TrustSnapshotTone.trust => (AppColors.verifiedSoft, AppColors.verified),
      TrustSnapshotTone.success => (AppColors.successSoft, AppColors.success),
      TrustSnapshotTone.warning => (AppColors.warningSoft, AppColors.warning),
      TrustSnapshotTone.danger => (AppColors.dangerSoft, AppColors.danger),
      TrustSnapshotTone.neutral => (AppColors.surfaceMuted, AppColors.inkMuted),
    };

    return Container(
      constraints: const BoxConstraints(minHeight: AppTouchTargets.minimum),
      padding: EdgeInsets.all(dense ? AppSpacing.xs : AppSpacing.sm),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Icon(item.icon, size: dense ? 16 : 18, color: foreground),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  item.value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(color: AppColors.ink),
                ),
                if (!dense) ...[
                  const SizedBox(height: AppSpacing.xxxs),
                  Text(
                    item.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall,
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

class ServiqStepper<T> extends StatelessWidget {
  const ServiqStepper({
    super.key,
    required this.steps,
    required this.value,
    required this.onChanged,
  });

  final List<ServiqStepItem<T>> steps;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < AppBreakpoints.compact;
        final gap = AppSpacing.xs;
        final width = compact
            ? constraints.maxWidth
            : math.max(0.0, (constraints.maxWidth - gap) / 2);

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (var index = 0; index < steps.length; index += 1)
              SizedBox(
                width: width,
                child: _ServiqStepTile<T>(
                  key: steps[index].key,
                  item: steps[index],
                  number: index + 1,
                  selected: steps[index].value == value,
                  onTap: () => onChanged(steps[index].value),
                ),
              ),
          ],
        );
      },
    );
  }
}

@immutable
class ServiqStepItem<T> {
  const ServiqStepItem({
    required this.value,
    required this.label,
    required this.icon,
    this.key,
  });

  final T value;
  final String label;
  final IconData icon;
  final Key? key;
}

class _ServiqStepTile<T> extends StatelessWidget {
  const _ServiqStepTile({
    super.key,
    required this.item,
    required this.number,
    required this.selected,
    required this.onTap,
  });

  final ServiqStepItem<T> item;
  final int number;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foreground = selected ? Colors.white : AppColors.ink;
    final background = selected ? AppColors.inkStrong : AppColors.surface;

    return Material(
      color: background,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        side: BorderSide(
          color: selected ? AppColors.inkStrong : AppColors.border,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.md),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected
                      ? Colors.white.withValues(alpha: 0.14)
                      : AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Icon(item.icon, size: 16, color: foreground),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Step $number',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: selected
                            ? Colors.white.withValues(alpha: 0.70)
                            : AppColors.inkSubtle,
                      ),
                    ),
                    Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(
                        context,
                      ).textTheme.labelLarge?.copyWith(color: foreground),
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

class ServiqToast {
  const ServiqToast._();

  static void show(
    BuildContext context, {
    required String message,
    ServiqToastTone tone = ServiqToastTone.neutral,
    SnackBarAction? action,
  }) {
    final messenger = ScaffoldMessenger.of(context);
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          action: action,
          backgroundColor: switch (tone) {
            ServiqToastTone.success => AppColors.success,
            ServiqToastTone.warning => AppColors.warning,
            ServiqToastTone.danger => AppColors.danger,
            ServiqToastTone.neutral => AppColors.ink,
          },
        ),
      );
  }
}

enum ServiqToastTone { neutral, success, warning, danger }
