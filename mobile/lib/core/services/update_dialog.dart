import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/app_theme.dart';

Future<void> showUpdateDialog(BuildContext context, {
  required String latestVersion,
  required bool isCritical,
  String? releaseNotes,
  String? updateUrl,
}) async {
  if (!context.mounted) return;

    final install = await showDialog<bool>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: !isCritical,
      builder: (dialogContext) {
        return AlertDialog(
          title: Row(
            children: [
              Icon(
                Icons.system_update_alt_rounded,
                color: isCritical ? AppColors.danger : AppColors.primary,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(isCritical ? 'Update required' : 'Update available'),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Version $latestVersion is now available.'),
              if (releaseNotes != null && releaseNotes.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  'What\'s new:',
                  style: Theme.of(context).textTheme.labelLarge,
                ),
                const SizedBox(height: 4),
                Text(releaseNotes),
              ],
            ],
          ),
          actions: [
            if (!isCritical)
              TextButton(
                onPressed: () => Navigator.of(dialogContext, rootNavigator: true).pop(false),
                child: const Text('Later'),
              ),
            FilledButton.icon(
              onPressed: () => Navigator.of(dialogContext, rootNavigator: true).pop(true),
              icon: const Icon(Icons.download_rounded),
              label: const Text('Update'),
            ),
          ],
        );
      },
    );

  if (install != true || !context.mounted) return;
  if (updateUrl == null || updateUrl.isEmpty) return;

  final uri = Uri.tryParse(updateUrl);
  if (uri == null) return;

  try {
    if (await canLaunchUrl(uri).timeout(const Duration(seconds: 3))) {
      await launchUrl(uri, mode: LaunchMode.externalApplication)
          .timeout(const Duration(seconds: 5));
    }
  } catch (_) {
    // URL launch failed — non-blocking
  }
}
