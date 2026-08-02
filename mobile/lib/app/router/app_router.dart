import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state_controller.dart';
import '../../core/constants/app_routes.dart';
import '../../core/supabase/app_bootstrap.dart';
import '../../features/admin/presentation/admin_page.dart';
import '../../features/auth/data/onboarding_handoff.dart';
import '../../features/auth/presentation/setup_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/sign_up_page.dart';
import '../../features/auth/presentation/pages/forgot_password_page.dart';
import '../../features/chat/presentation/chat_page.dart';
import '../../features/connections/presentation/connections_page.dart';
import '../../features/feed/presentation/feed_page.dart';
import '../../features/discovery/presentation/discovery_page.dart';
import '../../features/listings/presentation/listing_detail_page.dart';
import '../../features/notifications/presentation/notifications_page.dart';
import '../../features/onboarding/presentation/seeker_onboarding_page.dart';
import '../../features/orders/domain/order_models.dart';
import '../../features/orders/presentation/checkout_page.dart';
import '../../features/orders/presentation/order_detail_page.dart';
import '../../features/orders/presentation/orders_page.dart';
import '../../features/orders/presentation/provider_leads_page.dart';
import '../../features/orders/presentation/provider_orders_page.dart';
import '../../features/promotions/presentation/provider_boosts_page.dart';
import '../../features/subscriptions/presentation/provider_subscriptions_page.dart';
import '../../features/invoices/presentation/invoices_page.dart';
import '../../features/invoices/presentation/invoice_detail_page.dart';
import '../../features/payouts/presentation/payouts_page.dart';
import '../../features/payments/presentation/transactions_page.dart';
import '../../features/referrals/presentation/referrals_page.dart';
import '../../features/verification/presentation/verification_page.dart';
import '../../features/analytics/presentation/analytics_page.dart';
import '../../features/blocking/presentation/blocked_users_page.dart';
import '../../features/public_profile/presentation/public_business_page.dart';
import '../../features/settings/presentation/settings_page.dart';
import '../../features/availability/presentation/availability_page.dart';
import '../../features/bookings/presentation/bookings_page.dart';
import '../../features/workspaces/presentation/workspaces_page.dart';
import '../../features/workspaces/presentation/workspace_detail_page.dart';
import '../../features/profile/data/profile_repository.dart';
import '../../features/provider/presentation/provider_launchpad_review_page.dart';
import '../../features/saved/presentation/saved_feed_page.dart';
import '../../features/marketplace/presentation/marketplace_landing_page.dart';
import '../../features/people/presentation/people_page.dart';
import '../../screens/market_zones_screen.dart';
import '../../features/post_create/presentation/create_need_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/provider/presentation/provider_onboarding_page.dart';
import '../../features/provider/presentation/provider_launchpad_page.dart';
import '../../features/provider/presentation/provider_listings_page.dart';
import '../../features/provider/presentation/provider_profile_page.dart';
import '../../features/quotes/domain/quote_models.dart';
import '../../features/quotes/presentation/quote_room_page.dart';
import '../../features/quotes/presentation/quote_comparison_page.dart';
import '../../features/search/presentation/search_page.dart';
import '../../features/search/presentation/map_discovery_page.dart';
import '../../features/tasks/presentation/tasks_page.dart';
import '../../features/welcome/presentation/onboarding_walkthrough_page.dart';
import '../../features/welcome/presentation/welcome_page.dart';
import '../presentation/app_shell.dart';
import 'post_auth_route_resolver.dart';

final appNavigatorKey = GlobalKey<NavigatorState>();

Page _smoothPage(Widget child, GoRouterState state) => CustomTransitionPage(
  key: state.pageKey,
  child: child,
  transitionsBuilder: (context, animation, secondaryAnimation, child) {
    return SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0.08, 0),
        end: Offset.zero,
      ).animate(CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
      )),
      child: FadeTransition(
        opacity: Tween<double>(begin: 0.0, end: 1.0).animate(animation),
        child: child,
      ),
    );
  },
);

final appRouterProvider = Provider<GoRouter>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  final authState = ref.watch(authStateControllerProvider);
  final onboardingHandoff = ref.watch(onboardingHandoffControllerProvider);
  final onboardingComplete = ref.watch(onboardingCompleteProvider);
  final profileReadiness = authState.isAuthenticated
      ? ref
            .watch(profileSnapshotProvider)
            .maybeWhen(
              data: MobileProfileReadiness.fromSnapshot,
              orElse: () => null,
            )
      : null;

  var initialLandingServed = false;

  return GoRouter(
    navigatorKey: appNavigatorKey,
    initialLocation: AppRoutes.root,
    debugLogDiagnostics: false,
    refreshListenable: Listenable.merge([authState, onboardingHandoff]),
    redirect: (context, state) {
      final location = state.matchedLocation;

      if (bootstrap.needsSetup && location != AppRoutes.setup) {
        return AppRoutes.setup;
      }

      final onboardingValue = onboardingComplete.asData?.value;
      if (onboardingValue == null) {
        if (location.startsWith('/app')) {
          return AppRoutes.onboarding;
        }
      } else {
        if (!onboardingValue && location != AppRoutes.onboarding) {
          return AppRoutes.onboarding;
        }
        if (onboardingValue && location == AppRoutes.onboarding) {
          return AppRoutes.root;
        }
      }

      if (!authState.isAuthenticated && location.startsWith('/app')) {
        scheduleMicrotask(() {
          unawaited(onboardingHandoff.rememberRoute(state.uri.toString()).catchError((e, st) => debugPrint('ServiQ app_router.rememberRoute failed: $e\n$st')));
        });
      }

      final redirect = resolveMobileAppRedirect(
        location: location,
        setupRequired: bootstrap.needsSetup,
        signedIn: authState.isAuthenticated,
        selectedIntent: onboardingHandoff.selectedIntent,
        hasPendingHandoff: onboardingHandoff.pendingAuthMethod != null,
        hasStoredHandoff: onboardingHandoff.hasStoredHandoff,
        storedHandoffRoute: onboardingHandoff.lastRoute,
        profileReadiness: profileReadiness,
      );

      if (redirect == null) {
        return null;
      }

      if (redirect.startsWith('/app')) {
        if (initialLandingServed &&
            (location == AppRoutes.root || location == AppRoutes.signIn)) {
          return AppRoutes.home;
        }
        initialLandingServed = true;
      }

      return redirect;
    },
    routes: [
      GoRoute(
        path: AppRoutes.root,
        pageBuilder: (context, state) => _smoothPage(const MarketplaceLandingPage(), state),
      ),
      GoRoute(
        path: AppRoutes.setup,
        pageBuilder: (context, state) => _smoothPage(const SetupPage(), state),
      ),
      GoRoute(
        path: AppRoutes.signIn,
        pageBuilder: (context, state) => _smoothPage(const LoginPage(), state),
      ),
      GoRoute(
        path: AppRoutes.signUp,
        pageBuilder: (context, state) => _smoothPage(const SignUpPage(), state),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        pageBuilder: (context, state) => _smoothPage(const ForgotPasswordPage(), state),
      ),
      GoRoute(
        path: AppRoutes.onboarding,
        pageBuilder: (context, state) => _smoothPage(const OnboardingWalkthroughPage(), state),
      ),
      GoRoute(
        path: AppRoutes.createNeed,
        pageBuilder: (context, state) => _smoothPage(CreateNeedPage(
          initialTitle: state.uri.queryParameters['title'],
          initialDetails: state.uri.queryParameters['details'],
          initialCategory: state.uri.queryParameters['category'],
        ), state),
      ),
      GoRoute(
        path: '/app/post-task',
        redirect: (context, state) => AppRoutes.createNeed,
      ),
      GoRoute(
        path: AppRoutes.search,
        pageBuilder: (context, state) => _smoothPage(
            SearchPage(initialQuery: state.uri.queryParameters['q']), state),
      ),
      GoRoute(
        path: AppRoutes.mapDiscovery,
        pageBuilder: (context, state) => _smoothPage(const MapDiscoveryPage(), state),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        pageBuilder: (context, state) => _smoothPage(const NotificationsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.profilePublic,
        redirect: (context, state) => AppRoutes.publicBusiness,
      ),
      GoRoute(
        path: AppRoutes.publicBusiness,
        pageBuilder: (context, state) => _smoothPage(const PublicBusinessPage(), state),
      ),
      GoRoute(
        path: AppRoutes.profileEdit,
        redirect: (context, state) => AppRoutes.profile,
      ),
      GoRoute(
        path: AppRoutes.profileTrust,
        redirect: (context, state) => AppRoutes.profile,
      ),
      GoRoute(
        path: AppRoutes.profileSettings,
        pageBuilder: (context, state) => _smoothPage(const SettingsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.blockedUsers,
        pageBuilder: (context, state) => _smoothPage(const BlockedUsersPage(), state),
      ),
      GoRoute(
        path: AppRoutes.control,
        redirect: (context, state) => AppRoutes.profile,
      ),
      GoRoute(
        path: AppRoutes.seekerOnboarding,
        pageBuilder: (context, state) => _smoothPage(const SeekerOnboardingPage(), state),
      ),
      GoRoute(
        path: AppRoutes.providerOnboarding,
        pageBuilder: (context, state) => _smoothPage(const ProviderOnboardingPage(), state),
      ),
      GoRoute(
        path: AppRoutes.providerLaunchpad,
        pageBuilder: (context, state) => _smoothPage(const ProviderLaunchpadPage(), state),
      ),
      GoRoute(
        path: AppRoutes.providerListings,
        pageBuilder: (context, state) => _smoothPage(const ProviderListingsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.payouts,
        pageBuilder: (context, state) => _smoothPage(const PayoutsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.transactions,
        pageBuilder: (context, state) => _smoothPage(const TransactionsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.referrals,
        pageBuilder: (context, state) => _smoothPage(const ReferralsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.verification,
        pageBuilder: (context, state) => _smoothPage(const VerificationPage(), state),
      ),
      GoRoute(
        path: AppRoutes.analytics,
        pageBuilder: (context, state) => _smoothPage(const AnalyticsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.availability,
        pageBuilder: (context, state) => _smoothPage(const AvailabilityPage(), state),
      ),
      GoRoute(
        path: AppRoutes.bookings,
        pageBuilder: (context, state) => _smoothPage(const BookingsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.workspaces,
        pageBuilder: (context, state) => _smoothPage(const WorkspacesPage(), state),
        routes: [
          GoRoute(
            path: ':workspaceId',
            pageBuilder: (context, state) => _smoothPage(WorkspaceDetailPage(
              workspaceId: state.pathParameters['workspaceId']?.trim() ?? '',
            ), state),
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.orders,
        pageBuilder: (context, state) => _smoothPage(const OrdersPage(), state),
        routes: [
          GoRoute(
            path: ':orderId',
            pageBuilder: (context, state) => _smoothPage(OrderDetailPage(
              orderId: state.pathParameters['orderId']?.trim() ?? '',
            ), state),
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.providerOrders,
        pageBuilder: (context, state) => _smoothPage(const ProviderOrdersPage(), state),
        routes: [
          GoRoute(
            path: ':orderId',
            pageBuilder: (context, state) => _smoothPage(OrderDetailPage(
              orderId: state.pathParameters['orderId']?.trim() ?? '',
            ), state),
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.providerLeads,
        pageBuilder: (context, state) => _smoothPage(const ProviderLeadsPage(), state),
        routes: [
          GoRoute(
            path: ':orderId',
            pageBuilder: (context, state) => _smoothPage(OrderDetailPage(
              orderId: state.pathParameters['orderId']?.trim() ?? '',
            ), state),
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.providerBoosts,
        pageBuilder: (context, state) => _smoothPage(const ProviderBoostsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.providerSubscriptions,
        pageBuilder: (context, state) => _smoothPage(const ProviderSubscriptionsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.invoices,
        pageBuilder: (context, state) => _smoothPage(const InvoicesPage(), state),
      ),
      GoRoute(
        path: '${AppRoutes.invoices}/:invoiceId',
        pageBuilder: (context, state) => _smoothPage(InvoiceDetailPage(
          invoiceId: state.pathParameters['invoiceId']!,
        ), state),
      ),
      GoRoute(
        path: AppRoutes.connections,
        pageBuilder: (context, state) => _smoothPage(const ConnectionsPage(), state),
      ),
      GoRoute(
        path: AppRoutes.admin,
        pageBuilder: (context, state) => _smoothPage(const AdminPage(), state),
      ),
      GoRoute(
        path: AppRoutes.checkout,
        pageBuilder: (context, state) => _smoothPage(CheckoutPage(
          item: _checkoutItemFromQuery(state),
          fromCart: state.uri.queryParameters['source'] == 'cart',
        ), state),
      ),
      GoRoute(
        path: AppRoutes.saved,
        pageBuilder: (context, state) => _smoothPage(const SavedFeedPage(), state),
      ),
      GoRoute(
        path: '${AppRoutes.listings}/:itemId',
        pageBuilder: (context, state) => _smoothPage(ListingDetailPage(
          itemId: state.pathParameters['itemId']?.trim() ?? '',
          source: _queryParam(state, 'source'),
        ), state),
      ),
      GoRoute(
        path: AppRoutes.providerLaunchpadReview,
        pageBuilder: (context, state) => _smoothPage(const ProviderLaunchpadReviewPage(), state),
      ),
      GoRoute(
        path: AppRoutes.quote,
        pageBuilder: (context, state) => _smoothPage(QuoteRoomPage(
          mode: quoteTargetModeFromSource(_queryParam(state, 'mode')),
          targetId: _queryParam(state, 'targetId') ?? '',
          conversationId: _queryParam(state, 'conversationId'),
        ), state),
      ),
      GoRoute(
        path: AppRoutes.quoteComparison,
        pageBuilder: (context, state) => _smoothPage(QuoteComparisonPage(
          helpRequestId: _queryParam(state, 'helpRequestId') ?? '',
        ), state),
      ),
      GoRoute(
        path: AppRoutes.profile,
        pageBuilder: (context, state) => _smoothPage(const ProfilePage(), state),
      ),
      GoRoute(
        path: AppRoutes.people,
        pageBuilder: (context, state) => _smoothPage(const PeoplePage(), state),
      ),
      GoRoute(
        path: AppRoutes.provider(':providerId'),
        pageBuilder: (context, state) => _smoothPage(ProviderProfilePage(
          providerId: state.pathParameters['providerId'] ?? '',
        ), state),
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
                pageBuilder: (context, state) => _smoothPage(const WelcomePage(), state),
              ),
              GoRoute(
                path: AppRoutes.explore,
                pageBuilder: (context, state) =>
                    _smoothPage(const FeedPage(mode: FeedPageMode.explore), state),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.discovery,
                pageBuilder: (context, state) =>
                    _smoothPage(const DiscoveryPage(), state),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.marketZones,
                pageBuilder: (context, state) => _smoothPage(const MarketZonesScreen(), state),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.tasks,
                pageBuilder: (context, state) => _smoothPage(TasksPage(
                  focusTaskId: state.uri.queryParameters['focus'],
                  focusSource: state.uri.queryParameters['source'],
                ), state),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.chat,
                pageBuilder: (context, state) => _smoothPage(ChatPage(
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
                ), state),
                routes: [
                  GoRoute(
                    path: 'thread/:threadId',
                    pageBuilder: (context, state) => _smoothPage(ChatPage(
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
                    ), state),
                  ),
                ],
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
