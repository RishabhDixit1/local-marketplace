import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:serviq_mobile/core/api/mobile_api_client.dart';
import 'package:serviq_mobile/features/orders/data/order_repository.dart';
import 'package:serviq_mobile/features/orders/domain/order_models.dart';

class MockMobileApiClient extends Mock implements MobileApiClient {}

void main() {
  late MockMobileApiClient mockApi;
  late OrderRepository repository;

  setUp(() {
    mockApi = MockMobileApiClient();
    repository = OrderRepository(mockApi);
  });

  group('OrderRepository', () {
    group('updateStatus', () {
      test('sends status update and returns warnings', () async {
        when(() => mockApi.patchJson('/api/orders/order-1',
                body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': true,
                  'refundWarning': 'Refund is being processed',
                  'payoutWarning': '',
                  'bookingWarning': null,
                });

        final result = await repository.updateStatus(
          orderId: 'order-1',
          status: 'cancelled',
        );

        expect(result.warnings, contains('Refund is being processed'));
        expect(result.warnings.length, 1);
      });

      test('collects all non-empty warnings', () async {
        when(() => mockApi.patchJson('/api/orders/order-1',
                body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': true,
                  'refundWarning': 'Refund pending',
                  'payoutWarning': 'Payout delayed',
                  'bookingWarning': 'Booking slot released',
                });

        final result = await repository.updateStatus(
          orderId: 'order-1',
          status: 'cancelled',
        );

        expect(result.warnings.length, 3);
      });

      test('returns empty warnings when none present', () async {
        when(() => mockApi.patchJson('/api/orders/order-1',
                body: any(named: 'body')))
            .thenAnswer((_) async => {'ok': true});

        final result = await repository.updateStatus(
          orderId: 'order-1',
          status: 'completed',
        );

        expect(result.warnings, isEmpty);
      });

      test('throws ApiException on failure', () async {
        when(() => mockApi.patchJson('/api/orders/order-1',
                body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': false,
                  'message': 'Cannot cancel completed order',
                });

        expect(
          () => repository.updateStatus(
            orderId: 'order-1',
            status: 'cancelled',
          ),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'Cannot cancel completed order',
            ),
          ),
        );
      });
    });

    group('updateDeliveryStatus', () {
      test('sends delivery status with extra data', () async {
        when(() => mockApi.postJson('/api/orders/order-1/delivery',
                body: any(named: 'body')))
            .thenAnswer((_) async => {'ok': true});

        await repository.updateDeliveryStatus(
          orderId: 'order-1',
          status: 'shipped',
          extra: {'trackingNumber': 'TRK123'},
        );

        verify(
          () => mockApi.postJson('/api/orders/order-1/delivery', body: {
            'status': 'shipped',
            'trackingNumber': 'TRK123',
          }),
        ).called(1);
      });

      test('collects payout and postSync warnings', () async {
        when(() => mockApi.postJson('/api/orders/order-1/delivery',
                body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': true,
                  'payoutWarning': 'Payout scheduled',
                  'postSyncWarning': 'Post sync delayed',
                });

        final result = await repository.updateDeliveryStatus(
          orderId: 'order-1',
          status: 'delivered',
        );

        expect(result.warnings.length, 2);
      });
    });

    group('createBulkOrder', () {
      test('throws ApiException when cart is empty', () async {
        expect(
          () => repository.createBulkOrder(
            MobileBulkCheckoutRequest(
              items: [],
              address: '123 Main St',
              notes: '',
              paymentMethod: MobileOrderPaymentMethod.razorpay,
              fulfillmentMethod: MobileOrderFulfillmentMethod.delivery,
            ),
          ),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'Cart is empty.',
            ),
          ),
        );
      });

      test('short-circuits to createOrder for single item', () async {
        when(() => mockApi.postJson('/api/orders', body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': true,
                  'orderIds': ['order-1'],
                  'count': 1,
                });

        final result = await repository.createBulkOrder(
          MobileBulkCheckoutRequest(
            items: [
              const MobileCheckoutItem(
                providerId: 'p1',
                itemType: 'service',
                itemId: 's1',
                title: 'Electrical repair',
                price: 1500,
              ),
            ],
            address: '123 Main St',
            notes: 'Urgent',
            paymentMethod: MobileOrderPaymentMethod.razorpay,
            fulfillmentMethod: MobileOrderFulfillmentMethod.onsite,
          ),
        );

        expect(result.orderIds, ['order-1']);
        expect(result.count, 1);
      });
    });

    group('fetchOrder', () {
      test('parses order record from payload', () async {
        when(() => mockApi.getJson('/api/orders/order-1')).thenAnswer(
          (_) async => {
            'ok': true,
            'order': {
              'id': 'order-1',
              'status': 'in_progress',
              'price': 1500,
              'listing_type': 'service',
              'consumer_id': 'user-1',
              'provider_id': 'user-2',
              'metadata': {
                'title': 'Electrical repair',
                'payment_method': 'razorpay',
                'payment_status': 'paid',
                'fulfillment_method': 'provider',
              },
            },
          },
        );

        final order = await repository.fetchOrder('order-1');

        expect(order.id, 'order-1');
        expect(order.status, 'in_progress');
        expect(order.title, 'Electrical repair');
        expect(order.paymentMethod, 'razorpay');
        expect(order.paymentStatus, 'paid');
        expect(order.needsDeliveryTracking, isTrue);
      });
    });

    group('createRazorpayOrder', () {
      test('sends amount and receipt', () async {
        when(() => mockApi.postJson('/api/payment/create-order',
                body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': true,
                  'orderId': 'razorpay-order-1',
                  'amount': 150000,
                  'currency': 'INR',
                  'keyId': 'rzp_test_123',
                });

        final result = await repository.createRazorpayOrder(
          amountPaise: 150000,
          receipt: 'order-1',
        );

        expect(result.orderId, 'razorpay-order-1');
        expect(result.amount, 150000);
        expect(result.currency, 'INR');
        expect(result.keyId, 'rzp_test_123');
      });
    });

    group('verifyRazorpayPayment', () {
      test('sends payment verification payload', () async {
        when(() => mockApi.postJson('/api/payment/verify',
                body: any(named: 'body')))
            .thenAnswer((_) async => {'ok': true});

        await repository.verifyRazorpayPayment(
          razorpayOrderId: 'rzp-order-1',
          razorpayPaymentId: 'pay_123',
          razorpaySignature: 'sig_abc',
          serviQOrderIds: ['order-1', 'order-2'],
        );

        verify(
          () => mockApi.postJson('/api/payment/verify', body: {
            'razorpayOrderId': 'rzp-order-1',
            'razorpayPaymentId': 'pay_123',
            'razorpaySignature': 'sig_abc',
            'serviQOrderIds': ['order-1', 'order-2'],
          }),
        ).called(1);
      });

      test('throws on verification failure', () async {
        when(() => mockApi.postJson('/api/payment/verify',
                body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': false,
                  'message': 'Signature mismatch',
                });

        expect(
          () => repository.verifyRazorpayPayment(
            razorpayOrderId: 'rzp-order-1',
            razorpayPaymentId: 'pay_123',
            razorpaySignature: 'bad_sig',
            serviQOrderIds: ['order-1'],
          ),
          throwsA(isA<ApiException>()),
        );
      });
    });
  });

  group('MobileOrderRecord', () {
    test('needsDeliveryTracking is true for provider method', () {
      final order = MobileOrderRecord(
        id: 'o1',
        status: 'new_lead',
        price: 100,
        listingType: 'service',
        consumerId: 'u1',
        providerId: 'u2',
        metadata: {'fulfillment_method': 'provider'},
        createdAt: null,
        updatedAt: null,
      );

      expect(order.needsDeliveryTracking, isTrue);
    });

    test('needsDeliveryTracking is false for self method', () {
      final order = MobileOrderRecord(
        id: 'o1',
        status: 'new_lead',
        price: 100,
        listingType: 'service',
        consumerId: 'u1',
        providerId: 'u2',
        metadata: {'fulfillment_method': 'self'},
        createdAt: null,
        updatedAt: null,
      );

      expect(order.needsDeliveryTracking, isFalse);
    });

    test('deliveryInfo parses nested delivery map', () {
      final order = MobileOrderRecord(
        id: 'o1',
        status: 'in_progress',
        price: 100,
        listingType: 'service',
        consumerId: 'u1',
        providerId: 'u2',
        metadata: {
          'delivery': {
            'status': 'shipped',
            'trackingNumber': 'TRK123',
            'updates': [
              {'status': 'picked_up', 'timestamp': '2026-07-20T10:00:00Z'},
            ],
          },
        },
        createdAt: null,
        updatedAt: null,
      );

      final info = order.deliveryInfo;

      expect(info, isNotNull);
      expect(info!.status, 'shipped');
      expect(info.trackingNumber, 'TRK123');
      expect(info.updates.length, 1);
    });

    test('deliveryInfo is null when no delivery metadata', () {
      final order = MobileOrderRecord(
        id: 'o1',
        status: 'new_lead',
        price: 100,
        listingType: 'service',
        consumerId: 'u1',
        providerId: 'u2',
        metadata: {},
        createdAt: null,
        updatedAt: null,
      );

      expect(order.deliveryInfo, isNull);
    });
  });

  group('MobileDeliveryInfo', () {
    test('isFinal is true for delivered status', () {
      const info = MobileDeliveryInfo(
        status: 'delivered',
        updates: [],
      );

      expect(info.isFinal, isTrue);
    });

    test('isFinal is true for failed status', () {
      const info = MobileDeliveryInfo(
        status: 'failed',
        updates: [],
      );

      expect(info.isFinal, isTrue);
    });

    test('isFinal is false for in-transit status', () {
      const info = MobileDeliveryInfo(
        status: 'in_transit',
        updates: [],
      );

      expect(info.isFinal, isFalse);
    });
  });

  group('MobileCheckoutItem', () {
    test('cartKey combines type and id', () {
      const item = MobileCheckoutItem(
        providerId: 'p1',
        itemType: 'service',
        itemId: 's1',
        title: 'Test',
        price: 100,
      );

      expect(item.cartKey, 'service:s1');
    });

    test('toOrderRequestMap includes payment_status for COD', () {
      const item = MobileCheckoutItem(
        providerId: 'p1',
        itemType: 'service',
        itemId: 's1',
        title: 'Test',
        price: 100,
      );

      final map = item.toOrderRequestMap(
        address: '123 Main St',
        notes: 'Urgent',
        paymentMethod: MobileOrderPaymentMethod.cod,
        fulfillmentMethod: MobileOrderFulfillmentMethod.onsite,
      );

      expect(map['payment_status'], 'cod_due');
      expect(map['fulfillment_method'], 'provider');
    });

    test('toOrderRequestMap includes payment_status for Razorpay', () {
      const item = MobileCheckoutItem(
        providerId: 'p1',
        itemType: 'service',
        itemId: 's1',
        title: 'Test',
        price: 100,
      );

      final map = item.toOrderRequestMap(
        address: '123 Main St',
        notes: '',
        paymentMethod: MobileOrderPaymentMethod.razorpay,
        fulfillmentMethod: MobileOrderFulfillmentMethod.delivery,
        razorpayOrderId: 'rzp-order-1',
      );

      expect(map['payment_status'], 'pending');
      expect(map['razorpay_order_id'], 'rzp-order-1');
    });

    test('omits razorpay_order_id when empty', () {
      const item = MobileCheckoutItem(
        providerId: 'p1',
        itemType: 'service',
        itemId: 's1',
        title: 'Test',
        price: 100,
      );

      final map = item.toOrderRequestMap(
        address: '123 Main St',
        notes: '',
        paymentMethod: MobileOrderPaymentMethod.razorpay,
        fulfillmentMethod: MobileOrderFulfillmentMethod.delivery,
      );

      expect(map.containsKey('razorpay_order_id'), isFalse);
    });
  });

  group('Order enums', () {
    test('MobileOrderFulfillmentMethod.apiValue mappings', () {
      expect(
        MobileOrderFulfillmentMethod.pickup.apiValue,
        'self',
      );
      expect(
        MobileOrderFulfillmentMethod.delivery.apiValue,
        'provider',
      );
      expect(
        MobileOrderFulfillmentMethod.onsite.apiValue,
        'provider',
      );
    });

    test('MobileOrderPaymentMethod.label', () {
      expect(
        MobileOrderPaymentMethod.cod.label,
        'Cash on delivery',
      );
      expect(
        MobileOrderPaymentMethod.razorpay.label,
        'Razorpay',
      );
    });
  });
}
