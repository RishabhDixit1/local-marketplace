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
    heroStart: Color(0xFFF3FBF7),
    heroEnd: Color(0xFFF4F8FF),
    heroAccent: Color(0xFF0F6E57),
    heroStroke: Color(0xFFD8E8E0),
    trustedTint: Color(0xFFE9F7F1),
    nearbyTint: Color(0xFFEFF4FF),
    earnTint: Color(0xFFFFF2E6),
    warningTint: Color(0xFFFFF4DB),
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
    final colorScheme = const ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.primary,
      onPrimary: Colors.white,
      secondary: AppColors.accent,
      onSecondary: Colors.white,
      error: AppColors.danger,
      onError: Colors.white,
      surface: AppColors.surface,
      onSurface: AppColors.ink,
    );

    final baseText = GoogleFonts.plusJakartaSansTextTheme(
      Typography.material2021().black,
    );
    final display = GoogleFonts.soraTextTheme(baseText);
    final textTheme = baseText.copyWith(
      displayLarge: display.displayLarge?.copyWith(
        fontSize: 34,
        fontWeight: FontWeight.w700,
        letterSpacing: -1.2,
        color: AppColors.ink,
      ),
      headlineLarge: display.headlineLarge?.copyWith(
        fontSize: 30,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.9,
        color: AppColors.ink,
      ),
      headlineMedium: display.headlineMedium?.copyWith(
        fontSize: 24,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.6,
        color: AppColors.ink,
      ),
      headlineSmall: display.headlineSmall?.copyWith(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
      ),
      titleLarge: baseText.titleLarge?.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
      ),
      titleMedium: baseText.titleMedium?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
      ),
      bodyLarge: baseText.bodyLarge?.copyWith(
        fontSize: 15,
        height: 1.45,
        color: AppColors.ink,
        fontWeight: FontWeight.w500,
      ),
      bodyMedium: baseText.bodyMedium?.copyWith(
        fontSize: 14,
        height: 1.45,
        color: AppColors.inkSubtle,
        fontWeight: FontWeight.w500,
      ),
      bodySmall: baseText.bodySmall?.copyWith(
        fontSize: 12,
        height: 1.4,
        color: AppColors.inkSubtle,
        fontWeight: FontWeight.w600,
      ),
      labelLarge: baseText.labelLarge?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
      ),
      labelMedium: baseText.labelMedium?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
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
        selectedColor: AppColors.primarySoft,
        side: const BorderSide(color: AppColors.border),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        labelStyle: textTheme.labelMedium,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        hintStyle: textTheme.bodyMedium,
        labelStyle: textTheme.bodyMedium,
        border: inputBorder,
        enabledBorder: inputBorder,
        focusedBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.primary, width: 1.3),
        ),
        errorBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: inputBorder.copyWith(
          borderSide: const BorderSide(color: AppColors.danger),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          foregroundColor: Colors.white,
          backgroundColor: AppColors.primary,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.sm),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          foregroundColor: AppColors.ink,
          side: const BorderSide(color: AppColors.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.sm),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primaryDeep,
          textStyle: textTheme.labelLarge,
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.ink,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(AppRadii.md)),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.surface,
        shape: const RoundedRectangleBorder(
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
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: AppColors.primarySoft,
        height: 74,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return textTheme.labelMedium?.copyWith(
            color: selected ? AppColors.ink : AppColors.inkSubtle,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.ink : AppColors.inkSubtle,
          );
        }),
      ),
    );
  }
}
