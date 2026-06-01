class VerificationDocument {
  const VerificationDocument({
    required this.id,
    required this.documentType,
    required this.fileUrl,
    this.status = 'pending',
    this.reviewerNotes,
    required this.submittedAt,
  });

  factory VerificationDocument.fromJson(Map<String, dynamic> json) {
    return VerificationDocument(
      id: _readString(json['id']),
      documentType: _readString(json['document_type']),
      fileUrl: _readString(json['file_url']),
      status: _readString(json['status'], fallback: 'pending'),
      reviewerNotes: json['reviewer_notes'] as String?,
      submittedAt: _parseDate(json['submitted_at']) ?? DateTime.now(),
    );
  }

  final String id;
  final String documentType;
  final String fileUrl;
  final String status;
  final String? reviewerNotes;
  final DateTime submittedAt;

  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';
  bool get isPending => status == 'pending';

  String get documentTypeLabel {
    switch (documentType) {
      case 'id_proof':
        return 'ID Proof (Aadhaar, PAN, DL)';
      case 'address_proof':
        return 'Address Proof';
      case 'business_license':
        return 'Business License / GST';
      case 'professional_certificate':
        return 'Professional Certificate';
      case 'insurance':
        return 'Insurance Certificate';
      case 'guarantee':
        return 'Service Guarantee Document';
      default:
        return documentType.replaceAll('_', ' ');
    }
  }
}

class VerificationStatus {
  const VerificationStatus({
    this.status = 'unverified',
    this.level = 'email',
  });

  factory VerificationStatus.fromJson(Map<String, dynamic> json) {
    return VerificationStatus(
      status: _readString(json['status'], fallback: 'unverified'),
      level: _readString(json['level'], fallback: 'email'),
    );
  }

  final String status;
  final String level;

  bool get isUnverified => status == 'unverified';
  bool get isPending => status == 'pending';
  bool get isVerified => status == 'verified';
  bool get isRejected => status == 'rejected';
}

class VerificationBundle {
  const VerificationBundle({
    required this.status,
    required this.documents,
  });

  factory VerificationBundle.fromJson(
    Map<String, dynamic> statusJson,
    List<dynamic> documentsList,
  ) {
    return VerificationBundle(
      status: VerificationStatus.fromJson(statusJson),
      documents: documentsList
          .whereType<Map<String, dynamic>>()
          .map(VerificationDocument.fromJson)
          .toList(),
    );
  }

  final VerificationStatus status;
  final List<VerificationDocument> documents;

  int get pendingCount => documents.where((d) => d.isPending).length;
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

DateTime? _parseDate(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  return DateTime.tryParse(value.trim())?.toLocal();
}
