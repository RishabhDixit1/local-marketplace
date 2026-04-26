class AppRoutes {
  static const root = '/';
  static const setup = '/setup';
  static const signIn = '/sign-in';

  static const home = welcome;
  static const welcome = '/app/welcome';
  static const explore = '/app/explore';
  static const people = '/app/people';
  static const tasks = '/app/tasks';
  static const chat = '/app/chat';
  static const inbox = '/app/inbox';
  static const profile = '/app/profile';
  static const createNeed = '/app/create-need';
  static const createRequest = createNeed;
  static const control = '/app/control';
  static const search = '/app/search';
  static const notifications = '/app/notifications';
  static const providerOnboarding = '/app/provider-onboarding';

  static String provider(String providerId) => '/app/provider/$providerId';
  static String chatThread(String threadId) => '/app/chat/thread/$threadId';
  static String inboxThread(String conversationId) =>
      chatThread(conversationId);

  static String chatDirect({
    required String recipientId,
    String? draft,
    String? contextTitle,
    String? contextTaskId,
    String? contextStatus,
    String? source,
  }) {
    return _withQuery(chat, {
      'recipientId': recipientId,
      'draft': draft,
      'title': contextTitle,
      'taskId': contextTaskId,
      'status': contextStatus,
      'source': source,
    });
  }

  static String chatThreadWithContext(
    String threadId, {
    String? draft,
    String? contextTitle,
    String? contextTaskId,
    String? contextStatus,
    String? source,
  }) {
    return _withQuery(chatThread(threadId), {
      'draft': draft,
      'title': contextTitle,
      'taskId': contextTaskId,
      'status': contextStatus,
      'source': source,
    });
  }

  static String _withQuery(String path, Map<String, String?> params) {
    final queryParameters = <String, String>{};
    for (final entry in params.entries) {
      final value = entry.value?.trim() ?? '';
      if (value.isNotEmpty) {
        queryParameters[entry.key] = value;
      }
    }

    if (queryParameters.isEmpty) {
      return path;
    }

    return Uri(path: path, queryParameters: queryParameters).toString();
  }
}
