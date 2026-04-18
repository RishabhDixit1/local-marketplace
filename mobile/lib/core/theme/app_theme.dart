import 'package:flutter/material.dart';

class AppTheme {
  static const Color _surfaceApp = Color(0xFFF3F6FB);
  static const Color _surfaceCard = Color(0xFFFFFFFF);
  static const Color _ink = Color(0xFF0F172A);
  static const Color _inkMuted = Color(0xFF64748B);
  static const Color _brandDeep = Color(0xFF0B1F33);
  static const Color _brandOcean = Color(0xFF11466A);
  static const Color _brandMint = Color(0xFF0EA5A4);
  static const Color _brandSky = Color(0xFF67E8F9);

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: _brandMint,
      brightness: Brightness.light,
      primary: _brandDeep,
      secondary: _brandOcean,
      tertiary: _brandMint,
      surface: _surfaceCard,
    );

    final baseTextTheme = Typography.material2021().black;
    final textTheme = baseTextTheme.copyWith(
      headlineLarge: const TextStyle(
        fontSize: 32,
        fontWeight: FontWeight.w700,
        color: _ink,
      ),
      headlineMedium: const TextStyle(
        fontSize: 26,
        fontWeight: FontWeight.w700,
        color: _ink,
      ),
      titleLarge: const TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: _ink,
      ),
      titleMedium: baseTextTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w700,
        color: _ink,
      ),
      bodyLarge: baseTextTheme.bodyLarge?.copyWith(color: _ink),
      bodyMedium: baseTextTheme.bodyMedium?.copyWith(color: _ink),
      bodySmall: baseTextTheme.bodySmall?.copyWith(color: _inkMuted),
      labelLarge: baseTextTheme.labelLarge?.copyWith(
        fontWeight: FontWeight.w700,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: _surfaceApp,
      textTheme: textTheme,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: _ink,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: _surfaceCard,
        shadowColor: const Color(0x1A0F172A),
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
          side: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: _surfaceCard,
        hintStyle: const TextStyle(color: _inkMuted),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: Color(0xFFD8E1EB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: Color(0xFFD8E1EB)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: _brandMint, width: 1.4),
        ),
      ),
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        side: BorderSide.none,
        backgroundColor: _brandSky.withValues(alpha: 0.18),
        labelStyle: const TextStyle(
          color: _brandDeep,
          fontWeight: FontWeight.w700,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: _brandDeep,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: _brandDeep,
          side: const BorderSide(color: Color(0xFFD8E1EB)),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 76,
        backgroundColor: _surfaceCard,
        surfaceTintColor: Colors.transparent,
        indicatorColor: _brandMint.withValues(alpha: 0.16),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? _brandDeep : _inkMuted);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            color: selected ? _brandDeep : _inkMuted,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          );
        }),
      ),
    );
  }
}
