import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';
import 'cards.dart';

class AppSkeleton extends StatelessWidget {
  const AppSkeleton({
    super.key,
    required this.height,
    this.width,
    this.radius = AppRadii.xs,
  });

  final double height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.35, end: 0.95),
      duration: AppDurations.slow,
      curve: Curves.easeInOut,
      builder: (context, value, _) {
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            gradient: LinearGradient(
              colors: [
                AppColors.surfaceAlt.withValues(alpha: value),
                AppColors.backgroundRaised.withValues(alpha: value),
              ],
            ),
          ),
        );
      },
    );
  }
}

class CardListSkeleton extends StatelessWidget {
  const CardListSkeleton({super.key, this.count = 3});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        count,
        (index) => Padding(
          padding: EdgeInsets.only(
            bottom: index == count - 1 ? 0 : AppSpacing.md,
          ),
          child: const AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppSkeleton(height: 16, width: 120),
                SizedBox(height: AppSpacing.sm),
                AppSkeleton(height: 22, width: 220),
                SizedBox(height: AppSpacing.sm),
                AppSkeleton(height: 14),
                SizedBox(height: AppSpacing.xs),
                AppSkeleton(height: 14, width: 190),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
