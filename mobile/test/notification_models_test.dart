import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/constants/app_routes.dart';
import 'package:serviq_mobile/features/notifications/domain/notification_models.dart';

void main() {
  test('message notifications deep link into the unified chat thread', () {
    final action = resolveMobileNotificationAction(
      _buildNotification(
        kind: MobileNotificationKind.message,
        entityType: 'conversation',
        entityId: 'conversation-42',
      ),
    );

    expect(action.label, 'Open chat');
    expect(action.route, AppRoutes.chatThread('conversation-42'));
    expect(action.queryParameters, {'source': 'notification'});
  });

  test('order notifications open the order detail', () {
    final action = resolveMobileNotificationAction(
      _buildNotification(
        kind: MobileNotificationKind.order,
        entityType: 'order',
        entityId: 'order-7',
      ),
    );

    expect(action.label, 'Open order');
    expect(action.route, AppRoutes.orderDetail('order-7'));
    expect(action.queryParameters, {'source': 'notification'});
  });

  test('quote notifications open the quote room with task context', () {
    final action = resolveMobileNotificationAction(
      _buildNotification(
        kind: MobileNotificationKind.order,
        entityType: 'quote',
        entityId: 'quote-7',
        metadata: const {'order_id': 'order-7'},
      ),
    );

    expect(action.label, 'Open quote');
    expect(action.route, AppRoutes.quote);
    expect(action.queryParameters, {
      'mode': 'order',
      'targetId': 'order-7',
      'source': 'notification',
    });
  });

  test('explicit app hrefs win over inferred notification routing', () {
    final action = resolveMobileNotificationAction(
      _buildNotification(
        kind: MobileNotificationKind.system,
        entityType: 'system',
        metadata: const {'href': '/app/provider-onboarding'},
      ),
    );

    expect(action.label, 'Open');
    expect(action.route, AppRoutes.providerOnboarding);
  });

  test('system notifications fall back to the welcome home feed', () {
    final action = resolveMobileNotificationAction(
      _buildNotification(
        kind: MobileNotificationKind.system,
        entityType: 'broadcast',
      ),
    );

    expect(action.label, 'View feed');
    expect(action.route, AppRoutes.welcome);
  });
}

MobileNotificationItem _buildNotification({
  required MobileNotificationKind kind,
  required String entityType,
  String? entityId,
  Map<String, dynamic> metadata = const <String, dynamic>{},
}) {
  return MobileNotificationItem(
    id: 'notification-1',
    userId: 'user-1',
    kind: kind,
    title: 'Test notification',
    message: 'Exercise the mobile notification routing contract.',
    entityType: entityType,
    entityId: entityId,
    metadata: metadata,
    readAt: null,
    clearedAt: null,
    createdAt: DateTime(2026, 4, 26, 9),
  );
}
