import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/supabase/app_bootstrap.dart';
import '../core/theme/app_theme.dart';
import 'router/app_router.dart';

class ServiQApp extends ConsumerWidget {
  const ServiQApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(appBootstrapProvider);
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: bootstrap.config.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: router,
    );
  }
}
