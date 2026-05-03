import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  static const background = Color(0xFFF7F8F4);
  static const backgroundRaised = Color(0xFFEFF4F1);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceAlt = Color(0xFFF1F6F4);
  static const surfaceTint = Color(0xFFE6F7F4);
  static const surfacePressed = Color(0xFFE9EFEC);
  static const surfaceMuted = surfaceAlt;
  static const surfaceRaised = backgroundRaised;

  static const ink = Color(0xFF141A22);
  static const inkStrong = Color(0xFF090F17);
  static const inkSubtle = Color(0xFF55616B);
  static const inkMuted = inkSubtle;
  static const inkFaint = Color(0xFF7A858E);

  static const border = Color(0xFFDCE5E1);
  static const borderStrong = Color(0xFFC5D3CD);

  static const primary = Color(0xFF0D9488);
  static const primaryDeep = Color(0xFF075E59);
  static const primarySoft = Color(0xFFDDF7F2);
  static const primaryPressed = Color(0xFF0B7E74);

  static const accent = Color(0xFF3557D5);
  static const accentDeep = Color(0xFF253C99);
  static const accentSoft = Color(0xFFEEF2FF);

  static const warm = Color(0xFFB66B1E);
  static const warmDeep = Color(0xFF7A4313);
  static const warmSoft = Color(0xFFFFF0DA);

  static const warning = Color(0xFFAD6B00);
  static const warningSoft = Color(0xFFFFF4D8);
  static const danger = Color(0xFFC2415A);
  static const dangerSoft = Color(0xFFFFE6EC);
  static const success = Color(0xFF158463);
  static const successSoft = Color(0xFFE2F6EE);
  static const verified = Color(0xFF2563EB);
  static const verifiedSoft = Color(0xFFEFF6FF);
  static const urgent = Color(0xFFB84A1C);
  static const urgentSoft = Color(0xFFFFEBDD);
  static const premium = Color(0xFF7147A8);
  static const premiumSoft = Color(0xFFF4ECFF);

  static const scrim = Color(0xA6141A22);
  static const shadow = Color(0x15141A22);
  static const glow = Color(0x220D9488);
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

  static const xs = 4.0;
  static const sm = 6.0;
  static const md = 8.0;
  static const lg = 12.0;
  static const xl = 16.0;
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
    BoxShadow(color: AppColors.shadow, blurRadius: 18, offset: Offset(0, 8)),
  ];

  static const floating = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 30, offset: Offset(0, 16)),
  ];

  static const glow = <BoxShadow>[
    BoxShadow(color: AppColors.glow, blurRadius: 28, offset: Offset(0, 10)),
  ];
}

@immutable
class ServiqThemeTokens extends ThemeExtension<ServiqThemeTokens> {
  const ServiqThemeTokens({
    required this.heroGradient,
    required this.exploreGradient,
    required this.peopleGradient,
    required this.trustGradient,
    required this.authGradient,
    required this.actionGradient,
    required this.glassBorder,
  });

  static const light = ServiqThemeTokens(
    heroGradient: LinearGradient(
      colors: [Color(0xFF10262B), Color(0xFF0D5C58), Color(0xFF11A08F)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    exploreGradient: LinearGradient(
      colors: [Color(0xFFE6F7F4), Color(0xFFFFF4D8)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    peopleGradient: LinearGradient(
      colors: [Color(0xFFEEF2FF), Color(0xFFE8F7F1)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    trustGradient: LinearGradient(
      colors: [Color(0xFFFFF0DA), Color(0xFFEFF6FF)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    authGradient: LinearGradient(
      colors: [Color(0xFFF7F8F4), Color(0xFFE6F7F4), Color(0xFFFFF7E8)],
      begin: Alignment.topCenter,
      end: Alignment.bottomRight,
    ),
    actionGradient: LinearGradient(
      colors: [Color(0xFF0D9488), Color(0xFF3557D5)],
      begin: Alignment.centerLeft,
      end: Alignment.centerRight,
    ),
    glassBorder: Color(0x66FFFFFF),
  );

  final Gradient heroGradient;
  final Gradient exploreGradient;
  final Gradient peopleGradient;
  final Gradient trustGradient;
  final Gradient authGradient;
  final Gradient actionGradient;
  final Color glassBorder;

  @override
  ThemeExtension<ServiqThemeTokens> copyWith({
    Gradient? heroGradient,
    Gradient? exploreGradient,
    Gradient? peopleGradient,
    Gradient? trustGradient,
    Gradient? authGradient,
    Gradient? actionGradient,
    Color? glassBorder,
  }) {
    return ServiqThemeTokens(
      heroGradient: heroGradient ?? this.heroGradient,
      exploreGradient: exploreGradient ?? this.exploreGradient,
      peopleGradient: peopleGradient ?? this.peopleGradient,
      trustGradient: trustGradient ?? this.trustGradient,
      authGradient: authGradient ?? this.authGradient,
      actionGradient: actionGradient ?? this.actionGradient,
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
