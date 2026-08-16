import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';

import 'package:serviq_mobile/core/api/mobile_api_client.dart';
import 'package:serviq_mobile/core/api/mobile_api_provider.dart';
import 'package:serviq_mobile/core/config/app_config.dart';
import 'package:serviq_mobile/core/services/user_location.dart';
import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/features/discovery/presentation/discovery_page.dart';
import 'package:serviq_mobile/features/search/data/search_repository.dart';
import 'package:serviq_mobile/features/search/domain/search_models.dart';
import 'package:serviq_mobile/shared/widgets/ai_prompt_bar.dart';

import 'helpers/serviq_test_app.dart';

const _bootstrap = AppBootstrap(
  config: AppConfig(
    appName: 'ServiQ',
    environment: 'test',
    supabaseUrl: 'https://demo-project.supabase.co',
    supabaseAnonKey: 'demo-anon-key',
    apiBaseUrl: 'https://demo.serviq.app',
    authRedirectScheme: 'serviq',
    authRedirectHost: 'auth-callback',
    allowBadCertificates: false,
  ),
  client: null,
  supabaseReady: false,
  initializationError: null,
);

class _MockSearchRepository implements SearchRepository {
  const _MockSearchRepository();

  @override
  Future<SearchResponse> search({
    String? category,
    String? query,
    double? lat,
    double? lng,
    int limit = 50,
    int offset = 0,
    double? minRating,
    bool onlineOnly = false,
    String sortBy = 'distance',
  }) async {
    return const SearchResponse(
      total: 3,
      providers: [
        SearchResult(
          id: 'provider-1',
          name: 'Priyanka Narayanan',
          location: 'Crossing Republik, Ghaziabad',
          avgRating: 4.9,
          reviewCount: 18,
          completedJobs: 37,
          isOnline: true,
          verified: true,
          priceMin: 1200,
        ),
        SearchResult(
          id: 'provider-2',
          name: 'Rajesh Kumar',
          location: 'Crossing Republik, Ghaziabad',
          avgRating: 4.2,
          reviewCount: 9,
          isOnline: false,
          verified: false,
        ),
      ],
    );
  }
}

class _MockApiClient extends MobileApiClient {
  _MockApiClient()
    : super(config: _bootstrap.config, supabaseClient: null, rateLimiter: null);

  @override
  Future<List<Map<String, dynamic>>> getServiceCategories({
    String? localityId,
  }) async {
    return [
      {'name': 'Electrician', 'icon': '⚡'},
      {'name': 'Plumber', 'icon': '🔧'},
    ];
  }

  @override
  Future<List<Map<String, dynamic>>> getLocalities({
    String? zoneType,
    int? phase,
  }) async {
    return [];
  }
}

void _setTallSurface(WidgetTester tester) {
  tester.view.devicePixelRatio = 1.0;
  tester.view.physicalSize = const Size(800, 3200);
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}

Future<void> _pumpDiscovery(WidgetTester tester) async {
  _setTallSurface(tester);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        appBootstrapProvider.overrideWithValue(_bootstrap),
        searchRepositoryProvider.overrideWithValue(
          const _MockSearchRepository(),
        ),
        mobileApiClientProvider.overrideWithValue(_MockApiClient()),
        userLocationProvider.overrideWith((ref) async => null),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        localizationsDelegates: kServiqTestLocalizationsDelegates,
        supportedLocales: kServiqTestSupportedLocales,
        home: const DiscoveryPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('explore page renders sections in order', (tester) async {
    await _pumpDiscovery(tester);

    expect(find.text('Discover'), findsOneWidget);
    expect(find.text('Search providers by name or service'), findsOneWidget);
    expect(find.text('Popular Services'), findsOneWidget);
    expect(find.text('Electrician'), findsAtLeastNWidgets(1));
    expect(find.text('Plumber'), findsAtLeastNWidgets(1));
    expect(find.text('3 providers near you'), findsOneWidget);
    expect(find.text('Explore Markets'), findsOneWidget);
    expect(find.text('No zones available'), findsOneWidget);
    expect(find.text('How ServiQ works'), findsNothing);
    expect(find.text('Looking for services?'), findsNothing);
    expect(find.text('Are you a service provider?'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('explore page has a single search affordance', (tester) async {
    await _pumpDiscovery(tester);

    expect(find.byType(AiPromptBar), findsOneWidget);
    expect(find.text('Search providers by name or service'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('explore markets groups live and upcoming zones', (tester) async {
    _setTallSurface(tester);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appBootstrapProvider.overrideWithValue(_bootstrap),
          searchRepositoryProvider.overrideWithValue(
            const _MockSearchRepository(),
          ),
          mobileApiClientProvider.overrideWithValue(_ZonesApiClient()),
          userLocationProvider.overrideWith((ref) async => null),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          localizationsDelegates: kServiqTestLocalizationsDelegates,
          supportedLocales: kServiqTestSupportedLocales,
          home: const DiscoveryPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('2 Societies · 1 Market'), findsOneWidget);
    expect(find.text('Live Now'), findsOneWidget);
    expect(find.text('Browse Local Zones'), findsOneWidget);
    expect(find.text('Live'), findsNWidgets(3));
    expect(find.text('Upcoming'), findsOneWidget);
    expect(find.text('Crossings Republik'), findsOneWidget);
    expect(find.text('Vaishali Extension'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('providers near you singular count', (tester) async {
    _setTallSurface(tester);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appBootstrapProvider.overrideWithValue(_bootstrap),
          searchRepositoryProvider.overrideWithValue(
            const _SingleProviderSearchRepository(),
          ),
          mobileApiClientProvider.overrideWithValue(_MockApiClient()),
          userLocationProvider.overrideWith((ref) async => null),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          localizationsDelegates: kServiqTestLocalizationsDelegates,
          supportedLocales: kServiqTestSupportedLocales,
          home: const DiscoveryPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('1 provider near you'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'map renders with a mix of valid, null, and NaN provider coordinates',
    (tester) async {
      _setTallSurface(tester);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appBootstrapProvider.overrideWithValue(_bootstrap),
            searchRepositoryProvider.overrideWithValue(
              const _MixedLocationSearchRepository(),
            ),
            mobileApiClientProvider.overrideWithValue(_MockApiClient()),
            userLocationProvider.overrideWith((ref) async => null),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            localizationsDelegates: kServiqTestLocalizationsDelegates,
            supportedLocales: kServiqTestSupportedLocales,
            home: const DiscoveryPage(),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('3 providers near you'), findsOneWidget);
      expect(find.byType(FlutterMap), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}

class _ZonesApiClient extends _MockApiClient {
  @override
  Future<List<Map<String, dynamic>>> getLocalities({
    String? zoneType,
    int? phase,
  }) async {
    return [
      {
        'id': 'loc-society-1',
        'name': 'Crossings Republik',
        'slug': 'crossings-republik',
        'zone_type': 'society',
        'phase': 1,
        'city': 'Ghaziabad',
        'state': 'UP',
        'provider_count': 45,
      },
      {
        'id': 'loc-society-2',
        'name': 'Gaur City',
        'slug': 'gaur-city',
        'zone_type': 'society',
        'phase': 1,
        'city': 'Noida',
        'state': 'UP',
        'provider_count': 18,
      },
      {
        'id': 'loc-market-1',
        'name': 'Chaudhary Market',
        'slug': 'chaudhary-market',
        'zone_type': 'market',
        'phase': 1,
        'city': 'Ghaziabad',
        'state': 'UP',
        'provider_count': 64,
      },
      {
        'id': 'loc-expansion-1',
        'name': 'Vaishali Extension',
        'slug': 'vaishali-extension',
        'zone_type': 'expansion',
        'phase': 1,
        'city': 'Ghaziabad',
        'state': 'UP',
        'provider_count': 0,
      },
    ];
  }
}

class _SingleProviderSearchRepository implements SearchRepository {
  const _SingleProviderSearchRepository();

  @override
  Future<SearchResponse> search({
    String? category,
    String? query,
    double? lat,
    double? lng,
    int limit = 50,
    int offset = 0,
    double? minRating,
    bool onlineOnly = false,
    String sortBy = 'distance',
  }) async {
    return const SearchResponse(
      total: 1,
      providers: [
        SearchResult(
          id: 'provider-1',
          name: 'Priyanka Narayanan',
          location: 'Crossing Republik, Ghaziabad',
        ),
      ],
    );
  }
}

class _MixedLocationSearchRepository implements SearchRepository {
  const _MixedLocationSearchRepository();

  @override
  Future<SearchResponse> search({
    String? category,
    String? query,
    double? lat,
    double? lng,
    int limit = 50,
    int offset = 0,
    double? minRating,
    bool onlineOnly = false,
    String sortBy = 'distance',
  }) async {
    return SearchResponse(
      total: 3,
      providers: [
        const SearchResult(
          id: 'provider-valid',
          name: 'Alpha Provider',
          location: 'Connaught Place, New Delhi',
          lat: 28.6139,
          lng: 77.2090,
        ),
        const SearchResult(
          id: 'provider-null',
          name: 'Bravo Provider',
          location: 'Crossing Republik, Ghaziabad',
        ),
        SearchResult(
          id: 'provider-nan',
          name: 'Charlie Provider',
          location: 'Vaishali, Ghaziabad',
          lat: double.nan,
          lng: double.nan,
        ),
      ],
    );
  }
}
