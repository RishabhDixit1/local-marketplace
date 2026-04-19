class AppRoutes {
  static const root = '/';
  static const setup = '/setup';
  static const signIn = '/sign-in';

  static const home = '/app/welcome';
  static const explore = '/app/explore';
  static const people = '/app/people';
  static const tasks = '/app/tasks';
  static const profile = '/app/profile';
  static const control = '/app/control';
  static const createRequest = '/app/create';
  static const search = '/app/search';
  static const notifications = '/app/notifications';
  static const chat = '/app/chat';
  static const providerOnboarding = '/app/provider-onboarding';

  static String provider(String providerId) => '/app/provider/$providerId';
}
