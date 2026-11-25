import 'package:flutter_test/flutter_test.dart';
import 'package:fyp_flutter/main.dart';

void main() {
  const local = 'http://10.0.2.2:58004';
  test('QA rejects a remote target before network initialization', () {
    expect(() => ApiConfig.pinIntegrationTestServer('https://synthetic.invalid'), throwsStateError);
  });
  test('both compiled endpoints must match the fixture, and saved URLs cannot override it', () {
    if (const String.fromEnvironment('API_BASE_URL') == local &&
        const String.fromEnvironment('EMULATOR_API_BASE_URL') == local) {
      ApiConfig.pinIntegrationTestServer(local);
      ApiConfig.customUrl = 'https://synthetic.invalid';
      expect(ApiConfig.getEffectiveUrl(), local);
    } else {
      expect(() => ApiConfig.pinIntegrationTestServer(local), throwsStateError);
    }
  });
}
