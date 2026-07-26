// ignore_for_file: use_build_context_synchronously
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../main.dart';
import '../../services/user_service.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/shimmer_loading.dart';
import '../../i18n/app_localizations.dart';

const List<Map<String, String>> kSupportedLanguages = [
  {'code': 'en', 'name': 'English (US)', 'native': 'English', 'flag': '🇺🇸'},
  {'code': 'ms', 'name': 'Bahasa Malaysia', 'native': 'Melayu', 'flag': '🇲🇾'},
  {'code': 'zh', 'name': 'Chinese (Simplified)', 'native': '中文 (简体)', 'flag': '🇨🇳'},
  {'code': 'ta', 'name': 'Tamil', 'native': 'தமிழ்', 'flag': '🇮🇳'},
  {'code': 'ja', 'name': 'Japanese', 'native': '日本語', 'flag': '🇯🇵'},
  {'code': 'ko', 'name': 'Korean', 'native': '한국어', 'flag': '🇰🇷'},
  {'code': 'es', 'name': 'Spanish', 'native': 'Español', 'flag': '🇪🇸'},
  {'code': 'fr', 'name': 'French', 'native': 'Français', 'flag': '🇫🇷'},
  {'code': 'de', 'name': 'German', 'native': 'Deutsch', 'flag': '🇩🇪'},
  {'code': 'ar', 'name': 'Arabic', 'native': 'العربية', 'flag': '🇦🇪'},
];

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

  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  /// Load preferences with instant local SharedPreferences caching + async backend sync
  Future<void> _loadPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // 1. Instant local cache load from phone storage
      final localTheme = prefs.getString('theme_mode') ?? 'light';
      final localFontSize = prefs.getString('font_size') ?? 'medium';
      final localLanguage = prefs.getString('language') ?? 'en';
      final localMasterNotif = prefs.getBool('notifications_enabled') ?? true;
      final localEmailNotif = prefs.getBool('email_notifications') ?? true;
      final localPushNotif = prefs.getBool('push_notifications') ?? true;
      final localInAppNotif = prefs.getBool('in_app_notifications') ?? true;

      if (mounted) {
        setState(() {
          _themeModeStr = localTheme;
          _fontSizeStr = localFontSize;
          _languageStr = localLanguage;
          _notificationsEnabled = localMasterNotif;
          _emailNotifications = localEmailNotif;
          _pushNotifications = localPushNotif;
          _inAppNotifications = localInAppNotif;
          _isLoading = false;
        });
      }

      // 2. Background sync with backend profile if available
      final profile = await UserService.fetchUserProfile();
      if (profile != null && mounted) {
        setState(() {
          if (profile['theme_preference'] != null) _themeModeStr = profile['theme_preference'];
          if (profile['font_size_preference'] != null) _fontSizeStr = profile['font_size_preference'];
          if (profile['language_preference'] != null) _languageStr = profile['language_preference'];
          if (profile['notifications_enabled'] != null) _notificationsEnabled = profile['notifications_enabled'];
          if (profile['email_notifications'] != null) _emailNotifications = profile['email_notifications'];
          if (profile['push_notifications'] != null) _pushNotifications = profile['push_notifications'];
          if (profile['in_app_notifications'] != null) _inAppNotifications = profile['in_app_notifications'];
        });

        // Update local SharedPreferences cache
        await prefs.setString('theme_mode', _themeModeStr);
        await prefs.setString('font_size', _fontSizeStr);
        await prefs.setString('language', _languageStr);
        await prefs.setBool('notifications_enabled', _notificationsEnabled);
        await prefs.setBool('email_notifications', _emailNotifications);
        await prefs.setBool('push_notifications', _pushNotifications);
        await prefs.setBool('in_app_notifications', _inAppNotifications);
        await MainApp.of(context).updateLanguage(_languageStr);
      }
    } catch (e) {
      debugPrint("Failed to load settings preferences: $e");
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveThemeMode(String mode) async {
    setState(() => _themeModeStr = mode);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('theme_mode', mode);

    final theme = mode == 'dark'
        ? ThemeMode.dark
        : (mode == 'system' ? ThemeMode.system : ThemeMode.light);
    await MainApp.of(context).updateThemeMode(theme);
    
    // Async background sync so theme animation remains 60fps buttery smooth
    UserService.updateUserSettings({'theme_preference': mode});
  }

  Future<void> _saveFontSize(String size) async {
    setState(() => _fontSizeStr = size);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('font_size', size);
    UserService.updateUserSettings({'font_size_preference': size});
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Font size updated to ${size.toUpperCase()}'),
          duration: const Duration(seconds: 1),
          backgroundColor: const Color(0xFF2563EB),
        ),
      );
    }
  }

  Future<void> _saveLanguage(String langCode) async {
    setState(() => _languageStr = langCode);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('language', langCode);
    await MainApp.of(context).updateLanguage(langCode);
    UserService.updateUserSettings({'language_preference': langCode});

    final langItem = kSupportedLanguages.firstWhere(
      (l) => l['code'] == langCode,
      orElse: () => kSupportedLanguages.first,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('App Language set to ${langItem['name']} (${langItem['flag']})'),
          duration: const Duration(seconds: 2),
          backgroundColor: const Color(0xFF059669),
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

    UserService.updateUserSettings({
      'notifications_enabled': _notificationsEnabled,
      'email_notifications': _emailNotifications,
      'push_notifications': _pushNotifications,
      'in_app_notifications': _inAppNotifications,
    });
  }

  void _showLanguageDropdownModal() {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    String searchQuery = "";

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final filtered = kSupportedLanguages.where((lang) {
              final q = searchQuery.toLowerCase();
              return lang['name']!.toLowerCase().contains(q) ||
                  lang['native']!.toLowerCase().contains(q) ||
                  lang['code']!.toLowerCase().contains(q);
            }).toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.70,
              decoration: BoxDecoration(
                color: isDarkMode ? const Color(0xFF1E293B) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 16,
                    offset: const Offset(0, -4),
                  )
                ],
              ),
              child: Column(
                children: [
                  // Modal handle
                  Container(
                    margin: const EdgeInsets.only(top: 10, bottom: 6),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isDarkMode ? const Color(0xFF475569) : const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),

                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Text("🌐", style: TextStyle(fontSize: 20)),
                            const SizedBox(width: 8),
                            Text(
                              "Select App Language",
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                color: isDarkMode ? Colors.white : const Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(ctx),
                          icon: Icon(Icons.close_rounded, color: isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),

                  // Search input
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4),
                    child: TextField(
                      onChanged: (val) => setModalState(() => searchQuery = val),
                      style: GoogleFonts.inter(fontSize: 13, color: isDarkMode ? Colors.white : const Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        hintText: "Search language or country...",
                        hintStyle: GoogleFonts.inter(fontSize: 12, color: isDarkMode ? const Color(0xFF64748B) : const Color(0xFF94A3B8)),
                        prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF2563EB)),
                        filled: true,
                        fillColor: isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                        contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Languages list
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      itemCount: filtered.length,
                      separatorBuilder: (c, i) => Divider(height: 1, color: isDarkMode ? const Color(0xFF334155).withValues(alpha: 0.5) : const Color(0xFFE2E8F0).withValues(alpha: 0.5)),
                      itemBuilder: (c, idx) {
                        final item = filtered[idx];
                        final isSelected = item['code'] == _languageStr;

                        return InkWell(
                          onTap: () {
                            _saveLanguage(item['code']!);
                            Navigator.pop(ctx);
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? (isDarkMode ? const Color(0xFF2563EB).withValues(alpha: 0.15) : const Color(0xFFEFF6FF))
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Text(item['flag']!, style: const TextStyle(fontSize: 22)),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item['name']!,
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 13.5,
                                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                          color: isSelected
                                              ? const Color(0xFF2563EB)
                                              : (isDarkMode ? Colors.white : const Color(0xFF0F172A)),
                                        ),
                                      ),
                                      Text(
                                        item['native']!,
                                        style: GoogleFonts.inter(
                                          fontSize: 11,
                                          color: isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (isSelected)
                                  Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFF2563EB),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.check_rounded, size: 14, color: Colors.white),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final borderColor = isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0);

    final selectedLangItem = kSupportedLanguages.firstWhere(
      (l) => l['code'] == _languageStr,
      orElse: () => kSupportedLanguages.first,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(
          l10n.tr('common.settings'),
          style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        elevation: 0,
      ),
      body: _isLoading
          ? const ShimmerLoading(
              isLoading: true,
              child: ShimmerSettingsSkeleton(),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // -------------------------------------------------------------
                  // 1. APPEARANCE SECTION
                  // -------------------------------------------------------------
                  _buildSectionHeader(
                    Icons.palette_outlined,
                    l10n.tr('common.theme'),
                    const Color(0xFF2563EB),
                    isDarkMode ? const Color(0xFF1E3A8A).withValues(alpha: 0.3) : const Color(0xFFEFF6FF),
                  ),
                  GlassCard(
                    child: Column(
                      children: [
                        _buildSegmentedOption(
                          label: 'Theme Mode',
                          subtitle: 'Choose your visual app interface theme',
                          currentValue: _themeModeStr,
                          options: const [
                            {'label': 'Light', 'value': 'light'},
                            {'label': 'Dark', 'value': 'dark'},
                            {'label': 'System', 'value': 'system'},
                          ],
                          onSelected: _saveThemeMode,
                        ),
                        Divider(height: 1, color: borderColor),
                        _buildSegmentedOption(
                          label: 'Font Size',
                          subtitle: 'Adjust text size scaling across dashboard cards',
                          currentValue: _fontSizeStr,
                          options: const [
                            {'label': 'Small', 'value': 'small'},
                            {'label': 'Medium', 'value': 'medium'},
                            {'label': 'Large', 'value': 'large'},
                          ],
                          onSelected: _saveFontSize,
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // -------------------------------------------------------------
                  // 2. NOTIFICATIONS SECTION
                  // -------------------------------------------------------------
                  _buildSectionHeader(
                    Icons.notifications_outlined,
                    l10n.tr('common.notifications'),
                    const Color(0xFF7C3AED),
                    isDarkMode ? const Color(0xFF5B21B6).withValues(alpha: 0.3) : const Color(0xFFF3E8FF),
                  ),
                  GlassCard(
                    child: Column(
                      children: [
                        _buildSwitchTile(
                          title: 'Master Notification Switch',
                          subtitle: 'Enable or disable all app notifications globally',
                          value: _notificationsEnabled,
                          icon: Icons.power_settings_new_rounded,
                          onChanged: (val) => _saveNotificationSettings(master: val),
                        ),
                        if (_notificationsEnabled) ...[
                          Divider(height: 1, color: borderColor),
                          _buildSwitchTile(
                            title: 'In-App Toasts & Alerts',
                            subtitle: 'Show attendance & session popups while inside app',
                            value: _inAppNotifications,
                            icon: Icons.notifications_active_outlined,
                            onChanged: (val) => _saveNotificationSettings(inApp: val),
                          ),
                          Divider(height: 1, color: borderColor),
                          _buildSwitchTile(
                            title: 'Push Notifications',
                            subtitle: 'Receive class reminders on your phone lock screen',
                            value: _pushNotifications,
                            icon: Icons.mobile_friendly_rounded,
                            onChanged: (val) => _saveNotificationSettings(push: val),
                          ),
                          Divider(height: 1, color: borderColor),
                          _buildSwitchTile(
                            title: 'Email Notifications',
                            subtitle: 'Receive weekly attendance summaries & notices',
                            value: _emailNotifications,
                            icon: Icons.mail_outline_rounded,
                            onChanged: (val) => _saveNotificationSettings(email: val),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // -------------------------------------------------------------
                  // 3. LANGUAGE SECTION (Dropdown Menu Sheet Trigger)
                  // -------------------------------------------------------------
                  _buildSectionHeader(
                    Icons.language_rounded,
                    l10n.tr('common.language'),
                    const Color(0xFF059669),
                    isDarkMode ? const Color(0xFF064E3B).withValues(alpha: 0.3) : const Color(0xFFECFDF5),
                  ),
                  GlassCard(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'App Language',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 13.5,
                              fontWeight: FontWeight.bold,
                              color: isDarkMode ? Colors.white : const Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Select default system localization language',
                            style: GoogleFonts.inter(
                              fontSize: 10.5,
                              color: isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                            ),
                          ),
                          const SizedBox(height: 12),
                          InkWell(
                            onTap: _showLanguageDropdownModal,
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                color: isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: borderColor),
                              ),
                              child: Row(
                                children: [
                                  Text(selectedLangItem['flag']!, style: const TextStyle(fontSize: 20)),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          selectedLangItem['name']!,
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 13,
                                            fontWeight: FontWeight.bold,
                                            color: isDarkMode ? Colors.white : const Color(0xFF0F172A),
                                          ),
                                        ),
                                        Text(
                                          selectedLangItem['native']!,
                                          style: GoogleFonts.inter(
                                            fontSize: 10.5,
                                            color: isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF059669).withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      selectedLangItem['code']!.toUpperCase(),
                                      style: GoogleFonts.inter(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF059669),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    color: isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 36),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionHeader(IconData icon, String title, Color color, Color bgColor) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 10, top: 4),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: 10),
          Text(
            title,
            style: GoogleFonts.spaceGrotesk(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSegmentedOption({
    required String label,
    required String subtitle,
    required List<Map<String, String>> options,
    required String currentValue,
    required Function(String) onSelected,
  }) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.spaceGrotesk(
              fontSize: 13.5,
              fontWeight: FontWeight.bold,
              color: isDarkMode ? Colors.white : const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: GoogleFonts.inter(
              fontSize: 10.5,
              color: isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: options.map((opt) {
                final isSelected = opt['value'] == currentValue;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => onSelected(opt['value']!),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? (isDarkMode ? const Color(0xFF2563EB) : Colors.white)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: isDarkMode ? 0.25 : 0.06),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                )
                              ]
                            : [],
                      ),
                      child: Center(
                        child: Text(
                          opt['label']!,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                            color: isSelected
                                ? (isDarkMode ? Colors.white : const Color(0xFF2563EB))
                                : (isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSwitchTile({
    required String title,
    required String subtitle,
    required bool value,
    required Function(bool) onChanged,
    IconData? icon,
  }) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          if (icon != null) ...[
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: isDarkMode ? Colors.white : const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: GoogleFonts.inter(
                    fontSize: 10.5,
                    color: isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            activeTrackColor: const Color(0xFF2563EB),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

// -----------------------------------------------------------------
// SHIMMER SETTINGS SKELETON: Mockup Loading Placeholder for Settings
// -----------------------------------------------------------------
class ShimmerSettingsSkeleton extends StatelessWidget {
  const ShimmerSettingsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final baseColor = isDarkMode ? const Color(0xFF1E293B) : Colors.grey.shade200;

    Widget buildSkeletonCard(double height) {
      return Container(
        height: height,
        margin: const EdgeInsets.only(bottom: 24),
        decoration: BoxDecoration(
          color: baseColor,
          borderRadius: BorderRadius.circular(18),
        ),
      );
    }

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(width: 28, height: 28, decoration: BoxDecoration(color: baseColor, borderRadius: BorderRadius.circular(8))),
              const SizedBox(width: 10),
              Container(width: 120, height: 16, decoration: BoxDecoration(color: baseColor, borderRadius: BorderRadius.circular(6))),
            ],
          ),
          const SizedBox(height: 12),
          buildSkeletonCard(180),
          Row(
            children: [
              Container(width: 28, height: 28, decoration: BoxDecoration(color: baseColor, borderRadius: BorderRadius.circular(8))),
              const SizedBox(width: 10),
              Container(width: 140, height: 16, decoration: BoxDecoration(color: baseColor, borderRadius: BorderRadius.circular(6))),
            ],
          ),
          const SizedBox(height: 12),
          buildSkeletonCard(220),
          Row(
            children: [
              Container(width: 28, height: 28, decoration: BoxDecoration(color: baseColor, borderRadius: BorderRadius.circular(8))),
              const SizedBox(width: 10),
              Container(width: 110, height: 16, decoration: BoxDecoration(color: baseColor, borderRadius: BorderRadius.circular(6))),
            ],
          ),
          const SizedBox(height: 12),
          buildSkeletonCard(110),
        ],
      ),
    );
  }
}
