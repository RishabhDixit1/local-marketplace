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

    if (!expanded) {
      return child;
    }

    return SizedBox(width: double.infinity, child: child);
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

    if (!expanded) {
      return child;
    }

    return SizedBox(width: double.infinity, child: child);
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

    if (!expanded) {
      return child;
    }

    return SizedBox(width: double.infinity, child: child);
  }
}
