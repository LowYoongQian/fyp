import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;

String newCheckInId() {
  final r = Random.secure();
  final b = List.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  final hex = b.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

class OfflineCheckInResult {
  final String status;
  final String message;
  const OfflineCheckInResult(this.status, this.message);
}

Future<OfflineCheckInResult> syncOfflineCheckIn({
  required http.Client client,
  required String server,
  required String token,
  required Map<String, Object?> row,
  required Future<Map<String, dynamic>> Function() networkFacts,
  required bool Function() stillCurrent,
}) async {
  const pending = OfflineCheckInResult(
    'pending',
    'Waiting for connection or sign-in. Attendance is not confirmed.',
  );
  if (!stillCurrent()) return pending;
  final headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };
  try {
    Future<http.Response> reconcile() => client
        .post(
          Uri.parse(
            '$server/students/me/offline-checkins/${row['session_id']}/reconcile',
          ),
          headers: headers,
          body: jsonEncode({
            'client_request_id': row['request_id'],
            'captured_at': row['queued_at'],
          }),
        )
        .timeout(const Duration(seconds: 15));
    OfflineCheckInResult decode(http.Response response) {
      if (response.statusCode == 401 ||
          response.statusCode == 429 ||
          response.statusCode >= 500) {
        return pending;
      }
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200) {
        return OfflineCheckInResult(
          'failed',
          '${data['detail'] ?? 'Contact your lecturer.'}',
        );
      }
      final status = data['status']?.toString() ?? 'failed';
      return OfflineCheckInResult(status, '${data['message'] ?? ''}');
    }

    var result = decode(await reconcile());
    if (result.status != 'retry_checkin' || !stillCurrent()) {
      return result.status == 'retry_checkin' ? pending : result;
    }
    final payload = Map<String, dynamic>.from(
      jsonDecode(row['payload_json'] as String),
    );
    payload.addAll(await networkFacts());
    if (!stillCurrent()) return pending;
    final response = await client
        .post(
          Uri.parse('$server/sessions/${row['session_id']}/attend'),
          headers: headers,
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode == 200) {
      return const OfflineCheckInResult('synced', 'Attendance recorded.');
    }
    if (response.statusCode == 401 ||
        response.statusCode == 429 ||
        response.statusCode >= 500) {
      return pending;
    }
    // Check again: another request may have succeeded, or the class just ended.
    if (!stillCurrent()) return pending;
    result = decode(await reconcile());
    if (result.status != 'retry_checkin') return result;
    return OfflineCheckInResult(
      'failed',
      '${jsonDecode(response.body)['detail'] ?? 'Verification failed; try a fresh check-in.'}',
    );
  } on TimeoutException {
    return pending;
  } on http.ClientException {
    return pending;
  } on FormatException {
    return pending;
  }
}
