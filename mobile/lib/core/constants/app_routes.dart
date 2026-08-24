class AppRoutes {
  static const root = '/';
  static const setup = '/setup';
  static const signIn = '/sign-in';
  static const signUp = '/sign-up';
  static const forgotPassword = '/forgot-password';
  static const onboarding = '/onboarding';
  static const publicBrowse = '/browse';

  /// Public search entry that opens the search page in its fresh-search
  /// state (suggestions, not auto-loaded browse-all), safe for anonymous
  /// users since it lives outside the auth-gated /app group.
  static String get publicSearch => '$publicBrowse?browse=0';

  static const home = welcome;
  static const welcome = '/app/welcome';
  static const explore = '/app/explore';
  static const feedAll = '/app/feed-all';
  static const discovery = '/app/discovery';
  static const people = '/app/people';
  static const tasks = '/app/tasks';
  static const chat = '/app/chat';
  static const inbox = '/app/inbox';
  static const profile = '/app/profile';
  static const createNeed = '/app/create-need';
  static const createRequest = createNeed;
  static const control = '/app/control';
  static const search = '/app/search';
  static const mapDiscovery = '/app/map';
  static const notifications = '/app/notifications';
  static const profilePublic = '/app/profile/public';
  static const profileEdit = '/app/profile/edit';
  static const profileTrust = '/app/profile/trust';
  static const profileSettings = '/app/profile/settings';
  static const seekerOnboarding = '/app/seeker-onboarding';
  static const providerOnboarding = '/app/provider-onboarding';
  static const providerLaunchpad = '/app/provider-launchpad';
  static const providerListings = '/app/provider-listings';
  static const publicBusiness = '/app/public-business';
  static const listings = '/app/listings';
  static const orders = '/app/orders';
  static const providerOrders = '/app/provider-orders';
  static const providerLeads = '/app/provider-leads';
  static const checkout = '/app/checkout';
  static const providerLaunchpadReview = '/app/provider-launchpad-review';
  static const quote = '/app/quote';
  static const marketZones = '/app/market-zones';
  static const transactions = '/app/transactions';
  static const quoteComparison = '/app/quote-comparison';
  static const verification = '/app/verification';
  static const availability = '/app/availability';
  static const bookings = '/app/bookings';
  static const connections = '/app/connections';
  static const storefronts = '/app/storefronts';
  static const products = '/app/products';

  static String get checkoutFromCart => '$checkout?source=cart';

  static String storefront(String storefrontId) =>
      '/app/storefronts/$storefrontId';
  static String productDetail(String productId, {String? storefrontId}) {
    return _withQuery('$products/$productId', {'storefrontId': storefrontId});
  }

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

  /// Maps web-style redirects produced by the shared AI orchestrator into
  /// mobile routes. The backend lives under the Next.js web app where
  /// `/search`, `/dashboard`, etc. are real routes; the mobile app only has
  /// the `/app/*` variants (plus a few public routes). Pushing a raw web
  /// redirect would throw a GoException and fall into the router error page.
  static String resolveAiRedirect(String redirect) {
    final uri = Uri.tryParse(redirect);
    if (uri == null) return home;

    final path = uri.path;
    if (path.startsWith('/app')) return redirect;

    final params = _queryParametersOf(uri);
    switch (path) {
      case '/search':
        return _withQuery(search, params);
      case '/dashboard/orders':
        return orders;
      case '/dashboard/launchpad':
        return providerLaunchpad;
      case '/dashboard':
        if (params['postType'] == 'need' || params['postType'] == 'product') {
          return _withQuery(createNeed, params);
        }
        return profile;
      case '/':
        if (params.containsKey('signin')) return signIn;
        return home;
      default:
        return _withQuery(search, params);
    }
  }

  static Map<String, String> _queryParametersOf(Uri uri) {
    final result = <String, String>{};
    for (final entry in uri.queryParameters.entries) {
      final value = entry.value.trim();
      if (value.isNotEmpty) {
        result[entry.key] = value;
      }
    }
    return result;
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
