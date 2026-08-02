import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

export 'design_tokens.dart';

import 'design_tokens.dart';

const _ink = Color(0xFF0D2137);
const _inkStrong = Color(0xFF071526);
const _inkSubtle = Color(0xFF6B7280);
const _inkFaint = Color(0xFF9CA3AF);
const _border = Color(0xFFE5E7EB);
const _borderStrong = Color(0xFFD1D5DB);

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
    heroStart: Color(0xFFE8EDF5),
    heroEnd: Color(0xFFFEF3C7),
    heroAccent: AppColors.primaryDeep,
    heroStroke: _borderStrong,
    trustedTint: AppColors.successSoft,
    nearbyTint: AppColors.primarySoft,
    earnTint: AppColors.warmSoft,
    warningTint: AppColors.warningSoft,
  );

  static const dark = WelcomeThemeTokens(
    heroStart: Color(0xFF0A1525),
    heroEnd: Color(0xFF1A1408),
    heroAccent: AppColors.accent,
    heroStroke: Color(0xFF1F2937),
    trustedTint: Color(0xFF0D3328),
    nearbyTint: Color(0xFF0D2137),
    earnTint: Color(0xFF3B2F08),
    warningTint: Color(0xFF3B2F08),
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
          primary: AppColors.accent,
          onPrimary: Colors.white,
          primaryContainer: AppColors.accentSoft,
          onPrimaryContainer: AppColors.accentDeep,
          secondary: AppColors.primary,
          onSecondary: Colors.white,
          secondaryContainer: AppColors.primarySoft,
          onSecondaryContainer: AppColors.primaryDeep,
          tertiary: AppColors.warm,
          onTertiary: Colors.white,
          tertiaryContainer: AppColors.warmSoft,
          onTertiaryContainer: AppColors.warmDeep,
          error: AppColors.danger,
          onError: Colors.white,
          errorContainer: AppColors.dangerSoft,
          surface: AppColors.surface,
          onSurface: _ink,
          surfaceContainerHighest: AppColors.surfaceAlt,
          outline: _border,
          outlineVariant: _border,
          shadow: AppColors.shadow,
          scrim: AppColors.scrim,
        );

    final baseText = GoogleFonts.manropeTextTheme(
      Typography.material2021().black,
    );
    final display = GoogleFonts.dmSerifDisplayTextTheme(baseText);
    final textTheme = baseText.copyWith(
      displayLarge: display.displayLarge?.copyWith(
        fontSize: 36,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.5,
        color: _inkStrong,
      ),
      displayMedium: display.displayMedium?.copyWith(
        fontSize: 32,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.3,
        color: _inkStrong,
      ),
      displaySmall: display.displaySmall?.copyWith(
        fontSize: 28,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.2,
        color: _inkStrong,
      ),
      headlineLarge: display.headlineLarge?.copyWith(
        fontSize: 26,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.2,
        color: _inkStrong,
      ),
      headlineMedium: display.headlineMedium?.copyWith(
        fontSize: 22,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.1,
        color: _inkStrong,
      ),
      headlineSmall: display.headlineSmall?.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        color: _inkStrong,
      ),
      titleLarge: baseText.titleLarge?.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
        color: _ink,
      ),
      titleMedium: baseText.titleMedium?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.1,
        color: _ink,
      ),
      titleSmall: baseText.titleSmall?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: _ink,
      ),
      bodyLarge: baseText.bodyLarge?.copyWith(
        fontSize: 16,
        height: 1.5,
        letterSpacing: 0,
        color: _ink,
        fontWeight: FontWeight.w500,
      ),
      bodyMedium: baseText.bodyMedium?.copyWith(
        fontSize: 14,
        height: 1.5,
        letterSpacing: 0,
        color: _inkSubtle,
        fontWeight: FontWeight.w500,
      ),
      bodySmall: baseText.bodySmall?.copyWith(
        fontSize: 13,
        height: 1.4,
        letterSpacing: 0,
        color: _inkSubtle,
        fontWeight: FontWeight.w600,
      ),
      labelLarge: baseText.labelLarge?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.2,
        color: _ink,
      ),
      labelMedium: baseText.labelMedium?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.3,
        color: _ink,
      ),
      labelSmall: baseText.labelSmall?.copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.4,
        color: _inkSubtle,
      ),
    );

    final inputBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      borderSide: const BorderSide(color: _border),
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
        foregroundColor: _ink,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0.5,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.xl),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: _border,
        thickness: 1,
        space: 1,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceAlt,
        selectedColor: AppColors.accentSoft,
        disabledColor: AppColors.surfacePressed,
        side: const BorderSide(color: _border),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        labelStyle: textTheme.labelMedium,
        secondaryLabelStyle: textTheme.labelMedium,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: _inkFaint),
        labelStyle: textTheme.bodyMedium,
        floatingLabelStyle: textTheme.labelMedium?.copyWith(
          color: AppColors.accentDeep,
        ),
        border: inputBorder,
        enabledBorder: inputBorder,
        focusedBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
        ),
        errorBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(AppTouchTargets.buttonHeight),
          foregroundColor: Colors.white,
          backgroundColor: AppColors.accent,
          disabledBackgroundColor: AppColors.surfacePressed,
          disabledForegroundColor: _inkFaint,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.lg),
          ),
          textStyle: textTheme.labelLarge?.copyWith(color: Colors.white),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(AppTouchTargets.buttonHeight),
          foregroundColor: _ink,
          side: const BorderSide(color: _borderStrong),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.lg),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.accentDeep,
          textStyle: textTheme.labelLarge,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
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
                ? AppColors.accentDeep
                : _inkSubtle;
          }),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.selected)
                ? AppColors.accentSoft
                : AppColors.surface;
          }),
          side: WidgetStateProperty.resolveWith((states) {
            return BorderSide(
              color: states.contains(WidgetState.selected)
                  ? AppColors.accentSoft
                  : _border,
            );
          }),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadii.lg),
            ),
          ),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(AppRadii.xl)),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadii.xxl),
          ),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.xl),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: _ink,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: Colors.white),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        indicatorColor: AppColors.accentSoft,
        height: 80,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return textTheme.labelMedium?.copyWith(
            color: selected ? AppColors.accentDeep : _inkSubtle,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.accent : _inkSubtle,
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
          color: AppColors.accent,
          size: 24,
        ),
        unselectedIconTheme: const IconThemeData(
          color: _inkSubtle,
          size: 23,
        ),
        selectedLabelTextStyle: textTheme.labelMedium?.copyWith(
          color: _inkStrong,
          fontWeight: FontWeight.w900,
        ),
        unselectedLabelTextStyle: textTheme.labelMedium?.copyWith(
          color: _inkSubtle,
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

  static ThemeData dark() {
    final colorScheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          brightness: Brightness.dark,
        ).copyWith(
          primary: AppColors.accent,
          onPrimary: Colors.white,
          primaryContainer: AppColors.accentDeep,
          onPrimaryContainer: AppColors.accentSoft,
          secondary: AppColors.primary,
          onSecondary: Colors.white,
          secondaryContainer: AppColors.primaryDeep,
          onSecondaryContainer: AppColors.primarySoft,
          tertiary: AppColors.warm,
          onTertiary: Colors.white,
          tertiaryContainer: AppColors.warmDeep,
          onTertiaryContainer: AppColors.warmSoft,
          error: AppColors.danger,
          onError: Colors.white,
          errorContainer: AppColors.dangerSoft,
          surface: AppColors.darkSurface,
          onSurface: AppColors.darkInk,
          surfaceContainerHighest: AppColors.darkSurfaceAlt,
          outline: AppColors.darkBorder,
          outlineVariant: AppColors.darkBorder,
          shadow: AppColors.shadow,
          scrim: AppColors.scrim,
        );

    final baseText = GoogleFonts.manropeTextTheme(
      Typography.material2021().white,
    );
    final display = GoogleFonts.dmSerifDisplayTextTheme(baseText);
    final textTheme = baseText.copyWith(
      displayLarge: display.displayLarge?.copyWith(
        fontSize: 36,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.5,
        color: AppColors.darkInkStrong,
      ),
      displayMedium: display.displayMedium?.copyWith(
        fontSize: 32,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.3,
        color: AppColors.darkInkStrong,
      ),
      displaySmall: display.displaySmall?.copyWith(
        fontSize: 28,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.2,
        color: AppColors.darkInkStrong,
      ),
      headlineLarge: display.headlineLarge?.copyWith(
        fontSize: 26,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.2,
        color: AppColors.darkInkStrong,
      ),
      headlineMedium: display.headlineMedium?.copyWith(
        fontSize: 22,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.1,
        color: AppColors.darkInkStrong,
      ),
      headlineSmall: display.headlineSmall?.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        color: AppColors.darkInkStrong,
      ),
      titleLarge: baseText.titleLarge?.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
        color: AppColors.darkInk,
      ),
      titleMedium: baseText.titleMedium?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.1,
        color: AppColors.darkInk,
      ),
      titleSmall: baseText.titleSmall?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
        color: AppColors.darkInk,
      ),
      bodyLarge: baseText.bodyLarge?.copyWith(
        fontSize: 16,
        height: 1.5,
        letterSpacing: 0,
        color: AppColors.darkInk,
        fontWeight: FontWeight.w500,
      ),
      bodyMedium: baseText.bodyMedium?.copyWith(
        fontSize: 14,
        height: 1.5,
        letterSpacing: 0,
        color: AppColors.darkInkSubtle,
        fontWeight: FontWeight.w500,
      ),
      bodySmall: baseText.bodySmall?.copyWith(
        fontSize: 13,
        height: 1.4,
        letterSpacing: 0,
        color: AppColors.darkInkSubtle,
        fontWeight: FontWeight.w600,
      ),
      labelLarge: baseText.labelLarge?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.2,
        color: AppColors.darkInk,
      ),
      labelMedium: baseText.labelMedium?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.3,
        color: AppColors.darkInk,
      ),
      labelSmall: baseText.labelSmall?.copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.4,
        color: AppColors.darkInkSubtle,
      ),
    );

    final inputBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      borderSide: const BorderSide(color: AppColors.darkBorder),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.darkBackground,
      textTheme: textTheme,
      extensions: const <ThemeExtension<dynamic>>[
        ServiqThemeTokens.dark,
        WelcomeThemeTokens.dark,
      ],
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.darkBackground,
        foregroundColor: AppColors.darkInk,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0.5,
      ),
      cardTheme: CardThemeData(
        color: AppColors.darkSurface,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.xl),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.darkBorder,
        thickness: 1,
        space: 1,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.darkSurfaceAlt,
        selectedColor: AppColors.accentDeep,
        disabledColor: AppColors.darkSurfacePressed,
        side: const BorderSide(color: AppColors.darkBorder),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        labelStyle: textTheme.labelMedium,
        secondaryLabelStyle: textTheme.labelMedium,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.darkSurface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: AppColors.darkInkFaint),
        labelStyle: textTheme.bodyMedium,
        floatingLabelStyle: textTheme.labelMedium?.copyWith(
          color: AppColors.accent,
        ),
        border: inputBorder,
        enabledBorder: inputBorder,
        focusedBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
        ),
        errorBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(AppTouchTargets.buttonHeight),
          foregroundColor: Colors.white,
          backgroundColor: AppColors.accent,
          disabledBackgroundColor: AppColors.darkSurfacePressed,
          disabledForegroundColor: AppColors.darkInkFaint,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.lg),
          ),
          textStyle: textTheme.labelLarge?.copyWith(color: Colors.white),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(AppTouchTargets.buttonHeight),
          foregroundColor: AppColors.darkInk,
          side: const BorderSide(color: AppColors.darkBorderStrong),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.lg),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.accent,
          textStyle: textTheme.labelLarge,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
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
                ? AppColors.accentSoft
                : AppColors.darkInkSubtle;
          }),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.selected)
                ? AppColors.accentDeep
                : AppColors.darkSurface;
          }),
          side: WidgetStateProperty.resolveWith((states) {
            return BorderSide(
              color: states.contains(WidgetState.selected)
                  ? AppColors.accentDeep
                  : AppColors.darkBorder,
            );
          }),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadii.lg),
            ),
          ),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(AppRadii.xl)),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.darkSurface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.darkSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadii.xxl),
          ),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.darkSurface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.xl),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.darkInk,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: Colors.white),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        indicatorColor: AppColors.accentDeep,
        height: 80,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return textTheme.labelMedium?.copyWith(
            color: selected ? AppColors.accent : AppColors.darkInkSubtle,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.accent : AppColors.darkInkSubtle,
            size: 24,
          );
        }),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: AppColors.darkSurface,
        indicatorColor: AppColors.accentDeep,
        elevation: 0,
        minWidth: 82,
        minExtendedWidth: 188,
        labelType: NavigationRailLabelType.all,
        selectedIconTheme: const IconThemeData(
          color: AppColors.accent,
          size: 24,
        ),
        unselectedIconTheme: const IconThemeData(
          color: AppColors.darkInkSubtle,
          size: 23,
        ),
        selectedLabelTextStyle: textTheme.labelMedium?.copyWith(
          color: AppColors.darkInkStrong,
          fontWeight: FontWeight.w900,
        ),
        unselectedLabelTextStyle: textTheme.labelMedium?.copyWith(
          color: AppColors.darkInkSubtle,
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
