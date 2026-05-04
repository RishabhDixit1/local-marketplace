import 'package:flutter/material.dart';

import '../design_system/serviq_surface.dart';

/// Primary card surface for lists and forms — uses [ServiqSurface] tokens.
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return ServiqSurface(
      variant: ServiqSurfaceVariant.flat,
      padding: padding,
      child: child,
    );
  }
}
