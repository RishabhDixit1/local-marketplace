import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

void showUpdateDialog(BuildContext context, {
  required String latestVersion,
  required bool isCritical,
  String? releaseNotes,
  String? updateUrl,
}) {
  showDialog(
    context: context,
    barrierDismissible: !isCritical,
    builder: (context) {
      return AlertDialog(
        title: Row(
          children: [
            Icon(
              isCritical ? Icons.system_update_alt_rounded : Icons.system_update_alt_rounded,
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
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Later'),
            ),
          FilledButton.icon(
            onPressed: () {
              // In production, open the app store URL
              // url_launcher could be used here
              Navigator.of(context).pop();
            },
            icon: const Icon(Icons.download_rounded),
            label: const Text('Update'),
          ),
        ],
      );
    },
  );
}
