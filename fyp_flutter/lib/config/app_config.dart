// -----------------------------------------------------------------
// APP CONFIG: Centralized environment & platform configuration.
// -----------------------------------------------------------------
import 'package:flutter/foundation.dart';

class AppConfig {
  // Production Railway Backend URL (HTTPS)
  static const String productionApiUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://fyps.up.railway.app',
  );

  // Android Emulator fallback URL.
  // Local port must match BACKEND_PORT in fyp-backend/.env (8003, not 8000:
  // Windows' IP Helper service binds 127.0.0.1:8000 and answers before uvicorn).
  static const String emulatorApiUrl = String.fromEnvironment(
    'EMULATOR_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8003',
  );

  // Local Desktop debugging URL
  static const String desktopApiUrl = 'http://localhost:8003';

  // Backward compatibility getters
  static String get apiBaseUrl => kIsWeb ? productionApiUrl : productionApiUrl;
  static String get emulatorApiBaseUrl => emulatorApiUrl;
}
