import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppConnectivityStatus { online, offline }

final connectivityStatusProvider = StreamProvider<AppConnectivityStatus>((ref) {
  final connectivity = Connectivity();
  return connectivity.onConnectivityChanged.map((results) {
    final hasConnection = results.any((result) => 
      result == ConnectivityResult.mobile ||
      result == ConnectivityResult.wifi ||
      result == ConnectivityResult.ethernet
    );
    return hasConnection ? AppConnectivityStatus.online : AppConnectivityStatus.offline;
  });
});

final initialConnectivityProvider = Provider<Future<AppConnectivityStatus>>((ref) {
  return Connectivity().checkConnectivity().then((results) {
    final hasConnection = results.any((result) =>
      result == ConnectivityResult.mobile ||
      result == ConnectivityResult.wifi ||
      result == ConnectivityResult.ethernet
    );
    return hasConnection ? AppConnectivityStatus.online : AppConnectivityStatus.offline;
  });
});
