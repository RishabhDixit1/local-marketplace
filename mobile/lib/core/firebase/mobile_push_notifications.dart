import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/notifications/domain/notification_models.dart';
import '../api/mobile_api_client.dart';
import '../api/mobile_api_provider.dart';
import '../supabase/app_bootstrap.dart';
import 'app_firebase.dart';
import 'local_notification_service.dart';

final notificationTapRouteControllerProvider =
    Provider<NotificationTapRouteController>((ref) {
      final controller = NotificationTapRouteController();
      ref.onDispose(controller.dispose);
      return controller;
    });

final notificationTapRouteStreamProvider = StreamProvider<String>((ref) {
  return ref.watch(notificationTapRouteControllerProvider).routes;
});

final mobilePushNotificationServiceProvider =
    Provider<MobilePushNotificationService>((ref) {
      final service = MobilePushNotificationService(
        firebaseState: ref.watch(appFirebaseProvider),
        apiClient: ref.watch(mobileApiClientProvider),
        bootstrap: ref.watch(appBootstrapProvider),
        tapRouteController: ref.watch(notificationTapRouteControllerProvider),
        ref: ref,
      );
      ref.onDispose(service.dispose);
      return service;
    });

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(
  RemoteMessage message,
) async {
  final data = message.data;
  final route = data['route'] as String?;
  final title = message.notification?.title ?? (data['title'] as String?);
  final body = message.notification?.body ?? (data['message'] as String? ?? data['body'] as String?);
  if (title != null && body != null) {
    final kindRaw = data['kind'] as String?;
    final kind = _parseKind(kindRaw);
    await showLocalNotification(
      title: title,
      body: body,
      kind: kind,
      route: route,
    );
  } else if (route != null && route.isNotEmpty) {
    debugPrint('ServiQ: background notification route=$route');
  }
}

MobileNotificationKind _parseKind(String? raw) {
  switch (raw?.toLowerCase()) {
    case 'order':
      return MobileNotificationKind.order;
    case 'message':
      return MobileNotificationKind.message;
    case 'review':
      return MobileNotificationKind.review;
    case 'connection':
      return MobileNotificationKind.connection;
    default:
      return MobileNotificationKind.system;
  }
}

class MobilePushNotificationService {
  MobilePushNotificationService({
    required AppFirebaseState firebaseState,
    required MobileApiClient apiClient,
    required AppBootstrap bootstrap,
    required NotificationTapRouteController tapRouteController,
    required Ref ref,
  }) : _firebaseState = firebaseState,
       _apiClient = apiClient,
       _bootstrap = bootstrap,
       _tapRouteController = tapRouteController,
       _ref = ref;

  // ignore: unused_field
  final AppFirebaseState _firebaseState;
  final MobileApiClient _apiClient;
  final AppBootstrap _bootstrap;
  final NotificationTapRouteController _tapRouteController;
  // ignore: unused_field
  final Ref _ref;
  bool _started = false;
  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<RemoteMessage>? _tapSubscription;
  StreamSubscription<RemoteMessage>? _foregroundSubscription;

  static void registerBackgroundHandler() {
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  }

  Future<void> start() async {
    if (_started || !_firebaseState.initialized) {
      return;
    }
    _started = true;

    await createNotificationChannels();

    final messaging = FirebaseMessaging.instance;

    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    final token = await messaging.getAPNSToken() ?? await messaging.getToken();
    if (token != null) {
      debugPrint('ServiQ: FCM token=$token');
      await _registerToken(token);
    }

    _tokenRefreshSubscription = messaging.onTokenRefresh.listen((t) {
      debugPrint('ServiQ: FCM token refreshed=$t');
      _registerToken(t);
    });

    _tapSubscription = FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }

    _foregroundSubscription = FirebaseMessaging.onMessage.listen((message) async {
      final data = message.data;
      final title = message.notification?.title ?? (data['title'] as String?);
      final body = message.notification?.body ?? (data['message'] as String? ?? data['body'] as String?);
      if (title != null && body != null) {
        final kindRaw = data['kind'] as String?;
        final kind = _parseKind(kindRaw);
        await showLocalNotification(
          title: title,
          body: body,
          kind: kind,
          route: data['route'] as String?,
        );
      }
    });
  }

  Future<void> _registerToken(String token) async {
    if (!_bootstrap.supabaseReady) return;
    try {
      await _apiClient.postJson(
        '/api/notifications/subscribe',
        body: {
          'fcmToken': token,
          'platform': 'android',
        },
      );
    } catch (e) {
      debugPrint('ServiQ: FCM token registration failed: $e');
    }
  }

  void _handleNotificationTap(RemoteMessage message) {
    final data = message.data;
    final route = data['route'] as String?;
    if (route != null && route.isNotEmpty) {
      _tapRouteController.push(route);
    }
  }

  void dispose() {
    unawaited(_tokenRefreshSubscription?.cancel());
    unawaited(_tapSubscription?.cancel());
    unawaited(_foregroundSubscription?.cancel());
  }
}

class NotificationTapRouteController {
  final _controller = StreamController<String>.broadcast();

  Stream<String> get routes => _controller.stream;

  void push(String route) {
    final location = route.trim();
    if (location.isNotEmpty && !_controller.isClosed) {
      _controller.add(location);
    }
  }

  void dispose() {
    unawaited(_controller.close());
  }
}
