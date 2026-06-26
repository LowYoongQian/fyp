import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../main.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _themeModeStr = 'light';
  bool _notificationsEnabled = true;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      setState(() {
        _themeModeStr = prefs.getString('theme_mode') ?? 'light';
        _notificationsEnabled = prefs.getBool('notifications_enabled') ?? true;
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
  }

  Future<void> _saveNotificationSettings(bool enabled) async {
    setState(() => _notificationsEnabled = enabled);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('notifications_enabled', enabled);
    } catch (e) {
      debugPrint("Failed to save notification settings: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Settings & Preferences",
          style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        elevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: isDarkMode ? Colors.white : const Color(0xFF0F172A),
      ),
      backgroundColor: isDarkMode ? const Color(0xFF121212) : const Color(0xFFF8FAFC),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Theme Section
            _buildSectionHeader("Universal App Theme"),
            _buildThemeSelector(),
            const SizedBox(height: 24),

            // Notifications Section
            _buildSectionHeader("Notifications Settings"),
            _buildCard([
              SwitchListTile(
                title: Text(
                  "App Notifications",
                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13.5),
                ),
                subtitle: Text(
                  _notificationsEnabled ? "Enabled — you will receive check-in alerts" : "Disabled — no check-in alerts",
                  style: GoogleFonts.inter(fontSize: 10.5, color: const Color(0xFF64748B)),
                ),
                secondary: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _notificationsEnabled ? const Color(0xFFEF4444).withValues(alpha: 0.1) : const Color(0xFF64748B).withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.notifications,
                    color: _notificationsEnabled ? const Color(0xFFEF4444) : const Color(0xFF64748B),
                    size: 20,
                  ),
                ),
                value: _notificationsEnabled,
                onChanged: _saveNotificationSettings,
              ),
            ]),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(left: 4.0, bottom: 8.0),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.spaceGrotesk(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  Widget _buildCard(List<Widget> children) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: isDarkMode ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDarkMode ? 0.15 : 0.03),
            blurRadius: 8,
            offset: const Offset(0, 3),
          )
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: children,
      ),
    );
  }

  Widget _buildThemeSelector() {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: isDarkMode ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(8.0),
      child: Row(
        children: [
          _buildThemeButton("Light Theme", "light", Icons.light_mode, const Color(0xFFF59E0B)),
          const SizedBox(width: 8),
          _buildThemeButton("Dark Theme", "dark", Icons.dark_mode, const Color(0xFF6366F1)),
          const SizedBox(width: 8),
          _buildThemeButton("System Default", "system", Icons.settings_brightness, const Color(0xFF64748B)),
        ],
      ),
    );
  }

  Widget _buildThemeButton(String label, String value, IconData icon, Color color) {
    final isSelected = _themeModeStr == value;
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    
    return Expanded(
      child: GestureDetector(
        onTap: () => _saveThemeMode(value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          decoration: BoxDecoration(
            color: isSelected
                ? (value == 'dark' 
                    ? const Color(0xFF2563EB).withValues(alpha: 0.15) 
                    : color.withValues(alpha: 0.15))
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected 
                  ? (value == 'dark' ? const Color(0xFF2563EB) : color)
                  : Colors.transparent,
              width: 1.5,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                color: isSelected 
                    ? (value == 'dark' ? const Color(0xFF3B82F6) : color)
                    : (isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                size: 20,
              ),
              const SizedBox(height: 6),
              Text(
                label,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 10.5,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                  color: isSelected
                      ? (isDarkMode ? Colors.white : const Color(0xFF0F172A))
                      : (isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
