import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/auth/auth_state_controller.dart';
import '../../../core/widgets/section_card.dart';
import '../data/chat_repository.dart';
import '../domain/chat_models.dart';

class InboxPage extends ConsumerStatefulWidget {
  const InboxPage({super.key});

  @override
  ConsumerState<InboxPage> createState() => _InboxPageState();
}

class _InboxPageState extends ConsumerState<InboxPage> {
  RealtimeChannel? _participantsChannel;
  RealtimeChannel? _messagesChannel;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _bindRealtimeChannels();
    });
  }

  @override
  void dispose() {
    _disposeRealtimeChannels();
    super.dispose();
  }

  Future<void> _bindRealtimeChannels() async {
    _disposeRealtimeChannels();

    final session = ref.read(currentSessionProvider).asData?.value;
    final userId = session?.user.id ?? '';
    final client = Supabase.instance.client;
    if (userId.isEmpty) {
      return;
    }

    _participantsChannel = client
        .channel('mobile-chat-participants-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'conversation_participants',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (_) {
            ref.invalidate(conversationListProvider);
          },
        )
        .subscribe();

    _messagesChannel = client
        .channel('mobile-chat-messages-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'messages',
          callback: (_) {
            ref.invalidate(conversationListProvider);
          },
        )
        .subscribe();
  }

  void _disposeRealtimeChannels() {
    final client = Supabase.instance.client;
    if (_participantsChannel != null) {
      unawaited(client.removeChannel(_participantsChannel!));
      _participantsChannel = null;
    }
    if (_messagesChannel != null) {
      unawaited(client.removeChannel(_messagesChannel!));
      _messagesChannel = null;
    }
  }

  Future<void> _refresh() async {
    ref.invalidate(conversationListProvider);
    await ref.read(conversationListProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    final conversations = ref.watch(conversationListProvider);
    final user = ref.watch(currentSessionProvider).asData?.value?.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Inbox')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              Text(
                'Fast replies keep tasks moving.',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 10),
              Text(
                'Your direct conversations, quote follow-up, and realtime replies for ${user?.email ?? 'this account'} all live here.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 16),
              conversations.when(
                data: (items) {
                  if (items.isEmpty) {
                    return const SectionCard(child: _EmptyInboxState());
                  }

                  return Column(
                    children: items
                        .map(
                          (conversation) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _ConversationCard(
                              conversation: conversation,
                              onTap: () =>
                                  context.push('/app/inbox/${conversation.id}'),
                            ),
                          ),
                        )
                        .toList(),
                  );
                },
                loading: () => const SectionCard(child: _InboxLoadingState()),
                error: (error, _) => SectionCard(
                  child: _InboxErrorState(error: error.toString()),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ChatThreadPage extends ConsumerStatefulWidget {
  const ChatThreadPage({required this.conversationId, super.key});

  final String conversationId;

  @override
  ConsumerState<ChatThreadPage> createState() => _ChatThreadPageState();
}

class _ChatThreadPageState extends ConsumerState<ChatThreadPage> {
  final TextEditingController _composerController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  RealtimeChannel? _messageChannel;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _bindMessageChannel();
      await _markConversationRead();
    });
  }

  @override
  void dispose() {
    _composerController.dispose();
    _scrollController.dispose();
    _disposeMessageChannel();
    super.dispose();
  }

  Future<void> _bindMessageChannel() async {
    _disposeMessageChannel();
    final client = Supabase.instance.client;
    _messageChannel = client
        .channel('mobile-thread-${widget.conversationId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: widget.conversationId,
          ),
          callback: (_) async {
            ref.invalidate(conversationMessagesProvider(widget.conversationId));
            ref.invalidate(conversationListProvider);
            await _markConversationRead();
          },
        )
        .subscribe();
  }

  void _disposeMessageChannel() {
    final client = Supabase.instance.client;
    if (_messageChannel != null) {
      unawaited(client.removeChannel(_messageChannel!));
      _messageChannel = null;
    }
  }

  Future<void> _markConversationRead() async {
    try {
      await ref
          .read(chatRepositoryProvider)
          .markConversationRead(widget.conversationId);
      ref.invalidate(conversationListProvider);
    } catch (_) {
      // Keep the thread usable even if read receipts are unavailable.
    }
  }

  Future<void> _sendMessage() async {
    final content = _composerController.text.trim();
    if (content.isEmpty || _sending) {
      return;
    }

    setState(() {
      _sending = true;
    });

    try {
      await ref
          .read(chatRepositoryProvider)
          .sendMessage(conversationId: widget.conversationId, content: content);
      _composerController.clear();
      ref.invalidate(conversationMessagesProvider(widget.conversationId));
      ref.invalidate(conversationListProvider);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final conversations = ref.watch(conversationListProvider);
    final messages = ref.watch(
      conversationMessagesProvider(widget.conversationId),
    );
    final currentUserId =
        ref.watch(currentSessionProvider).asData?.value?.user.id ?? '';

    final conversation = conversations.asData?.value.firstWhere(
      (entry) => entry.id == widget.conversationId,
      orElse: () => MobileConversationSummary(
        id: widget.conversationId,
        name: 'Conversation',
        avatarUrl: '',
        otherUserId: null,
        lastMessage: '',
        lastMessageAt: null,
        unreadCount: 0,
      ),
    );

    return Scaffold(
      appBar: AppBar(title: Text(conversation?.name ?? 'Conversation')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: messages.when(
                data: (items) {
                  if (items.isEmpty) {
                    return const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'No messages yet. Start the conversation below.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    );
                  }

                  return ListView.builder(
                    controller: _scrollController,
                    reverse: true,
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final message = items[items.length - 1 - index];
                      final isMine = message.senderId == currentUserId;
                      return _MessageBubble(message: message, isMine: isMine);
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(error.toString(), textAlign: TextAlign.center),
                  ),
                ),
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _composerController,
                        minLines: 1,
                        maxLines: 4,
                        textInputAction: TextInputAction.send,
                        decoration: const InputDecoration(
                          hintText: 'Send a message',
                        ),
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                    const SizedBox(width: 12),
                    FilledButton(
                      onPressed: _sending ? null : _sendMessage,
                      child: _sending
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send_rounded),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConversationCard extends StatelessWidget {
  const _ConversationCard({required this.conversation, required this.onTap});

  final MobileConversationSummary conversation;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final initials = conversation.name.isEmpty
        ? 'S'
        : conversation.name
              .trim()
              .split(RegExp(r'\s+'))
              .take(2)
              .map((part) => part.isEmpty ? '' : part[0].toUpperCase())
              .join();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: onTap,
        child: SectionCard(
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: const Color(0xFFE0F2FE),
                child: Text(
                  initials,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            conversation.name,
                            style: Theme.of(context).textTheme.titleMedium,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          conversation.timeLabel,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      conversation.lastMessage,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              if (conversation.unreadCount > 0) ...[
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0B1F33),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    conversation.unreadCount > 9
                        ? '9+'
                        : conversation.unreadCount.toString(),
                    style: Theme.of(
                      context,
                    ).textTheme.labelLarge?.copyWith(color: Colors.white),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.isMine});

  final MobileChatMessage message;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final alignment = isMine ? Alignment.centerRight : Alignment.centerLeft;
    final background = isMine ? const Color(0xFF0B1F33) : Colors.white;
    final foreground = isMine ? Colors.white : const Color(0xFF0F172A);

    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 320),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: isMine ? const Color(0xFF0B1F33) : const Color(0xFFE2E8F0),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                message.content,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: foreground),
              ),
              const SizedBox(height: 8),
              Text(
                message.timeLabel,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: foreground.withValues(alpha: 0.72),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyInboxState extends StatelessWidget {
  const _EmptyInboxState();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'No conversations yet',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Text(
          'When you start chatting with nearby providers or requesters, those conversations will appear here in realtime.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}

class _InboxLoadingState extends StatelessWidget {
  const _InboxLoadingState();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 180,
      child: Center(child: CircularProgressIndicator()),
    );
  }
}

class _InboxErrorState extends StatelessWidget {
  const _InboxErrorState({required this.error});

  final String error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Inbox unavailable',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Text(error, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}
