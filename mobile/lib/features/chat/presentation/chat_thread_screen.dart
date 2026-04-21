import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../data/chat_hub_repository.dart';
import 'chat_widgets.dart';

class ChatThreadScreen extends ConsumerStatefulWidget {
  const ChatThreadScreen({super.key, required this.threadId});

  final String threadId;

  @override
  ConsumerState<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends ConsumerState<ChatThreadScreen> {
  final _composerController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      ref
          .read(analyticsServiceProvider)
          .trackScreen(
            'chat_thread_screen',
            extras: {'thread_id': widget.threadId},
          );
      await ref.read(chatHubRepositoryProvider).markRead(widget.threadId);
      ref.invalidate(chatThreadsProvider);
    });
  }

  @override
  void dispose() {
    _composerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final threadAsync = ref.watch(chatThreadsProvider);
    final messagesAsync = ref.watch(chatMessagesProvider(widget.threadId));

    return Scaffold(
      appBar: AppBar(title: const Text('Conversation')),
      body: SafeArea(
        child: threadAsync.when(
          data: (threads) {
            final thread = threads.firstWhere(
              (item) => item.id == widget.threadId,
            );
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.pageInset,
                    AppSpacing.sm,
                    AppSpacing.pageInset,
                    0,
                  ),
                  child: TaskContextBanner(
                    taskId: thread.linkedTaskId,
                    safetyLabel: thread.safetyLabel,
                  ),
                ),
                Expanded(
                  child: messagesAsync.when(
                    data: (messages) => ListView(
                      padding: const EdgeInsets.all(AppSpacing.pageInset),
                      children: messages
                          .map((message) => MessageBubble(message: message))
                          .toList(),
                    ),
                    loading: () => const Padding(
                      padding: EdgeInsets.all(AppSpacing.pageInset),
                      child: CardListSkeleton(count: 2),
                    ),
                    error: (error, _) => Padding(
                      padding: const EdgeInsets.all(AppSpacing.pageInset),
                      child: AppErrorState(
                        title: 'Messages unavailable',
                        message: AppErrorMapper.toMessage(error),
                      ),
                    ),
                  ),
                ),
                Container(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.pageInset,
                    AppSpacing.sm,
                    AppSpacing.pageInset,
                    AppSpacing.sm + MediaQuery.viewInsetsOf(context).bottom,
                  ),
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    border: Border(top: BorderSide(color: AppColors.border)),
                  ),
                  child: SafeArea(
                    top: false,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Wrap(
                            spacing: AppSpacing.xs,
                            runSpacing: AppSpacing.xs,
                            children:
                                const [
                                      'On my way',
                                      'Can you share your exact location?',
                                      'I will update the task now',
                                    ]
                                    .map(
                                      (text) => ActionChip(
                                        label: Text(text),
                                        onPressed: () {
                                          _composerController.text = text;
                                        },
                                      ),
                                    )
                                    .toList(),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _composerController,
                                minLines: 1,
                                maxLines: 4,
                                decoration: const InputDecoration(
                                  hintText: 'Write a message',
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            FilledButton(
                              onPressed: () async {
                                final text = _composerController.text.trim();
                                if (text.isEmpty) {
                                  return;
                                }
                                await ref
                                    .read(chatHubRepositoryProvider)
                                    .sendMessage(widget.threadId, text);
                                _composerController.clear();
                                ref.invalidate(
                                  chatMessagesProvider(widget.threadId),
                                );
                                ref.invalidate(chatThreadsProvider);
                              },
                              child: const Icon(Icons.send_rounded),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
          loading: () => const Padding(
            padding: EdgeInsets.all(AppSpacing.pageInset),
            child: CardListSkeleton(count: 2),
          ),
          error: (error, _) => Padding(
            padding: const EdgeInsets.all(AppSpacing.pageInset),
            child: AppErrorState(
              title: 'Conversation unavailable',
              message: AppErrorMapper.toMessage(error),
            ),
          ),
        ),
      ),
    );
  }
}
