import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  static const background = Color(0xFFFCFCFD);
  static const backgroundAlt = Color(0xFFF5F6FA);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceAlt = Color(0xFFF0F1F5);
  static const surfaceTint = Color(0xFFE8EDF5);
  static const surfacePressed = Color(0xFFE5E6EB);
  static const surfaceMuted = surfaceAlt;

  static const primary = Color(0xFF0D2137);
  static const primaryDeep = Color(0xFF071526);
  static const primarySoft = Color(0xFFE8EDF5);
  static const primaryPressed = Color(0xFF1A3552);

  static const accent = Color(0xFF0F766E);
  static const accentDeep = Color(0xFF0A5C56);
  static const accentSoft = Color(0xFFCCFBF1);

  static const warm = Color(0xFFD97706);
  static const warmDeep = Color(0xFFB85D04);
  static const warmSoft = Color(0xFFFFF3E0);

  static const warning = Color(0xFFDC6803);
  static const warningSoft = Color(0xFFFFF2CC);
  static const danger = Color(0xFFE03E5A);
  static const dangerSoft = Color(0xFFFFE5E9);
  static const success = Color(0xFF0E8345);
  static const successSoft = Color(0xFFDCFCE6);
  static const verified = Color(0xFF2563EB);
  static const verifiedSoft = Color(0xFFEFF6FF);
  static const urgent = Color(0xFFDC6803);
  static const urgentSoft = Color(0xFFFFF2CC);
  static const premium = Color(0xFF7C3AED);
  static const premiumSoft = Color(0xFFF3ECFF);

  static const marigold = Color(0xFFF59E0B);
  static const marigoldDeep = Color(0xFFD97706);
  static const marigoldSoft = Color(0xFFFEF3C7);
  static const marigoldMuted = Color(0xFFFDE68A);

  static const whatsapp = Color(0xFF25D366);
  static const whatsappDeep = Color(0xFF20BD5A);
  static const whatsappSoft = Color(0xFFDCF8C6);

  static const sage = Color(0xFF10B981);
  static const sageDeep = Color(0xFF059669);
  static const sageSoft = Color(0xFFD1FAE5);
  static const sageMuted = Color(0xFFA7F3D0);

  static const scrim = Color(0xCC0D2137);
  static const shadow = Color(0x1A0D2137);
  static const glow = Color(0x1A0F766E);

  static const darkBackground = Color(0xFF0A0E17);
  static const darkBackgroundAlt = Color(0xFF111827);
  static const darkSurface = Color(0xFF1F2937);
  static const darkSurfaceAlt = Color(0xFF374151);
  static const darkSurfaceTint = Color(0xFF1E2D40);
  static const darkSurfacePressed = Color(0xFF4B5563);
  static const darkInk = Color(0xFFF9FAFB);
  static const darkInkStrong = Color(0xFFFFFFFF);
  static const darkInkSubtle = Color(0xFF9CA3AF);
  static const darkInkFaint = Color(0xFF6B7280);
  static const darkBorder = Color(0xFF374151);
  static const darkBorderStrong = Color(0xFF4B5563);

  static const shimmerBase = Color(0xFFE5E7EB);
  static const shimmerHighlight = Color(0xFFF3F4F6);

  static const heroOverlay = Color(0xCC0A0E17);
  static const heroOverlayDeep = Color(0xE00A0E17);

  static const avatarFallback = Color(0xFFE5E7EB);
  static const darkAvatarFallback = darkSurfaceAlt;

  static const darkConfirmed = Color(0xFF0D3328);
  static const darkCompleted = Color(0xFF0D2418);
  static const darkCancelled = Color(0xFF3B0F1F);
  static const darkRescheduled = Color(0xFF3B2F08);

  static const glassWhite = Color(0xE6FFFFFF);
  static const glassWhiteLight = Color(0xB3FFFFFF);
  static const glassDark = Color(0xB31F2937);
  static const glassDarkLight = Color(0x801F2937);
  static const glassStroke = Color(0x33FFFFFF);
  static const glassStrokeDark = Color(0x1AFFFFFF);
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

class AppIconSize {
  const AppIconSize._();

  static const xxs = 12.0;
  static const xs = 16.0;
  static const sm = 18.0;
  static const md = 20.0;
  static const lg = 24.0;
  static const xl = 32.0;
  static const xxl = 48.0;
}

class AppRadii {
  const AppRadii._();

  static const xs = 4.0;
  static const sm = 6.0;
  static const md = 8.0;
  static const lg = 12.0;
  static const xl = 16.0;
  static const xxl = 20.0;
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

  static const fast = Duration(milliseconds: 200);
  static const standard = Duration(milliseconds: 300);
  static const slow = Duration(milliseconds: 500);
}

class AppShadows {
  const AppShadows._();

  static const soft = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 8, offset: Offset(0, 2)),
  ];

  static const card = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 12, offset: Offset(0, 4)),
  ];

  static const md = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 6, offset: Offset(0, 3)),
  ];

  static const lg = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 20, offset: Offset(0, 8)),
  ];

  static const xl = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 30, offset: Offset(0, 12)),
  ];

  static const floating = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 24, offset: Offset(0, 8)),
  ];

  static const nav = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 20, offset: Offset(0, -4)),
  ];

  static const header = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 12, offset: Offset(0, 4)),
  ];

  static const popover = <BoxShadow>[
    BoxShadow(color: AppColors.shadow, blurRadius: 40, offset: Offset(0, 16)),
  ];

  static const glow = <BoxShadow>[
    BoxShadow(color: AppColors.glow, blurRadius: 24, offset: Offset(0, 6)),
  ];

  static const glass = <BoxShadow>[
    BoxShadow(color: Color(0x1A0D2137), blurRadius: 20, offset: Offset(0, 8)),
  ];
}

class AppRoleColors {
  const AppRoleColors._();

  static const helpRequestBg = Color(0xFFFFF3E0);
  static const helpRequestFg = Color(0xFFB85D04);
  static const serviceBg = AppColors.accentSoft;
  static const serviceFg = AppColors.accentDeep;
  static const productBg = AppColors.warmSoft;
  static const productFg = AppColors.warmDeep;
  static const orderBg = AppColors.primarySoft;
  static const orderFg = AppColors.primaryDeep;
  static const trustBg = AppColors.verifiedSoft;
  static const trustFg = AppColors.verified;
}

class AppTouchTargets {
  const AppTouchTargets._();

  static const minimum = 48.0;
  static const buttonHeight = 52.0;
  static const iconButton = 44.0;
}

class AppGradients {
  const AppGradients._();

  static const premiumDark = LinearGradient(
    colors: [Color(0xFF0D2137), Color(0xFF1A3552), Color(0xFF1E4D6B)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const premiumAccent = LinearGradient(
    colors: [Color(0xFF0F766E), Color(0xFF2563EB)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static const premiumWarm = LinearGradient(
    colors: [Color(0xFFD97706), Color(0xFFF59E0B)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static const glassLight = LinearGradient(
    colors: [Color(0xE6FFFFFF), Color(0xB3FFFFFF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const glassDark = LinearGradient(
    colors: [Color(0xB31F2937), Color(0x801F2937)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const hero = LinearGradient(
    colors: [Color(0xFF0A0E17), Color(0xFF0D2137), Color(0xFF1E4D6B)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const heroLight = LinearGradient(
    colors: [Color(0xFFE8EDF5), Color(0xFFCCFBF1)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const explore = LinearGradient(
    colors: [Color(0xFFE8EDF5), Color(0xFFFEF3C7)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const people = LinearGradient(
    colors: [Color(0xFFEFF6FF), Color(0xFFD1FAE5)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

class AppGlassStyles {
  const AppGlassStyles._();

  static BoxDecoration light({
    double blur = 20,
    double opacity = 0.9,
    BorderRadiusGeometry borderRadius = const BorderRadius.all(Radius.circular(16)),
  }) {
    return BoxDecoration(
      gradient: LinearGradient(
        colors: [
          Colors.white.withValues(alpha: opacity),
          Colors.white.withValues(alpha: opacity - 0.2),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: borderRadius,
      border: Border.all(color: AppColors.glassStroke),
      boxShadow: AppShadows.glass,
    );
  }

  static BoxDecoration dark({
    double blur = 20,
    double opacity = 0.85,
    BorderRadiusGeometry borderRadius = const BorderRadius.all(Radius.circular(16)),
  }) {
    return BoxDecoration(
      gradient: LinearGradient(
        colors: [
          AppColors.darkSurface.withValues(alpha: opacity),
          AppColors.darkSurfaceAlt.withValues(alpha: opacity - 0.15),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: borderRadius,
      border: Border.all(color: AppColors.glassStrokeDark),
      boxShadow: AppShadows.glass,
    );
  }
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
    required this.glassBackground,
  });

  static const light = ServiqThemeTokens(
    heroGradient: LinearGradient(
      colors: [Color(0xFF0A0E17), Color(0xFF0D2137)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    exploreGradient: LinearGradient(
      colors: [Color(0xFFE8EDF5), Color(0xFFFEF3C7)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    peopleGradient: LinearGradient(
      colors: [Color(0xFFEFF6FF), Color(0xFFD1FAE5)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    trustGradient: LinearGradient(
      colors: [Color(0xFFFFF3E0), Color(0xFFEFF6FF)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    authGradient: LinearGradient(
      colors: [Color(0xFFFCFCFD), Color(0xFFE8EDF5), Color(0xFFCCFBF1)],
      begin: Alignment.topCenter,
      end: Alignment.bottomRight,
    ),
    actionGradient: LinearGradient(
      colors: [Color(0xFF0F766E), Color(0xFF2563EB)],
      begin: Alignment.centerLeft,
      end: Alignment.centerRight,
    ),
    glassBorder: Color(0x33FFFFFF),
    glassBackground: Color(0xE6FFFFFF),
  );

  static const dark = ServiqThemeTokens(
    heroGradient: LinearGradient(
      colors: [Color(0xFF05080E), Color(0xFF0A1525)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    exploreGradient: LinearGradient(
      colors: [Color(0xFF0A0E17), Color(0xFF111827)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    peopleGradient: LinearGradient(
      colors: [Color(0xFF0A0E17), Color(0xFF111827)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    trustGradient: LinearGradient(
      colors: [Color(0xFF0A0E17), Color(0xFF111827)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    authGradient: LinearGradient(
      colors: [Color(0xFF0A0E17), Color(0xFF111827), Color(0xFF0D3328)],
      begin: Alignment.topCenter,
      end: Alignment.bottomRight,
    ),
    actionGradient: LinearGradient(
      colors: [Color(0xFF0D5E56), Color(0xFF1D4ED8)],
      begin: Alignment.centerLeft,
      end: Alignment.centerRight,
    ),
    glassBorder: Color(0x1AFFFFFF),
    glassBackground: Color(0xB31F2937),
  );

  final Gradient heroGradient;
  final Gradient exploreGradient;
  final Gradient peopleGradient;
  final Gradient trustGradient;
  final Gradient authGradient;
  final Gradient actionGradient;
  final Color glassBorder;
  final Color glassBackground;

  @override
  ThemeExtension<ServiqThemeTokens> copyWith({
    Gradient? heroGradient,
    Gradient? exploreGradient,
    Gradient? peopleGradient,
    Gradient? trustGradient,
    Gradient? authGradient,
    Gradient? actionGradient,
    Color? glassBorder,
    Color? glassBackground,
  }) {
    return ServiqThemeTokens(
      heroGradient: heroGradient ?? this.heroGradient,
      exploreGradient: exploreGradient ?? this.exploreGradient,
      peopleGradient: peopleGradient ?? this.peopleGradient,
      trustGradient: trustGradient ?? this.trustGradient,
      authGradient: authGradient ?? this.authGradient,
      actionGradient: actionGradient ?? this.actionGradient,
      glassBorder: glassBorder ?? this.glassBorder,
      glassBackground: glassBackground ?? this.glassBackground,
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
