import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

export 'design_tokens.dart';

import 'design_tokens.dart';

@immutable
class WelcomeThemeTokens extends ThemeExtension<WelcomeThemeTokens> {
  const WelcomeThemeTokens({
    required this.heroStart,
    required this.heroEnd,
    required this.heroAccent,
    required this.heroStroke,
    required this.trustedTint,
    required this.nearbyTint,
    required this.earnTint,
    required this.warningTint,
  });

  static const light = WelcomeThemeTokens(
    heroStart: Color(0xFFE6F7F4),
    heroEnd: Color(0xFFFFF7E8),
    heroAccent: AppColors.primaryDeep,
    heroStroke: AppColors.borderStrong,
    trustedTint: AppColors.successSoft,
    nearbyTint: AppColors.accentSoft,
    earnTint: AppColors.warmSoft,
    warningTint: AppColors.warningSoft,
  );

  final Color heroStart;
  final Color heroEnd;
  final Color heroAccent;
  final Color heroStroke;
  final Color trustedTint;
  final Color nearbyTint;
  final Color earnTint;
  final Color warningTint;

  @override
  ThemeExtension<WelcomeThemeTokens> copyWith({
    Color? heroStart,
    Color? heroEnd,
    Color? heroAccent,
    Color? heroStroke,
    Color? trustedTint,
    Color? nearbyTint,
    Color? earnTint,
    Color? warningTint,
  }) {
    return WelcomeThemeTokens(
      heroStart: heroStart ?? this.heroStart,
      heroEnd: heroEnd ?? this.heroEnd,
      heroAccent: heroAccent ?? this.heroAccent,
      heroStroke: heroStroke ?? this.heroStroke,
      trustedTint: trustedTint ?? this.trustedTint,
      nearbyTint: nearbyTint ?? this.nearbyTint,
      earnTint: earnTint ?? this.earnTint,
      warningTint: warningTint ?? this.warningTint,
    );
  }

  @override
  ThemeExtension<WelcomeThemeTokens> lerp(
    covariant ThemeExtension<WelcomeThemeTokens>? other,
    double t,
  ) {
    if (other is! WelcomeThemeTokens) {
      return this;
    }

    return WelcomeThemeTokens(
      heroStart: Color.lerp(heroStart, other.heroStart, t) ?? heroStart,
      heroEnd: Color.lerp(heroEnd, other.heroEnd, t) ?? heroEnd,
      heroAccent: Color.lerp(heroAccent, other.heroAccent, t) ?? heroAccent,
      heroStroke: Color.lerp(heroStroke, other.heroStroke, t) ?? heroStroke,
      trustedTint: Color.lerp(trustedTint, other.trustedTint, t) ?? trustedTint,
      nearbyTint: Color.lerp(nearbyTint, other.nearbyTint, t) ?? nearbyTint,
      earnTint: Color.lerp(earnTint, other.earnTint, t) ?? earnTint,
      warningTint: Color.lerp(warningTint, other.warningTint, t) ?? warningTint,
    );
  }
}

class AppTheme {
  const AppTheme._();

  static ThemeData light() {
    final colorScheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          brightness: Brightness.light,
        ).copyWith(
          primary: AppColors.primary,
          onPrimary: Colors.white,
          primaryContainer: AppColors.primarySoft,
          onPrimaryContainer: AppColors.primaryDeep,
          secondary: AppColors.accent,
          onSecondary: Colors.white,
          secondaryContainer: AppColors.accentSoft,
          onSecondaryContainer: AppColors.accentDeep,
          tertiary: AppColors.warm,
          onTertiary: Colors.white,
          tertiaryContainer: AppColors.warmSoft,
          onTertiaryContainer: AppColors.warmDeep,
          error: AppColors.danger,
          onError: Colors.white,
          errorContainer: AppColors.dangerSoft,
          surface: AppColors.surface,
          onSurface: AppColors.ink,
          surfaceContainerHighest: AppColors.surfaceAlt,
          outline: AppColors.border,
          outlineVariant: AppColors.border,
          shadow: AppColors.shadow,
          scrim: AppColors.scrim,
        );

    final baseText = GoogleFonts.manropeTextTheme(
      Typography.material2021().black,
    );
    final display = GoogleFonts.soraTextTheme(baseText);
    final textTheme = baseText.copyWith(
      displayLarge: display.displayLarge?.copyWith(
        fontSize: 34,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.inkStrong,
      ),
      headlineLarge: display.headlineLarge?.copyWith(
        fontSize: 30,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.inkStrong,
      ),
      headlineMedium: display.headlineMedium?.copyWith(
        fontSize: 24,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.inkStrong,
      ),
      headlineSmall: display.headlineSmall?.copyWith(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.inkStrong,
      ),
      titleLarge: baseText.titleLarge?.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.ink,
      ),
      titleMedium: baseText.titleMedium?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.ink,
      ),
      titleSmall: baseText.titleSmall?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.ink,
      ),
      bodyLarge: baseText.bodyLarge?.copyWith(
        fontSize: 15,
        height: 1.45,
        letterSpacing: 0,
        color: AppColors.ink,
        fontWeight: FontWeight.w600,
      ),
      bodyMedium: baseText.bodyMedium?.copyWith(
        fontSize: 14,
        height: 1.45,
        letterSpacing: 0,
        color: AppColors.inkSubtle,
        fontWeight: FontWeight.w600,
      ),
      bodySmall: baseText.bodySmall?.copyWith(
        fontSize: 12,
        height: 1.4,
        letterSpacing: 0,
        color: AppColors.inkSubtle,
        fontWeight: FontWeight.w700,
      ),
      labelLarge: baseText.labelLarge?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.ink,
      ),
      labelMedium: baseText.labelMedium?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.ink,
      ),
      labelSmall: baseText.labelSmall?.copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.inkSubtle,
      ),
    );

    final inputBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadii.md),
      borderSide: const BorderSide(color: AppColors.border),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: textTheme,
      extensions: const <ThemeExtension<dynamic>>[
        ServiqThemeTokens.light,
        WelcomeThemeTokens.light,
      ],
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.ink,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
        space: 1,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceAlt,
        selectedColor: AppColors.accentSoft,
        disabledColor: AppColors.surfacePressed,
        side: const BorderSide(color: AppColors.border),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        labelStyle: textTheme.labelMedium,
        secondaryLabelStyle: textTheme.labelMedium,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: AppColors.inkFaint),
        labelStyle: textTheme.bodyMedium,
        floatingLabelStyle: textTheme.labelMedium?.copyWith(
          color: AppColors.accentDeep,
        ),
        border: inputBorder,
        enabledBorder: inputBorder,
        focusedBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.primary, width: 1.4),
        ),
        errorBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.danger, width: 1.4),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          foregroundColor: Colors.white,
          backgroundColor: AppColors.primary,
          disabledBackgroundColor: AppColors.surfacePressed,
          disabledForegroundColor: AppColors.inkFaint,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          foregroundColor: AppColors.ink,
          side: const BorderSide(color: AppColors.borderStrong),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.accentDeep,
          textStyle: textTheme.labelLarge,
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          minimumSize: WidgetStateProperty.all(
            const Size(0, AppTouchTargets.minimum),
          ),
          visualDensity: VisualDensity.compact,
          textStyle: WidgetStateProperty.all(textTheme.labelMedium),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.selected)
                ? AppColors.primaryDeep
                : AppColors.inkSubtle;
          }),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.selected)
                ? AppColors.primarySoft
                : AppColors.surface;
          }),
          iconColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.selected)
                ? AppColors.primaryDeep
                : AppColors.inkSubtle;
          }),
          side: WidgetStateProperty.resolveWith((states) {
            return BorderSide(
              color: states.contains(WidgetState.selected)
                  ? AppColors.primarySoft
                  : AppColors.border,
            );
          }),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
          ),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.ink,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(AppRadii.md)),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadii.lg),
          ),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.ink,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: Colors.white),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: AppColors.accentSoft,
        height: 74,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return textTheme.labelMedium?.copyWith(
            color: selected ? AppColors.inkStrong : AppColors.inkSubtle,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.accentDeep : AppColors.inkSubtle,
            size: 24,
          );
        }),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.accentSoft,
        elevation: 0,
        minWidth: 82,
        minExtendedWidth: 188,
        labelType: NavigationRailLabelType.all,
        selectedIconTheme: const IconThemeData(
          color: AppColors.accentDeep,
          size: 24,
        ),
        unselectedIconTheme: const IconThemeData(
          color: AppColors.inkSubtle,
          size: 23,
        ),
        selectedLabelTextStyle: textTheme.labelMedium?.copyWith(
          color: AppColors.inkStrong,
          fontWeight: FontWeight.w900,
        ),
        unselectedLabelTextStyle: textTheme.labelMedium?.copyWith(
          color: AppColors.inkSubtle,
          fontWeight: FontWeight.w700,
        ),
      ),
      badgeTheme: BadgeThemeData(
        backgroundColor: AppColors.danger,
        textColor: Colors.white,
        textStyle: textTheme.labelSmall?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w900,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 6),
      ),
    );
  }
}
