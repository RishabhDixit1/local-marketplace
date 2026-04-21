import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/mock/serviq_mock_store.dart';
import '../../../core/models/serviq_models.dart';

final peopleHubRepositoryProvider = Provider<PeopleHubRepository>((ref) {
  return PeopleHubRepository(ref);
});

final peopleHubProvider = FutureProvider<PeopleHub>((ref) async {
  return ref.read(peopleHubRepositoryProvider).fetchHub();
});

class PeopleHubRepository {
  PeopleHubRepository(this._ref);

  final Ref _ref;

  Future<PeopleHub> fetchHub() async {
    await Future<void>.delayed(const Duration(milliseconds: 180));
    final state = _ref.read(serviqMockStoreProvider);

    final accepted = state.people
        .where((item) => item.connectionState == PeopleConnectionState.connected)
        .toList();
    final suggested = state.people
        .where((item) => item.connectionState != PeopleConnectionState.connected)
        .where((item) => item.connectionState != PeopleConnectionState.blocked)
        .toList();

    return PeopleHub(
      acceptedConnections: accepted,
      suggestedPeople: suggested,
      incomingRequests: state.connectionRequests
          .where(
            (item) => item.direction == ConnectionRequestDirection.incoming,
          )
          .toList(),
      outgoingRequests: state.connectionRequests
          .where(
            (item) => item.direction == ConnectionRequestDirection.outgoing,
          )
          .toList(),
    );
  }

  Future<void> toggleSaved(String personId) async {
    _ref.read(serviqMockStoreProvider.notifier).toggleSavedPerson(personId);
  }

  Future<void> sendConnectionRequest(String personId) async {
    _ref.read(serviqMockStoreProvider.notifier).sendConnectionRequest(personId);
  }

  Future<void> acceptIncomingRequest(String requestId) async {
    _ref
        .read(serviqMockStoreProvider.notifier)
        .acceptIncomingRequest(requestId);
  }

  Future<void> removeConnection(String personId) async {
    _ref.read(serviqMockStoreProvider.notifier).removeConnection(personId);
  }

  Future<void> blockPerson(String personId) async {
    _ref.read(serviqMockStoreProvider.notifier).blockPerson(personId);
  }
}
