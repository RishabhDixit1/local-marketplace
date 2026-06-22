# Integration Tests

This directory contains integration tests for the ServiQ mobile app.

## Prerequisites

- Android emulator or iOS simulator running
- Flutter SDK installed

## Running Tests

### Using Flutter's built-in integration test driver:

```sh
flutter test integration_test/app_test.dart
```

### Using Patrol (recommended for more advanced scenarios):

```sh
patrol test
```

### Running a specific test:

```sh
patrol test -t "Landing page loads and shows ServiQ"
```

## Notes

- Integration tests require a running device/emulator — they will not work in headless mode.
- Tests use `IntegrationTestWidgetsFlutterBinding` for proper async handling.
- The `patrol test` command handles app installation and launch automatically.
