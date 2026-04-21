import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  static const background = Color(0xFFF5F7F4);
  static const backgroundRaised = Color(0xFFEFF4F0);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceAlt = Color(0xFFF0F4F2);
  static const surfaceTint = Color(0xFFE6F4EE);
  static const ink = Color(0xFF14211D);
  static const inkSubtle = Color(0xFF5D6C66);
  static const surfaceMuted = surfaceAlt;
  static const surfaceRaised = backgroundRaised;
  static const inkMuted = inkSubtle;
  static const border = Color(0xFFD7E3DD);
  static const primary = Color(0xFF0F8A6C);
  static const primaryDeep = Color(0xFF0A5F4A);
  static const primarySoft = Color(0xFFE4F5EF);
  static const accent = Color(0xFF0D6EFD);
  static const accentSoft = Color(0xFFEAF2FF);
  static const warning = Color(0xFFC77718);
  static const warningSoft = Color(0xFFFFF2DF);
  static const danger = Color(0xFFD14C5D);
  static const dangerSoft = Color(0xFFFFE8EB);
  static const success = Color(0xFF21926A);
  static const successSoft = Color(0xFFE4F7EF);
  static const verified = Color(0xFF1169D9);
  static const verifiedSoft = Color(0xFFEAF2FF);
  static const urgent = Color(0xFFB94C1C);
  static const urgentSoft = Color(0xFFFFEBDD);
  static const premium = Color(0xFF7A5215);
  static const premiumSoft = Color(0xFFFFF3E2);
  static const shadow = Color(0x1414211D);
}

class AppSpacing {
  const AppSpacing._();

  static const xxxs = 2.0;
  static const xxs = 4.0;
  static const xs = 8.0;
  static const sm = 12.0;
  static const md = 16.0;
  static const lg = 20.0;
  static const xl = 24.0;
  static const xxl = 32.0;
  static const xxxl = 40.0;
  static const pageInset = 20.0;
}

class AppRadii {
  const AppRadii._();

  static const xs = 10.0;
  static const sm = 14.0;
  static const md = 18.0;
  static const lg = 24.0;
  static const xl = 30.0;
  static const pill = 999.0;
}

class AppBreakpoints {
  const AppBreakpoints._();

  static const compact = 360.0;
  static const regular = 430.0;
  static const expanded = 700.0;
}

class AppDurations {
  const AppDurations._();

  static const fast = Duration(milliseconds: 160);
  static const standard = Duration(milliseconds: 240);
  static const slow = Duration(milliseconds: 360);
}

class AppShadows {
  const AppShadows._();

  static const card = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 24, offset: Offset(0, 10)),
  ];

  static const floating = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 36, offset: Offset(0, 18)),
  ];
}

@immutable
class ServiqThemeTokens extends ThemeExtension<ServiqThemeTokens> {
  const ServiqThemeTokens({
    required this.heroGradient,
    required this.exploreGradient,
    required this.peopleGradient,
    required this.trustGradient,
    required this.glassBorder,
  });

  static const light = ServiqThemeTokens(
    heroGradient: LinearGradient(
      colors: [Color(0xFF0A5F4A), Color(0xFF178566), Color(0xFF4FA07F)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    exploreGradient: LinearGradient(
      colors: [Color(0xFFE8F6F0), Color(0xFFFDF8EE)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    peopleGradient: LinearGradient(
      colors: [Color(0xFFE9F2FF), Color(0xFFF2FBF8)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    trustGradient: LinearGradient(
      colors: [Color(0xFFFFF0DD), Color(0xFFEAF2FF)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    glassBorder: Color(0x33FFFFFF),
  );

  final Gradient heroGradient;
  final Gradient exploreGradient;
  final Gradient peopleGradient;
  final Gradient trustGradient;
  final Color glassBorder;

  @override
  ThemeExtension<ServiqThemeTokens> copyWith({
    Gradient? heroGradient,
    Gradient? exploreGradient,
    Gradient? peopleGradient,
    Gradient? trustGradient,
    Color? glassBorder,
  }) {
    return ServiqThemeTokens(
      heroGradient: heroGradient ?? this.heroGradient,
      exploreGradient: exploreGradient ?? this.exploreGradient,
      peopleGradient: peopleGradient ?? this.peopleGradient,
      trustGradient: trustGradient ?? this.trustGradient,
      glassBorder: glassBorder ?? this.glassBorder,
    );
  }

  @override
  ThemeExtension<ServiqThemeTokens> lerp(
    covariant ThemeExtension<ServiqThemeTokens>? other,
    double t,
  ) {
    if (other is! ServiqThemeTokens) {
      return this;
    }

    return t < 0.5 ? this : other;
  }
}
