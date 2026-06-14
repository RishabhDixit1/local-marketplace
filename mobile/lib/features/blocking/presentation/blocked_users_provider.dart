import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/block_repository_provider.dart';
import '../domain/blocked_user.dart';

final blockedUsersProvider = FutureProvider<List<BlockedUser>>((ref) async {
  final repo = ref.read(blockRepositoryProvider);
  final raw = await repo.listBlocked();
  return raw.map((json) => BlockedUser.fromJson(json)).toList();
});
