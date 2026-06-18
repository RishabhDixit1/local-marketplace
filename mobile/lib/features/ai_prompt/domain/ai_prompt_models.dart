class AiPromptResponse {
  final String response;
  final String action;
  final String? redirect;
  final Map<String, dynamic>? data;
  final List<String> suggestions;

  const AiPromptResponse({
    required this.response,
    required this.action,
    this.redirect,
    this.data,
    this.suggestions = const [],
  });

  factory AiPromptResponse.fromJson(Map<String, dynamic> json) {
    return AiPromptResponse(
      response: (json['response'] as String?) ?? '',
      action: (json['action'] as String?) ?? 'find_service',
      redirect: json['redirect'] as String?,
      data: json['data'] as Map<String, dynamic>?,
      suggestions: ((json['suggestions'] as List?) ?? [])
          .whereType<String>()
          .toList(),
    );
  }
}
