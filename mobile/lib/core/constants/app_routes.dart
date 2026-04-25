class AppRoutes {
  static const root = '/';
  static const setup = '/setup';
  static const signIn = '/sign-in';

  static const home = explore;
  static const welcome = '/app/welcome';
  static const explore = '/app/explore';
  static const people = '/app/people';
  static const tasks = '/app/tasks';
  static const chat = '/app/chat';
  static const profile = '/app/profile';
  static const createNeed = '/app/create-need';
  static const createRequest = createNeed;
  static const control = '/app/control';
  static const search = '/app/search';
  static const notifications = '/app/notifications';
  static const settings = '/app/settings';
  static const privacySettings = '/app/settings/privacy';
  static const notificationSettings = '/app/settings/notifications';
  static const editProfile = '/app/profile/edit';
  static const providerOnboarding = '/app/provider-onboarding';

  static String provider(String providerId) => '/app/provider/$providerId';
  static String taskDetail(String taskId) => '/app/tasks/$taskId';
  static String chatThread(String threadId) => '/app/chat/thread/$threadId';
}
