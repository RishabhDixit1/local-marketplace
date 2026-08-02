import 'dart:async';

import 'package:flutter_webrtc/flutter_webrtc.dart';

const _iceServers = <Map<String, dynamic>>[
  {'urls': 'stun:stun.l.google.com:19302'},
];

enum LiveTalkSignalingState {
  idle,
  connecting,
  connected,
  disconnected,
  error,
}

class LiveTalkSignaling {
  LiveTalkSignaling({
    required this.conversationId,
    required this.currentUserId,
    required this.otherUserId,
  });

  final String conversationId;
  final String currentUserId;
  final String otherUserId;

  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  MediaStream? _remoteStream;
  bool _madeOffer = false;
  bool _disposed = false;

  final _stateController = StreamController<LiveTalkSignalingState>.broadcast();
  final _remoteStreamController = StreamController<MediaStream>.broadcast();

  Stream<LiveTalkSignalingState> get stateStream => _stateController.stream;
  Stream<MediaStream> get remoteStreamStream => _remoteStreamController.stream;
  MediaStream? get localStream => _localStream;
  MediaStream? get remoteStream => _remoteStream;

  Function(Map<String, dynamic> payload)? onOutgoingIceCandidate;
  Function(Map<String, dynamic> payload)? onOutgoingOffer;
  Function(Map<String, dynamic> payload)? onOutgoingAnswer;

  Future<MediaStream> startLocalStream() async {
    final stream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': {
        'facingMode': 'user',
        'width': {'ideal': 320},
        'height': {'ideal': 240},
      },
    });
    _localStream = stream;
    return stream;
  }

  Future<void> connect() async {
    _stateController.add(LiveTalkSignalingState.connecting);

    final pc = await createPeerConnection({'iceServers': _iceServers});
    _pc = pc;

    if (_localStream != null) {
      for (final track in _localStream!.getTracks()) {
        await pc.addTrack(track, _localStream!);
      }
    }

    pc.onTrack = (RTCTrackEvent event) {
      if (event.streams.isNotEmpty) {
        _remoteStream = event.streams.first;
        _remoteStreamController.add(event.streams.first);
      }
    };

    pc.onIceCandidate = (RTCIceCandidate candidate) {
      onOutgoingIceCandidate?.call(candidate.toMap());
    };

    pc.onIceConnectionState = (RTCIceConnectionState state) {
      if (state == RTCIceConnectionState.RTCIceConnectionStateDisconnected ||
          state == RTCIceConnectionState.RTCIceConnectionStateFailed) {
        _stateController.add(LiveTalkSignalingState.disconnected);
      }
    };

    pc.onConnectionState = (RTCPeerConnectionState state) {
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
        _stateController.add(LiveTalkSignalingState.connected);
      }
    };

    _stateController.add(LiveTalkSignalingState.connecting);
  }

  Future<void> handleOffer(Map<String, dynamic> sdp) async {
    if (_disposed || _pc == null) return;
    if (_pc!.signalingState != RTCSignalingState.RTCSignalingStateStable) return;
    _madeOffer = false;
    await _pc!.setRemoteDescription(
      RTCSessionDescription(sdp['sdp'] as String, sdp['type'] as String),
    );
    final answer = await _pc!.createAnswer();
    await _pc!.setLocalDescription(answer);
    final localDesc = await _pc!.getLocalDescription();
    if (localDesc != null) {
      onOutgoingAnswer?.call(localDesc.toMap());
    }
  }

  Future<void> handleAnswer(Map<String, dynamic> sdp) async {
    if (_disposed || _pc == null) return;
    if (_pc!.signalingState != RTCSignalingState.RTCSignalingStateHaveLocalOffer) return;
    await _pc!.setRemoteDescription(
      RTCSessionDescription(sdp['sdp'] as String, sdp['type'] as String),
    );
  }

  Future<void> handleIceCandidate(Map<String, dynamic> candidate) async {
    if (_disposed || _pc == null) return;
    try {
      await _pc!.addCandidate(RTCIceCandidate(
        candidate['candidate'] as String,
        candidate['sdpMid'] as String?,
        candidate['sdpMLineIndex'] as int? ?? 0,
      ));
    } catch (_) {}
  }

  Future<void> makeOffer() async {
    if (_disposed || _pc == null || _madeOffer) return;
    _madeOffer = true;
    final offer = await _pc!.createOffer();
    await _pc!.setLocalDescription(offer);
    final localDesc = await _pc!.getLocalDescription();
    if (localDesc != null) {
      onOutgoingOffer?.call(localDesc.toMap());
    }
  }

  Future<void> toggleMute() async {
    if (_localStream == null) return;
    for (final track in _localStream!.getAudioTracks()) {
      track.enabled = !track.enabled;
    }
  }

  Future<void> toggleVideo() async {
    if (_localStream == null) return;
    for (final track in _localStream!.getVideoTracks()) {
      track.enabled = !track.enabled;
    }
  }

  bool get isMuted {
    if (_localStream == null) return false;
    final tracks = _localStream!.getAudioTracks();
    return tracks.isNotEmpty && !tracks.first.enabled;
  }

  bool get isVideoOff {
    if (_localStream == null) return true;
    final tracks = _localStream!.getVideoTracks();
    return tracks.isEmpty || !tracks.first.enabled;
  }

  Future<void> dispose() async {
    _disposed = true;
    await _pc?.close();
    _pc = null;
    if (_localStream != null) {
      for (final track in _localStream!.getTracks()) {
        await track.stop();
      }
      _localStream = null;
    }
    _remoteStream = null;
    await _stateController.close();
    await _remoteStreamController.close();
  }
}
