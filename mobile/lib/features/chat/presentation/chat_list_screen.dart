import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../../../shared/widgets/section_header.dart';
import '../data/chat_hub_repository.dart';
import 'chat_widgets.dart';

class ChatListScreen extends ConsumerStatefulWidget {
  const ChatListScreen({super.key});

  @override
  ConsumerState<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends ConsumerState<ChatListScreen> {
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsServiceProvider).trackScreen('chat_list_screen');
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(chatThreadsProvider);
    await ref.read(chatThreadsProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    final threadsAsync = ref.watch(chatThreadsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Chat')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.pageInset,
              AppSpacing.sm,
              AppSpacing.pageInset,
              120,
            ),
            children: [
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Fast coordination, low clutter',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Task-linked conversations, safety context, and meaningful unread state.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: _searchController,
                      decoration: const InputDecoration(
                        hintText: 'Search people or messages',
                        prefixIcon: Icon(Icons.search_rounded),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              threadsAsync.when(
                data: (threads) {
                  final query = _searchController.text.trim().toLowerCase();
                  final filtered = threads.where((thread) {
                    if (query.isEmpty) {
                      return true;
                    }
                    return '${thread.counterpartName} ${thread.subtitle} ${thread.lastMessagePreview}'
                        .toLowerCase()
                        .contains(query);
                  }).toList();
                  final pinned = filtered.where((item) => item.pinned).toList();
                  final rest = filtered.where((item) => !item.pinned).toList();

                  if (filtered.isEmpty) {
                    return const AppEmptyState(
                      title: 'No conversations yet',
                      message:
                          'Chat opens naturally from people, tasks, and notifications once real coordination begins.',
                    );
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (pinned.isNotEmpty) ...[
                        const AppSectionHeader(
                          title: 'Pinned',
                          subtitle:
                              'High-priority threads you do not want buried.',
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        ...pinned.map(
                          (thread) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: ChatThreadTile(
                              thread: thread,
                              onPin: () async {
                                await ref
                                    .read(chatHubRepositoryProvider)
                                    .togglePin(thread.id);
                                ref.invalidate(chatThreadsProvider);
                              },
                            ),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                      ],
                      const AppSectionHeader(
                        title: 'All threads',
                        subtitle:
                            'Ranked by pin state, unread urgency, and freshest activity.',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      ...rest.map(
                        (thread) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.md),
                          child: ChatThreadTile(
                            thread: thread,
                            onPin: () async {
                              await ref
                                  .read(chatHubRepositoryProvider)
                                  .togglePin(thread.id);
                              ref.invalidate(chatThreadsProvider);
                            },
                          ),
                        ),
                      ),
                    ],
                  );
                },
                loading: () => const CardListSkeleton(count: 4),
                error: (error, _) => AppErrorState(
                  title: 'Chat is unavailable',
                  message: AppErrorMapper.toMessage(error),
                  onRetry: _refresh,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
