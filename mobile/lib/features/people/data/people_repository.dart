import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../core/cache/people_cache.dart';
import '../../../core/error/app_error_mapper.dart';
import '../domain/people_snapshot.dart';

final peopleRepositoryProvider = Provider<PeopleRepository>((ref) {
  return PeopleRepository(
    ref.watch(mobileApiClientProvider),
    ref.watch(peopleCacheProvider),
  );
});

final peopleSnapshotProvider = FutureProvider<MobilePeopleSnapshot>((ref) {
  return ref.watch(peopleRepositoryProvider).fetchPeople();
});

class PeopleFetchResult {
  final MobilePeopleSnapshot snapshot;
  final bool fromCache;
  final int limit;

  const PeopleFetchResult({
    required this.snapshot,
    required this.fromCache,
    required this.limit,
  });
}

class PeopleListState {
  final List<MobilePersonCard> people;
  final String currentUserId;
  final List<String> acceptedConnectionIds;
  final String viewerRoleFamily;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final int offset;
  final bool isStale;
  final String? error;

  const PeopleListState({
    this.people = const [],
    this.currentUserId = '',
    this.acceptedConnectionIds = const [],
    this.viewerRoleFamily = 'seeker',
    this.isLoading = true,
    this.isLoadingMore = false,
    this.hasMore = true,
    this.offset = 0,
    this.isStale = false,
    this.error,
  });

  bool get isEmpty => people.isEmpty;

  PeopleListState copyWith({
    List<MobilePersonCard>? people,
    String? currentUserId,
    List<String>? acceptedConnectionIds,
    String? viewerRoleFamily,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasMore,
    int? offset,
    bool? isStale,
    String? error,
    bool clearError = false,
  }) {
    return PeopleListState(
      people: people ?? this.people,
      currentUserId: currentUserId ?? this.currentUserId,
      acceptedConnectionIds:
          acceptedConnectionIds ?? this.acceptedConnectionIds,
      viewerRoleFamily: viewerRoleFamily ?? this.viewerRoleFamily,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasMore: hasMore ?? this.hasMore,
      offset: offset ?? this.offset,
      isStale: isStale ?? this.isStale,
      error: clearError ? null : error ?? this.error,
    );
  }

  MobilePeopleSnapshot toSnapshot() => MobilePeopleSnapshot(
        currentUserId: currentUserId,
        people: people,
        acceptedConnectionIds: acceptedConnectionIds,
        viewerRoleFamily: viewerRoleFamily,
      );
}

class PeopleListNotifier extends Notifier<PeopleListState> {
  @override
  PeopleListState build() => const PeopleListState();

  PeopleRepository get _repository => ref.read(peopleRepositoryProvider);

  Future<void> loadInitial() async {
    state = const PeopleListState(isLoading: true);
    try {
      final result = await _repository.fetchPeopleResult(offset: 0);
      final snapshot = result.snapshot;
      state = PeopleListState(
        people: snapshot.people,
        currentUserId: snapshot.currentUserId,
        acceptedConnectionIds: snapshot.acceptedConnectionIds,
        viewerRoleFamily: snapshot.viewerRoleFamily,
        isLoading: false,
        hasMore: snapshot.people.length >= result.limit,
        offset: snapshot.people.length,
        isStale: result.fromCache,
      );
    } catch (e) {
      state = PeopleListState(
        isLoading: false,
        hasMore: false,
        error: AppErrorMapper.toMessage(e),
      );
    }
  }

  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final result =
          await _repository.fetchPeopleResult(offset: state.offset);
      final snapshot = result.snapshot;
      final allPeople = [...state.people, ...snapshot.people];
      state = state.copyWith(
        people: allPeople,
        offset: state.offset + snapshot.people.length,
        hasMore: snapshot.people.length >= result.limit,
        isLoadingMore: false,
        isStale: state.isStale || result.fromCache,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: AppErrorMapper.toMessage(e),
      );
    }
  }

  Future<void> refresh() async {
    try {
      final result = await _repository.fetchPeopleResult(offset: 0);
      final snapshot = result.snapshot;
      state = PeopleListState(
        people: snapshot.people,
        currentUserId: snapshot.currentUserId,
        acceptedConnectionIds: snapshot.acceptedConnectionIds,
        viewerRoleFamily: snapshot.viewerRoleFamily,
        isLoading: false,
        hasMore: snapshot.people.length >= result.limit,
        offset: snapshot.people.length,
        isStale: result.fromCache,
      );
    } catch (e) {
      state = state.copyWith(error: AppErrorMapper.toMessage(e));
    }
  }
}

final peopleListNotifierProvider =
    NotifierProvider<PeopleListNotifier, PeopleListState>(
  PeopleListNotifier.new,
);

final peopleListAsyncProvider = Provider<AsyncValue<PeopleListState>>((ref) {
  final state = ref.watch(peopleListNotifierProvider);
  if (state.isLoading) {
    return const AsyncValue.loading();
  }
  if (state.error != null && state.people.isEmpty) {
    return AsyncValue.error(state.error!, StackTrace.current);
  }
  return AsyncValue.data(state);
});

class PeopleRepository {
  const PeopleRepository(this._apiClient, this._cache);

  final MobileApiClient _apiClient;
  final PeopleCache _cache;

  Future<MobilePeopleSnapshot> fetchPeople({int limit = 50, int offset = 0}) async {
    final result = await fetchPeopleResult(limit: limit, offset: offset);
    return result.snapshot;
  }

  Future<PeopleFetchResult> fetchPeopleResult({int limit = 50, int offset = 0}) async {
    try {
      final payload = await _apiClient.getJson(
        '/api/community/people',
        queryParameters: {
          'limit': limit.toString(),
          'offset': offset.toString(),
        },
      );
      if (payload['ok'] != true) {
        throw ApiException(
          (payload['message'] as String?) ??
              'Unable to load the people directory right now.',
        );
      }

      final snapshot = MobilePeopleSnapshot.fromJson(payload);
      if (offset == 0) {
        await _cache.cachePeople(snapshot);
      }
      return PeopleFetchResult(snapshot: snapshot, fromCache: false, limit: limit);
    } catch (e) {
      if (offset == 0) {
        final cached = await _cache.getCachedPeople();
        if (cached != null) {
          return PeopleFetchResult(snapshot: cached, fromCache: true, limit: limit);
        }
      }
      rethrow;
    }
  }
}
