import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../supabase/app_bootstrap.dart';
import 'mobile_api_client.dart';

final mobileApiClientProvider = Provider<MobileApiClient>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  final client = MobileApiClient(
    config: bootstrap.config,
    supabaseClient: bootstrap.client,
  );
  ref.onDispose(client.dispose);
  return client;
});
