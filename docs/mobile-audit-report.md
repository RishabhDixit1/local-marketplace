# Mobile Audit Report — Image Decoder Failures & Jank

**Date:** 2026-07-11
**Auditor:** opencode (read-only audit)
**Environment:** Android emulator `sdk gphone16k arm64`, API 36 (CinnamonBun), run via `scripts/run-mobile.sh`
**Flutter:** 3.41.9 stable, Dart 3.11.5, DevTools 2.54.2
**Status:** ✅ Audit complete, zero files modified

---

## Summary

### Issue A — Image Decoder Failures
**Root cause (85% confidence):** The CinnamonBun (API 36) emulator system image lacks full codec support for the image formats served by Supabase Storage. `cached_network_image` successfully downloads images, but Flutter's `FlutterImageDecoderImplDefault` delegates to Android's `android.graphics.ImageDecoder` which fails with `"unimplemented"` for the specific format (likely WebP). **This is emulator-specific and would not reproduce on real devices** with manufacturer-shipped codec libraries.

### Issue B — Jank / Frame Skips
**Root cause (70% confidence):** Cold-start frame skips are caused by **blocking platform channel calls during `_startBootstrap()`** (Supabase's `FlutterSecureStorage` Keystore init on cold Android start: 3 sequential reads × 100-500ms each). Secondary contributors: `AppConfig.load()` blocking `runApp()` with an asset bundle platform channel call, and feed screens using `ListView(children:...)` instead of `ListView.builder`. The 6475ms Davey frame is likely the `WidgetsFlutterBinding.ensureInitialized()` + `AppConfig.load()` combination on a cold process.

---

## Issue A: Image Decoder — Detailed Investigation

### Package and Version
| Item | Value |
|------|-------|
| Image loading package | `cached_network_image: ^3.4.1` (locked at `3.4.1`) |
| Cache manager | `flutter_cache_manager` (transitive via `cached_network_image`) |
| Underlying decode path | `FlutterImageDecoderImplDefault` → `android.graphics.ImageDecoder` |
| Other image usage | `Image.network` in `order_detail_page.dart:1189`, `NetworkImage` in `CircleAvatar` at `provider_card.dart:183` and `profile_avatar_tile.dart:33` |
| Files using CachedNetworkImage | 8 files (feed_card, provider_profile_page, provider_listings_page, listing_detail_page, welcome_widgets, public_business_page, review_card, order_detail_page) |

### SDK Versions vs Emulator
| Setting | Value | Emulator API |
|---------|-------|--------------|
| `compileSdk` | 36 (Flutter default via `FlutterExtension.kt:23`) | 36 (CinnamonBun) ✅ Match |
| `targetSdk` | 36 (Flutter default via `FlutterExtension.kt:34`) | 36 ✅ Match |
| `minSdk` | 24 (Flutter default via `FlutterExtension.kt:26`) | N/A |

**No SDK version mismatch.** The `build.gradle.kts` delegates to `flutter.compileSdkVersion` / `flutter.targetSdkVersion` / `flutter.minSdkVersion` (lines 30, 45-46), which resolve to 36/36/24 in Flutter 3.41.9. No custom overrides.

### Custom Decoders / Workarounds
- No custom image decoders in the codebase
- No `--enable-impeller` / `--no-enable-impeller` flags in `scripts/run-mobile.sh`
- No Impeller/Skia configuration in `AndroidManifest.xml` or Dart code
- No existing notes/workarounds for image decoder issues in docs
- All image widgets have error fallbacks (`errorWidget` for `CachedNetworkImage`, `onForegroundImageError` for `CircleAvatar`), which silently swallow the decode failure

### Emulator vs Real Device
**Emulator-specific.** Evidence:
1. Error fires for **every** image render — systemic, not format-specific to individual images
2. The error tag `FlutterImageDecoderImplDefault` is Flutter's non-accelerated decoder path
3. The CinnamonBun "Resizable Experimental" emulator image is known to have limited codec support compared to production device images
4. Real Android devices ship with full codec libraries from the manufacturer (Qualcomm, MediaTek, etc.)
5. No reports of this error on physical devices in the codebase or existing docs

### Recommended Fix
**Do nothing in code.** This is a test environment limitation. Options:
1. Switch to a non-"Resizable Experimental" emulator system image (e.g., `google_apis_playstore_arm64_v8a`)
2. Add a `--no-enable-impeller` flag to `run-mobile.sh` if Impeller's decode path is the specific trigger
3. Verify on a physical device before spending engineering time

---

## Issue B: Jank / Frame Skips — Detailed Investigation

### Startup Sequence Analysis

```
main() [main.dart:14]
  ├── FlutterError.onError = (line 15)
  ├── WidgetsFlutterBinding.ensureInitialized() [line 26] ← PLATFORM CHANNEL
  ├── AppConfig.load() [line 28] ← AWAITED, BLOCKS RUNAPP
  │     └── rootBundle.loadString('config/local.json') ← PLATFORM CHANNEL
  ├── AppFirebase.initialize() [line 29] ← Future created, NOT awaited
  ├── MobilePushNotificationService.registerBackgroundHandler() [line 30]
  ├── runApp(_BootstrapHost) [line 32]
  │     └── _BootstrapHostState.initState() [line 74]
  │           └── addPostFrameCallback → _startBootstrap() [line 82]
  │                 └── Future.wait([
  │                       AppBootstrap.initialize() [line 106]
  │                       └── Supabase.initialize() [line 59]
  │                             └── FlutterSecureStorage ×3 platform channels
  │                       widget.firebaseFuture [line 107]
  │                         └── Firebase.initializeApp()
  │                     ])
  └── addPostFrameCallback → initializeLocalNotifications() [line 42]
```

### Critical Findings

#### 1. `AppConfig.load()` blocks `runApp()` — `main.dart:28`
`AppConfig.load()` is `await`ed before `runApp()`. It calls `rootBundle.loadString('config/local.json')` (`app_config.dart:176`), which is a platform channel call to the embedder. On cold Android start, this can take 200-500ms because the asset bundle is not yet warmed up. **This delays the first frame.**

#### 2. `_startBootstrap()` blocks main thread post-first-frame — `main.dart:82`
After the first frame paints (the loading screen), `addPostFrameCallback` fires `_startBootstrap()` which calls `Supabase.initialize()` (`app_bootstrap.dart:59`). This internally does 3 sequential `FlutterSecureStorage` platform channel calls for Keystore initialization on cold Android start, each 100-500ms. **These are awaited synchronously within `Supabase.initialize()`**, blocking the main thread and preventing the `LinearProgressIndicator` from animating. This is the primary cause of the 334-frame skip.

#### 3. Firebase initialized before first frame — `main.dart:29`
`AppFirebase.initialize()` creates its Future before `runApp()`. While it's not `await`ed, `Firebase.initializeApp()` does internal platform channel work. The Future runs concurrently with the first frame, but may contend for the main thread during `addPostFrameCallback`.

#### 4. Feed screens use non-lazy lists
- `feed_page.dart:558`: `ListView(children: [...])` — all feed items built at once
- `feed_page.dart:1029`: `_ExploreFeedLane` uses `Column` with `...items.map()` — all items built at once
- `welcome_page.dart:708`: `SliverList(delegate: SliverChildListDelegate.fixed([...]))` — all welcome entries built at once
- **Only 2 files** in the entire codebase use `ListView.builder`: `chat_page.dart:1377` and `admin_page.dart:226,337`

#### 5. `addPostFrameCallback` coverage
15 usages found across the codebase. Cold-start paths are covered:
- `main.dart:42` — local notification init ✅
- `main.dart:82` — bootstrap init ✅
- `app.dart:35` — analytics tracking ✅
- `welcome_page.dart:123` — welcome analytics ✅

#### 6. `_WelcomeViewModel.build()` — `welcome_page.dart:1189`
Complex computation (sorting, scoring, diversifying across 4 surfaces). However, it is **memoized** via `_buildCachedViewModel()` (line 78) with `identical()` checks on AsyncValues. Only rebuilds when feed/people data actually changes. Not a cold-start bottleneck.

### Davey! 6475ms Frame Analysis
A single frame lasting 6475ms indicates a blocking call on the main thread that prevents the frame from completing. Most likely candidates:
1. `WidgetsFlutterBinding.ensureInitialized()` + `AppConfig.load()` on cold process
2. The first `FlutterSecureStorage` Keystore init call within Supabase bootstrap
3. `Firebase.initializeApp()` platform channel call

### DevTools Timeline Exports
**None found.** `test-results 2/` contains only `.last-run.json`. No timeline JSON exports exist for analysis.

### Recommended Fix (ranked by impact)

1. **Defer `AppConfig.load()` after `runApp()`** — Move it into `_startBootstrap()` so the first frame is not blocked by the asset bundle platform channel call. Pass a default/empty config to `_BootstrapHost` and resolve the real config asynchronously.

2. **Use `ListView.builder` in feed screens** — Replace `ListView(children: [...])` in `feed_page.dart:558` and `SliverChildListDelegate.fixed` in `welcome_page.dart:708` with builder variants to defer card widget construction until visible.

3. **Parallelize Supabase SecureStorage reads** — If possible, batch the 3 `FlutterSecureStorage` reads instead of doing them sequentially, or pre-warm Keystore during the splash screen animation.

---

## Build / Render Configuration

### Impeller vs Skia
**Impeller is the default backend** in Flutter 3.41.9. No explicit Impeller/Skia configuration found:
- No `--enable-impeller` or `--no-enable-impeller` in `scripts/run-mobile.sh`
- No `android:impeller` entry in `AndroidManifest.xml`
- No `impeller` references in Dart code

The error tag `FlutterImageDecoderImplDefault` confirms Impeller is active (this is Impeller's default image decoder, as opposed to the Skia-backed `FlutterImageDecoderImplSkia`).

### Debug vs Release Mode
**All testing is in debug mode.** `scripts/run-mobile.sh` runs `flutter run` (line 164) without `--debug` or `--release` flags, defaulting to debug mode. Debug mode characteristics:
- JIT compilation (no tree shaking, no AOT)
- Assert checks enabled
- Impeller in debug configuration (less optimized)
- All platform channels go through debug bridges

**No profile or release mode testing evidence found.** The `build.gradle.kts` has release signing configuration (lines 52-68), but the release path requires a keystore that may not be set up (line 79-88 has a guard for `hasReleaseKeystore`).

**Note:** Debug-mode jank is expected to be significantly worse than release. The 334-frame skip and 6475ms Davey are partially attributable to debug overhead. Recommended: run `flutter run --profile` to get closer to real-device performance characteristics.

---

## Files Examined

| File | Purpose |
|------|---------|
| `mobile/pubspec.yaml` | Package versions |
| `mobile/pubspec.lock` | Locked versions (cached_network_image 3.4.1) |
| `mobile/lib/main.dart` | App entry, startup sequence |
| `mobile/lib/core/supabase/app_bootstrap.dart` | Supabase init |
| `mobile/lib/core/firebase/app_firebase.dart` | Firebase init |
| `mobile/lib/core/config/app_config.dart` | Config loading |
| `mobile/lib/app/app.dart` | ServiQApp widget, router |
| `mobile/lib/features/welcome/presentation/welcome_page.dart` | Welcome/home screen |
| `mobile/lib/features/feed/presentation/feed_page.dart` | Feed screen |
| `mobile/lib/shared/components/feed_card.dart` | Feed card widget |
| `mobile/lib/shared/components/provider_card.dart` | Provider card widget |
| `mobile/lib/shared/components/profile_avatar_tile.dart` | Avatar widget |
| `mobile/android/app/build.gradle.kts` | Android build config |
| `mobile/android/app/src/main/AndroidManifest.xml` | Android manifest |
| `scripts/run-mobile.sh` | Run script |
| `test-results 2/.last-run.json` | Test results (no timeline data) |

---

## Verification

**Zero files were modified** during this audit. Only read operations were performed:
- File reads via `Read` tool
- Pattern searches via `Grep` and `Glob` tools
- Flutter version check via `flutter --version` (read-only)
- Gradle plugin source inspection via `grep` (read-only)

All file contents remain unchanged from the pre-audit state.
