import 'dart:math' as math;

import 'quote_models.dart';

class GeneratedMobileQuoteDraft {
  const GeneratedMobileQuoteDraft({
    required this.summary,
    required this.notes,
    required this.expiresDays,
    required this.lineItems,
  });

  final String summary;
  final String notes;
  final int expiresDays;
  final List<MobileQuoteLineItem> lineItems;
}

GeneratedMobileQuoteDraft generateMobileQuoteDraft(MobileQuoteContext? context) {
  if (context == null) {
    return GeneratedMobileQuoteDraft(
      summary: 'Quote',
      notes: '',
      expiresDays: 7,
      lineItems: const [],
    );
  }

  final taskTitle = _trim(context.taskTitle).isEmpty
      ? 'Scope item'
      : _trim(context.taskTitle);
  final taskDescription = _trim(context.taskDescription);
  final locationLabel = _trim(context.locationLabel);
  final counterpartyName = _trim(context.counterpartyName).isEmpty
      ? 'Client'
      : _trim(context.counterpartyName);
  final suggestedAmount = _positiveAmount(context.suggestedAmount);
  final descriptionItems = taskDescription.isEmpty
      ? const <String>[]
      : _splitScopeItems(taskDescription);

  final labels = descriptionItems.length >= 2
      ? descriptionItems.take(3).map(_titleCase).toList()
      : [_titleCase(taskTitle)];
  final amounts = suggestedAmount == null
      ? labels.map((_) => 0.0).toList()
      : _distributeAmount(suggestedAmount, labels.length);

  final lineItems = descriptionItems.isEmpty
      ? [
          MobileQuoteLineItem(
            label: _titleCase(taskTitle),
            description: _limit(taskDescription, 160),
            quantity: 1,
            unitPrice: suggestedAmount ?? 0,
          ),
        ]
      : [
          for (var index = 0; index < labels.length; index += 1)
            MobileQuoteLineItem(
              label: labels[index],
              description: index == 0 && descriptionItems.length < 2
                  ? _limit(taskDescription, 160)
                  : '',
              quantity: 1,
              unitPrice: amounts[index],
            ),
        ];

  final notes = [
    if (locationLabel.isNotEmpty) 'Location: $locationLabel.',
    'Pricing is indicative. Please confirm scope before work begins.',
    if (suggestedAmount == null)
      'Update line item prices to match your actual rates.',
  ].join(' ');

  return GeneratedMobileQuoteDraft(
    summary: 'Quote for $counterpartyName - $taskTitle',
    notes: notes,
    expiresDays: 7,
    lineItems: lineItems,
  );
}

String _trim(String value) => value.trim();

double? _positiveAmount(double? value) {
  if (value == null || !value.isFinite || value <= 0) {
    return null;
  }
  return value.roundToDouble();
}

List<String> _splitScopeItems(String text) {
  return text
      .split(RegExp(r',|;|\r?\n'))
      .map((part) => part.replaceFirst(RegExp(r'^[-*.\d)\s]+'), '').trim())
      .where((part) => part.length > 2 && part.length < 100)
      .take(4)
      .toList();
}

String _titleCase(String value) {
  return value
      .toLowerCase()
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty)
      .map((word) => '${word[0].toUpperCase()}${word.substring(1)}')
      .join(' ');
}

String _limit(String value, int maxLength) {
  final trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.substring(0, math.max(0, maxLength)).trim();
}

List<double> _distributeAmount(double total, int count) {
  if (count <= 1) {
    return [total];
  }

  final base = (total / count * 100).floorToDouble() / 100;
  final remainder = ((total - base * count) * 100).roundToDouble() / 100;
  final shares = List<double>.filled(count, base);
  if (remainder > 0) {
    shares[0] = ((shares[0] + remainder) * 100).roundToDouble() / 100;
  }
  return shares;
}
