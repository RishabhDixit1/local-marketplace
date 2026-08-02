import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../core/design_system/serviq_chrome.dart';
import '../../core/theme/design_tokens.dart';

class VoiceInputButton extends StatefulWidget {
  const VoiceInputButton({
    super.key,
    required this.controller,
    this.iconSize = 20,
    this.tooltip,
  });

  final TextEditingController controller;
  final double iconSize;
  final String? tooltip;

  @override
  State<VoiceInputButton> createState() => _VoiceInputButtonState();
}

class _VoiceInputButtonState extends State<VoiceInputButton> {
  final SpeechToText _speech = SpeechToText();
  bool _listening = false;
  bool _initialized = false;
  String _baseText = '';
  String _pendingText = '';

  @override
  void dispose() {
    _speech.stop();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_listening) {
      await _speech.stop();
      if (mounted) setState(() => _listening = false);
      return;
    }

    try {
      if (!_initialized) {
        final available = await _speech.initialize(
          onStatus: (status) {
            if (status == 'done' && mounted) {
              setState(() => _listening = false);
            }
          },
          onError: (error) {
            if (!mounted) return;
            setState(() => _listening = false);
            ServiqToast.show(
              context,
              message: _errorMessage(error.errorMsg),
              tone: ServiqToastTone.danger,
            );
          },
        );
        if (!available) {
          if (mounted) {
            ServiqToast.show(
              context,
              message: 'Voice input is not available on this device',
              tone: ServiqToastTone.danger,
            );
          }
          return;
        }
        _initialized = true;
      }

      _baseText = widget.controller.text.trim();
      _pendingText = '';
      await _speech.listen(
        onResult: _handleResult,
        listenOptions: SpeechListenOptions(
          partialResults: true,
          cancelOnError: true,
          listenFor: const Duration(seconds: 30),
          pauseFor: const Duration(seconds: 5),
        ),
      );
      if (mounted) {
        setState(() => _listening = true);
        HapticFeedback.mediumImpact();
      }
    } catch (_) {
      if (mounted) {
        ServiqToast.show(context, message: 'Voice input failed', tone: ServiqToastTone.danger);
      }
    }
  }

  void _handleResult(SpeechRecognitionResult result) {
    if (result.recognizedWords.isNotEmpty) {
      _pendingText = result.recognizedWords;
    }
    if (result.finalResult) {
      _applyText(_pendingText);
      if (mounted) setState(() => _listening = false);
    } else if (_pendingText.isNotEmpty) {
      _applyText(_pendingText);
    }
  }

  void _applyText(String text) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    final combined = _baseText.isEmpty ? trimmed : '$_baseText $trimmed';
    widget.controller.text = combined;
    widget.controller.selection = TextSelection.collapsed(offset: combined.length);
  }

  String _errorMessage(String raw) {
    final lower = raw.toLowerCase();
    if (lower.contains('permission')) {
      return 'Microphone permission denied. Enable it in settings to use voice input.';
    }
    if (lower.contains('network') || lower.contains('internet')) {
      return 'Voice recognition needs an internet connection.';
    }
    return 'Voice input unavailable. Try again.';
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: _toggle,
      tooltip: widget.tooltip ?? (_listening ? 'Stop listening' : 'Speak'),
      icon: Icon(
        _listening ? Icons.mic_rounded : Icons.mic_none_rounded,
        size: widget.iconSize,
        color: _listening
            ? AppColors.danger
            : Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }
}
