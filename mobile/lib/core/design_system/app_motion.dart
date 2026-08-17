import 'package:flutter/material.dart';

/// Motion tokens. Curves + duration presets centralize animation timing so no
/// screen hardcodes `Duration(milliseconds: ...)` or `Curves.easeOut`.
class AppEasing {
  const AppEasing._();

  /// Fast, snappy feedback (press, toggle, pill swap).
  static const fast = Curves.easeOutCubic;

  /// Standard UI motion (sheet, page, expand).
  static const standard = Curves.easeOutCubic;

  /// Emphasized entrances (hero, section reveal).
  static const emphasize = Curves.easeOutBack;

  /// Deceleration for bottom sheets (follow the finger feel).
  static const sheet = Curves.easeOutQuart;

  /// Content exit / dismiss.
  static const exit = Curves.easeInCubic;

  /// Spring-like, subtle overshoot for badges and counts.
  static const spring = Curves.easeOutBack;
}

class AppMotion {
  const AppMotion._();

  static const page = Duration(milliseconds: 260);
  static const sheet = Duration(milliseconds: 320);
  static const dialog = Duration(milliseconds: 220);
  static const standard = Duration(milliseconds: 300);
  static const fast = Duration(milliseconds: 180);
  static const slow = Duration(milliseconds: 500);

  /// Standard page transition (slide + fade), matches `_smoothPage` in router.
  static Widget pageTransition(
    Animation<double> animation,
    Widget child, {
    bool forward = true,
  }) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
    );
    final offset = Tween<Offset>(
      begin: forward ? const Offset(0.06, 0) : const Offset(-0.06, 0),
      end: Offset.zero,
    ).animate(curved);
    return FadeTransition(
      opacity: Tween<double>(begin: 0.0, end: 1.0).animate(animation),
      child: SlideTransition(position: offset, child: child),
    );
  }

  /// Standard entrance for content blocks (section reveal).
  static Widget fadeIn(Animation<double> animation, Widget child) {
    return FadeTransition(
      opacity: CurvedAnimation(
        parent: animation,
        curve: AppEasing.standard,
      ),
      child: child,
    );
  }

  /// Scale-in for pills / badges / counts.
  static Widget scaleIn(Animation<double> animation, Widget child) {
    return ScaleTransition(
      scale: Tween<double>(begin: 0.92, end: 1.0).animate(
        CurvedAnimation(parent: animation, curve: AppEasing.fast),
      ),
      child: child,
    );
  }
}

/// Shared [TweenAnimationBuilder] helpers for implicit motion.
class AppAnimated {
  const AppAnimated._();

  static Widget opacity({
    required bool visible,
    required Widget child,
    Duration duration = AppMotion.fast,
  }) {
    return AnimatedOpacity(
      opacity: visible ? 1 : 0,
      duration: duration,
      curve: AppEasing.fast,
      child: child,
    );
  }

  static Widget scale({
    required bool visible,
    required Widget child,
    Duration duration = AppMotion.fast,
  }) {
    return AnimatedScale(
      scale: visible ? 1 : 0,
      duration: duration,
      curve: AppEasing.fast,
      child: child,
    );
  }

  /// Staggered fade+slide entrance. Pass [index] and [total] to compute
  /// the delay so cards appear sequentially rather than all at once.
  static Widget fadeSlideIn({
    required int index,
    required int total,
    required Widget child,
    Duration duration = AppMotion.standard,
    Offset begin = const Offset(0.02, 0),
  }) {
    final delay = (index * 60).clamp(0, 300);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: duration.inMilliseconds + delay),
      curve: AppEasing.standard,
      builder: (context, value, _) {
        final offset = Offset.lerp(begin, Offset.zero, value)!;
        return FadeTransition(
          opacity: AlwaysStoppedAnimation(value.clamp(0.0, 1.0)),
          child: SlideTransition(
            position: AlwaysStoppedAnimation(offset),
            child: child,
          ),
        );
      },
    );
  }
}
