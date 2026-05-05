import 'package:flutter/material.dart';

import '../design_system/serviq_surface.dart';

/// Primary card surface for lists and forms — uses [ServiqSurface] tokens.
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.variant = ServiqSurfaceVariant.flat,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final ServiqSurfaceVariant variant;

  @override
  Widget build(BuildContext context) {
    return ServiqSurface(variant: variant, padding: padding, child: child);
  }
}
