import 'package:flutter/material.dart';

/// Typography tokens. The single sanctioned path for text styles in screens.
///
/// Screens must NOT use `TextStyle(fontSize: ...)` directly. Either consume
/// `Theme.of(context).textTheme.*` or these semantic helpers. This keeps the
/// scale centralized in `AppTheme` and text scaling (WCAG) working everywhere.
class AppType {
  const AppType._();

  static TextStyle _t(BuildContext context, TextStyle? style) => style!;

  // --- Display / hero (DM Serif Display) ---
  static TextStyle displayLarge(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.displayLarge);
  static TextStyle displayMedium(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.displayMedium);
  static TextStyle displaySmall(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.displaySmall);

  // --- Headings ---
  static TextStyle headlineLarge(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.headlineLarge);
  static TextStyle headlineMedium(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.headlineMedium);
  static TextStyle headlineSmall(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.headlineSmall);

  // --- Titles ---
  static TextStyle titleLarge(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.titleLarge);
  static TextStyle titleMedium(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.titleMedium);
  static TextStyle titleSmall(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.titleSmall);

  // --- Body ---
  static TextStyle bodyLarge(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.bodyLarge);
  static TextStyle bodyMedium(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.bodyMedium);
  static TextStyle bodySmall(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.bodySmall);

  // --- Labels / buttons ---
  static TextStyle labelLarge(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.labelLarge);
  static TextStyle labelMedium(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.labelMedium);
  static TextStyle labelSmall(BuildContext context) =>
      _t(context, Theme.of(context).textTheme.labelSmall);

  // --- Semantic ---
  /// Card meta lines (compact caption under a title).
  static TextStyle caption(BuildContext context) => labelSmall(context);

  /// Overline / eyebrow labels above section headers.
  static TextStyle overline(BuildContext context) =>
      labelSmall(context).copyWith(letterSpacing: 1.1);
}
