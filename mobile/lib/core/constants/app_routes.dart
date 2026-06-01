class AppRoutes {
  static const root = '/';
  static const setup = '/setup';
  static const signIn = '/sign-in';
  static const onboarding = '/onboarding';

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
  static const profilePublic = '/app/profile/public';
  static const profileEdit = '/app/profile/edit';
  static const profileTrust = '/app/profile/trust';
  static const profileSettings = '/app/profile/settings';
  static const seekerOnboarding = '/app/seeker-onboarding';
  static const providerOnboarding = '/app/provider-onboarding';
  static const providerLaunchpad = '/app/provider-launchpad';
  static const providerListings = '/app/provider-listings';
  static const listings = '/app/listings';
  static const orders = '/app/orders';
  static const checkout = '/app/checkout';
  static const saved = '/app/saved';
  static const providerLaunchpadReview = '/app/provider-launchpad-review';
  static const quote = '/app/quote';
  static const marketZones = '/app/market-zones';
  static const payouts = '/app/payouts';
  static const referrals = '/app/referrals';
  static const verification = '/app/verification';
  static const analytics = '/app/analytics';
  static const availability = '/app/availability';
  static const workspaces = '/app/workspaces';
  static String workspaceDetail(String workspaceId) => '/app/workspaces/$workspaceId';

  static String get checkoutFromCart => '$checkout?source=cart';

  static String provider(String providerId) => '/app/provider/$providerId';
  static String listingDetail(String itemId, {String? source}) {
    return _withQuery('$listings/$itemId', {'source': source});
  }

  static String chatThread(String threadId) => '/app/chat/thread/$threadId';
  static String inboxThread(String conversationId) =>
      chatThread(conversationId);
  static String orderDetail(String orderId) => '/app/orders/$orderId';

  static String checkoutItem({
    required String providerId,
    required String itemType,
    required String itemId,
    required String title,
    required double price,
    int quantity = 1,
  }) {
    return _withQuery(checkout, {
      'providerId': providerId,
      'itemType': itemType,
      'itemId': itemId,
      'title': title,
      'price': price.toString(),
      'quantity': quantity.toString(),
    });
  }

  static String quoteRoom({
    required String mode,
    required String targetId,
    String? conversationId,
  }) {
    return _withQuery(quote, {
      'mode': mode,
      'targetId': targetId,
      'conversationId': conversationId,
    });
  }

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
