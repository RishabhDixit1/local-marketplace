import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/theme/design_tokens.dart';
import '../data/live_talk_repository.dart';
import '../domain/live_talk_models.dart';
import '../domain/live_talk_signaling.dart';

class LiveTalkCallScreen extends ConsumerStatefulWidget {
  const LiveTalkCallScreen({
    super.key,
    required this.conversationId,
    required this.otherUserId,
    required this.request,
  });

  final String conversationId;
  final String otherUserId;
  final LiveTalkRequest request;

  @override
  ConsumerState<LiveTalkCallScreen> createState() => _LiveTalkCallScreenState();
}

class _LiveTalkCallScreenState extends ConsumerState<LiveTalkCallScreen> {
  LiveTalkSignaling? _signaling;
  RealtimeChannel? _signalChannel;
  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();
  bool _connecting = true;
  bool _muted = false;
  bool _videoOff = false;
  bool _remoteStreamReady = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initRenderers();
  }

  Future<void> _initRenderers() async {
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();
    _startCall();
  }

  Future<void> _startCall() async {
    final bootstrap = ref.read(appBootstrapProvider);
    final currentUserId = bootstrap.client?.auth.currentUser?.id ?? '';
    if (currentUserId.isEmpty) {
      setState(() {
        _error = 'Not authenticated';
        _connecting = false;
      });
      return;
    }

    final realtimeClient = bootstrap.client?.realtime;
    if (realtimeClient == null) {
      setState(() {
        _error = 'Realtime not available';
        _connecting = false;
      });
      return;
    }

    final signaling = LiveTalkSignaling(
      conversationId: widget.conversationId,
      currentUserId: currentUserId,
      otherUserId: widget.otherUserId,
    );
    _signaling = signaling;

    signaling.stateStream.listen((state) {
      if (!mounted) return;
      setState(() {
        switch (state) {
          case LiveTalkSignalingState.connected:
            _connecting = false;
          case LiveTalkSignalingState.disconnected:
            _error = 'Call disconnected.';
          default:
            break;
        }
      });
    });

    signaling.remoteStreamStream.listen((stream) {
      if (!mounted) return;
      _remoteRenderer.srcObject = stream;
      setState(() => _remoteStreamReady = true);
    });

    try {
      final localStream = await signaling.startLocalStream();
      _localRenderer.srcObject = localStream;
      await signaling.connect();
      if (mounted) setState(() => _connecting = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _connecting = false;
        });
        return;
      }
    }

    final channel = realtimeClient.channel('webrtc-${widget.conversationId}');
    _signalChannel = channel;

    channel
      ..onBroadcast(event: 'webrtc_offer', callback: (payload) {
        final senderId = payload['senderId'] as String?;
        if (senderId == currentUserId) return;
        final sdp = payload['sdp'] as Map<String, dynamic>?;
        if (sdp == null) return;
        signaling.handleOffer(sdp);
      })
      ..onBroadcast(event: 'webrtc_answer', callback: (payload) {
        final senderId = payload['senderId'] as String?;
        if (senderId == currentUserId) return;
        final sdp = payload['sdp'] as Map<String, dynamic>?;
        if (sdp == null) return;
        signaling.handleAnswer(sdp);
      })
      ..onBroadcast(event: 'webrtc_ice', callback: (payload) {
        final senderId = payload['senderId'] as String?;
        if (senderId == currentUserId) return;
        final candidate = payload['candidate'] as Map<String, dynamic>?;
        if (candidate == null) return;
        signaling.handleIceCandidate(candidate);
      })
      ..subscribe((status, _) {
        if (status == RealtimeSubscribeStatus.subscribed) {
          if (currentUserId.compareTo(widget.otherUserId) > 0) {
            signaling.makeOffer();
          }
        }
      });

    signaling.onOutgoingOffer = (sdp) {
      channel.sendBroadcastMessage(
        event: 'webrtc_offer',
        payload: {'sdp': sdp, 'senderId': currentUserId},
      );
    };
    signaling.onOutgoingAnswer = (sdp) {
      channel.sendBroadcastMessage(
        event: 'webrtc_answer',
        payload: {'sdp': sdp, 'senderId': currentUserId},
      );
    };
    signaling.onOutgoingIceCandidate = (candidate) {
      channel.sendBroadcastMessage(
        event: 'webrtc_ice',
        payload: {'candidate': candidate, 'senderId': currentUserId},
      );
    };
  }

  void _toggleMute() async {
    await _signaling?.toggleMute();
    setState(() => _muted = !_muted);
  }

  void _toggleVideo() async {
    await _signaling?.toggleVideo();
    setState(() => _videoOff = !_videoOff);
  }

  Future<void> _endCall() async {
    try {
      await ref.read(liveTalkRepositoryProvider).updateRequestStatus(
        widget.request.id,
        'ended',
      );
    } catch (_) {}
    _signalChannel?.unsubscribe();
    await _signaling?.dispose();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _signalChannel?.unsubscribe();
    _signaling?.dispose();
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return _ErrorOverlay(
        message: _error!,
        onClose: () {
          _signalChannel?.unsubscribe();
          _signaling?.dispose();
          Navigator.of(context).pop();
        },
      );
    }

    if (_connecting) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 48,
                height: 48,
                child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white54),
              ),
              SizedBox(height: AppSpacing.md),
              Text(
                'Connecting...',
                style: TextStyle(color: Colors.white70, fontSize: 16),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Positioned.fill(
            child: _remoteStreamReady
                ? RTCVideoView(
                    _remoteRenderer,
                    objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                  )
                : const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.person_rounded, size: 80, color: Colors.white24),
                        SizedBox(height: AppSpacing.md),
                        Text(
                          'Waiting for other user...',
                          style: TextStyle(color: Colors.white70, fontSize: 16),
                        ),
                        SizedBox(height: AppSpacing.sm),
                        SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white38),
                        ),
                      ],
                    ),
                  ),
          ),
          Positioned(
            right: 16,
            top: MediaQuery.of(context).padding.top + 16,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.xl),
              child: Container(
                width: 80,
                height: 112,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white30, width: 2),
                  borderRadius: BorderRadius.circular(AppRadii.xl),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadii.xl - 2),
                  child: RTCVideoView(
                    _localRenderer,
                    objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 48,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _CallControlButton(
                  icon: _muted ? Icons.mic_off_rounded : Icons.mic_rounded,
                  color: _muted ? AppColors.danger : Colors.white24,
                  onTap: _toggleMute,
                ),
                const SizedBox(width: AppSpacing.xl),
                _EndCallButton(onTap: _endCall),
                const SizedBox(width: AppSpacing.xl),
                _CallControlButton(
                  icon: _videoOff ? Icons.videocam_off_rounded : Icons.videocam_rounded,
                  color: _videoOff ? AppColors.danger : Colors.white24,
                  onTap: _toggleVideo,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorOverlay extends StatelessWidget {
  const _ErrorOverlay({required this.message, required this.onClose});

  final String message;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black87,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.danger),
              const SizedBox(height: AppSpacing.md),
              const Text(
                'Call error',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white60, fontSize: 14),
              ),
              const SizedBox(height: AppSpacing.xl),
              FilledButton(
                onPressed: onClose,
                style: FilledButton.styleFrom(backgroundColor: Colors.white),
                child: const Text('Close', style: TextStyle(color: Colors.black)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CallControlButton extends StatelessWidget {
  const _CallControlButton({
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.white, size: 28),
      ),
    );
  }
}

class _EndCallButton extends StatelessWidget {
  const _EndCallButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 64,
        height: 64,
        decoration: const BoxDecoration(
          color: AppColors.danger,
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.call_end_rounded, color: Colors.white, size: 32),
      ),
    );
  }
}
