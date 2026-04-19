import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state_controller.dart';
import '../../core/constants/app_routes.dart';
import '../../core/supabase/app_bootstrap.dart';
import '../../features/auth/presentation/setup_page.dart';
import '../../features/auth/presentation/sign_in_page.dart';
import '../../features/chat/presentation/chat_page.dart';
import '../../features/control/presentation/control_page.dart';
import '../../features/feed/presentation/feed_page.dart';
import '../../features/home/presentation/home_shell_page.dart';
import '../../features/inbox/presentation/inbox_page.dart';
import '../../features/notifications/presentation/notifications_page.dart';
import '../../features/people/presentation/people_page.dart';
import '../../features/post_create/presentation/create_need_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/provider/presentation/provider_onboarding_page.dart';
import '../../features/provider/presentation/provider_profile_page.dart';
import '../../features/search/presentation/search_page.dart';
import '../../features/task_post/presentation/task_post_page.dart';
import '../../features/tasks/presentation/tasks_page.dart';
import '../../features/welcome/presentation/welcome_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  final authState = ref.watch(authStateControllerProvider);

  return GoRouter(
    initialLocation: AppRoutes.root,
    debugLogDiagnostics: false,
    refreshListenable: authState,
    redirect: (context, state) {
      final location = state.matchedLocation;
      final setupRequired = bootstrap.needsSetup;
      final signedIn = authState.isAuthenticated;
      final visitingApp = location.startsWith('/app');

      if (setupRequired && location != AppRoutes.setup) {
        return AppRoutes.setup;
      }

      if (!setupRequired && location == AppRoutes.setup) {
        return signedIn ? AppRoutes.home : AppRoutes.signIn;
      }

      if (!setupRequired && !signedIn && visitingApp) {
        return AppRoutes.signIn;
      }

      if (!setupRequired &&
          signedIn &&
          (location == AppRoutes.root || location == AppRoutes.signIn)) {
        return AppRoutes.home;
      }

      if (!setupRequired && !signedIn && location == AppRoutes.root) {
        return AppRoutes.signIn;
      }

      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.root,
        builder: (context, state) => const _RouterPlaceholder(),
      ),
      GoRoute(
        path: AppRoutes.setup,
        builder: (context, state) => const SetupPage(),
      ),
      GoRoute(
        path: AppRoutes.signIn,
        builder: (context, state) => const SignInPage(),
      ),
      GoRoute(
        path: AppRoutes.createRequest,
        builder: (context, state) => const CreateNeedPage(),
      ),
      GoRoute(
        path: '/app/post-task',
        builder: (context, state) => const TaskPostPage(),
      ),
      GoRoute(
        path: AppRoutes.search,
        builder: (context, state) =>
            SearchPage(initialQuery: state.uri.queryParameters['q']),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        builder: (context, state) => const NotificationsPage(),
      ),
      GoRoute(
        path: AppRoutes.chat,
        builder: (context, state) => ChatPage(
          initialConversationId: state.uri.queryParameters['conversationId'],
          recipientId: state.uri.queryParameters['recipientId'],
          initialDraft: state.uri.queryParameters['draft'],
          contextTitle: state.uri.queryParameters['contextTitle'],
        ),
      ),
      GoRoute(
        path: AppRoutes.providerOnboarding,
        builder: (context, state) => const ProviderOnboardingPage(),
      ),
      GoRoute(
        path: AppRoutes.control,
        builder: (context, state) => const ControlPage(),
      ),
      GoRoute(
        path: '/app/provider/:providerId',
        builder: (context, state) => ProviderProfilePage(
          providerId: state.pathParameters['providerId'] ?? '',
        ),
      ),
      GoRoute(
        path: '/app/inbox',
        builder: (context, state) => const InboxPage(),
        routes: [
          GoRoute(
            path: ':conversationId',
            builder: (context, state) => ChatThreadPage(
              conversationId: state.pathParameters['conversationId'] ?? '',
            ),
          ),
        ],
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return HomeShellPage(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const WelcomePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.explore,
                builder: (context, state) =>
                    const FeedPage(mode: FeedPageMode.explore),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.people,
                builder: (context, state) => const PeoplePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.tasks,
                builder: (context, state) => const TasksPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                builder: (context, state) => const ProfilePage(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

class _RouterPlaceholder extends StatelessWidget {
  const _RouterPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: SizedBox.shrink());
  }
}
