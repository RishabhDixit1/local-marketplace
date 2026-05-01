import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/constants/app_routes.dart';
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

class ChatPage extends ConsumerStatefulWidget {
  const ChatPage({
    super.key,
    this.initialConversationId,
    this.recipientId,
    this.initialDraft,
    this.contextTitle,
    this.contextTaskId,
    this.contextStatus,
    this.contextSource,
  });

  final String? initialConversationId;
  final String? recipientId;
  final String? initialDraft;
  final String? contextTitle;
  final String? contextTaskId;
  final String? contextStatus;
  final String? contextSource;

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
    final initialDraft = widget.initialDraft?.trim() ?? '';
    if (initialDraft.isNotEmpty) {
      _composerController.value = TextEditingValue(
        text: initialDraft,
        selection: TextSelection.collapsed(offset: initialDraft.length),
      );
    }
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
      await ref
          .read(chatRepositoryProvider)
          .markConversationRead(conversationId);
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(AppErrorMapper.toMessage(error))));
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  bool get _openedFromRouteContext {
    return (widget.initialConversationId?.trim().isNotEmpty ?? false) ||
        (widget.recipientId?.trim().isNotEmpty ?? false);
  }

  void _handleThreadBack() {
    if (_openedFromRouteContext) {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go(AppRoutes.chat);
      }
      return;
    }

    setState(() => _selectedConversationId = null);
  }

  @override
  Widget build(BuildContext context) {
    final conversationsAsync = ref.watch(chatConversationsProvider);
    final selectedConversationId = _selectedConversationId;
    final query = _searchController.text.trim().toLowerCase();

    final body = selectedConversationId == null
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
                        return SectionCard(
                          child: EmptyStateView(
                            title: query.isEmpty
                                ? 'No conversations yet'
                                : 'No conversations match',
                            message: query.isEmpty
                                ? 'Post a need or message a provider. Replies, quotes, and timing follow-up will collect here.'
                                : 'Try a broader search term or clear the field to see recent local follow-up.',
                            actionLabel: query.isEmpty ? 'Post a Need' : null,
                            onAction: query.isEmpty
                                ? () => context.push(AppRoutes.createNeed)
                                : null,
                          ),
                        );
                      }

                      final unread = filtered
                          .where((conversation) => conversation.unreadCount > 0)
                          .toList();
                      final recent = filtered
                          .where(
                            (conversation) => conversation.unreadCount == 0,
                          )
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
                              subtitle:
                                  'Pick up where local conversations left off.',
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
            contextTitle: widget.contextTitle,
            contextTaskId: widget.contextTaskId,
            contextStatus: widget.contextStatus,
            contextSource: widget.contextSource,
            onSend: _sendMessage,
          );

    return Scaffold(
      appBar: AppBar(
        title: Text(selectedConversationId == null ? 'Chat' : 'Conversation'),
        leading: selectedConversationId == null
            ? null
            : IconButton(
                onPressed: _handleThreadBack,
                icon: const Icon(Icons.arrow_back_rounded),
              ),
      ),
      body: PopScope(
        canPop: selectedConversationId == null || _openedFromRouteContext,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop || _selectedConversationId == null) {
            return;
          }
          setState(() => _selectedConversationId = null);
        },
        child: body,
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

List<String> _quickRepliesFor({
  required String? contextTitle,
  required String? contextStatus,
}) {
  final rawTitle = contextTitle?.trim() ?? '';
  final normalizedStatus = (contextStatus ?? '').trim().toLowerCase();
  if (normalizedStatus.contains('progress') ||
      normalizedStatus.contains('accepted') ||
      normalizedStatus.contains('travel') ||
      normalizedStatus.contains('work')) {
    return const [
      'I will update the task status now.',
      'Can you confirm the current timing?',
      'I am on the way.',
      'Work has started.',
    ];
  }

  if (normalizedStatus.contains('complete') ||
      normalizedStatus.contains('closed')) {
    return const [
      'Thanks, this is complete.',
      'Can you share any final notes?',
      'I will keep the receipt here.',
      'Happy to help again.',
    ];
  }

  if (rawTitle.isEmpty) {
    return const [
      'I can help today.',
      'Can you share the exact location?',
      'Can we confirm timing first?',
      'I will send a quote shortly.',
    ];
  }

  final title = rawTitle.length > 34
      ? '${rawTitle.substring(0, 31)}...'
      : rawTitle;
  return [
    'I can help with "$title".',
    'Can you share timing and access details?',
    'I will send a quote shortly.',
    'Let us confirm the next step before sharing contact details.',
  ];
}

class _ChatRequestContext {
  const _ChatRequestContext({
    required this.title,
    required this.taskId,
    required this.status,
    required this.source,
  });

  final String? title;
  final String? taskId;
  final String? status;
  final String? source;

  String get titleText => title?.trim() ?? '';
  String get taskIdText => taskId?.trim() ?? '';
  String get statusText => status?.trim() ?? '';
  String get sourceText => source?.trim() ?? '';

  bool get visible =>
      titleText.isNotEmpty ||
      taskIdText.isNotEmpty ||
      statusText.isNotEmpty ||
      sourceText.isNotEmpty;

  String get sourceLabel {
    switch (sourceText) {
      case 'notification':
        return 'From notification';
      case 'feed_card':
      case 'home_feed_card':
        return 'From request card';
      case 'search_result':
        return 'From search';
      case 'provider_profile_card':
        return 'From profile card';
      default:
        return 'Request context';
    }
  }
}

class _RequestContextCard extends StatelessWidget {
  const _RequestContextCard({required this.contextData});

  final _ChatRequestContext contextData;

  @override
  Widget build(BuildContext context) {
    final title = contextData.titleText.isEmpty
        ? 'Local request follow-up'
        : contextData.titleText;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.assignment_outlined,
              size: 18,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  contextData.sourceLabel,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(color: AppColors.primary),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  'Confirm scope, timing, and the next task update before moving off-platform.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.primaryDeep),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    TrustBadge(
                      label: contextData.statusText.isEmpty
                          ? 'Status in Tasks'
                          : contextData.statusText,
                      icon: Icons.flag_outlined,
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.primary,
                    ),
                    if (contextData.taskIdText.isNotEmpty)
                      TrustBadge(
                        label: 'Task linked',
                        icon: Icons.link_rounded,
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.ink,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ThreadEmptyState extends StatelessWidget {
  const _ThreadEmptyState({required this.contextData});

  final _ChatRequestContext contextData;

  @override
  Widget build(BuildContext context) {
    final hasContext = contextData.visible;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EmptyStateView(
            icon: Icons.chat_bubble_outline_rounded,
            title: 'No messages in this thread yet',
            message: hasContext
                ? 'Start with timing, access, and scope so this request stays easy to track in Tasks.'
                : 'Send the first message to confirm timing, scope, or pricing before sharing sensitive details.',
          ),
          const SizedBox(height: 14),
          _SafetyNote(
            icon: Icons.rule_rounded,
            text:
                'Keep quotes, timing changes, and acceptance decisions in this thread.',
          ),
          const SizedBox(height: 8),
          _SafetyNote(
            icon: Icons.assignment_turned_in_outlined,
            text:
                'Use Tasks for live status after a provider accepts the work.',
          ),
        ],
      ),
    );
  }
}

class _SafetyNote extends StatelessWidget {
  const _SafetyNote({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppColors.inkMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text, style: Theme.of(context).textTheme.bodySmall),
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
    required this.contextTitle,
    required this.contextTaskId,
    required this.contextStatus,
    required this.contextSource,
    required this.onSend,
  });

  final String conversationId;
  final TextEditingController composerController;
  final bool sending;
  final String? contextTitle;
  final String? contextTaskId;
  final String? contextStatus;
  final String? contextSource;
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
    final requestContext = _ChatRequestContext(
      title: contextTitle,
      taskId: contextTaskId,
      status: contextStatus,
      source: contextSource,
    );
    final hasMessages = messagesAsync.asData?.value.isNotEmpty ?? false;

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
          if (requestContext.visible)
            _RequestContextCard(contextData: requestContext),
          if (requestContext.taskIdText.isNotEmpty)
            _DealRoomShortcut(
              contextData: requestContext,
              conversationId: conversationId,
            ),
          Expanded(
            child: messagesAsync.when(
              data: (messages) {
                if (messages.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(16),
                    child: _ThreadEmptyState(contextData: requestContext),
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
                              style: Theme.of(context).textTheme.bodyLarge
                                  ?.copyWith(
                                    color: isMine
                                        ? Colors.white
                                        : AppColors.ink,
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
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (!hasMessages)
                          Text(
                            'Suggested first replies',
                            style: Theme.of(context).textTheme.labelLarge,
                          )
                        else
                          Text(
                            'Quick replies',
                            style: Theme.of(context).textTheme.labelLarge,
                          ),
                        const SizedBox(height: 8),
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children:
                                _quickRepliesFor(
                                      contextTitle: contextTitle,
                                      contextStatus: contextStatus,
                                    )
                                    .map(
                                      (reply) => Padding(
                                        padding: const EdgeInsets.only(
                                          right: 8,
                                        ),
                                        child: ActionChip(
                                          label: Text(reply),
                                          onPressed: sending
                                              ? null
                                              : () {
                                                  composerController
                                                      .value = TextEditingValue(
                                                    text: reply,
                                                    selection:
                                                        TextSelection.collapsed(
                                                          offset: reply.length,
                                                        ),
                                                  );
                                                },
                                        ),
                                      ),
                                    )
                                    .toList(),
                          ),
                        ),
                      ],
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
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
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

class _DealRoomShortcut extends StatelessWidget {
  const _DealRoomShortcut({
    required this.contextData,
    required this.conversationId,
  });

  final _ChatRequestContext contextData;
  final String conversationId;

  @override
  Widget build(BuildContext context) {
    final mode = contextData.sourceText.contains('order')
        ? 'order'
        : 'help_request';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Quote and acceptance',
              style: Theme.of(context).textTheme.labelLarge,
            ),
          ),
          OutlinedButton.icon(
            onPressed: () => context.push(
              AppRoutes.quoteRoom(
                mode: mode,
                targetId: contextData.taskIdText,
                conversationId: conversationId,
              ),
            ),
            icon: const Icon(Icons.request_quote_outlined),
            label: const Text('Deal room'),
          ),
        ],
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.conversation, required this.onTap});

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
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
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
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(color: AppColors.primary),
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
