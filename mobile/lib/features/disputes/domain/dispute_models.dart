enum DisputeReason {
  serviceNotProvided,
  poorQuality,
  lateDelivery,
  wrongItem,
  pricingIssue,
  communication,
  other;

  String get label {
    switch (this) {
      case DisputeReason.serviceNotProvided:
        return 'Service not provided';
      case DisputeReason.poorQuality:
        return 'Poor quality work';
      case DisputeReason.lateDelivery:
        return 'Late delivery';
      case DisputeReason.wrongItem:
        return 'Wrong item/service';
      case DisputeReason.pricingIssue:
        return 'Pricing / billing issue';
      case DisputeReason.communication:
        return 'Communication breakdown';
      case DisputeReason.other:
        return 'Other';
    }
  }

  String get apiValue {
    switch (this) {
      case DisputeReason.serviceNotProvided:
        return 'service_not_provided';
      case DisputeReason.poorQuality:
        return 'poor_quality';
      case DisputeReason.lateDelivery:
        return 'late_delivery';
      case DisputeReason.wrongItem:
        return 'wrong_item';
      case DisputeReason.pricingIssue:
        return 'pricing_issue';
      case DisputeReason.communication:
        return 'communication';
      case DisputeReason.other:
        return 'other';
    }
  }
}

class DisputeSubmission {
  final String orderId;
  final DisputeReason reason;
  final String description;

  const DisputeSubmission({
    required this.orderId,
    required this.reason,
    required this.description,
  });

  Map<String, dynamic> toJson() => {
    'orderId': orderId,
    'reason': reason.apiValue,
    'description': description.trim(),
  };
}
