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
  static const search = '/app/search';
  static const notifications = '/app/notifications';
  static const providerOnboarding = '/app/provider-onboarding';

  static String provider(String providerId) => '/app/provider/$providerId';
  static String chatThread(String threadId) => '/app/chat/thread/$threadId';
  static String inboxThread(String conversationId) => '$inbox/$conversationId';
}
