import 'package:flutter/material.dart';

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.expanded = true,
  });

  final String label;
  final Widget? icon;
  final VoidCallback? onPressed;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final child = icon == null
        ? FilledButton(onPressed: onPressed, child: Text(label))
        : FilledButton.icon(
            onPressed: onPressed,
            icon: icon!,
            label: Text(label),
          );

    final sized = !expanded
        ? child
        : SizedBox(width: double.infinity, child: child);

    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: sized,
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.expanded = true,
  });

  final String label;
  final Widget? icon;
  final VoidCallback? onPressed;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final child = icon == null
        ? OutlinedButton(onPressed: onPressed, child: Text(label))
        : OutlinedButton.icon(
            onPressed: onPressed,
            icon: icon!,
            label: Text(label),
          );

    final sized = !expanded
        ? child
        : SizedBox(width: double.infinity, child: child);

    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: sized,
    );
  }
}

/// Outlined destructive action (cancel order, remove item).
class DangerButton extends StatelessWidget {
  const DangerButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.expanded = true,
  });

  final String label;
  final Widget? icon;
  final VoidCallback? onPressed;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final style = OutlinedButton.styleFrom(
      foregroundColor: Theme.of(context).colorScheme.error,
      side: BorderSide(color: Theme.of(context).colorScheme.error),
    );
    final child = icon == null
        ? OutlinedButton(
            style: style,
            onPressed: onPressed,
            child: Text(label),
          )
        : OutlinedButton.icon(
            style: style,
            onPressed: onPressed,
            icon: icon!,
            label: Text(label),
          );

    final sized = !expanded
        ? child
        : SizedBox(width: double.infinity, child: child);

    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: sized,
    );
  }
}

class GhostButton extends StatelessWidget {
  const GhostButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.expanded = false,
  });

  final String label;
  final Widget? icon;
  final VoidCallback? onPressed;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final child = icon == null
        ? TextButton(onPressed: onPressed, child: Text(label))
        : TextButton.icon(
            onPressed: onPressed,
            icon: icon!,
            label: Text(label),
          );

    final sized = !expanded
        ? child
        : SizedBox(width: double.infinity, child: child);

    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: sized,
    );
  }
}
