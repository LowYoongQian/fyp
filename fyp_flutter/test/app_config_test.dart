import 'package:flutter_test/flutter_test.dart';
import 'package:fyp_flutter/config/app_config.dart';

/// Guards the switch that decides whether the app scans the LAN for a backend.
///
/// Why this matters: ApiConfig.customUrl (set only by LAN discovery) outranks
/// productionApiUrl in getEffectiveUrl(). So if discovery runs against a hosted
/// backend, it can pin the app to a stale address — that is exactly the bug that
/// left iOS builds talking to the old Railway host and reporting "cannot reach
/// the server". Discovery must stay off whenever the backend is remote.
void main() {
  group('AppConfig.isRemoteBackend', () {
    test('is true for the configured production backend, so LAN discovery is skipped', () {
      expect(
        AppConfig.productionApiUrl,
        startsWith('https://'),
        reason: 'Production must be HTTPS; plain HTTP would re-enable LAN discovery.',
      );
      expect(AppConfig.isRemoteBackend, isTrue);
    });

    test('emulator and desktop URLs stay local, so discovery still works in dev', () {
      for (final url in [AppConfig.emulatorApiUrl, AppConfig.desktopApiUrl]) {
        final uri = Uri.parse(url);
        expect(
          uri.scheme == 'https' &&
              uri.host != 'localhost' &&
              uri.host != '127.0.0.1' &&
              uri.host != '10.0.2.2',
          isFalse,
          reason: '$url must not be classified as remote.',
        );
      }
    });
  });
}
