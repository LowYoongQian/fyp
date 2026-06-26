// -----------------------------------------------------------------
// APP CONFIG: all sensitive / environment-specific values.
//
// Values are injected at build/run time via --dart-define-from-file so
// secrets never live in source control. Run the app with:
//
//   flutter run --dart-define-from-file=env.json
//   flutter build apk --dart-define-from-file=env.json
//
// See env.json.example for the expected keys. env.json is gitignored.
// -----------------------------------------------------------------
class AppConfig {
  // Backend API base URL (FastAPI server).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:8000',
  );

  // Backend API base URL used when running on an Android emulator without an
  // adb-reverse tunnel. The emulator reaches the host PC via 10.0.2.2.
  static const String emulatorApiBaseUrl = String.fromEnvironment(
    'EMULATOR_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );
}
