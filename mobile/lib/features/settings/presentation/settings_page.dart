import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/design_system/serviq_chrome.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../data/settings_repository.dart';
import '../data/theme_mode_provider.dart';
import '../domain/settings_models.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  bool _saving = false;
  String? _saveMessage;

  Future<void> _refresh() async {
    ref.invalidate(notificationSettingsProvider);
    await ref.read(notificationSettingsProvider.future);
  }

  Future<void> _toggle({
    required bool current,
    required NotificationSettings Function(NotificationSettings) updateFn,
  }) async {
    setState(() { _saving = true; _saveMessage = null; });
    try {
      final repo = ref.read(settingsRepositoryProvider);
      final currentSettings = await ref.read(notificationSettingsProvider.future);
      final updated = updateFn(currentSettings);
      await repo.update(updated);
      ref.invalidate(notificationSettingsProvider);
      if (mounted) setState(() => _saveMessage = 'Saved.');
    } on ApiException catch (e) {
      if (mounted) setState(() => _saveMessage = e.message);
    } catch (e) {
      if (mounted) setState(() => _saveMessage = 'Failed to save.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _signOutOfAllDevices() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out everywhere?'),
        content: const Text('This signs out all sessions across all devices.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sign out everywhere')),
        ],
      ),
    );
    if (confirmed == true) {
      await Supabase.instance.client.auth.signOut();
      if (mounted) context.go('/');
    }
  }

  Future<void> _deleteAccount() async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('This permanently deletes your account and data. Type DELETE to confirm.'),
            const SizedBox(height: 12),
            TextField(controller: controller, decoration: const InputDecoration(labelText: 'Type DELETE')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: controller.text == 'DELETE' ? () => Navigator.pop(ctx, true) : null,
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await ref.read(mobileApiClientProvider).postJson('/api/account/delete');
        await Supabase.instance.client.auth.signOut();
        if (mounted) context.go('/');
      } on ApiException catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeModeProvider);
    final notifAsync = ref.watch(notificationSettingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            Text('Manage account, notifications, and appearance.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.inkSubtle)),
            const SizedBox(height: 16),
            _buildNotificationsSection(notifAsync),
            const SizedBox(height: 16),
            _buildAppearanceSection(themeMode),
            const SizedBox(height: 16),
            _buildGeneralSection(),
            const SizedBox(height: 16),
            _buildAccountSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationsSection(AsyncValue<NotificationSettings> notifAsync) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Notifications', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          ServiqAsyncBody<NotificationSettings>(
            value: notifAsync,
            errorTitle: 'Unable to load notification settings',
            onRetry: _refresh,
            data: (settings) => Column(
              children: [
                _notificationToggle(
                  value: settings.orderNotifications,
                  title: 'Order Notifications',
                  subtitle: 'Receive email updates about new orders and status changes.',
                  onChanged: (v) => _toggle(current: settings.orderNotifications, updateFn: (s) => s.copyWith(orderNotifications: v)),
                ),
                const Divider(height: 1),
                _notificationToggle(
                  value: settings.promoNotifications,
                  title: 'Promotional Notifications',
                  subtitle: 'Get notified about promotions, discounts, and special offers.',
                  onChanged: (v) => _toggle(current: settings.promoNotifications, updateFn: (s) => s.copyWith(promoNotifications: v)),
                ),
                const Divider(height: 1),
                _notificationToggle(
                  value: settings.messageNotifications,
                  title: 'Message Notifications',
                  subtitle: 'Get notified when you receive new messages.',
                  onChanged: (v) => _toggle(current: settings.messageNotifications, updateFn: (s) => s.copyWith(messageNotifications: v)),
                ),
              ],
            ),
            loadingBuilder: () => const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
          ),
          if (_saveMessage != null) ...[
            const SizedBox(height: 8),
            Text(_saveMessage!, style: const TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
          ],
        ],
      ),
    );
  }

  Widget _notificationToggle({
    required bool value,
    required String title,
    required String subtitle,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile(
      value: value,
      onChanged: _saving ? null : onChanged,
      title: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
      contentPadding: EdgeInsets.zero,
    );
  }

  Widget _buildAppearanceSection(ThemeMode currentMode) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Appearance', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          _themeOption(ThemeMode.system, currentMode, Icons.brightness_auto_rounded, 'System default', 'Follow your device theme'),
          const SizedBox(height: 6),
          _themeOption(ThemeMode.light, currentMode, Icons.light_mode_rounded, 'Light', 'Always use light mode'),
          const SizedBox(height: 6),
          _themeOption(ThemeMode.dark, currentMode, Icons.dark_mode_rounded, 'Dark', 'Always use dark mode'),
        ],
      ),
    );
  }

  Widget _themeOption(ThemeMode mode, ThemeMode current, IconData icon, String title, String subtitle) {
    final selected = mode == current;
    return Material(
      color: selected ? AppColors.primarySoft : AppColors.surfaceAlt,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => ref.read(themeModeProvider.notifier).set(mode),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: selected ? AppColors.primary : AppColors.border),
          ),
          child: Row(
            children: [
              Icon(icon, size: 20, color: selected ? AppColors.primary : AppColors.inkSubtle),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: selected ? AppColors.primary : AppColors.ink)),
                    Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
                  ],
                ),
              ),
              if (selected)
                const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGeneralSection() {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('General', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.language_rounded, color: AppColors.ink),
            title: const Text('Language', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            subtitle: const Text('English', style: TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
            trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.inkSubtle),
            onTap: () {
              ServiqToast.show(context, message: 'More languages coming soon.', tone: ServiqToastTone.neutral);
            },
          ),
          const Divider(height: 1),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.info_outline_rounded, color: AppColors.ink),
            title: const Text('App Version', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            subtitle: const Text('1.0.0+1', style: TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
          ),
          const Divider(height: 1),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.description_outlined, color: AppColors.ink),
            title: const Text('Privacy Policy', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            trailing: const Icon(Icons.open_in_new_rounded, size: 18, color: AppColors.inkSubtle),
            onTap: () async {
              final uri = Uri.parse('https://serviq.app/privacy');
              if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
            },
          ),
          const Divider(height: 1),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.description_outlined, color: AppColors.ink),
            title: const Text('Terms of Service', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            trailing: const Icon(Icons.open_in_new_rounded, size: 18, color: AppColors.inkSubtle),
            onTap: () async {
              final uri = Uri.parse('https://serviq.app/terms');
              if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAccountSection() {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Account', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.logout_rounded, color: AppColors.ink),
            title: const Text('Sign out', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            subtitle: const Text('Sign out of this device', style: TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
            onTap: () async {
              await Supabase.instance.client.auth.signOut();
              if (mounted) context.go('/');
            },
          ),
          const Divider(height: 1),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.devices_other_rounded, color: AppColors.warning),
            title: const Text('Sign out of all devices', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            subtitle: const Text('Revoke all active sessions', style: TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
            onTap: _signOutOfAllDevices,
          ),
          const Divider(height: 1),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.delete_forever_rounded, color: AppColors.danger),
            title: Text('Delete account', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.danger)),
            subtitle: const Text('Permanently remove your account and data', style: TextStyle(fontSize: 12, color: AppColors.inkSubtle)),
            onTap: _deleteAccount,
          ),
        ],
      ),
    );
  }
}
