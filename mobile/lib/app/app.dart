import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/firebase/mobile_push_notifications.dart';
import '../core/supabase/app_bootstrap.dart';
import '../core/theme/app_theme.dart';
import 'router/app_router.dart';

class ServiQApp extends ConsumerWidget {
  const ServiQApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(appBootstrapProvider);
    final router = ref.watch(appRouterProvider);
    ref.listen(notificationTapRouteStreamProvider, (previous, next) {
      next.whenData((location) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          router.push(location);
        });
      });
    });

    return MaterialApp.router(
      title: bootstrap.config.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: router,
    );
  }
}
