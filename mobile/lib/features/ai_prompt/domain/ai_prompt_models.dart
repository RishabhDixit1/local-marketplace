class AiPromptResponse {
  final String response;
  final String action;
  final String? redirect;
  final Map<String, String>? redirectParams;
  final Map<String, dynamic>? data;
  final List<String> suggestions;
  final String? intentType;
  final double? confidence;
  final int providerCount;

  const AiPromptResponse({
    required this.response,
    required this.action,
    this.redirect,
    this.redirectParams,
    this.data,
    this.suggestions = const [],
    this.intentType,
    this.confidence,
    this.providerCount = 0,
  });

  bool get hasProviders => providerCount > 0;
  bool get isRequirementPost => intentType == 'requirement_post';
  bool get isDirectBooking => intentType == 'direct_booking';

  factory AiPromptResponse.fromJson(Map<String, dynamic> json) {
    final providers = (json['data']?['providers'] as List?) ?? [];
    final rawRedirectParams = json['redirectParams'];
    Map<String, String>? redirectParams;
    if (rawRedirectParams is Map) {
      redirectParams = rawRedirectParams.map(
        (key, value) => MapEntry(key.toString(), value?.toString() ?? ''),
      );
    }
    return AiPromptResponse(
      response: (json['response'] as String?) ?? '',
      action: (json['action'] as String?) ?? 'find_service',
      redirect: json['redirect'] as String?,
      redirectParams: redirectParams,
      data: json['data'] as Map<String, dynamic>?,
      suggestions: ((json['suggestions'] as List?) ?? [])
          .whereType<String>()
          .toList(),
      intentType: json['intentType'] as String?,
      confidence: (json['confidence'] as num?)?.toDouble(),
      providerCount: providers.length,
    );
  }
}
