import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase/app_bootstrap.dart';

final authStateControllerProvider = Provider<AuthStateController>((ref) {
  final controller = AuthStateController(ref.watch(appBootstrapProvider));
  ref.onDispose(controller.dispose);
  return controller;
});

final currentSessionProvider = StreamProvider<Session?>((ref) {
  return ref.watch(authStateControllerProvider).sessionChanges;
});

class AuthStateController extends ChangeNotifier {
  AuthStateController(this._bootstrap) {
    _currentSession = _bootstrap.client?.auth.currentSession;
    _subscription = _bootstrap.client?.auth.onAuthStateChange.listen((data) {
      _currentSession = data.session;
      _sessionController.add(_currentSession);
      notifyListeners();
    });
  }

  final AppBootstrap _bootstrap;
  final StreamController<Session?> _sessionController =
      StreamController<Session?>.broadcast();
  StreamSubscription<AuthState>? _subscription;
  Session? _currentSession;

  Session? get currentSession => _currentSession;
  User? get currentUser => _currentSession?.user;
  bool get isAuthenticated => currentSession != null;
  Stream<Session?> get sessionChanges async* {
    yield _currentSession;
    yield* _sessionController.stream;
  }

  Future<void> signOut() async {
    final client = _bootstrap.client;
    if (client == null) {
      return;
    }

    await client.auth.signOut();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _sessionController.close();
    super.dispose();
  }
}
