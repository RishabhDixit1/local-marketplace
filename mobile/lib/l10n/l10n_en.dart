import 'l10n.dart';

class AppLocalizationsEn extends AppLocalizations {
  @override
  String get signInTitle => 'Sign in to ServiQ';
  @override
  String get signInSubtitle => 'Access your local marketplace account.';
  @override
  String get emailLabel => 'Email address';
  @override
  String get passwordLabel => 'Password';
  @override
  String get forgotPassword => 'Forgot password?';
  @override
  String get sendResetLink => 'Send reset link';
  @override
  String get resetLinkSent => 'Check your email for the password reset link.';
  @override
  String get continueWithGoogle => 'Continue with Google';
  @override
  String get continueWithEmail => 'Continue with email code';
  @override
  String get sendMagicLink => 'Send magic link';
  @override
  String get sendEmailCode => 'Send email code';
  @override
  String get createAccount => 'Create account';
  @override
  String get signIn => 'Sign in';
  @override
  String get signInWithPassword => 'Sign in with password';
  @override
  String get signInWithEmail => 'Sign in with email';
  @override
  String get signOut => 'Sign out';
  @override
  String get sending => 'Sending...';
  @override
  String get home => 'Home';
  @override
  String get needSomething => 'Need Something';
  @override
  String get explore => 'Explore';
  @override
  String get people => 'People';
  @override
  String get market => 'Market';
  @override
  String get discovery => 'Discover';
  @override
  String get work => 'Work';
  @override
  String get activity => 'Activity';
  @override
  String get inbox => 'Inbox';
  @override
  String get youTab => 'You';
  @override
  String get tasks => 'Tasks';
  @override
  String get chat => 'Chat';
  @override
  String get profile => 'Profile';
  @override
  String get search => 'Search';
  @override
  String get notifications => 'Notifications';
  @override
  String get saved => 'Saved';
  @override
  String get orders => 'Orders';
  @override
  String get save => 'Save';
  @override
  String get share => 'Share';
  @override
  String get message => 'Message';
  @override
  String get book => 'Book';
  @override
  String get cancel => 'Cancel';
  @override
  String get retry => 'Retry';
  @override
  String get refresh => 'Refresh';
  @override
  String get done => 'Done';
  @override
  String get submit => 'Submit';
  @override
  String get report => 'Report';
  @override
  String get update => 'Update';
  @override
  String get later => 'Later';
  @override
  String get viewAll => 'View all';
  @override
  String get myNeeds => 'My needs';
  @override
  String get myWork => 'My work';
  @override
  String get homeQuickActions => 'Quick actions';
  @override
  String get browseNearby => 'Browse nearby';
  @override
  String get nothingInMotion => 'Nothing in motion yet';
  @override
  String get nothingInMotionSubtitle =>
      'Post a need and offers from trusted locals will show up here';
  @override
  String get postYourFirstNeed => 'Post your first need';
  @override
  String get browseMyTasks => 'Browse my tasks';
  @override
  String newMessages(int count) => count == 1 ? '1 new message' : '$count new messages';
  @override
  String get loading => 'Loading...';
  @override
  String get errorOccurred => 'Something went wrong.';
  @override
  String get offline => 'You are offline. Some features may be limited.';
  @override
  String get noInternet => 'No internet connection.';
  @override
  String get emptyFeed => 'No items to show right now.';
  @override
  String get emptyInbox => 'Inbox is ready.';
  @override
  String get noTasks => 'No tasks yet.';
  @override
  String get noNotifications => 'No notifications yet.';
  @override
  String get couldNotConnect => 'Could not connect';
  @override
  String get updateRequired => 'Update required';
  @override
  String get updateAvailable => 'Update available';
  @override
  String newVersionAvailable(String version) => 'Version $version is now available.';
  @override
  String get whatsNew => "What's new:";
  @override
  String get routeErrorTitle => 'Page not found';
  @override
  String get routeErrorMessage =>
      "We couldn't find that page. It may have moved or no longer exists.";
  @override
  String get goHome => 'Back to home';
  @override
  String get postNeed => 'Post Need';
  @override
  String get findPeople => 'Find People';
  @override
  String get businessControl => 'Business Control';
  @override
  String get editProfile => 'Edit Profile';
  @override
  String get trustScore => 'Trust score';
  @override
  String get reviews => 'Reviews';
  @override
  String get listings => 'Listings';
  @override
  String get aiPlaceholder => 'Ask ServiQ to find, post, buy, sell or manage...';
  @override
  String get aiErrorTitle => 'Something went wrong';
  @override
  String get aiTryAsking => 'Try asking';
  @override
  String get aiBrowseResults => 'Browse results';
  @override
  String get aiCreatePost => 'Create post';
  @override
  String get aiNoProvidersFound => 'No providers found';
  @override
  String get aiPostRequirement => 'Post a Requirement';
  @override
  String get aiNearbyProviders => 'Nearby providers';
  @override
  String get aiFoundProviders => 'Found providers';
  @override
  String get aiSearchMarket => 'Search market';
  @override
  String get discoveryNearbyProviders => 'Nearby providers';
  @override
  String get discoveryFindLocalServices => 'Find local services, shops and providers near you';
  @override
  String get discoveryNearbySubtitle => 'Tap a marker or a provider to see their work';
  @override
  String get discoveryOpenMap => 'Open map';
  @override
  String get discoveryExploreZones => 'Explore zones';
  @override
  String get discoveryExploreMarkets => 'Explore Markets';
  @override
  String get discoveryLiveNow => 'Live Now';
  @override
  String get discoveryLive => 'Live';
  @override
  String get discoveryBrowseLocalZones => 'Browse Local Zones';
  @override
  String discoveryMarketsSummary(int societies, int markets) {
    final s = societies == 1 ? 'Society' : 'Societies';
    final m = markets == 1 ? 'Market' : 'Markets';
    return '$societies $s · $markets $m';
  }
  @override
  String get discoveryZonesSubtitle => 'Societies, markets and supply areas near you';
  @override
  String get discoveryAllZones => 'All zones';
  @override
  String get discoveryPopularServices => 'Popular Services';
  @override
  String get discoveryServicesSubtitle => 'Jump straight to a service';
  @override
  String get discoverySearchHint => 'Search providers by name or service';
  @override
  String get discoveryNoProvidersTitle => 'No providers nearby';
  @override
  String get discoveryNoProvidersMessage => 'Check back later as more local providers join.';
  @override
  String get discoveryNoLocation => 'No location data available';
  @override
  String get mapTilesUnavailable => 'Map unavailable right now';
  @override
  String discoveryViewAllProviders(int count) =>
      count == 1 ? 'View 1 provider' : 'View all $count providers';
  @override
  String get discoveryNoZonesTitle => 'No zones available';
  @override
  String get discoveryNoZonesMessage => 'New zones are being added regularly. Check back soon.';
  @override
  String get discoveryUpcoming => 'Upcoming';
  @override
  String get discoveryLoadError => "Couldn't load right now. Check your connection and try again.";
  @override
  String get zoneSociety => 'Society';
  @override
  String get zoneMarket => 'Market';
  @override
  String get zoneSupplyArea => 'Supply area';
  @override
  String get zoneComingSoon => 'Coming soon';
  @override
  String discoveryZoneProviderCount(int count) => '$count providers';
  @override
  String get discoveryHowItWorks => 'How ServiQ works';
  @override
  String get discoveryDismiss => 'Dismiss';
  @override
  String get discoveryStep1 => 'Browse nearby providers';
  @override
  String get discoveryStep1Desc => 'Browse services in your neighborhood';
  @override
  String get discoveryStep2 => 'Contact & compare';
  @override
  String get discoveryStep2Desc => 'Compare and contact providers directly';
  @override
  String get discoveryStep3 => 'Get work done';
  @override
  String get discoveryStep3Desc => 'Get quality work done with confidence';
  @override
  String discoveryProvidersNearYou(int count) =>
      count == 1 ? '1 provider near you' : '$count providers near you';
  @override
  String get discoveryLookingForServices => 'Looking for services?';
  @override
  String get discoveryLookingForServicesSubtitle =>
      'Find trusted providers for any service in your neighborhood';
  @override
  String get discoveryAreYouProvider => 'Are you a service provider?';
  @override
  String get discoveryAreYouProviderSubtitle =>
      'List your business on ServiQ and get more customers from your neighborhood';
  @override
  String get discoveryListYourBusiness => 'List Your Business';
  @override
  String get discoveryBrowseMarketplace => 'Browse Marketplace';
  @override
  String get whoAreYouTitle => 'What brings you to ServiQ?';
  @override
  String get whoAreYouSubtitle => 'Pick a path and we will tailor your home to you.';
  @override
  String get intentFindHelp => 'Find help';
  @override
  String get intentFindHelpSubtitle => 'Post needs and hire nearby professionals';
  @override
  String get intentEarnNearby => 'Earn nearby';
  @override
  String get intentEarnNearbySubtitle => 'Take on local work and grow your income';
  @override
  String get intentBusinessSetup => 'Set up my business';
  @override
  String get intentBusinessSetupSubtitle => 'List your services, team, and availability';
  @override
  String get notNow => 'Not now';

  // Storefronts & Products
  @override
  String get storefrontsSectionTitle => 'Storefronts';
  @override
  String get storefrontsSectionSubtitle => 'Shops and businesses near you';
  @override
  String get viewAllStorefronts => 'View all storefronts';
  @override
  String get productsSectionTitle => 'Products';
  @override
  String get productsSectionSubtitle => 'Items available nearby';
  @override
  String get viewAllProducts => 'View all products';
  @override
  String get noStorefrontsTitle => 'No storefronts yet';
  @override
  String get noStorefrontsMessage => 'Storefronts will appear here once providers set up their shops.';
  @override
  String get noProductsTitle => 'No products yet';
  @override
  String get noProductsMessage => 'Products will appear here once providers list items.';
  @override
  String storefrontProductCount(int count) =>
      count == 1 ? '1 product' : '$count products';
  @override
  String get storefrontDetailTitle => 'Storefront';
  @override
  String get storefrontOwnerLabel => 'Owned by';
  @override
  String get storefrontHoursLabel => 'Operating hours';
  @override
  String get storefrontDescriptionLabel => 'About';
  @override
  String get storefrontProductsLabel => 'Products';
  @override
  String get storefrontVisitProvider => 'Visit provider';
  @override
  String get storefrontChatWithOwner => 'Chat with owner';
  @override
  String get productDetailTitle => 'Product';
  @override
  String get productPriceLabel => 'Price';
  @override
  String get productAvailabilityLabel => 'Availability';
  @override
  String get productInStock => 'In stock';
  @override
  String get productOutOfStock => 'Out of stock';
  @override
  String get productDeliveryInfo => 'Delivery available';
  @override
  String get productContactInquiry => 'Contact for inquiry';
  @override
  String get productFromStorefront => 'From';
  @override
  String get browseStorefrontsTitle => 'All Storefronts';
  @override
  String get browseProductsTitle => 'All Products';
  @override
  String get allStorefronts => 'All Storefronts';
  @override
  String get allProducts => 'All Products';
}
