import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class FirebaseRuntimeOptions {
  const FirebaseRuntimeOptions._();

  static FirebaseOptions? get currentPlatform {
    const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
    const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
    const messagingSenderId = String.fromEnvironment(
      'FIREBASE_MESSAGING_SENDER_ID',
    );
    if (apiKey.isEmpty || projectId.isEmpty || messagingSenderId.isEmpty) {
      return null;
    }

    final appId = String.fromEnvironment(
      switch (defaultTargetPlatform) {
        TargetPlatform.android => 'FIREBASE_ANDROID_APP_ID',
        TargetPlatform.iOS => 'FIREBASE_IOS_APP_ID',
        TargetPlatform.macOS => 'FIREBASE_MACOS_APP_ID',
        _ => '',
      },
    );

    if (appId.isEmpty) {
      return null;
    }

    return FirebaseOptions(
      apiKey: apiKey,
      appId: appId,
      messagingSenderId: messagingSenderId,
      projectId: projectId,
    );
  }
}
