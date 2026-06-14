import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/rate_limiter.dart';
import '../supabase/app_bootstrap.dart';
import 'mobile_api_client.dart';

final rateLimiterProvider = Provider<RateLimiter>((ref) => RateLimiter());

final mobileApiClientProvider = Provider<MobileApiClient>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  final rateLimiter = ref.watch(rateLimiterProvider);
  final client = MobileApiClient(
    config: bootstrap.config,
    supabaseClient: bootstrap.client,
    rateLimiter: rateLimiter,
  );
  ref.onDispose(client.dispose);
  return client;
});
