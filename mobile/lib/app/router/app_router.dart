import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state_controller.dart';
import '../../core/supabase/app_bootstrap.dart';
import '../../features/auth/presentation/setup_page.dart';
import '../../features/auth/presentation/sign_in_page.dart';
import '../../features/control/presentation/control_page.dart';
import '../../features/feed/presentation/feed_page.dart';
import '../../features/home/presentation/home_shell_page.dart';
import '../../features/people/presentation/people_page.dart';
import '../../features/post_create/presentation/create_need_page.dart';
import '../../features/inbox/presentation/inbox_page.dart';
import '../../features/notifications/presentation/notifications_page.dart';
import '../../features/people/presentation/people_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/task_post/presentation/task_post_page.dart';
import '../../features/tasks/presentation/tasks_page.dart';
import '../../features/welcome/presentation/welcome_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  final authState = ref.watch(authStateControllerProvider);

  return GoRouter(
    initialLocation: '/',
    debugLogDiagnostics: false,
    refreshListenable: authState,
    redirect: (context, state) {
      final location = state.matchedLocation;
      final setupRequired = bootstrap.needsSetup;
      final signedIn = authState.isAuthenticated;
      final visitingApp = location.startsWith('/app');

      if (setupRequired && location != '/setup') {
        return '/setup';
      }

      if (!setupRequired && location == '/setup') {
        return signedIn ? '/app/welcome' : '/sign-in';
      }

      if (!setupRequired && !signedIn && visitingApp) {
        return '/sign-in';
      }

      if (!setupRequired &&
          signedIn &&
          (location == '/' || location == '/sign-in')) {
        return '/app/welcome';
      }

      if (!setupRequired && !signedIn && location == '/') {
        return '/sign-in';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const SizedBox.shrink()),
      GoRoute(path: '/setup', builder: (context, state) => const SetupPage()),
      GoRoute(
        path: '/sign-in',
        builder: (context, state) => const SignInPage(),
      ),
      GoRoute(
        path: '/app/create',
        builder: (context, state) => const CreateNeedPage(),
        path: '/app/post-task',
        builder: (context, state) => const TaskPostPage(),
      ),
      GoRoute(
        path: '/app/inbox',
        builder: (context, state) => const InboxPage(),
        routes: [
          GoRoute(
            path: ':conversationId',
            builder: (context, state) => ChatThreadPage(
              conversationId: state.pathParameters['conversationId']!,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/app/notifications',
        builder: (context, state) => const NotificationsPage(),
      ),
      GoRoute(
        path: '/app/profile',
        builder: (context, state) => const ProfilePage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return HomeShellPage(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app/welcome',
                builder: (context, state) => const WelcomePage(),
                builder: (context, state) =>
                    const FeedPage(mode: FeedPageMode.welcome),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app/explore',
                builder: (context, state) => const FeedPage(),
                builder: (context, state) =>
                    const FeedPage(mode: FeedPageMode.explore),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app/people',
                builder: (context, state) => const PeoplePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app/tasks',
                builder: (context, state) => const TasksPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app/control',
                builder: (context, state) => const ControlPage(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
