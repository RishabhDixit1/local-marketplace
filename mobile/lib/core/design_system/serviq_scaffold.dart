import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';

class ServiqScaffold extends StatelessWidget {
  const ServiqScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
    this.extendBody = false,
    this.gradient,
    this.glassNav = false,
  });

  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;
  final bool extendBody;
  final Gradient? gradient;
  final bool glassNav;

  @override
  Widget build(BuildContext context) {
    Widget scaffold = Scaffold(
      extendBody: extendBody,
      backgroundColor: Colors.transparent,
      appBar: appBar,
      body: body,
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: floatingActionButtonLocation,
    );

    if (gradient != null) {
      scaffold = Container(
        decoration: BoxDecoration(gradient: gradient),
        child: scaffold,
      );
    } else {
      scaffold = Container(
        color: AppColors.background,
        child: scaffold,
      );
    }

    return scaffold;
  }
}
