// -----------------------------------------------------------------
// APP CONFIG: Centralized environment & platform configuration.
// -----------------------------------------------------------------
import 'package:flutter/foundation.dart';

class AppConfig {
  // Production Backend URL (Azure)
  // 如果要切回 Railway，改成 'https://fyps.up.railway.app'
  static const String productionApiUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.smartsystem.live',
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

  /// True when the backend is a hosted HTTPS server rather than something on the
  /// local machine/LAN. Used to skip LAN auto-discovery: scanning the subnet is
  /// pointless against a public host, and a stale discovered URL would silently
  /// override this one (ApiConfig.customUrl outranks productionApiUrl).
  static bool get isRemoteBackend {
    final uri = Uri.tryParse(productionApiUrl);
    if (uri == null) return false;
    if (uri.scheme != 'https') return false;
    final h = uri.host;
    return h != 'localhost' && h != '127.0.0.1' && h != '10.0.2.2';
  }
}
