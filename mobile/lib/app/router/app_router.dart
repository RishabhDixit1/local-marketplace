import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state_controller.dart';
import '../../core/constants/app_routes.dart';
import '../../core/supabase/app_bootstrap.dart';
import '../../features/auth/presentation/setup_page.dart';
import '../../features/auth/presentation/sign_in_page.dart';
import '../../features/chat/presentation/chat_list_screen.dart';
import '../../features/chat/presentation/chat_thread_screen.dart';
import '../../features/explore/presentation/explore_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/people/presentation/people_screen.dart';
import '../../features/post_create/presentation/create_need_page.dart';
import '../../features/profile/presentation/edit_profile_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/provider/presentation/provider_onboarding_page.dart';
import '../../features/provider/presentation/provider_profile_page.dart';
import '../../features/search/presentation/global_search_screen.dart';
import '../../features/settings/presentation/notification_settings_screen.dart';
import '../../features/settings/presentation/privacy_settings_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/tasks/presentation/task_detail_screen.dart';
import '../../features/tasks/presentation/tasks_screen.dart';
import '../presentation/app_shell.dart';

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
        builder: (context, state) => const SizedBox.shrink(),
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
        path: AppRoutes.createNeed,
        builder: (context, state) => const CreateNeedPage(),
      ),
      GoRoute(
        path: AppRoutes.search,
        builder: (context, state) =>
            GlobalSearchScreen(initialQuery: state.uri.queryParameters['q']),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: AppRoutes.settings,
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.privacySettings,
        builder: (context, state) => const PrivacySettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.notificationSettings,
        builder: (context, state) => const NotificationSettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.editProfile,
        builder: (context, state) => const EditProfileScreen(),
      ),
      GoRoute(
        path: AppRoutes.providerOnboarding,
        builder: (context, state) => const ProviderOnboardingPage(),
      ),
      GoRoute(
        path: '/app/provider/:providerId',
        builder: (context, state) => ProviderProfilePage(
          providerId: state.pathParameters['providerId'] ?? '',
        ),
      ),
      GoRoute(
        path: '/app/tasks/:taskId',
        builder: (context, state) =>
            TaskDetailScreen(taskId: state.pathParameters['taskId'] ?? ''),
      ),
      GoRoute(
        path: '/app/chat/thread/:threadId',
        builder: (context, state) =>
            ChatThreadScreen(threadId: state.pathParameters['threadId'] ?? ''),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.explore,
                builder: (context, state) => const ExploreScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.people,
                builder: (context, state) => const PeopleScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.tasks,
                builder: (context, state) => const TasksScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.chat,
                builder: (context, state) => const ChatListScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
