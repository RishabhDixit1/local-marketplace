enum MobileQuoteTargetMode {
  order,
  helpRequest;

  String get apiValue => this == order ? 'order' : 'help_request';

  String get label => this == order ? 'Order' : 'Request';
}

enum MobileQuoteActorRole { provider, consumer }

enum MobileQuoteStatus {
  draft,
  sent,
  accepted,
  expired,
  cancelled;

  String get label {
    switch (this) {
      case MobileQuoteStatus.draft:
        return 'Draft';
      case MobileQuoteStatus.sent:
        return 'Sent';
      case MobileQuoteStatus.accepted:
        return 'Accepted';
      case MobileQuoteStatus.expired:
        return 'Expired';
      case MobileQuoteStatus.cancelled:
        return 'Cancelled';
    }
  }
}

class MobileQuoteWorkspace {
  const MobileQuoteWorkspace({required this.context, required this.draft});

  factory MobileQuoteWorkspace.fromJson(Map<String, dynamic> json) {
    return MobileQuoteWorkspace(
      context: MobileQuoteContext.fromJson(
        Map<String, dynamic>.from(
          (json['context'] as Map?) ?? const <String, dynamic>{},
        ),
      ),
      draft: json['draft'] is Map
          ? MobileQuoteDraft.fromJson(
              Map<String, dynamic>.from(json['draft'] as Map),
            )
          : null,
    );
  }

  final MobileQuoteContext context;
  final MobileQuoteDraft? draft;
}

class MobileQuoteContext {
  const MobileQuoteContext({
    required this.mode,
    required this.orderId,
    required this.helpRequestId,
    required this.consumerId,
    required this.providerId,
    required this.actorRole,
    required this.canEdit,
    required this.taskTitle,
    required this.taskDescription,
    required this.locationLabel,
    required this.currentStatus,
    required this.suggestedAmount,
    required this.counterpartyName,
  });

  factory MobileQuoteContext.fromJson(Map<String, dynamic> json) {
    return MobileQuoteContext(
      mode: _parseMode(json['mode']),
      orderId: _nullableString(json['orderId']),
      helpRequestId: _nullableString(json['helpRequestId']),
      consumerId: _readString(json['consumerId']),
      providerId: _nullableString(json['providerId']),
      actorRole: _readString(json['actorRole']) == 'provider'
          ? MobileQuoteActorRole.provider
          : MobileQuoteActorRole.consumer,
      canEdit: json['canEdit'] == true,
      taskTitle: _readString(json['taskTitle'], fallback: 'Marketplace task'),
      taskDescription: _readString(json['taskDescription']),
      locationLabel: _readString(json['locationLabel'], fallback: 'Nearby'),
      currentStatus: _readString(json['currentStatus'], fallback: 'open'),
      suggestedAmount: _nullableDouble(json['suggestedAmount']),
      counterpartyName: _readString(
        json['counterpartyName'],
        fallback: 'Local member',
      ),
    );
  }

  final MobileQuoteTargetMode mode;
  final String? orderId;
  final String? helpRequestId;
  final String consumerId;
  final String? providerId;
  final MobileQuoteActorRole actorRole;
  final bool canEdit;
  final String taskTitle;
  final String taskDescription;
  final String locationLabel;
  final String currentStatus;
  final double? suggestedAmount;
  final String counterpartyName;
}

class MobileQuoteDraft {
  const MobileQuoteDraft({
    required this.id,
    required this.orderId,
    required this.helpRequestId,
    required this.providerId,
    required this.consumerId,
    required this.status,
    required this.summary,
    required this.notes,
    required this.subtotal,
    required this.taxAmount,
    required this.total,
    required this.expiresAt,
    required this.sentAt,
    required this.lineItems,
  });

  factory MobileQuoteDraft.fromJson(Map<String, dynamic> json) {
    return MobileQuoteDraft(
      id: _readString(json['id']),
      orderId: _nullableString(json['orderId']),
      helpRequestId: _nullableString(json['helpRequestId']),
      providerId: _readString(json['providerId']),
      consumerId: _nullableString(json['consumerId']),
      status: _parseStatus(json['status']),
      summary: _readString(json['summary']),
      notes: _readString(json['notes']),
      subtotal: _toDouble(json['subtotal']),
      taxAmount: _toDouble(json['taxAmount']),
      total: _toDouble(json['total']),
      expiresAt: _parseDate(json['expiresAt']),
      sentAt: _parseDate(json['sentAt']),
      lineItems: ((json['lineItems'] as List?) ?? const [])
          .whereType<Map>()
          .map(
            (row) =>
                MobileQuoteLineItem.fromJson(Map<String, dynamic>.from(row)),
          )
          .toList(),
    );
  }

  final String id;
  final String? orderId;
  final String? helpRequestId;
  final String providerId;
  final String? consumerId;
  final MobileQuoteStatus status;
  final String summary;
  final String notes;
  final double subtotal;
  final double taxAmount;
  final double total;
  final DateTime? expiresAt;
  final DateTime? sentAt;
  final List<MobileQuoteLineItem> lineItems;

  bool get isAcceptable => status == MobileQuoteStatus.sent;
}

class MobileQuoteLineItem {
  const MobileQuoteLineItem({
    this.id,
    required this.label,
    required this.description,
    required this.quantity,
    required this.unitPrice,
    this.amount,
  });

  factory MobileQuoteLineItem.fromJson(Map<String, dynamic> json) {
    return MobileQuoteLineItem(
      id: _nullableString(json['id']),
      label: _readString(json['label'], fallback: 'Line item'),
      description: _readString(json['description']),
      quantity: _toDouble(json['quantity'], fallback: 1),
      unitPrice: _toDouble(json['unitPrice']),
      amount: _nullableDouble(json['amount']),
    );
  }

  final String? id;
  final String label;
  final String description;
  final double quantity;
  final double unitPrice;
  final double? amount;

  double get calculatedAmount => amount ?? quantity * unitPrice;

  Map<String, dynamic> toInput() {
    return {
      'label': label,
      'description': description,
      'quantity': quantity,
      'unitPrice': unitPrice,
    };
  }
}

class MobileQuoteDraftInput {
  const MobileQuoteDraftInput({
    required this.mode,
    required this.targetId,
    required this.summary,
    required this.notes,
    required this.taxAmount,
    required this.expiresAt,
    required this.lineItems,
    this.conversationId,
  });

  final MobileQuoteTargetMode mode;
  final String targetId;
  final String summary;
  final String notes;
  final double taxAmount;
  final DateTime? expiresAt;
  final List<MobileQuoteLineItem> lineItems;
  final String? conversationId;

  Map<String, dynamic> toJson() {
    return {
      if (mode == MobileQuoteTargetMode.order) 'orderId': targetId,
      if (mode == MobileQuoteTargetMode.helpRequest) 'helpRequestId': targetId,
      'summary': summary,
      'notes': notes,
      'taxAmount': taxAmount,
      'expiresAt': expiresAt?.toUtc().toIso8601String(),
      'lineItems': lineItems.map((item) => item.toInput()).toList(),
      if ((conversationId ?? '').trim().isNotEmpty)
        'conversationId': conversationId!.trim(),
    };
  }
}

MobileQuoteTargetMode quoteTargetModeFromSource(String? source) {
  final normalized = (source ?? '').trim().toLowerCase();
  if (normalized == 'order' || normalized == 'orders') {
    return MobileQuoteTargetMode.order;
  }
  return MobileQuoteTargetMode.helpRequest;
}

MobileQuoteTargetMode _parseMode(Object? value) {
  final normalized = _readString(value).toLowerCase();
  if (normalized == 'order') {
    return MobileQuoteTargetMode.order;
  }
  return MobileQuoteTargetMode.helpRequest;
}

MobileQuoteStatus _parseStatus(Object? value) {
  switch (_readString(value).toLowerCase()) {
    case 'sent':
      return MobileQuoteStatus.sent;
    case 'accepted':
      return MobileQuoteStatus.accepted;
    case 'expired':
      return MobileQuoteStatus.expired;
    case 'cancelled':
    case 'canceled':
      return MobileQuoteStatus.cancelled;
    default:
      return MobileQuoteStatus.draft;
  }
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String? _nullableString(Object? value) {
  final text = _readString(value);
  return text.isEmpty ? null : text;
}

double _toDouble(Object? value, {double fallback = 0}) {
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value) ?? fallback;
  }
  return fallback;
}

double? _nullableDouble(Object? value) {
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value);
  }
  return null;
}

DateTime? _parseDate(Object? value) {
  if (value is! String || value.trim().isEmpty) {
    return null;
  }
  return DateTime.tryParse(value.trim())?.toLocal();
}
