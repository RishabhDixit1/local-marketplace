import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/notifications/data/notification_repository.dart';
import '../../features/notifications/domain/notification_models.dart';
import '../api/mobile_api_client.dart';
import '../api/mobile_api_provider.dart';
import '../supabase/app_bootstrap.dart';
import 'app_firebase.dart';

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

  final AppFirebaseState _firebaseState;
  final MobileApiClient _apiClient;
  final AppBootstrap _bootstrap;
  final NotificationTapRouteController _tapRouteController;
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

    final userId = _bootstrap.client?.auth.currentUser?.id ?? '';
    if (userId.isEmpty || !_bootstrap.config.hasApiConfig) {
      return;
    }

    _started = true;
    try {
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
            alert: true,
            badge: true,
            sound: true,
          );

      final token = await FirebaseMessaging.instance.getToken();
      await _registerToken(token);

      _tokenRefreshSubscription = FirebaseMessaging.instance.onTokenRefresh
          .listen(_registerToken);
      _tapSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
        _handleNotificationTap,
      );
      _foregroundSubscription = FirebaseMessaging.onMessage.listen((message) {
        _ref.invalidate(notificationListProvider);
        if (kDebugMode) {
          debugPrint('ServiQ FCM foreground message=${message.messageId}');
        }
      });

      final initialMessage = await FirebaseMessaging.instance
          .getInitialMessage();
      if (initialMessage != null) {
        _handleNotificationTap(initialMessage);
      }
    } catch (error, stackTrace) {
      debugPrint('ServiQ mobile: FCM setup failed: $error');
      unawaited(AppFirebase.recordError(error, stackTrace));
      _started = false;
    }
  }

  Future<void> _registerToken(String? token) async {
    final normalized = token?.trim() ?? '';
    if (normalized.isEmpty) {
      return;
    }

    try {
      await _apiClient.postJson(
        '/api/notifications/subscribe',
        body: {
          'token': normalized,
          'platform': defaultTargetPlatform.name,
          'userAgent': 'serviq-flutter',
        },
      );
    } on ApiException catch (error) {
      if (kDebugMode) {
        debugPrint('ServiQ mobile: FCM token registration failed: $error');
      }
    }
  }

  void _handleNotificationTap(RemoteMessage message) {
    final data = Map<String, dynamic>.from(message.data);
    final action = resolveMobileNotificationActionFromData(
      kind: _firstString(data, ['kind', 'notification_kind', 'type']),
      entityType: _firstString(data, ['entity_type', 'entityType', 'target']),
      entityId: _firstString(data, [
        'entity_id',
        'entityId',
        'conversation_id',
        'order_id',
        'help_request_id',
        'id',
      ]),
      metadata: data,
    );
    _tapRouteController.push(action.location);
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

String? _firstString(Map<String, dynamic> data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return null;
}

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await AppFirebase.initialize();
}
