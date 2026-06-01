class MobileLaunchpadWorkspace {
  const MobileLaunchpadWorkspace({required this.draft, required this.summary});

  factory MobileLaunchpadWorkspace.fromJson(Map<String, dynamic> json) {
    final draftJson = json['draft'];
    return MobileLaunchpadWorkspace(
      draft: draftJson is Map
          ? MobileLaunchpadDraft.fromJson(Map<String, dynamic>.from(draftJson))
          : null,
      summary: MobileLaunchpadSummary.fromJson(
        Map<String, dynamic>.from(
          (json['summary'] as Map?) ?? const <String, dynamic>{},
        ),
      ),
    );
  }

  final MobileLaunchpadDraft? draft;
  final MobileLaunchpadSummary summary;
}

class MobileLaunchpadSummary {
  const MobileLaunchpadSummary({
    required this.profileExists,
    required this.profilePath,
    required this.businessPath,
    required this.totalServices,
    required this.totalProducts,
    required this.lastPublishedAt,
  });

  factory MobileLaunchpadSummary.fromJson(Map<String, dynamic> json) {
    return MobileLaunchpadSummary(
      profileExists: json['profileExists'] == true,
      profilePath: _nullableString(json['profilePath']),
      businessPath: _nullableString(json['businessPath']),
      totalServices: _toInt(json['totalServices']),
      totalProducts: _toInt(json['totalProducts']),
      lastPublishedAt: _parseDate(json['lastPublishedAt']),
    );
  }

  final bool profileExists;
  final String? profilePath;
  final String? businessPath;
  final int totalServices;
  final int totalProducts;
  final DateTime? lastPublishedAt;
}

class MobileLaunchpadDraft {
  const MobileLaunchpadDraft({
    required this.id,
    required this.status,
    required this.answers,
    required this.generatedServices,
    required this.generatedProducts,
    required this.updatedAt,
  });

  factory MobileLaunchpadDraft.fromJson(Map<String, dynamic> json) {
    return MobileLaunchpadDraft(
      id: _readString(json['id']),
      status: _readString(json['status'], fallback: 'draft'),
      answers: MobileLaunchpadAnswers.fromJson(
        Map<String, dynamic>.from(
          (json['answers'] as Map?) ?? const <String, dynamic>{},
        ),
      ),
      generatedServices: ((json['generatedServices'] as List?) ?? const [])
          .whereType<Map>()
          .map(
            (row) => MobileLaunchpadGeneratedOffering.fromJson(
              Map<String, dynamic>.from(row),
            ),
          )
          .toList(),
      generatedProducts: ((json['generatedProducts'] as List?) ?? const [])
          .whereType<Map>()
          .map(
            (row) => MobileLaunchpadGeneratedOffering.fromJson(
              Map<String, dynamic>.from(row),
            ),
          )
          .toList(),
      updatedAt: _parseDate(json['updatedAt']),
    );
  }

  final String id;
  final String status;
  final MobileLaunchpadAnswers answers;
  final List<MobileLaunchpadGeneratedOffering> generatedServices;
  final List<MobileLaunchpadGeneratedOffering> generatedProducts;
  final DateTime? updatedAt;
}

class MobileLaunchpadAnswers {
  const MobileLaunchpadAnswers({
    required this.businessName,
    required this.businessType,
    required this.offeringType,
    required this.primaryCategory,
    required this.location,
    required this.serviceArea,
    required this.serviceRadiusKm,
    required this.shortDescription,
    required this.coreOfferings,
    required this.catalogText,
    required this.pricingNotes,
    required this.hours,
    required this.phone,
    required this.website,
    required this.brandTone,
    this.latitude,
    this.longitude,
  });

  factory MobileLaunchpadAnswers.fromJson(Map<String, dynamic> json) {
    return MobileLaunchpadAnswers(
      businessName: _readString(json['businessName']),
      businessType: _readString(
        json['businessType'],
        fallback: 'local_service',
      ),
      offeringType: _readString(json['offeringType'], fallback: 'services'),
      primaryCategory: _readString(json['primaryCategory']),
      location: _readString(json['location']),
      serviceArea: _readString(json['serviceArea']),
      serviceRadiusKm: _toInt(json['serviceRadiusKm'], fallback: 5),
      shortDescription: _readString(json['shortDescription']),
      coreOfferings: _readString(json['coreOfferings']),
      catalogText: _readString(json['catalogText']),
      pricingNotes: _readString(json['pricingNotes']),
      hours: _readString(json['hours']),
      phone: _readString(json['phone']),
      website: _readString(json['website']),
      brandTone: _readString(json['brandTone'], fallback: 'friendly'),
      latitude: _nullableDouble(json['latitude']),
      longitude: _nullableDouble(json['longitude']),
    );
  }

  factory MobileLaunchpadAnswers.empty() {
    return const MobileLaunchpadAnswers(
      businessName: '',
      businessType: 'local_service',
      offeringType: 'services',
      primaryCategory: '',
      location: '',
      serviceArea: '',
      serviceRadiusKm: 5,
      shortDescription: '',
      coreOfferings: '',
      catalogText: '',
      pricingNotes: '',
      hours: '',
      phone: '',
      website: '',
      brandTone: 'friendly',
      latitude: null,
      longitude: null,
    );
  }

  final String businessName;
  final String businessType;
  final String offeringType;
  final String primaryCategory;
  final String location;
  final String serviceArea;
  final int serviceRadiusKm;
  final String shortDescription;
  final String coreOfferings;
  final String catalogText;
  final String pricingNotes;
  final String hours;
  final String phone;
  final String website;
  final String brandTone;
  final double? latitude;
  final double? longitude;

  Map<String, dynamic> toJson() {
    return {
      'businessName': businessName,
      'businessType': businessType,
      'offeringType': offeringType,
      'primaryCategory': primaryCategory,
      'location': location,
      'serviceArea': serviceArea,
      'serviceRadiusKm': serviceRadiusKm,
      'shortDescription': shortDescription,
      'coreOfferings': coreOfferings,
      'catalogText': catalogText,
      'pricingNotes': pricingNotes,
      'hours': hours,
      'phone': phone,
      'website': website,
      'brandTone': brandTone,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    };
  }
}

class MobileLaunchpadGeneratedOffering {
  const MobileLaunchpadGeneratedOffering({
    required this.title,
    required this.description,
    required this.category,
    required this.price,
  });

  factory MobileLaunchpadGeneratedOffering.fromJson(Map<String, dynamic> json) {
    return MobileLaunchpadGeneratedOffering(
      title: _readString(json['title'], fallback: 'Untitled offering'),
      description: _readString(json['description']),
      category: _readString(json['category']),
      price: _nullableDouble(json['price']),
    );
  }

  final String title;
  final String description;
  final String category;
  final double? price;
}

class MobileLaunchpadPublishResult {
  const MobileLaunchpadPublishResult({
    required this.publishedServices,
    required this.publishedProducts,
    required this.profilePath,
    required this.businessPath,
  });

  factory MobileLaunchpadPublishResult.fromJson(Map<String, dynamic> json) {
    return MobileLaunchpadPublishResult(
      publishedServices: _toInt(json['publishedServices']),
      publishedProducts: _toInt(json['publishedProducts']),
      profilePath: _readString(json['profilePath']),
      businessPath: _readString(json['businessPath']),
    );
  }

  final int publishedServices;
  final int publishedProducts;
  final String profilePath;
  final String businessPath;
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String? _nullableString(Object? value) {
  final text = _readString(value);
  return text.isEmpty ? null : text;
}

int _toInt(Object? value, {int fallback = 0}) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? fallback;
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
