import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../main.dart';
import '../../services/server_discovery_service.dart';
import '../../services/user_service.dart';
import 'profile_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _themeModeStr = 'light';
  String _fontSizeStr = 'medium';
  String _languageStr = 'en';

  bool _notificationsEnabled = true;
  bool _emailNotifications = true;
  bool _pushNotifications = true;
  bool _inAppNotifications = true;
  bool _twoFactorEnabled = false;

  bool _isLoading = true;
  bool _isScanning = false;
  List<dynamic> _activeSessions = [];

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final profile = await UserService.fetchUserProfile();
      final sessions = await UserService.fetchActiveSessions();

      setState(() {
        _themeModeStr = profile?['theme_preference'] ?? prefs.getString('theme_mode') ?? 'light';
        _fontSizeStr = profile?['font_size_preference'] ?? prefs.getString('font_size') ?? 'medium';
        _languageStr = profile?['language_preference'] ?? prefs.getString('language') ?? 'en';

        _notificationsEnabled = profile?['notifications_enabled'] ?? prefs.getBool('notifications_enabled') ?? true;
        _emailNotifications = profile?['email_notifications'] ?? prefs.getBool('email_notifications') ?? true;
        _pushNotifications = profile?['push_notifications'] ?? prefs.getBool('push_notifications') ?? true;
        _inAppNotifications = profile?['in_app_notifications'] ?? prefs.getBool('in_app_notifications') ?? true;
        _twoFactorEnabled = profile?['two_factor_enabled'] ?? prefs.getBool('two_factor_enabled') ?? false;

        _activeSessions = sessions;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint("Failed to load settings: $e");
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveThemeMode(String mode) async {
    setState(() => _themeModeStr = mode);
    final theme = mode == 'dark'
        ? ThemeMode.dark
        : (mode == 'system' ? ThemeMode.system : ThemeMode.light);
    await MainApp.of(context).updateThemeMode(theme);
    await UserService.updateUserSettings({'theme_preference': mode});
  }

  Future<void> _saveFontSize(String size) async {
    setState(() => _fontSizeStr = size);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('font_size', size);
    await UserService.updateUserSettings({'font_size_preference': size});
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Font size updated to $size'), duration: const Duration(seconds: 1)),
      );
    }
  }

  Future<void> _saveLanguage(String lang) async {
    setState(() => _languageStr = lang);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('language', lang);
    await UserService.updateUserSettings({'language_preference': lang});
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(lang == 'ms' ? 'Bahasa ditukar ke Bahasa Malaysia' : 'Language changed to English'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  Future<void> _saveNotificationSettings({
    bool? master,
    bool? email,
    bool? push,
    bool? inApp,
  }) async {
    setState(() {
      if (master != null) _notificationsEnabled = master;
      if (email != null) _emailNotifications = email;
      if (push != null) _pushNotifications = push;
      if (inApp != null) _inAppNotifications = inApp;
    });

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notifications_enabled', _notificationsEnabled);
    await prefs.setBool('email_notifications', _emailNotifications);
    await prefs.setBool('push_notifications', _pushNotifications);
    await prefs.setBool('in_app_notifications', _inAppNotifications);

    await UserService.updateUserSettings({
      'notifications_enabled': _notificationsEnabled,
      'email_notifications': _emailNotifications,
      'push_notifications': _pushNotifications,
      'in_app_notifications': _inAppNotifications,
    });
  }

  Future<void> _toggle2FA(bool value) async {
    setState(() => _twoFactorEnabled = value);
    // ASSUMPTION: 2FA UI state and DB flag is persisted to Supabase/PostgreSQL.
    // Full TOTP QR code generation and 2FA authenticator verification logic
    // still requires backend TOTP service implementation.
    await UserService.updateUserSettings({'two_factor_enabled': value});
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(value
              ? '2FA security flag enabled on your account.'
              : '2FA security flag disabled.'),
          backgroundColor: value ? const Color(0xFF10B981) : const Color(0xFF64748B),
        ),
      );
    }
  }

  Future<void> _runAutoDiscovery() async {
    setState(() => _isScanning = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final discoveredUrl = await ServerDiscoveryService.discoverServer();
      final prefs = await SharedPreferences.getInstance();
      if (discoveredUrl != null) {
        await prefs.setString('custom_api_url', discoveredUrl);
        setState(() {
          ApiConfig.customUrl = discoveredUrl;
        });
        messenger.showSnackBar(
          SnackBar(
            content: Text("Server discovered successfully at $discoveredUrl!"),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
      } else {
        messenger.showSnackBar(
          const SnackBar(
            content: Text("No server found on the network. Using default configuration."),
            backgroundColor: Color(0xFFDC2626),
          ),
        );
      }
    } catch (e) {
      debugPrint("Settings discovery action failed: $e");
      messenger.showSnackBar(
        SnackBar(
          content: Text("Discovery error: $e"),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isScanning = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text('Settings & Preferences', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16.0),
              children: [
                // 1. APPEARANCE SECTION
                _buildSectionHeader(Icons.palette_outlined, 'Appearance'),
                Card(
                  elevation: 1.5,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  color: isDarkMode ? const Color(0xFF1E293B) : Colors.white,
                  child: Column(
                    children: [
                      ListTile(
                        title: const Text('Theme Mode'),
                        subtitle: Text('Current: ${_themeModeStr.toUpperCase()}'),
                        trailing: DropdownButton<String>(
                          value: _themeModeStr,
                          underline: const SizedBox(),
                          items: const [
                            DropdownMenuItem(value: 'light', child: Text('Light Mode')),
                            DropdownMenuItem(value: 'dark', child: Text('Dark Mode')),
                            DropdownMenuItem(value: 'system', child: Text('System Default')),
                          ],
                          onChanged: (val) {
                            if (val != null) _saveThemeMode(val);
                          },
                        ),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        title: const Text('Font Size'),
                        subtitle: Text('Current: ${_fontSizeStr.toUpperCase()}'),
                        trailing: DropdownButton<String>(
                          value: _fontSizeStr,
                          underline: const SizedBox(),
                          items: const [
                            DropdownMenuItem(value: 'small', child: Text('Small')),
                            DropdownMenuItem(value: 'medium', child: Text('Medium')),
                            DropdownMenuItem(value: 'large', child: Text('Large')),
                          ],
                          onChanged: (val) {
                            if (val != null) _saveFontSize(val);
                          },
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // 2. NOTIFICATIONS SECTION
                _buildSectionHeader(Icons.notifications_outlined, 'Notifications'),
                Card(
                  elevation: 1.5,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  color: isDarkMode ? const Color(0xFF1E293B) : Colors.white,
                  child: Column(
                    children: [
                      SwitchListTile(
                        title: const Text('Master Notification Switch'),
                        subtitle: const Text('Enable or disable all app notifications'),
                        value: _notificationsEnabled,
                        onChanged: (val) => _saveNotificationSettings(master: val),
                      ),
                      if (_notificationsEnabled) ...[
                        const Divider(height: 1),
                        SwitchListTile(
                          title: const Text('In-App Toasts & Alerts'),
                          subtitle: const Text('Attendance & session alerts in app'),
                          value: _inAppNotifications,
                          onChanged: (val) => _saveNotificationSettings(inApp: val),
                        ),
                        const Divider(height: 1),
                        SwitchListTile(
                          title: const Text('Push Notifications'),
                          subtitle: const Text('Class session reminders & alerts'),
                          value: _pushNotifications,
                          onChanged: (val) => _saveNotificationSettings(push: val),
                        ),
                        const Divider(height: 1),
                        SwitchListTile(
                          title: const Text('Email Notifications'),
                          subtitle: const Text('Attendance reports & announcements'),
                          value: _emailNotifications,
                          onChanged: (val) => _saveNotificationSettings(email: val),
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // 3. SECURITY SECTION
                _buildSectionHeader(Icons.security_outlined, 'Security'),
                Card(
                  elevation: 1.5,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  color: isDarkMode ? const Color(0xFF1E293B) : Colors.white,
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.lock_reset_rounded, color: Color(0xFF2563EB)),
                        title: const Text('Change Password'),
                        subtitle: const Text('Open secure password update flow'),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ProfileScreen()),
                          );
                        },
                      ),
                      const Divider(height: 1),
                      SwitchListTile(
                        title: const Text('Two-Factor Authentication (2FA)'),
                        subtitle: const Text('Require 2FA verification code on login'),
                        value: _twoFactorEnabled,
                        onChanged: _toggle2FA,
                      ),
                      const Divider(height: 1),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Active Device Sessions',
                              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            const SizedBox(height: 8),
                            if (_activeSessions.isEmpty)
                              const Text('No active sessions found.')
                            else
                              ..._activeSessions.map((sess) {
                                return Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Colors.grey.withValues(alpha: 0.2)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              const Icon(Icons.smartphone_rounded, size: 16, color: Color(0xFF2563EB)),
                                              const SizedBox(width: 6),
                                              Text(
                                                sess['device_name'] ?? 'Mobile Device',
                                                style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 12),
                                              ),
                                              if (sess['is_current'] == true) ...[
                                                const SizedBox(width: 6),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFD1FAE5),
                                                    borderRadius: BorderRadius.circular(6),
                                                  ),
                                                  child: Text(
                                                    'Current',
                                                    style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF059669), fontWeight: FontWeight.bold),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Platform: ${sess['platform'] ?? 'App'}',
                                            style: GoogleFonts.inter(fontSize: 11, color: Colors.grey),
                                          ),
                                        ],
                                      ),
                                      if (sess['is_current'] != true)
                                        TextButton(
                                          onPressed: () async {
                                            await UserService.logoutSession(sess['id'].toString());
                                            _loadPreferences();
                                          },
                                          child: const Text('Log out', style: TextStyle(color: Colors.red, fontSize: 12)),
                                        ),
                                    ],
                                  ),
                                );
                              }),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // 4. LANGUAGE SECTION
                _buildSectionHeader(Icons.language_rounded, 'Language'),
                Card(
                  elevation: 1.5,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  color: isDarkMode ? const Color(0xFF1E293B) : Colors.white,
                  child: ListTile(
                    title: const Text('App Language'),
                    subtitle: Text(_languageStr == 'ms' ? 'Bahasa Malaysia' : 'English (US)'),
                    trailing: DropdownButton<String>(
                      value: _languageStr,
                      underline: const SizedBox(),
                      items: const [
                        DropdownMenuItem(value: 'en', child: Text('English')),
                        DropdownMenuItem(value: 'ms', child: Text('Bahasa Malaysia')),
                      ],
                      onChanged: (val) {
                        if (val != null) _saveLanguage(val);
                      },
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // 5. SERVER DISCOVERY & DIAGNOSTICS
                _buildSectionHeader(Icons.dns_outlined, 'Server Configuration'),
                Card(
                  elevation: 1.5,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  color: isDarkMode ? const Color(0xFF1E293B) : Colors.white,
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Backend Gateway Address',
                          style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                        const SizedBox(height: 4),
                        SelectableText(
                          ApiConfig.baseUrl,
                          style: GoogleFonts.firaCode(fontSize: 12, color: const Color(0xFF2563EB)),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _isScanning ? null : _runAutoDiscovery,
                            icon: _isScanning
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Icon(Icons.radar_rounded),
                            label: Text(_isScanning ? 'Discovering Server...' : 'Auto-Discover Server Network'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2563EB),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 40),
              ],
            ),
    );
  }

  Widget _buildSectionHeader(IconData icon, String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF2563EB)),
          const SizedBox(width: 8),
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF2563EB),
            ),
          ),
        ],
      ),
    );
  }
}
