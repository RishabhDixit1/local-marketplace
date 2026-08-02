import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/design_system/design_system.dart';
import '../../core/theme/design_tokens.dart';

enum WhatsAppShareButtonSize { sm, md, lg }

enum WhatsAppShareButtonVariant { primary, outline }

class WhatsAppShareButton extends StatefulWidget {
  const WhatsAppShareButton({
    super.key,
    required this.shareText,
    this.shareUrl,
    this.label = 'Share on WhatsApp',
    this.size = WhatsAppShareButtonSize.sm,
    this.variant = WhatsAppShareButtonVariant.outline,
  });

  final String shareText;
  final String? shareUrl;
  final String label;
  final WhatsAppShareButtonSize size;
  final WhatsAppShareButtonVariant variant;

  @override
  State<WhatsAppShareButton> createState() => _WhatsAppShareButtonState();

  String get _fullText {
    if (shareUrl == null) return shareText;
    return '$shareText\n\n$shareUrl';
  }
}

class _WhatsAppShareButtonState extends State<WhatsAppShareButton> {
  bool _copied = false;

  Future<void> _openWhatsApp() async {
    final text = widget._fullText;
    final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ServiqToast.show(
          context,
          message: 'Could not open WhatsApp. Check if it is installed.',
          tone: ServiqToastTone.warning,
        );
      }
    }
  }

  Future<void> _copyText() async {
    final text = widget._fullText;
    await Clipboard.setData(ClipboardData(text: text));
    setState(() => _copied = true);
    if (mounted) {
      ServiqToast.show(
        context,
        message: 'Text copied',
        tone: ServiqToastTone.success,
      );
    }
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) setState(() => _copied = false);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final buttonHeight = switch (widget.size) {
      WhatsAppShareButtonSize.sm => 32.0,
      WhatsAppShareButtonSize.md => 40.0,
      WhatsAppShareButtonSize.lg => 48.0,
    };

    final iconSize = switch (widget.size) {
      WhatsAppShareButtonSize.sm => 14.0,
      WhatsAppShareButtonSize.md => 16.0,
      WhatsAppShareButtonSize.lg => 20.0,
    };

    final fontSize = switch (widget.size) {
      WhatsAppShareButtonSize.sm => 12.0,
      WhatsAppShareButtonSize.md => 14.0,
      WhatsAppShareButtonSize.lg => 16.0,
    };

    final borderRadius = BorderRadius.circular(AppRadii.lg);
    final borderColor = isDark ? AppColors.glassStrokeDark : AppColors.surfaceAlt;

    if (widget.variant == WhatsAppShareButtonVariant.primary) {
      return SizedBox(
        height: buttonHeight,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _WhatsAppButton(
              height: buttonHeight,
              iconSize: iconSize,
              fontSize: fontSize,
              borderRadius: borderRadius,
              backgroundColor: AppColors.whatsapp,
              foregroundColor: Colors.white,
              icon: Icons.chat_rounded,
              label: widget.label,
              onPressed: _openWhatsApp,
            ),
            Container(width: 1, color: Colors.white.withValues(alpha: 0.3)),
            _CopyButton(
              height: buttonHeight,
              iconSize: iconSize,
              borderRadius: borderRadius,
              backgroundColor: AppColors.whatsappDeep,
              foregroundColor: Colors.white,
              copied: _copied,
              onPressed: _copyText,
            ),
          ],
        ),
      );
    }

    return SizedBox(
      height: buttonHeight,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _WhatsAppButton(
            height: buttonHeight,
            iconSize: iconSize,
            fontSize: fontSize,
            borderRadius: borderRadius,
            backgroundColor: Colors.transparent,
            foregroundColor: isDark ? Colors.white : AppColors.whatsapp,
            borderColor: borderColor,
            icon: Icons.chat_rounded,
            label: widget.label,
            onPressed: _openWhatsApp,
          ),
          Container(width: 1, color: borderColor),
          _CopyButton(
            height: buttonHeight,
            iconSize: iconSize,
            borderRadius: borderRadius,
            backgroundColor: Colors.transparent,
            foregroundColor: isDark ? AppColors.darkInkSubtle : AppColors.primary,
            borderColor: borderColor,
            copied: _copied,
            onPressed: _copyText,
          ),
        ],
      ),
    );
  }
}

class _WhatsAppButton extends StatelessWidget {
  const _WhatsAppButton({
    required this.height,
    required this.iconSize,
    required this.fontSize,
    required this.borderRadius,
    required this.backgroundColor,
    required this.foregroundColor,
    this.borderColor,
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final double height;
  final double iconSize;
  final double fontSize;
  final BorderRadius borderRadius;
  final Color backgroundColor;
  final Color foregroundColor;
  final Color? borderColor;
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Material(
        color: backgroundColor,
        borderRadius: BorderRadius.only(
          topLeft: borderRadius.topLeft,
          bottomLeft: borderRadius.bottomLeft,
        ),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.only(
            topLeft: borderRadius.topLeft,
            bottomLeft: borderRadius.bottomLeft,
          ),
          child: Container(
            height: height,
            decoration: BoxDecoration(
              border: borderColor != null
                  ? Border(
                      top: BorderSide(color: borderColor!),
                      bottom: BorderSide(color: borderColor!),
                      left: BorderSide(color: borderColor!),
                    )
                  : null,
              borderRadius: BorderRadius.only(
                topLeft: borderRadius.topLeft,
                bottomLeft: borderRadius.bottomLeft,
              ),
            ),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: iconSize, color: foregroundColor),
                const SizedBox(width: AppSpacing.xxs),
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: fontSize,
                      fontWeight: FontWeight.w600,
                      color: foregroundColor,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CopyButton extends StatelessWidget {
  const _CopyButton({
    required this.height,
    required this.iconSize,
    required this.borderRadius,
    required this.backgroundColor,
    required this.foregroundColor,
    this.borderColor,
    required this.copied,
    required this.onPressed,
  });

  final double height;
  final double iconSize;
  final BorderRadius borderRadius;
  final Color backgroundColor;
  final Color foregroundColor;
  final Color? borderColor;
  final bool copied;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: backgroundColor,
      borderRadius: BorderRadius.only(
        topRight: borderRadius.topRight,
        bottomRight: borderRadius.bottomRight,
      ),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.only(
          topRight: borderRadius.topRight,
          bottomRight: borderRadius.bottomRight,
        ),
        child: Container(
          height: height,
          width: 40,
          decoration: BoxDecoration(
            border: borderColor != null
                ? Border.all(color: borderColor!)
                : null,
            borderRadius: BorderRadius.only(
              topRight: borderRadius.topRight,
              bottomRight: borderRadius.bottomRight,
            ),
          ),
          child: Semantics(
            label: copied ? 'Copied' : 'Copy share text',
            child: Icon(
              copied ? Icons.check_rounded : Icons.copy_rounded,
              size: iconSize,
              color: copied ? AppColors.sage : foregroundColor,
            ),
          ),
        ),
      ),
    );
  }
}
