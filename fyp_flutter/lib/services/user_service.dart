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

  static Future<Map<String, String>> _getHeaders() async {
    final token = await _getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>?> fetchUserProfile() async {
    try {
      final headers = await _getHeaders();
      final url = Uri.parse('${ApiConfig.baseUrl}/auth/me');
      final response = await http.get(url, headers: headers);

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        debugPrint('Failed to fetch user profile: ${response.statusCode} ${response.body}');
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
  }) async {
    try {
      final headers = await _getHeaders();
      final url = Uri.parse('${ApiConfig.baseUrl}/auth/change-password');
      final response = await http.post(
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

  static Future<bool> uploadAvatar(String avatarUrl) async {
    try {
      final headers = await _getHeaders();
      final url = Uri.parse('${ApiConfig.baseUrl}/auth/avatar');
      final response = await http.post(
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

  static Future<List<dynamic>> fetchActiveSessions() async {
    try {
      final headers = await _getHeaders();
      final url = Uri.parse('${ApiConfig.baseUrl}/auth/active-sessions');
      final response = await http.get(url, headers: headers);

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as List<dynamic>;
      } else {
        return [];
      }
    } catch (e) {
      debugPrint('Error fetching active sessions: $e');
      return [];
    }
  }

  static Future<bool> logoutSession(String sessionId) async {
    try {
      final headers = await _getHeaders();
      final url = Uri.parse('${ApiConfig.baseUrl}/auth/logout-session?session_id=$sessionId');
      final response = await http.post(url, headers: headers);

      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Error logging out session: $e');
      return false;
    }
  }
}
