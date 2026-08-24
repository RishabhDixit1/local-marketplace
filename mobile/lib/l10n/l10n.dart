import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'l10n_en.dart';
import 'l10n_hi.dart';
import 'l10n_bn.dart';
import 'l10n_ta.dart';
import 'l10n_te.dart';
import 'l10n_mr.dart';

final localeProvider = NotifierProvider<LocaleNotifier, Locale>(LocaleNotifier.new);

class LocaleNotifier extends Notifier<Locale> {
  @override
  Locale build() {
    return const Locale('en', 'US');
  }

  Future<void> setLocale(Locale locale) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('locale', locale.languageCode);
    state = locale;
  }
}

abstract class AppLocalizations {
  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  // Auth
  String get signInTitle;
  String get signInSubtitle;
  String get emailLabel;
  String get passwordLabel;
  String get forgotPassword;
  String get sendResetLink;
  String get resetLinkSent;
  String get continueWithGoogle;
  String get continueWithEmail;
  String get sendMagicLink;
  String get sendEmailCode;
  String get createAccount;
  String get signIn;
  String get signInWithPassword;
  String get signInWithEmail;
  String get signOut;
  String get sending;

  // Navigation
  String get home;
  String get needSomething;
  String get explore;
  String get people;
  String get market;
  String get discovery;
  String get work;
  String get activity;
  String get inbox;
  String get youTab;
  String get tasks;
  String get chat;
  String get profile;
  String get search;
  String get notifications;
  String get saved;
  String get orders;

  // Actions
  String get save;
  String get share;
  String get message;
  String get book;
  String get cancel;
  String get retry;
  String get refresh;
  String get done;
  String get submit;
  String get report;
  String get update;
  String get later;
  String get viewAll;
  String get myNeeds;
  String get myWork;
  String get homeQuickActions;
  String get browseNearby;
  String get nothingInMotion;
  String get nothingInMotionSubtitle;
  String get postYourFirstNeed;
  String get browseMyTasks;
  String newMessages(int count);

  // States
  String get loading;
  String get errorOccurred;
  String get offline;
  String get noInternet;
  String get emptyFeed;
  String get emptyInbox;
  String get noTasks;
  String get noNotifications;
  String get couldNotConnect;
  String get updateRequired;
  String get updateAvailable;
  String newVersionAvailable(String version);
  String get whatsNew;
  String get routeErrorTitle;
  String get routeErrorMessage;
  String get goHome;

  // Marketplace
  String get postNeed;
  String get findPeople;
  String get businessControl;
  String get editProfile;
  String get trustScore;
  String get reviews;
  String get listings;

  // Discovery
  String get discoveryNearbyProviders;
  String get discoveryFindLocalServices;
  String get discoveryNearbySubtitle;
  String get discoveryOpenMap;
  String get discoveryExploreZones;
  String get discoveryExploreMarkets;
  String get discoveryLiveNow;
  String get discoveryLive;
  String get discoveryBrowseLocalZones;
  String discoveryMarketsSummary(int societies, int markets);
  String get discoveryZonesSubtitle;
  String get discoveryAllZones;
  String get discoveryPopularServices;
  String get discoveryServicesSubtitle;
  String get discoverySearchHint;
  String get discoveryNoProvidersTitle;
  String get discoveryNoProvidersMessage;
  String get discoveryNoLocation;
  String get mapTilesUnavailable;
  String discoveryViewAllProviders(int count);
  String get discoveryNoZonesTitle;
  String get discoveryNoZonesMessage;
  String get discoveryUpcoming;
  String get discoveryLoadError;
  String get zoneSociety;
  String get zoneMarket;
  String get zoneSupplyArea;
  String get zoneComingSoon;
  String discoveryZoneProviderCount(int count);
  String get discoveryHowItWorks;
  String get discoveryDismiss;
  String get discoveryStep1;
  String get discoveryStep1Desc;
  String get discoveryStep2;
  String get discoveryStep2Desc;
  String get discoveryStep3;
  String get discoveryStep3Desc;
  String discoveryProvidersNearYou(int count);
  String get discoveryLookingForServices;
  String get discoveryLookingForServicesSubtitle;
  String get discoveryAreYouProvider;
  String get discoveryAreYouProviderSubtitle;
  String get discoveryListYourBusiness;
  String get discoveryBrowseMarketplace;

  // AI
  String get aiPlaceholder;
  String get aiErrorTitle;
  String get aiTryAsking;
  String get aiBrowseResults;
  String get aiCreatePost;
  String get aiNoProvidersFound;
  String get aiPostRequirement;
  String get aiNearbyProviders;
  String get aiFoundProviders;
  String get aiSearchMarket;

  // Role / intent
  String get whoAreYouTitle;
  String get whoAreYouSubtitle;
  String get intentFindHelp;
  String get intentFindHelpSubtitle;
  String get intentEarnNearby;
  String get intentEarnNearbySubtitle;
  String get intentBusinessSetup;
  String get intentBusinessSetupSubtitle;
  String get notNow;

  // Storefronts & Products (Explore tab)
  String get storefrontsSectionTitle;
  String get storefrontsSectionSubtitle;
  String get viewAllStorefronts;
  String get productsSectionTitle;
  String get productsSectionSubtitle;
  String get viewAllProducts;
  String get noStorefrontsTitle;
  String get noStorefrontsMessage;
  String get noProductsTitle;
  String get noProductsMessage;
  String storefrontProductCount(int count);
  String get storefrontDetailTitle;
  String get storefrontOwnerLabel;
  String get storefrontHoursLabel;
  String get storefrontDescriptionLabel;
  String get storefrontProductsLabel;
  String get storefrontVisitProvider;
  String get storefrontChatWithOwner;
  String get productDetailTitle;
  String get productPriceLabel;
  String get productAvailabilityLabel;
  String get productInStock;
  String get productOutOfStock;
  String get productDeliveryInfo;
  String get productContactInquiry;
  String get productFromStorefront;
  String get browseStorefrontsTitle;
  String get browseProductsTitle;
  String get allStorefronts;
  String get allProducts;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return ['en', 'hi', 'bn', 'ta', 'te', 'mr'].contains(locale.languageCode);
  }

  @override
  Future<AppLocalizations> load(Locale locale) async {
    switch (locale.languageCode) {
      case 'hi':
        return AppLocalizationsHi();
      case 'bn':
        return AppLocalizationsBn();
      case 'ta':
        return AppLocalizationsTa();
      case 'te':
        return AppLocalizationsTe();
      case 'mr':
        return AppLocalizationsMr();
      default:
        return AppLocalizationsEn();
    }
  }

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
