import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/profile_avatar_tile.dart';
import '../../../shared/components/trust_badge.dart';
import '../data/chat_repository.dart';
import '../domain/chat_models.dart';

const _quickReplies = [
  'I can help today.',
  'Can you share the exact location?',
  'Sending a quote shortly.',
  'I am on the way.',
];

class ChatPage extends ConsumerStatefulWidget {
  const ChatPage({
    super.key,
    this.initialConversationId,
    this.recipientId,
  });

  final String? initialConversationId;
  final String? recipientId;

  @override
  ConsumerState<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends ConsumerState<ChatPage> {
  final _searchController = TextEditingController();
  final _composerController = TextEditingController();

  String? _selectedConversationId;
  bool _openingConversation = false;
  bool _sending = false;
  RealtimeChannel? _messagesChannel;
  SupabaseClient? _client;

  @override
  void initState() {
    super.initState();
    _selectedConversationId = widget.initialConversationId;
    try {
      _client = ref.read(appBootstrapProvider).client;
    } catch (_) {
      _client = null;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final selectedConversationId = _selectedConversationId;
      if (selectedConversationId != null) {
        _bindMessageStream(selectedConversationId);
        await _markConversationReadSafely(selectedConversationId);
      }
      await _ensureDirectConversationIfNeeded();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _composerController.dispose();
    if (_client != null && _messagesChannel != null) {
      _client!.removeChannel(_messagesChannel!);
    }
    super.dispose();
  }

  Future<void> _ensureDirectConversationIfNeeded() async {
    final recipientId = widget.recipientId?.trim() ?? '';
    if (recipientId.isEmpty || _selectedConversationId != null) {
      return;
    }

    setState(() => _openingConversation = true);
    try {
      final conversationId = await ref
          .read(chatRepositoryProvider)
          .ensureConversation(recipientId);
      if (!mounted) {
        return;
      }
      setState(() => _selectedConversationId = conversationId);
      ref.invalidate(chatConversationsProvider);
      _bindMessageStream(conversationId);
      await _markConversationReadSafely(conversationId);
    } catch (_) {
      if (mounted) {
        setState(() => _openingConversation = false);
      }
    } finally {
      if (mounted) {
        setState(() => _openingConversation = false);
      }
    }
  }

  void _bindMessageStream(String conversationId) {
    final client = _client;
    if (client == null) {
      return;
    }

    if (_messagesChannel != null) {
      client.removeChannel(_messagesChannel!);
    }

    _messagesChannel = client
        .channel('mobile-chat-$conversationId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: conversationId,
          ),
          callback: (_) {
            ref.invalidate(chatMessagesProvider(conversationId));
            ref.invalidate(chatConversationsProvider);
          },
        )
        .subscribe();
  }

  Future<void> _refreshConversations() async {
    ref.invalidate(chatConversationsProvider);
    await ref.read(chatConversationsProvider.future);
  }

  Future<void> _markConversationReadSafely(String conversationId) async {
    try {
      await ref.read(chatRepositoryProvider).markConversationRead(conversationId);
    } catch (_) {
      // Tests and preview states may not have a live Supabase client yet.
    }
  }

  Future<void> _sendMessage() async {
    final conversationId = _selectedConversationId;
    final content = _composerController.text.trim();
    if (conversationId == null || content.isEmpty || _sending) {
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _sending = true);
    try {
      await ref
          .read(chatRepositoryProvider)
          .sendMessage(conversationId: conversationId, content: content);
      _composerController.clear();
      ref.invalidate(chatMessagesProvider(conversationId));
      ref.invalidate(chatConversationsProvider);
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppErrorMapper.toMessage(error))),
      );
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final conversationsAsync = ref.watch(chatConversationsProvider);
    final selectedConversationId = _selectedConversationId;
    final query = _searchController.text.trim().toLowerCase();

    return Scaffold(
      appBar: AppBar(
        title: Text(selectedConversationId == null ? 'Chat' : 'Conversation'),
        leading: selectedConversationId == null
            ? null
            : IconButton(
                onPressed: () {
                  setState(() => _selectedConversationId = null);
                },
                icon: const Icon(Icons.arrow_back_rounded),
              ),
      ),
      body: selectedConversationId == null
          ? SafeArea(
              child: RefreshIndicator(
                onRefresh: _refreshConversations,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  children: [
                    AppSearchField(
                      controller: _searchController,
                      hintText: 'Search people or messages',
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 16),
                    if (_openingConversation)
                      const SectionCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            LoadingShimmer(height: 18, width: 140),
                            SizedBox(height: 10),
                            LoadingShimmer(height: 14),
                          ],
                        ),
                      ),
                    conversationsAsync.when(
                      data: (conversations) {
                        final filtered = conversations.where((conversation) {
                          if (query.isEmpty) {
                            return true;
                          }
                          final haystack =
                              '${conversation.name} ${conversation.lastMessage} ${conversation.subtitle}'
                                  .toLowerCase();
                          return haystack.contains(query);
                        }).toList();

                        if (filtered.isEmpty) {
                          return const SectionCard(
                            child: EmptyStateView(
                              title: 'No conversations yet',
                              message:
                                  'Start from provider discovery, requests, or notifications and your conversations will show up here.',
                            ),
                          );
                        }

                        final unread = filtered
                            .where((conversation) => conversation.unreadCount > 0)
                            .toList();
                        final recent = filtered
                            .where((conversation) => conversation.unreadCount == 0)
                            .toList();

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (unread.isNotEmpty)
                              _ConversationSection(
                                title: 'Unread',
                                subtitle:
                                    '${unread.length} conversation${unread.length == 1 ? '' : 's'} need attention.',
                                conversations: unread,
                                onTapConversation: _openConversation,
                              ),
                            if (recent.isNotEmpty) ...[
                              if (unread.isNotEmpty) const SizedBox(height: 16),
                              _ConversationSection(
                                title: 'Recent',
                                subtitle: 'Pick up where local conversations left off.',
                                conversations: recent,
                                onTapConversation: _openConversation,
                              ),
                            ],
                          ],
                        );
                      },
                      loading: () => const _ConversationListLoading(),
                      error: (error, _) => SectionCard(
                        child: ErrorStateView(
                          title: 'Unable to load chat',
                          message: AppErrorMapper.toMessage(error),
                          onRetry: _refreshConversations,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
          : _ChatThread(
              conversationId: selectedConversationId,
              composerController: _composerController,
              sending: _sending,
              onSend: _sendMessage,
            ),
    );
  }

  Future<void> _openConversation(ChatConversation conversation) async {
    setState(() {
      _selectedConversationId = conversation.id;
    });
    _bindMessageStream(conversation.id);
    await _markConversationReadSafely(conversation.id);
  }
}

class _ConversationSection extends StatelessWidget {
  const _ConversationSection({
    required this.title,
    required this.subtitle,
    required this.conversations,
    required this.onTapConversation,
  });

  final String title;
  final String subtitle;
  final List<ChatConversation> conversations;
  final Future<void> Function(ChatConversation conversation) onTapConversation;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 12),
        ...conversations.map(
          (conversation) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _ConversationTile(
              conversation: conversation,
              onTap: () => onTapConversation(conversation),
            ),
          ),
        ),
      ],
    );
  }
}

class _ChatThread extends ConsumerWidget {
  const _ChatThread({
    required this.conversationId,
    required this.composerController,
    required this.sending,
    required this.onSend,
  });

  final String conversationId;
  final TextEditingController composerController;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(appBootstrapProvider);
    final currentUserId = bootstrap.client?.auth.currentUser?.id ?? '';
    final conversations =
        ref.watch(chatConversationsProvider).asData?.value ?? const [];
    final conversation = conversations
        .where((item) => item.id == conversationId)
        .cast<ChatConversation?>()
        .firstOrNull;
    final messagesAsync = ref.watch(chatMessagesProvider(conversationId));

    return SafeArea(
      child: Column(
        children: [
          if (conversation != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: AppColors.border)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ProfileAvatarTile(
                    name: conversation.name,
                    subtitle: conversation.isOnline
                        ? 'Active now'
                        : conversation.subtitle,
                    avatarUrl: conversation.avatarUrl,
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      TrustBadge(
                        label: conversation.isOnline
                            ? 'Active now'
                            : 'Recently active',
                        icon: Icons.circle,
                        backgroundColor: conversation.isOnline
                            ? AppColors.primarySoft
                            : AppColors.surfaceMuted,
                        foregroundColor: conversation.isOnline
                            ? AppColors.primary
                            : AppColors.inkMuted,
                      ),
                      TrustBadge(
                        label: conversation.subtitle,
                        icon: Icons.place_outlined,
                        backgroundColor: AppColors.surfaceMuted,
                        foregroundColor: AppColors.ink,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          Expanded(
            child: messagesAsync.when(
              data: (messages) {
                if (messages.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(16),
                    child: SectionCard(
                      child: EmptyStateView(
                        title: 'No messages yet',
                        message:
                            'Send the first message to start the conversation.',
                      ),
                    ),
                  );
                }

                final lastMineIndex = messages.lastIndexWhere(
                  (message) => message.senderId == currentUserId,
                );

                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final message = messages[index];
                    final isMine = message.senderId == currentUserId;
                    return Align(
                      alignment: isMine
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 300),
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: isMine ? AppColors.ink : AppColors.surface,
                          borderRadius: BorderRadius.circular(AppRadii.md),
                          border: Border.all(
                            color: isMine ? AppColors.ink : AppColors.border,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              message.content,
                              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                color: isMine ? Colors.white : AppColors.ink,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (isMine)
                                  Icon(
                                    Icons.done_rounded,
                                    size: 14,
                                    color: Colors.white.withValues(alpha: 0.72),
                                  ),
                                if (isMine) const SizedBox(width: 4),
                                Text(
                                  _messageStatusLabel(
                                    message,
                                    isMine: isMine,
                                    isLatestMine: index == lastMineIndex,
                                  ),
                                  style: Theme.of(
                                    context,
                                  ).textTheme.bodySmall?.copyWith(
                                    color: isMine
                                        ? Colors.white70
                                        : AppColors.inkMuted,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
              loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: _MessageListLoading(),
              ),
              error: (error, _) => Padding(
                padding: const EdgeInsets.all(16),
                child: SectionCard(
                  child: ErrorStateView(
                    title: 'Unable to load messages',
                    message: AppErrorMapper.toMessage(error),
                  ),
                ),
              ),
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(
              16,
              12,
              16,
              16 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _quickReplies
                            .map(
                              (reply) => Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ActionChip(
                                  label: Text(reply),
                                  onPressed: sending
                                      ? null
                                      : () {
                                          composerController.text = reply;
                                          onSend();
                                        },
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: composerController,
                          minLines: 1,
                          maxLines: 4,
                          textInputAction: TextInputAction.send,
                          decoration: const InputDecoration(
                            hintText: 'Write a message',
                          ),
                          onSubmitted: (_) => onSend(),
                        ),
                      ),
                      const SizedBox(width: 12),
                      SizedBox(
                        width: 56,
                        height: 48,
                        child: FilledButton(
                          onPressed: sending ? null : onSend,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size(56, 48),
                            padding: EdgeInsets.zero,
                          ),
                          child: sending
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.send_rounded),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.conversation,
    required this.onTap,
  });

  final ChatConversation conversation;
  final Future<void> Function() onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.md),
      onTap: onTap,
      child: SectionCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: AppColors.surfaceMuted,
                  backgroundImage: conversation.avatarUrl.trim().isEmpty
                      ? null
                      : NetworkImage(conversation.avatarUrl),
                  child: conversation.avatarUrl.trim().isEmpty
                      ? Text(conversation.name.characters.first.toUpperCase())
                      : null,
                ),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: conversation.isOnline
                          ? AppColors.primary
                          : AppColors.border,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
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
                        ),
                      ),
                      if (conversation.lastMessageAt != null)
                        Text(
                          _relativeTime(conversation.lastMessageAt!),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    conversation.subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          conversation.lastMessage,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.ink,
                            fontWeight: conversation.unreadCount > 0
                                ? FontWeight.w700
                                : FontWeight.w500,
                          ),
                        ),
                      ),
                      if (conversation.unreadCount > 0) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.primarySoft,
                            borderRadius: BorderRadius.circular(AppRadii.md),
                          ),
                          child: Text(
                            conversation.unreadCount.toString(),
                            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConversationListLoading extends StatelessWidget {
  const _ConversationListLoading();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        4,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 18, width: 120),
                SizedBox(height: 10),
                LoadingShimmer(height: 14),
                SizedBox(height: 8),
                LoadingShimmer(height: 14, width: 200),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MessageListLoading extends StatelessWidget {
  const _MessageListLoading();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: const [
        Align(
          alignment: Alignment.centerLeft,
          child: LoadingShimmer(height: 62, width: 220),
        ),
        SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: LoadingShimmer(height: 54, width: 180),
        ),
        SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: LoadingShimmer(height: 68, width: 240),
        ),
      ],
    );
  }
}

String _messageStatusLabel(
  ChatMessageItem message, {
  required bool isMine,
  required bool isLatestMine,
}) {
  final time = _relativeTime(message.createdAt);
  if (isMine) {
    return isLatestMine ? 'Sent $time' : 'Sent $time';
  }
  return 'Received $time';
}

String _relativeTime(DateTime value) {
  final diff = DateTime.now().difference(value.toLocal());
  if (diff.inMinutes < 1) {
    return 'just now';
  }
  if (diff.inHours < 1) {
    return '${diff.inMinutes}m ago';
  }
  if (diff.inDays < 1) {
    return '${diff.inHours}h ago';
  }
  return '${diff.inDays}d ago';
}
