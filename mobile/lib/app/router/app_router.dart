import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state_controller.dart';
import '../../core/constants/app_routes.dart';
import '../../core/supabase/app_bootstrap.dart';
import '../../features/auth/data/onboarding_handoff.dart';
import '../../features/auth/presentation/setup_page.dart';
import '../../features/auth/presentation/sign_in_page.dart';
import '../../features/chat/presentation/chat_page.dart';
import '../../features/control/presentation/control_page.dart';
import '../../features/feed/presentation/feed_page.dart';
import '../../features/listings/presentation/listing_detail_page.dart';
import '../../features/notifications/presentation/notifications_page.dart';
import '../../features/orders/domain/order_models.dart';
import '../../features/orders/presentation/checkout_page.dart';
import '../../features/orders/presentation/order_detail_page.dart';
import '../../features/orders/presentation/orders_page.dart';
import '../../features/profile/data/profile_repository.dart';
import '../../features/provider/presentation/provider_launchpad_review_page.dart';
import '../../features/saved/presentation/saved_feed_page.dart';
import '../../features/people/presentation/people_page.dart';
import '../../features/post_create/presentation/create_need_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/provider/presentation/provider_onboarding_page.dart';
import '../../features/provider/presentation/provider_launchpad_page.dart';
import '../../features/provider/presentation/provider_listings_page.dart';
import '../../features/provider/presentation/provider_profile_page.dart';
import '../../features/quotes/domain/quote_models.dart';
import '../../features/quotes/presentation/quote_room_page.dart';
import '../../features/search/presentation/search_page.dart';
import '../../features/tasks/presentation/tasks_page.dart';
import '../../features/welcome/presentation/welcome_page.dart';
import '../presentation/app_shell.dart';
import 'post_auth_route_resolver.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  final authState = ref.watch(authStateControllerProvider);
  final onboardingHandoff = ref.watch(onboardingHandoffControllerProvider);
  final profileReadiness = authState.isAuthenticated
      ? ref
            .watch(profileSnapshotProvider)
            .maybeWhen(
              data: MobileProfileReadiness.fromSnapshot,
              orElse: () => null,
            )
      : null;

  return GoRouter(
    initialLocation: AppRoutes.root,
    debugLogDiagnostics: false,
    refreshListenable: Listenable.merge([authState, onboardingHandoff]),
    redirect: (context, state) {
      final location = state.matchedLocation;
      if (!authState.isAuthenticated && location.startsWith('/app')) {
        scheduleMicrotask(() {
          unawaited(onboardingHandoff.rememberRoute(state.uri.toString()));
        });
      }

      return resolveMobileAppRedirect(
        location: location,
        setupRequired: bootstrap.needsSetup,
        signedIn: authState.isAuthenticated,
        selectedIntent: onboardingHandoff.selectedIntent,
        hasPendingHandoff: onboardingHandoff.pendingAuthMethod != null,
        hasStoredHandoff: onboardingHandoff.hasStoredHandoff,
        storedHandoffRoute: onboardingHandoff.lastRoute,
        profileReadiness: profileReadiness,
      );
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
        path: AppRoutes.createNeed,
        builder: (context, state) => const CreateNeedPage(),
      ),
      GoRoute(
        path: '/app/post-task',
        redirect: (context, state) => AppRoutes.createNeed,
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
        path: AppRoutes.profilePublic,
        builder: (context, state) => const ProfilePage(
          title: 'Public Profile',
          initialSection: 'viewProfile',
          showCommandHub: false,
        ),
      ),
      GoRoute(
        path: AppRoutes.profileEdit,
        builder: (context, state) => const ProfilePage(
          title: 'Edit Profile',
          initialSection: 'editProfile',
          showCommandHub: false,
        ),
      ),
      GoRoute(
        path: AppRoutes.profileTrust,
        builder: (context, state) => const ProfilePage(
          title: 'Trust',
          initialSection: 'trust',
          showCommandHub: false,
        ),
      ),
      GoRoute(
        path: AppRoutes.profileSettings,
        builder: (context, state) => const ProfilePage(
          title: 'Settings',
          initialSection: 'settings',
          showCommandHub: false,
        ),
      ),
      GoRoute(
        path: AppRoutes.control,
        builder: (context, state) => const ControlPage(),
      ),
      GoRoute(
        path: AppRoutes.providerOnboarding,
        builder: (context, state) => const ProviderOnboardingPage(),
      ),
      GoRoute(
        path: AppRoutes.providerLaunchpad,
        builder: (context, state) => const ProviderLaunchpadPage(),
      ),
      GoRoute(
        path: AppRoutes.providerListings,
        builder: (context, state) => const ProviderListingsPage(),
      ),
      GoRoute(
        path: AppRoutes.orders,
        builder: (context, state) => const OrdersPage(),
        routes: [
          GoRoute(
            path: ':orderId',
            builder: (context, state) => OrderDetailPage(
              orderId: state.pathParameters['orderId']?.trim() ?? '',
            ),
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.checkout,
        builder: (context, state) => CheckoutPage(
          item: _checkoutItemFromQuery(state),
          fromCart: state.uri.queryParameters['source'] == 'cart',
        ),
      ),
      GoRoute(
        path: AppRoutes.saved,
        builder: (context, state) => const SavedFeedPage(),
      ),
      GoRoute(
        path: '${AppRoutes.listings}/:itemId',
        builder: (context, state) => ListingDetailPage(
          itemId: state.pathParameters['itemId']?.trim() ?? '',
          source: _queryParam(state, 'source'),
        ),
      ),
      GoRoute(
        path: AppRoutes.providerLaunchpadReview,
        builder: (context, state) => const ProviderLaunchpadReviewPage(),
      ),
      GoRoute(
        path: AppRoutes.quote,
        builder: (context, state) => QuoteRoomPage(
          mode: quoteTargetModeFromSource(_queryParam(state, 'mode')),
          targetId: _queryParam(state, 'targetId') ?? '',
          conversationId: _queryParam(state, 'conversationId'),
        ),
      ),
      GoRoute(
        path: AppRoutes.provider(':providerId'),
        builder: (context, state) => ProviderProfilePage(
          providerId: state.pathParameters['providerId'] ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.inbox,
        redirect: (context, state) => AppRoutes.chat,
      ),
      GoRoute(
        path: '${AppRoutes.inbox}/:conversationId',
        redirect: (context, state) {
          final conversationId =
              state.pathParameters['conversationId']?.trim() ?? '';
          return conversationId.isEmpty
              ? AppRoutes.chat
              : AppRoutes.chatThread(conversationId);
        },
      ),
      GoRoute(
        path: '${AppRoutes.tasks}/:taskId',
        redirect: (context, state) {
          final taskId = state.pathParameters['taskId']?.trim() ?? '';
          if (taskId.isEmpty) {
            return AppRoutes.tasks;
          }

          return Uri(
            path: AppRoutes.tasks,
            queryParameters: {'focus': taskId, 'source': 'legacy_task_route'},
          ).toString();
        },
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.welcome,
                builder: (context, state) => const WelcomePage(),
              ),
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
                builder: (context, state) => TasksPage(
                  focusTaskId: state.uri.queryParameters['focus'],
                  focusSource: state.uri.queryParameters['source'],
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.chat,
                builder: (context, state) => ChatPage(
                  recipientId: _queryParam(state, 'recipientId'),
                  initialDraft: _queryParam(state, 'draft'),
                  contextTitle: _firstQueryParam(state, [
                    'title',
                    'contextTitle',
                  ]),
                  contextTaskId: _firstQueryParam(state, [
                    'taskId',
                    'helpRequestId',
                  ]),
                  contextStatus: _queryParam(state, 'status'),
                  contextSource: _queryParam(state, 'source'),
                ),
                routes: [
                  GoRoute(
                    path: 'thread/:threadId',
                    builder: (context, state) => ChatPage(
                      initialConversationId: state.pathParameters['threadId']
                          ?.trim(),
                      initialDraft: _queryParam(state, 'draft'),
                      contextTitle: _firstQueryParam(state, [
                        'title',
                        'contextTitle',
                      ]),
                      contextTaskId: _firstQueryParam(state, [
                        'taskId',
                        'helpRequestId',
                      ]),
                      contextStatus: _queryParam(state, 'status'),
                      contextSource: _queryParam(state, 'source'),
                    ),
                  ),
                ],
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

String? _queryParam(GoRouterState state, String key) {
  final value = state.uri.queryParameters[key]?.trim() ?? '';
  return value.isEmpty ? null : value;
}

String? _firstQueryParam(GoRouterState state, List<String> keys) {
  for (final key in keys) {
    final value = _queryParam(state, key);
    if (value != null) {
      return value;
    }
  }
  return null;
}

MobileCheckoutItem? _checkoutItemFromQuery(GoRouterState state) {
  final providerId = _queryParam(state, 'providerId') ?? '';
  final itemType = _queryParam(state, 'itemType') ?? '';
  final itemId = _queryParam(state, 'itemId') ?? '';
  final title = _queryParam(state, 'title') ?? '';
  final price = double.tryParse(_queryParam(state, 'price') ?? '') ?? 0;
  final quantity = int.tryParse(_queryParam(state, 'quantity') ?? '') ?? 1;

  if (providerId.isEmpty ||
      itemType.isEmpty ||
      itemId.isEmpty ||
      title.isEmpty) {
    return null;
  }

  return MobileCheckoutItem(
    providerId: providerId,
    itemType: itemType,
    itemId: itemId,
    title: title,
    price: price,
    quantity: quantity <= 0 ? 1 : quantity,
  );
}

class _RouterPlaceholder extends StatelessWidget {
  const _RouterPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: SizedBox.shrink());
  }
}
