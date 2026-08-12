import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../main.dart';

class UserService {
  static Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('auth_token');
  }

  static Future<Map<String, String>> _getHeaders([String? authToken]) async {
    final token = authToken ?? await _getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>?> fetchUserProfile({
    String? authToken,
    String? apiBaseUrl,
  }) async {
    try {
      final headers = await _getHeaders(authToken);
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
          'Failed to fetch user profile: ${response.statusCode} ${response.body}',
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
    String? authToken,
    String? apiBaseUrl,
  }) async {
    try {
      final headers = await _getHeaders(authToken);
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

  static Future<bool> updateUserSettings(Map<String, dynamic> settings) async {
    try {
      final headers = await _getHeaders();
      final url = Uri.parse('${ApiConfig.baseUrl}/auth/settings');
      final response = await http.put(
        url,
        headers: headers,
        body: jsonEncode(settings),
      );

      if (response.statusCode == 200) {
        return true;
      } else {
        debugPrint('Failed to update settings: ${response.body}');
        return false;
      }
    } catch (e) {
      debugPrint('Error updating settings: $e');
      return false;
    }
  }

  static Future<bool> uploadAvatar(
    String avatarUrl, {
    String? authToken,
    String? apiBaseUrl,
  }) async {
    try {
      final headers = await _getHeaders(authToken);
      final url = Uri.parse(
        '${apiBaseUrl ?? ApiConfig.getEffectiveUrl()}/auth/me/avatar',
      );
      final response = await http.put(
        url,
        headers: headers,
        body: jsonEncode({'avatar_url': avatarUrl}),
      );

      if (response.statusCode == 200) {
        return true;
      } else {
        debugPrint('Failed to update avatar: ${response.body}');
        return false;
      }
    } catch (e) {
      debugPrint('Error uploading avatar: $e');
      return false;
    }
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
          headers: await _getHeaders(authToken),
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
          headers: await _getHeaders(authToken),
          body: jsonEncode({'code': code}),
        )
        .timeout(const Duration(seconds: 12));
    if (response.statusCode != 200) {
      throw Exception(jsonDecode(response.body)['detail'] ?? 'Code is invalid');
    }
  }

  static Future<Map<String, dynamic>?> fetchSystemLanguages() async {
    try {
      final url = Uri.parse('${ApiConfig.baseUrl}/api/v1/system/languages');
      final response = await http.get(url);

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
