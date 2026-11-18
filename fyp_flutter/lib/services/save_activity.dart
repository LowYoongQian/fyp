import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// How many saves the user started (POST, PUT, PATCH, DELETE) are on their way. While it is above zero the app shows
/// "Saving…" at the top, so every button that sends something answers the tap at once, whatever screen it is on.
final ValueNotifier<int> savesInFlight = ValueNotifier(0);

// Sent by the app on its own, or with their own progress on screen (sign-in, the check-in dialog, the scan's challenge):
// counting them would show "Saving…" when the user is not waiting on a save.
const _notCounted = [
  '/auth/login',
  '/auth/logout',
  '/auth/push/',
  '/notifications',
  '/offline-checkins/',
  '/attend',
  '/checkin-challenge',
  '/self-test/challenge',
];

/// Counts every save that goes through package:http. Installed for the whole app by [runWithClient] in main().
class SaveTrackingClient extends http.BaseClient {
  SaveTrackingClient(this._inner);
  final http.Client _inner;

  static bool counts(http.BaseRequest request) =>
      !const {'GET', 'HEAD', 'OPTIONS'}.contains(request.method) && !_notCounted.any(request.url.path.contains);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    if (!counts(request)) return _inner.send(request);
    savesInFlight.value++;
    try {
      return await _inner.send(request);
    } finally {
      savesInFlight.value--;
    }
  }

  @override
  void close() => _inner.close();
}
