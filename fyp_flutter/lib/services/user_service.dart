import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../main.dart';

class UserService {
  static Map<String, String> _getHeaders(String token) {
    return {
      'Content-Type': 'application/json',
      if (token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>?> fetchUserProfile({
    required String authToken,
    String? apiBaseUrl,
  }) async {
    try {
      final headers = _getHeaders(authToken);
      final url = Uri.parse(
        '${apiBaseUrl ?? ApiConfig.getEffectiveUrl()}/auth/me',
      );
      final response = await http
          .get(url, headers: headers)
          .timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        debugPrint(
          'Failed to fetch user profile: HTTP ${response.statusCode}',
        );
        return null;
      }
    } catch (e) {
      debugPrint('Error in fetchUserProfile: $e');
      return null;
    }
  }

  static Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
    required String authToken,
    String? apiBaseUrl,
  }) async {
    try {
      final headers = _getHeaders(authToken);
      final url = Uri.parse(
        '${apiBaseUrl ?? ApiConfig.getEffectiveUrl()}/auth/me/change-password',
      );
      final response = await http.put(
        url,
        headers: headers,
        body: jsonEncode({
          'current_password': currentPassword,
          'new_password': newPassword,
        }),
      );

      if (response.statusCode == 200) {
        return true;
      } else {
        final err = jsonDecode(response.body);
        throw Exception(err['detail'] ?? 'Password change failed');
      }
    } catch (e) {
      rethrow;
    }
  }

  static Future<bool> updateUserSettings(
    Map<String, dynamic> settings, {
    required String authToken,
    String? apiBaseUrl,
  }) async {
    try {
      final headers = _getHeaders(authToken);
      final url = Uri.parse('${apiBaseUrl ?? ApiConfig.getEffectiveUrl()}/auth/me/settings');
      final response = await http.put(
        url,
        headers: headers,
        body: jsonEncode(settings),
      );

      if (response.statusCode == 200) {
        return true;
      } else {
        debugPrint('Failed to update settings: HTTP ${response.statusCode}');
        return false;
      }
    } catch (e) {
      debugPrint('Error updating settings: $e');
      return false;
    }
  }

  static Future<String> uploadAvatar(
    Uint8List imageBytes, {
    required String filename,
    required String authToken,
    String? apiBaseUrl,
  }) async {
    final headers = _getHeaders(authToken);
    headers.remove('Content-Type');
    final request = http.MultipartRequest(
      'POST',
      Uri.parse(
        '${apiBaseUrl ?? ApiConfig.getEffectiveUrl()}/auth/me/avatar/upload',
      ),
    )..headers.addAll(headers);
    request.files.add(
      http.MultipartFile.fromBytes('file', imageBytes, filename: filename),
    );

    final streamed = await request.send().timeout(const Duration(seconds: 25));
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return (jsonDecode(response.body) as Map<String, dynamic>)['avatar_url']
          as String;
    }

    String detail = 'Could not save profile image';
    try {
      final error = jsonDecode(response.body) as Map<String, dynamic>;
      detail = error['detail']?.toString() ?? detail;
    } catch (_) {}
    throw Exception(detail);
  }

  static Future<void> requestRecoveryEmail(
    String email,
    String authToken,
  ) async {
    final response = await http
        .post(
          Uri.parse(
            '${ApiConfig.getEffectiveUrl()}/auth/recovery-email/request',
          ),
          headers: _getHeaders(authToken),
          body: jsonEncode({'recovery_email': email}),
        )
        .timeout(const Duration(seconds: 12));
    if (response.statusCode != 200) {
      if (response.statusCode == 404) {
        throw Exception(
          'Recovery service is not available on this server. Please update the server and try again.',
        );
      }
      throw Exception(
        jsonDecode(response.body)['detail'] ?? 'Could not send code',
      );
    }
  }

  static Future<void> verifyRecoveryEmail(String code, String authToken) async {
    final response = await http
        .post(
          Uri.parse(
            '${ApiConfig.getEffectiveUrl()}/auth/recovery-email/verify',
          ),
          headers: _getHeaders(authToken),
          body: jsonEncode({'code': code}),
        )
        .timeout(const Duration(seconds: 12));
    if (response.statusCode != 200) {
      throw Exception(jsonDecode(response.body)['detail'] ?? 'Code is invalid');
    }
  }

  static Future<Map<String, dynamic>?> fetchSystemLanguages() async {
    try {
      final url = Uri.parse(
        '${ApiConfig.getEffectiveUrl()}/api/v1/system/languages',
      );
      final response = await http.get(url).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      debugPrint('Error fetching system languages in Flutter: $e');
      return null;
    }
  }
}
