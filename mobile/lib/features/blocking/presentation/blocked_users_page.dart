import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/design_system/serviq_chrome.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../data/block_repository_provider.dart';
import '../domain/blocked_user.dart';
import 'blocked_users_provider.dart';

class BlockedUsersPage extends ConsumerStatefulWidget {
  const BlockedUsersPage({super.key});

  @override
  ConsumerState<BlockedUsersPage> createState() => _BlockedUsersPageState();
}

class _BlockedUsersPageState extends ConsumerState<BlockedUsersPage> {
  Future<void> _refresh() async {
    ref.invalidate(blockedUsersProvider);
  }

  Future<void> _unblock(BlockedUser user) async {
    try {
      await ref.read(blockRepositoryProvider).unblockUser(user.blockedId);
      ref.invalidate(blockedUsersProvider);
      if (mounted) {
        ServiqToast.show(context, message: 'User unblocked.', tone: ServiqToastTone.success);
      }
    } catch (e) {
      if (mounted) {
        ServiqToast.show(context, message: AppErrorMapper.toMessage(e), tone: ServiqToastTone.danger);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final blockedAsync = ref.watch(blockedUsersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Blocked Users')),
      body: ServiqAsyncBody<List<BlockedUser>>(
        value: blockedAsync,
        errorTitle: 'Unable to load blocked users',
        onRetry: _refresh,
        data: (users) {
          if (users.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.shield_outlined,
                        size: 48, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                    const SizedBox(height: 12),
                    Text(
                      'No blocked users',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'When you block someone, they\'ll appear here.',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: users.length,
              separatorBuilder: (context, index) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final user = users[index];
                final blockedDate =
                    '${user.createdAt.month}/${user.createdAt.day}/${user.createdAt.year}';
                return SectionCard(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: AppColors.surfaceAlt,
                          child: Icon(Icons.person_outline,
                              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user.blockedId.length > 20
                                    ? '${user.blockedId.substring(0, 20)}...'
                                    : user.blockedId,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Blocked $blockedDate',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                              ),
                            ],
                          ),
                        ),
                        PopupMenuButton<String>(
                          onSelected: (value) {
                            if (value == 'view') {
                              context.push(AppRoutes.provider(user.blockedId));
                            } else if (value == 'unblock') {
                              _unblock(user);
                            }
                          },
                          itemBuilder: (context) => [
                            const PopupMenuItem(
                              value: 'view',
                              child: ListTile(
                                leading: Icon(Icons.person_outline),
                                title: Text('View Profile'),
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                            const PopupMenuItem(
                              value: 'unblock',
                              child: ListTile(
                                leading: Icon(Icons.person_off_outlined,
                                    color: AppColors.danger),
                                title: Text('Unblock',
                                    style: TextStyle(color: AppColors.danger)),
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
        loadingBuilder: () => const Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      ),
    );
  }
}
