import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:serviq_mobile/core/api/mobile_api_client.dart';
import 'package:serviq_mobile/features/quotes/data/quote_repository.dart';
import 'package:serviq_mobile/features/quotes/domain/quote_models.dart';

class MockMobileApiClient extends Mock implements MobileApiClient {}

void main() {
  late MockMobileApiClient mockApi;
  late QuoteRepository repository;

  setUp(() {
    mockApi = MockMobileApiClient();
    repository = QuoteRepository(mockApi);
  });

  group('QuoteRepository', () {
    group('acceptQuote', () {
      test('sends accept request and succeeds on ok', () async {
        when(() => mockApi.postJson('/api/quotes/quote-1/accept')).thenAnswer(
          (_) async => {'ok': true},
        );

        await repository.acceptQuote('quote-1');

        verify(() => mockApi.postJson('/api/quotes/quote-1/accept')).called(1);
      });

      test('throws ApiException when ok is false', () async {
        when(() => mockApi.postJson('/api/quotes/quote-1/accept')).thenAnswer(
          (_) async => {'ok': false, 'message': 'Quote already accepted'},
        );

        expect(
          () => repository.acceptQuote('quote-1'),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'Quote already accepted',
            ),
          ),
        );
      });

      test('throws ApiException with default message when no message', () async {
        when(() => mockApi.postJson('/api/quotes/quote-1/accept')).thenAnswer(
          (_) async => {'ok': false},
        );

        expect(
          () => repository.acceptQuote('quote-1'),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'Unable to accept quote.',
            ),
          ),
        );
      });
    });

    group('rejectQuote', () {
      test('sends reject request with reason and counter', () async {
        when(() => mockApi.postJson('/api/quotes/reject', body: any(named: 'body')))
            .thenAnswer((_) async => {'ok': true});

        final input = QuoteRejectInput(
          quoteId: 'quote-1',
          reason: 'Too expensive',
          counterAmount: 800,
        );

        await repository.rejectQuote(input);

        verify(
          () => mockApi.postJson('/api/quotes/reject', body: {
            'quoteId': 'quote-1',
            'reason': 'Too expensive',
            'counterAmount': 800,
          }),
        ).called(1);
      });

      test('sends reject request without optional fields', () async {
        when(() => mockApi.postJson('/api/quotes/reject', body: any(named: 'body')))
            .thenAnswer((_) async => {'ok': true});

        final input = QuoteRejectInput(quoteId: 'quote-1');

        await repository.rejectQuote(input);

        verify(
          () => mockApi.postJson('/api/quotes/reject', body: {
            'quoteId': 'quote-1',
          }),
        ).called(1);
      });

      test('throws ApiException on failure', () async {
        when(() => mockApi.postJson('/api/quotes/reject', body: any(named: 'body')))
            .thenAnswer(
          (_) async => {'ok': false, 'message': 'Quote not found'},
        );

        expect(
          () => repository.rejectQuote(
            QuoteRejectInput(quoteId: 'quote-1'),
          ),
          throwsA(isA<ApiException>()),
        );
      });
    });

    group('fetchWorkspace', () {
      test('passes orderId for order mode', () async {
        when(() => mockApi.getJson('/api/quotes/draft',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {
                  'ok': true,
                  'context': {
                    'mode': 'order',
                    'orderId': 'order-1',
                    'consumerId': 'user-1',
                    'actorRole': 'provider',
                    'canEdit': true,
                    'taskTitle': 'Test task',
                    'taskDescription': '',
                    'locationLabel': 'Delhi',
                    'currentStatus': 'open',
                    'counterpartyName': 'Test User',
                  },
                });

        final request = QuoteWorkspaceRequest(
          mode: MobileQuoteTargetMode.order,
          targetId: 'order-1',
        );

        final workspace = await repository.fetchWorkspace(request);

        expect(workspace.context.mode, MobileQuoteTargetMode.order);
        expect(workspace.context.orderId, 'order-1');
      });

      test('passes helpRequestId for helpRequest mode', () async {
        when(() => mockApi.getJson('/api/quotes/draft',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {
                  'ok': true,
                  'context': {
                    'mode': 'help_request',
                    'helpRequestId': 'hr-1',
                    'consumerId': 'user-1',
                    'actorRole': 'provider',
                    'canEdit': true,
                    'taskTitle': 'Test task',
                    'taskDescription': '',
                    'locationLabel': 'Delhi',
                    'currentStatus': 'open',
                    'counterpartyName': 'Test User',
                  },
                });

        final request = QuoteWorkspaceRequest(
          mode: MobileQuoteTargetMode.helpRequest,
          targetId: 'hr-1',
        );

        final workspace = await repository.fetchWorkspace(request);

        expect(workspace.context.mode, MobileQuoteTargetMode.helpRequest);
        expect(workspace.context.helpRequestId, 'hr-1');
      });
    });

    group('fetchDealRoom', () {
      test('returns null when ok is false', () async {
        when(() => mockApi.getJson('/api/quotes/deal-room',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {'ok': false});

        final result = await repository.fetchDealRoom('order-1');

        expect(result, isNull);
      });

      test('returns null when data is null', () async {
        when(() => mockApi.getJson('/api/quotes/deal-room',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {'ok': true});

        final result = await repository.fetchDealRoom('order-1');

        expect(result, isNull);
      });

      test('returns DealRoomContext when data is present', () async {
        when(() => mockApi.getJson('/api/quotes/deal-room',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {
                  'ok': true,
                  'data': {
                    'order_status': 'in_progress',
                    'budget_min': 500,
                    'budget_max': 2000,
                  },
                });

        final result = await repository.fetchDealRoom('order-1');

        expect(result, isNotNull);
        expect(result!.orderStatus, 'in_progress');
        expect(result.budgetMin, 500);
        expect(result.budgetMax, 2000);
      });
    });
  });

  group('QuoteRejectInput', () {
    test('toJson includes only non-null optional fields', () {
      final input = QuoteRejectInput(quoteId: 'q1');
      final json = input.toJson();

      expect(json, equals({'quoteId': 'q1'}));
      expect(json.containsKey('reason'), isFalse);
      expect(json.containsKey('counterAmount'), isFalse);
    });

    test('toJson includes reason when non-empty', () {
      final input = QuoteRejectInput(
        quoteId: 'q1',
        reason: 'Too slow',
      );
      final json = input.toJson();

      expect(json['reason'], 'Too slow');
    });

    test('toJson omits empty reason', () {
      final input = QuoteRejectInput(
        quoteId: 'q1',
        reason: '',
      );
      final json = input.toJson();

      expect(json.containsKey('reason'), isFalse);
    });

    test('toJson includes counterAmount when set', () {
      final input = QuoteRejectInput(
        quoteId: 'q1',
        counterAmount: 1500,
      );
      final json = input.toJson();

      expect(json['counterAmount'], 1500);
    });
  });

  group('MobileQuoteDraft', () {
    test('isAcceptable is true only when status is sent', () {
      final sentDraft = MobileQuoteDraft(
        id: 'q1',
        orderId: 'order-1',
        helpRequestId: 'hr-1',
        providerId: 'p1',
        consumerId: 'user-1',
        status: MobileQuoteStatus.sent,
        summary: 'Test',
        notes: '',
        subtotal: 100,
        taxAmount: 10,
        total: 110,
        expiresAt: null,
        sentAt: null,
        lineItems: [],
      );

      expect(sentDraft.isAcceptable, isTrue);

      final draftDraft = MobileQuoteDraft(
        id: 'q2',
        orderId: 'order-2',
        helpRequestId: 'hr-2',
        providerId: 'p1',
        consumerId: 'user-1',
        status: MobileQuoteStatus.draft,
        summary: 'Test',
        notes: '',
        subtotal: 100,
        taxAmount: 10,
        total: 110,
        expiresAt: null,
        sentAt: null,
        lineItems: [],
      );

      expect(draftDraft.isAcceptable, isFalse);

      final acceptedDraft = MobileQuoteDraft(
        id: 'q3',
        orderId: 'order-3',
        helpRequestId: 'hr-3',
        providerId: 'p1',
        consumerId: 'user-1',
        status: MobileQuoteStatus.accepted,
        summary: 'Test',
        notes: '',
        subtotal: 100,
        taxAmount: 10,
        total: 110,
        expiresAt: null,
        sentAt: null,
        lineItems: [],
      );

      expect(acceptedDraft.isAcceptable, isFalse);
    });
  });

  group('quoteTargetModeFromSource', () {
    test('returns order for "order"', () {
      expect(
        quoteTargetModeFromSource('order'),
        MobileQuoteTargetMode.order,
      );
    });

    test('returns order for "orders"', () {
      expect(
        quoteTargetModeFromSource('orders'),
        MobileQuoteTargetMode.order,
      );
    });

    test('returns order case-insensitively', () {
      expect(
        quoteTargetModeFromSource('ORDER'),
        MobileQuoteTargetMode.order,
      );
    });

    test('returns helpRequest for null', () {
      expect(
        quoteTargetModeFromSource(null),
        MobileQuoteTargetMode.helpRequest,
      );
    });

    test('returns helpRequest for unknown string', () {
      expect(
        quoteTargetModeFromSource('help_request'),
        MobileQuoteTargetMode.helpRequest,
      );
    });

    test('returns helpRequest for empty string', () {
      expect(
        quoteTargetModeFromSource(''),
        MobileQuoteTargetMode.helpRequest,
      );
    });
  });

  group('MobileQuoteDraftInput.toJson', () {
    test('includes orderId for order mode', () {
      final input = MobileQuoteDraftInput(
        mode: MobileQuoteTargetMode.order,
        targetId: 'order-1',
        summary: 'Test quote',
        notes: 'Notes here',
        taxAmount: 10,
        expiresAt: null,
        lineItems: [],
      );

      final json = input.toJson();

      expect(json['orderId'], 'order-1');
      expect(json.containsKey('helpRequestId'), isFalse);
      expect(json['summary'], 'Test quote');
      expect(json['notes'], 'Notes here');
      expect(json['taxAmount'], 10);
    });

    test('includes helpRequestId for helpRequest mode', () {
      final input = MobileQuoteDraftInput(
        mode: MobileQuoteTargetMode.helpRequest,
        targetId: 'hr-1',
        summary: 'Test quote',
        notes: '',
        taxAmount: 0,
        expiresAt: null,
        lineItems: [],
      );

      final json = input.toJson();

      expect(json['helpRequestId'], 'hr-1');
      expect(json.containsKey('orderId'), isFalse);
    });

    test('includes conversationId when non-empty', () {
      final input = MobileQuoteDraftInput(
        mode: MobileQuoteTargetMode.order,
        targetId: 'order-1',
        summary: 'Test',
        notes: '',
        taxAmount: 0,
        expiresAt: null,
        lineItems: [],
        conversationId: 'conv-1',
      );

      final json = input.toJson();

      expect(json['conversationId'], 'conv-1');
    });

    test('omits conversationId when empty', () {
      final input = MobileQuoteDraftInput(
        mode: MobileQuoteTargetMode.order,
        targetId: 'order-1',
        summary: 'Test',
        notes: '',
        taxAmount: 0,
        expiresAt: null,
        lineItems: [],
        conversationId: '',
      );

      final json = input.toJson();

      expect(json.containsKey('conversationId'), isFalse);
    });

    test('converts expiresAt to UTC ISO8601', () {
      final dt = DateTime.utc(2026, 7, 15, 12, 0, 0);
      final input = MobileQuoteDraftInput(
        mode: MobileQuoteTargetMode.order,
        targetId: 'order-1',
        summary: 'Test',
        notes: '',
        taxAmount: 0,
        expiresAt: dt,
        lineItems: [],
      );

      final json = input.toJson();

      expect(json['expiresAt'], '2026-07-15T12:00:00.000Z');
    });
  });

  group('MobileQuoteLineItem', () {
    test('calculatedAmount uses explicit amount when set', () {
      final item = MobileQuoteLineItem(
        label: 'Item',
        description: 'Desc',
        quantity: 3,
        unitPrice: 100,
        amount: 250,
      );

      expect(item.calculatedAmount, 250);
    });

    test('calculatedAmount falls back to quantity * unitPrice', () {
      final item = MobileQuoteLineItem(
        label: 'Item',
        description: 'Desc',
        quantity: 3,
        unitPrice: 100,
      );

      expect(item.calculatedAmount, 300);
    });

    test('toInput maps to API-compatible map', () {
      final item = MobileQuoteLineItem(
        id: 'li-1',
        label: 'Electrical inspection',
        description: 'Full home check',
        quantity: 1,
        unitPrice: 1500,
      );

      final input = item.toInput();

      expect(input['label'], 'Electrical inspection');
      expect(input['description'], 'Full home check');
      expect(input['quantity'], 1);
      expect(input['unitPrice'], 1500);
      expect(input.containsKey('id'), isFalse);
    });
  });
}
