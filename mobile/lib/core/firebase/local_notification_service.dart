import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../features/notifications/domain/notification_models.dart';
import 'app_firebase.dart';

const _notifIcon = 'ic_notification';

final flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();
bool _initialized = false;

Future<void> initializeLocalNotifications() async {
  if (_initialized) return;

  try {
    const androidSettings = AndroidInitializationSettings(_notifIcon);
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    await flutterLocalNotificationsPlugin.initialize(
      settings: settings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );
    _initialized = true;
  } catch (e, stack) {
    debugPrint('ServiQ: Failed to initialize local notifications: $e');
    unawaited(AppFirebase.recordError(e, stack, fatal: false));
  }
}

void _onNotificationTap(NotificationResponse response) {
  // Route resolution is handled via FCM tap handler.
  // This handles the case where a local-only notification is tapped.
}

Future<void> showLocalNotification({
  required String title,
  required String body,
  required MobileNotificationKind kind,
  String? route,
}) async {
  try {
    final channelId = _channelIdForKind(kind);
    final androidDetails = AndroidNotificationDetails(
      channelId,
      _channelNameForKind(kind),
      channelDescription: _channelDescriptionForKind(kind),
      importance: _importanceForKind(kind),
      priority: _priorityForKind(kind),
      icon: _notifIcon,
    );
    final iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );
    await flutterLocalNotificationsPlugin.show(
      id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: title,
      body: body,
      notificationDetails: details,
      payload: route,
    );
  } catch (e, stack) {
    debugPrint('ServiQ: Failed to show local notification: $e');
    unawaited(AppFirebase.recordError(e, stack, fatal: false));
  }
}

Future<void> createNotificationChannels() async {
  try {
    final androidPlugin = flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    if (androidPlugin == null) return;

    for (final kind in MobileNotificationKind.values) {
      await androidPlugin.createNotificationChannel(
        AndroidNotificationChannel(
          _channelIdForKind(kind),
          _channelNameForKind(kind),
          description: _channelDescriptionForKind(kind),
          importance: _importanceForKind(kind),
          playSound: true,
          enableVibration: true,
        ),
      );
    }
  } catch (e, stack) {
    debugPrint('ServiQ: Failed to create notification channels: $e');
    unawaited(AppFirebase.recordError(e, stack, fatal: false));
  }
}

String _channelIdForKind(MobileNotificationKind kind) {
  switch (kind) {
    case MobileNotificationKind.order:
      return 'serviq_orders';
    case MobileNotificationKind.message:
      return 'serviq_messages';
    case MobileNotificationKind.review:
      return 'serviq_reviews';
    case MobileNotificationKind.system:
      return 'serviq_system';
    case MobileNotificationKind.connection:
      return 'serviq_connections';
  }
}

String _channelNameForKind(MobileNotificationKind kind) {
  switch (kind) {
    case MobileNotificationKind.order:
      return 'Orders';
    case MobileNotificationKind.message:
      return 'Messages';
    case MobileNotificationKind.review:
      return 'Reviews';
    case MobileNotificationKind.system:
      return 'System';
    case MobileNotificationKind.connection:
      return 'Connections';
  }
}

String _channelDescriptionForKind(MobileNotificationKind kind) {
  switch (kind) {
    case MobileNotificationKind.order:
      return 'Order status updates and payment notifications';
    case MobileNotificationKind.message:
      return 'New messages and chat notifications';
    case MobileNotificationKind.review:
      return 'Review and rating notifications';
    case MobileNotificationKind.system:
      return 'System and account notifications';
    case MobileNotificationKind.connection:
      return 'Connection requests and updates';
  }
}

Importance _importanceForKind(MobileNotificationKind kind) {
  switch (kind) {
    case MobileNotificationKind.order:
    case MobileNotificationKind.message:
    case MobileNotificationKind.connection:
      return Importance.high;
    case MobileNotificationKind.review:
    case MobileNotificationKind.system:
      return Importance.defaultImportance;
  }
}

Priority _priorityForKind(MobileNotificationKind kind) {
  switch (kind) {
    case MobileNotificationKind.order:
    case MobileNotificationKind.message:
    case MobileNotificationKind.connection:
      return Priority.high;
    case MobileNotificationKind.review:
    case MobileNotificationKind.system:
      return Priority.defaultPriority;
  }
}
