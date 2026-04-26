import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/constants/app_routes.dart';
import 'package:serviq_mobile/features/notifications/domain/notification_models.dart';

void main() {
  test('message notifications deep link into the inbox thread', () {
    final action = resolveMobileNotificationAction(
      _buildNotification(
        kind: MobileNotificationKind.message,
        entityType: 'conversation',
        entityId: 'conversation-42',
      ),
    );

    expect(action.label, 'Open chat');
    expect(action.route, AppRoutes.inboxThread('conversation-42'));
  });

  test('order notifications focus the tasks board', () {
    final action = resolveMobileNotificationAction(
      _buildNotification(
        kind: MobileNotificationKind.order,
        entityType: 'order',
        entityId: 'order-7',
      ),
    );

    expect(action.label, 'Open task');
    expect(action.route, AppRoutes.tasks);
    expect(action.queryParameters, {
      'focus': 'order-7',
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
