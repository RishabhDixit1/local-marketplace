import 'package:flutter_test/flutter_test.dart';
import 'package:serviq_mobile/features/quotes/domain/quote_drafting.dart';
import 'package:serviq_mobile/features/quotes/domain/quote_models.dart';

void main() {
  test('generated quote draft uses suggested amount and scope context', () {
    const context = MobileQuoteContext(
      mode: MobileQuoteTargetMode.helpRequest,
      orderId: null,
      helpRequestId: 'need-1',
      consumerId: 'consumer-1',
      providerId: 'provider-1',
      actorRole: MobileQuoteActorRole.provider,
      canEdit: true,
      taskTitle: 'Bathroom tap repair',
      taskDescription: 'Inspect leak, Replace washer, Test water flow',
      locationLabel: 'Sector 62',
      currentStatus: 'matched',
      suggestedAmount: 900,
      counterpartyName: 'Asha',
    );

    final draft = generateMobileQuoteDraft(context);

    expect(draft.summary, 'Quote for Asha - Bathroom tap repair');
    expect(draft.expiresDays, 7);
    expect(draft.notes, contains('Location: Sector 62.'));
    expect(draft.lineItems, hasLength(3));
    expect(draft.lineItems.map((item) => item.label), [
      'Inspect Leak',
      'Replace Washer',
      'Test Water Flow',
    ]);
    expect(
      draft.lineItems.fold<double>(0, (sum, item) => sum + item.unitPrice),
      900,
    );
  });

  test('generated quote draft asks provider to fill rates without amount', () {
    const context = MobileQuoteContext(
      mode: MobileQuoteTargetMode.order,
      orderId: 'order-1',
      helpRequestId: null,
      consumerId: 'consumer-1',
      providerId: 'provider-1',
      actorRole: MobileQuoteActorRole.provider,
      canEdit: true,
      taskTitle: 'Kitchen shelf installation',
      taskDescription: 'Install one wall shelf with existing brackets',
      locationLabel: 'Nearby',
      currentStatus: 'new_lead',
      suggestedAmount: null,
      counterpartyName: '',
    );

    final draft = generateMobileQuoteDraft(context);

    expect(draft.summary, 'Quote for Client - Kitchen shelf installation');
    expect(draft.notes, contains('Update line item prices'));
    expect(draft.lineItems, hasLength(1));
    expect(draft.lineItems.single.unitPrice, 0);
    expect(
      draft.lineItems.single.description,
      'Install one wall shelf with existing brackets',
    );
  });
}
