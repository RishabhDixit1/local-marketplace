enum ReportReason {
  spam,
  inappropriate,
  fakeListing,
  scam,
  harassment,
  wrongCategory,
  duplicate,
  other;

  String get label {
    switch (this) {
      case ReportReason.spam:
        return 'Spam';
      case ReportReason.inappropriate:
        return 'Inappropriate content';
      case ReportReason.fakeListing:
        return 'Fake or misleading listing';
      case ReportReason.scam:
        return 'Scam or fraud';
      case ReportReason.harassment:
        return 'Harassment or abuse';
      case ReportReason.wrongCategory:
        return 'Wrong category';
      case ReportReason.duplicate:
        return 'Duplicate listing';
      case ReportReason.other:
        return 'Other';
    }
  }

  String get apiValue => name;
}

enum ReportTargetType { feedItem, provider, message, listing }

class ReportSubmission {
  final ReportTargetType targetType;
  final String targetId;
  final ReportReason reason;
  final String? description;

  ReportSubmission({
    required this.targetType,
    required this.targetId,
    required this.reason,
    this.description,
  });

  Map<String, dynamic> toJson() => {
    'targetType': targetType.name,
    'targetId': targetId,
    'reason': reason.apiValue,
    if (description != null && description!.trim().isNotEmpty) 'description': description!.trim(),
  };
}
