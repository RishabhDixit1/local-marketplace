import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_provider.dart';
import 'block_repository.dart';

final blockRepositoryProvider = Provider<BlockRepository>((ref) {
  return BlockRepository(ref.watch(mobileApiClientProvider));
});
