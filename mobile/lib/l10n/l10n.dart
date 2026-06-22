import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'l10n_en.dart';
import 'l10n_hi.dart';

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
  String get createAccount;
  String get signIn;
  String get signOut;

  // Navigation
  String get home;
  String get explore;
  String get people;
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

  // States
  String get loading;
  String get errorOccurred;
  String get offline;
  String get noInternet;
  String get emptyFeed;
  String get emptyInbox;
  String get noTasks;
  String get noNotifications;

  // Marketplace
  String get postNeed;
  String get findPeople;
  String get businessControl;
  String get editProfile;
  String get trustScore;
  String get reviews;
  String get listings;
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
      default:
        return AppLocalizationsEn();
    }
  }

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
