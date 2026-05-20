import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final localeProvider = NotifierProvider<LocaleNotifier, Locale>(LocaleNotifier.new);

class LocaleNotifier extends Notifier<Locale> {
  @override
  Locale build() => const Locale('en', 'US');

  void setLocale(Locale locale) => state = locale;
}

class AppLocalizations {
  static AppLocalizations of(BuildContext context) {
    return AppLocalizations();
  }

  AppLocalizations();

  // Auth
  String get signInTitle => 'Sign in to ServiQ';
  String get signInSubtitle => 'Access your local marketplace account.';
  String get emailLabel => 'Email address';
  String get passwordLabel => 'Password';
  String get forgotPassword => 'Forgot password?';
  String get sendResetLink => 'Send reset link';
  String get resetLinkSent => 'Check your email for the password reset link.';
  String get continueWithGoogle => 'Continue with Google';
  String get continueWithEmail => 'Continue with email code';
  String get sendMagicLink => 'Send magic link';
  String get createAccount => 'Create account';
  String get signIn => 'Sign in';
  String get signOut => 'Sign out';

  // Navigation
  String get home => 'Home';
  String get explore => 'Explore';
  String get people => 'People';
  String get tasks => 'Tasks';
  String get chat => 'Chat';
  String get profile => 'Profile';
  String get search => 'Search';
  String get notifications => 'Notifications';
  String get saved => 'Saved';
  String get orders => 'Orders';

  // Actions
  String get save => 'Save';
  String get share => 'Share';
  String get message => 'Message';
  String get book => 'Book';
  String get cancel => 'Cancel';
  String get retry => 'Retry';
  String get refresh => 'Refresh';
  String get done => 'Done';
  String get submit => 'Submit';
  String get report => 'Report';

  // States
  String get loading => 'Loading...';
  String get errorOccurred => 'Something went wrong.';
  String get offline => 'You are offline. Some features may be limited.';
  String get noInternet => 'No internet connection.';
  String get emptyFeed => 'No items to show right now.';
  String get emptyInbox => 'Inbox is ready.';
  String get noTasks => 'No tasks yet.';
  String get noNotifications => 'No notifications yet.';

  // Marketplace
  String get postNeed => 'Post a Need';
  String get findPeople => 'Find People';
  String get businessControl => 'Business Control';
  String get editProfile => 'Edit Profile';
  String get trustScore => 'Trust score';
  String get reviews => 'Reviews';
  String get listings => 'Listings';
}
