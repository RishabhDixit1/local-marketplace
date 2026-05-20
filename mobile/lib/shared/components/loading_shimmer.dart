import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';

class LoadingShimmer extends StatefulWidget {
  const LoadingShimmer({
    super.key,
    this.height = 16,
    this.width = double.infinity,
    this.borderRadius = 8,
  });

  final double height;
  final double width;
  final double borderRadius;

  @override
  State<LoadingShimmer> createState() => _LoadingShimmerState();
}

class _LoadingShimmerState extends State<LoadingShimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading',
      liveRegion: true,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final value = Color.lerp(
            AppColors.shimmerBase,
            AppColors.shimmerHighlight,
            _controller.value,
          )!;

          return Container(
            width: widget.width,
            height: widget.height,
            decoration: BoxDecoration(
              color: value,
              borderRadius: BorderRadius.circular(widget.borderRadius),
            ),
          );
        },
      ),
    );
  }
}
