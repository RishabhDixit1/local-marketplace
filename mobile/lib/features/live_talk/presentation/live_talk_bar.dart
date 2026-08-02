import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/theme/design_tokens.dart';
import '../data/live_talk_repository.dart';
import '../domain/live_talk_models.dart';
import 'live_talk_call_screen.dart';

class LiveTalkBar extends ConsumerStatefulWidget {
  const LiveTalkBar({
    super.key,
    required this.conversationId,
    required this.otherUserId,
  });

  final String conversationId;
  final String otherUserId;

  @override
  ConsumerState<LiveTalkBar> createState() => _LiveTalkBarState();
}

class _LiveTalkBarState extends ConsumerState<LiveTalkBar> {
  LiveTalkRequest? _request;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadRequest();
    _subscribe();
  }

  Future<void> _loadRequest() async {
    setState(() => _loading = true);
    try {
      final request = await ref.read(liveTalkRepositoryProvider).fetchRequest(widget.conversationId);
      if (mounted) setState(() => _request = request);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _subscribe() {
    final bootstrap = ref.read(appBootstrapProvider);
    final client = bootstrap.client;
    if (client == null) return;

    client
        .channel('live-talk-${widget.conversationId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'live_talk_requests',
          filter: PostgresChangeFilter(
            column: 'conversation_id',
            type: PostgresChangeFilterType.eq,
            value: widget.conversationId,
          ),
          callback: (_) {
            _loadRequest();
          },
        )
        .subscribe();
  }

  @override
  void dispose() {
    final bootstrap = ref.read(appBootstrapProvider);
    final channel = bootstrap.client?.channel('live-talk-${widget.conversationId}');
    if (channel != null) {
      bootstrap.client?.removeChannel(channel);
    }
    super.dispose();
  }

  Future<void> _startCall() async {
    try {
      final request = await ref.read(liveTalkRepositoryProvider).createRequest(
        widget.conversationId,
        widget.otherUserId,
      );
      if (mounted) setState(() => _request = request);
    } on ApiException catch (e) {
      if (mounted) ServiqToast.show(context, message: e.message, tone: ServiqToastTone.danger);
    } catch (_) {
      if (mounted) ServiqToast.show(context, message: 'Failed to start call.', tone: ServiqToastTone.danger);
    }
  }

  Future<void> _acceptCall() async {
    if (_request == null) return;
    try {
      await ref.read(liveTalkRepositoryProvider).updateRequestStatus(_request!.id, 'accepted');
      if (mounted) {
        setState(() => _request = LiveTalkRequest(
          id: _request!.id,
          conversationId: _request!.conversationId,
          callerId: _request!.callerId,
          recipientId: _request!.recipientId,
          status: LiveTalkRequestStatus.accepted,
          createdAt: _request!.createdAt,
          respondedAt: _request!.respondedAt,
        ));
      }
    } on ApiException catch (e) {
      if (mounted) ServiqToast.show(context, message: e.message, tone: ServiqToastTone.danger);
    } catch (_) {
      if (mounted) ServiqToast.show(context, message: 'Failed to accept call.', tone: ServiqToastTone.danger);
    }
  }

  Future<void> _declineCall() async {
    if (_request == null) return;
    try {
      await ref.read(liveTalkRepositoryProvider).updateRequestStatus(_request!.id, 'declined');
      if (mounted) setState(() => _request = null);
    } catch (_) {}
  }

  Future<void> _endCall() async {
    if (_request == null) return;
    try {
      await ref.read(liveTalkRepositoryProvider).updateRequestStatus(_request!.id, 'ended');
      if (mounted) setState(() => _request = null);
    } catch (_) {}
  }

  void _openCallScreen() {
    if (_request == null || _request!.status != LiveTalkRequestStatus.accepted) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => LiveTalkCallScreen(
          conversationId: widget.conversationId,
          otherUserId: widget.otherUserId,
          request: _request!,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();
    if (_request == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
        child: OutlinedButton.icon(
          onPressed: _startCall,
          icon: const Icon(Icons.video_call_rounded, size: 18),
          label: const Text('Start Live Talk'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.whatsapp,
            side: const BorderSide(color: AppColors.whatsapp),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadii.lg),
            ),
          ),
        ),
      );
    }

    final request = _request!;
    final isPending = request.status == LiveTalkRequestStatus.pending;
    final isAccepted = request.status == LiveTalkRequestStatus.accepted;

    if (isPending) {
      if (_isCaller(request)) {
        return _StatusCard(
          icon: Icons.video_call_rounded,
          label: 'Calling...',
          subtitle: 'Waiting for the other user to accept',
          action: OutlinedButton(
            onPressed: () {
              ref.read(liveTalkRepositoryProvider).updateRequestStatus(request.id, 'cancelled');
              setState(() => _request = null);
            },
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger),
            ),
            child: const Text('Cancel'),
          ),
        );
      }
      return _StatusCard(
        icon: Icons.video_call_rounded,
        label: 'Incoming Live Talk',
        subtitle: 'Incoming call...',
        action: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            FilledButton(
              onPressed: _acceptCall,
              style: FilledButton.styleFrom(backgroundColor: AppColors.success),
              child: const Text('Accept'),
            ),
            const SizedBox(width: AppSpacing.sm),
            OutlinedButton(
              onPressed: _declineCall,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.danger,
                side: const BorderSide(color: AppColors.danger),
              ),
              child: const Text('Decline'),
            ),
          ],
        ),
      );
    }

    if (isAccepted) {
      return _StatusCard(
        icon: Icons.video_call_rounded,
        label: 'Live Talk in progress',
        subtitle: 'Tap to rejoin the call',
        action: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            FilledButton.icon(
              onPressed: _openCallScreen,
              icon: const Icon(Icons.call_rounded, size: 16),
              label: const Text('Join'),
              style: FilledButton.styleFrom(backgroundColor: AppColors.success),
            ),
            const SizedBox(width: AppSpacing.sm),
            OutlinedButton(
              onPressed: _endCall,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.danger,
                side: const BorderSide(color: AppColors.danger),
              ),
              child: const Text('End'),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }

  bool _isCaller(LiveTalkRequest request) {
    final bootstrap = ref.read(appBootstrapProvider);
    final currentUserId = bootstrap.client?.auth.currentUser?.id ?? '';
    return request.callerId == currentUserId;
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.action,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final Widget action;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.sageSoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: AppColors.sage.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.sageDeep, size: 24),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                Text(subtitle, style: TextStyle(fontSize: 11, color: AppColors.sageDeep)),
              ],
            ),
          ),
          action,
        ],
      ),
    );
  }
}
