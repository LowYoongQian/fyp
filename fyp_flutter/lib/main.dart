// ignore_for_file: deprecated_member_use, use_build_context_synchronously
import 'dart:async';
import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'services/network_info_service.dart';
import 'services/local_cache_service.dart';
import 'services/server_discovery_service.dart';
import 'services/user_service.dart';
import 'config/app_config.dart';
import 'widgets/aurora_background.dart';
import 'screens/security/login_screen.dart';
import 'screens/student/student_dashboard_screen.dart';
import 'screens/staff/staff_dashboard_screen.dart';
import 'screens/student/face_scanner_screen.dart';
import 'screens/system/home_screen.dart';
import 'screens/system/settings_screen.dart';
import 'widgets/shimmer_loading.dart';
import 'i18n/app_localizations.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MainApp());
}

class MainApp extends StatefulWidget {
  const MainApp({super.key});

  static MainAppState of(BuildContext context) {
    return context.findAncestorStateOfType<MainAppState>()!;
  }

  @override
  State<MainApp> createState() => MainAppState();
}

class MainAppState extends State<MainApp> {
  ThemeMode _themeMode = ThemeMode.light;
  String _languageCode = 'en';
  Map<String, dynamic> _translations = const {
    'en': {
      'common': {
        'dashboard': 'Dashboard', 'timetable': 'Timetable', 'attendance': 'Attendance',
        'settings': 'Settings', 'logout': 'Sign Out', 'save': 'Save Preferences',
        'cancel': 'Cancel', 'search': 'Search language or region...',
        'language': 'Language & Locale', 'theme': 'Appearance Theme',
        'notifications': 'Notifications', 'security': 'Security & Biometrics',
      },
    },
  };

  static final ThemeData _lightThemeData = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFF2563EB),
      primary: const Color(0xFF2563EB),
      brightness: Brightness.light,
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
  );

  static final ThemeData _darkThemeData = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: const Color(0xFF121212),
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFF2563EB),
      primary: const Color(0xFF2563EB),
      surface: const Color(0xFF1E1E1E),
      brightness: Brightness.dark,
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
  );

  @override
  void initState() {
    super.initState();
    _loadThemeMode();
    _loadLanguage();
  }

  Future<void> _loadThemeMode() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final modeStr = prefs.getString('theme_mode') ?? 'light';
      setState(() {
        if (modeStr == 'dark') {
          _themeMode = ThemeMode.dark;
        } else if (modeStr == 'system') {
          _themeMode = ThemeMode.system;
        } else {
          _themeMode = ThemeMode.light;
        }
      });
    } catch (e) {
      debugPrint("Failed to load theme mode: $e");
    }
  }

  Future<void> updateThemeMode(ThemeMode mode) async {
    setState(() {
      _themeMode = mode;
    });
    try {
      final prefs = await SharedPreferences.getInstance();
      String modeStr = 'light';
      if (mode == ThemeMode.dark) {
        modeStr = 'dark';
      } else if (mode == ThemeMode.system) {
        modeStr = 'system';
      }
      await prefs.setString('theme_mode', modeStr);
    } catch (e) {
      debugPrint("Failed to save theme mode: $e");
    }
  }

  Future<void> _loadLanguage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedLanguage = prefs.getString('language') ?? 'en';
      final catalogue = await UserService.fetchSystemLanguages();
      if (!mounted) return;
      setState(() {
        _languageCode = savedLanguage;
        final remoteTranslations = catalogue?['translations'];
        if (remoteTranslations is Map) {
          _translations = Map<String, dynamic>.from(remoteTranslations);
        }
      });
    } catch (e) {
      debugPrint('Failed to load app language: $e');
    }
  }

  Future<void> updateLanguage(String languageCode) async {
    final catalogue = await UserService.fetchSystemLanguages();
    if (!mounted) return;
    setState(() {
      _languageCode = languageCode == 'zh_CN' || languageCode == 'zh_TW' ? 'zh' : languageCode;
      final remoteTranslations = catalogue?['translations'];
      if (remoteTranslations is Map) {
        _translations = Map<String, dynamic>.from(remoteTranslations);
      }
    });
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('language', _languageCode);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Smart Attendance Portal',
      debugShowCheckedModeBanner: false,
      locale: Locale(_languageCode),
      theme: _lightThemeData,
      darkTheme: _darkThemeData,
      themeMode: _themeMode,
      builder: (context, child) {
        final isDarkMode = _themeMode == ThemeMode.dark ||
            (_themeMode == ThemeMode.system &&
                MediaQuery.platformBrightnessOf(context) == Brightness.dark);
        return AppLocalizations(
          languageCode: _languageCode,
          translations: _translations,
          child: Directionality(
            textDirection: _languageCode == 'ar' ? TextDirection.rtl : TextDirection.ltr,
            child: AnimatedTheme(
              data: isDarkMode ? _darkThemeData : _lightThemeData,
              duration: const Duration(milliseconds: 350),
              curve: Curves.easeInOut,
              child: child ?? const AppRoot(),
            ),
          ),
        );
      },
      home: const AppRoot(),
    );
  }
}

// -----------------------------------------------------------------
// CONFIGURATION: Dynamic API Base URL
// -----------------------------------------------------------------
class ApiConfig {
  // Backend API base URL, injected at build time via --dart-define-from-file.
  // API_BASE_URL          -> used as-is (real device / adb-reverse tunnel).
  // EMULATOR_API_BASE_URL -> used on an emulator when the tunnel is OFF.
  static String baseUrl = AppConfig.apiBaseUrl;
  static String emulatorBaseUrl = AppConfig.emulatorApiBaseUrl;
  static String? customUrl;

  // true  = tunnel active: use baseUrl (localhost) on every device.
  // false = no tunnel: rewrite to the emulator URL on Android.
  static bool useAdbReverse = true;

  // Global time offset to align with the server clock
  static Duration serverOffset = Duration.zero;

  // Campus timezone offset is UTC+8 (Asia/Kuala_Lumpur)
  static const Duration campusTimezoneOffset = Duration(hours: 8);

  // Server-aligned campus wall-clock time getter (Asia/Kuala_Lumpur GMT+8)
  static DateTime get now {
    final utcNow = DateTime.now().toUtc().add(serverOffset);
    return utcNow.add(campusTimezoneOffset);
  }

  static String getEffectiveUrl() {
    // 1. Flutter Web -> ALWAYS use Production Railway HTTPS Backend
    if (kIsWeb) {
      if (customUrl != null && customUrl!.trim().isNotEmpty && customUrl!.trim().startsWith('https://')) {
        String url = customUrl!.trim();
        if (url.endsWith('/')) url = url.substring(0, url.length - 1);
        return url;
      }
      return AppConfig.productionApiUrl;
    }

    // 2. Custom URL explicitly set via settings or discovery
    if (customUrl != null && customUrl!.trim().isNotEmpty) {
      String url = customUrl!.trim();
      if (url.endsWith('/')) url = url.substring(0, url.length - 1);
      return url;
    }

    // 3. Android Emulator without adb-reverse tunnel
    if (!useAdbReverse && defaultTargetPlatform == TargetPlatform.android) {
      return AppConfig.emulatorApiUrl;
    }

    // 4. Default Production / Desktop
    return AppConfig.productionApiUrl;
  }
}

// -----------------------------------------------------------------
// ROOT APP STATE CONTROL
// -----------------------------------------------------------------
class AppRoot extends StatefulWidget {
  const AppRoot({super.key});

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  int selectedTab = 0; // 0: Home, 1: Student Portal, 2: Staff Portal

  String studentAuthToken = "";
  String staffAuthToken = "";
  bool isSyncing = false;
  bool isDatabaseOffline = false;

  // Student State
  bool isStudentLoggedIn = false;
  int studentId = 0;
  String studentName = "";
  String studentCode = "";
  String studentEmail = "";
  bool isFaceRegistered = false;
  bool isCheckedInToday = false;
  List<Map<String, dynamic>> attendanceHistory = [];
  List<Map<String, dynamic>> studentSchedule = [];
  List<Map<String, dynamic>> studentAnnouncements = [];
  List<Map<String, dynamic>> publicAnnouncements = [];

  // Staff State
  bool isStaffLoggedIn = false;
  int staffId = 0;
  String staffName = "";
  String staffCode = "";
  String staffEmail = "";
  String staffRole = "Lecturer";

  @override
  void initState() {
    super.initState();
    _initApp();
  }

  Future<void> _initApp() async {
    setState(() => isSyncing = true);
    // LAN discovery only makes sense when the configured backend is itself on the
    // LAN (local dev against uvicorn). Once API_BASE_URL is a public HTTPS host,
    // discovery would scan 254 LAN IPs on port 443 over plain HTTP, find nothing,
    // and — worse — a stale cached custom_api_url would keep overriding it,
    // because customUrl wins over productionApiUrl in getEffectiveUrl().
    if (!kIsWeb && !AppConfig.isRemoteBackend) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final savedCustomUrl = prefs.getString('custom_api_url');
        
        // 1. Try saved/cached URL first if exists
        if (savedCustomUrl != null && savedCustomUrl.isNotEmpty) {
          final isAlive = await ServerDiscoveryService.checkUrl(savedCustomUrl);
          if (isAlive) {
            ApiConfig.customUrl = savedCustomUrl;
            debugPrint("Using working cached API Server: $savedCustomUrl");
          } else {
            // If cached URL is dead, run discovery
            debugPrint("Cached API Server is unreachable. Initiating auto-discovery...");
            final discovered = await ServerDiscoveryService.discoverServer();
            if (discovered != null) {
              ApiConfig.customUrl = discovered;
              await prefs.setString('custom_api_url', discovered);
            } else {
              ApiConfig.customUrl = null;
            }
          }
        } else {
          // 2. No cached URL, perform auto-discovery
          debugPrint("No cached server address. Initiating auto-discovery...");
          final discovered = await ServerDiscoveryService.discoverServer();
          if (discovered != null) {
            ApiConfig.customUrl = discovered;
            await prefs.setString('custom_api_url', discovered);
          } else {
            ApiConfig.customUrl = null;
          }
        }
      } catch (e) {
        debugPrint("Server auto-discovery/init failed: $e");
      }
    } else if (!kIsWeb) {
      // Drop any URL discovered by an older build. It is inert now, but it would
      // come back to life (and win) if this app were ever pointed at a LAN
      // backend again.
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove('custom_api_url');
      } catch (_) {}
      ApiConfig.customUrl = null;
      debugPrint("Remote backend configured (${AppConfig.productionApiUrl}); skipping LAN discovery.");
    }

    try {
      await syncClock();
    } catch (_) {}
    try {
      await fetchPublicAnnouncements();
    } catch (_) {}

    setState(() => isSyncing = false);
  }

  Future<void> syncClock() async {
    await _performClockSync(retries: 2);
  }

  Future<void> _performClockSync({int retries = 5}) async {
    try {
      final effectiveUrl = ApiConfig.getEffectiveUrl();
      final serverTimeRes = await http.get(
        Uri.parse('$effectiveUrl/auth/server-time'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 5));
      if (serverTimeRes.statusCode == 200) {
        final serverTimeStr = jsonDecode(serverTimeRes.body)['server_time'];
        final serverTime = DateTime.parse(serverTimeStr).toLocal();
        final localTime = DateTime.now();
        ApiConfig.serverOffset = serverTime.difference(localTime);
        debugPrint("Synced server time offset: ${ApiConfig.serverOffset.inMilliseconds} ms");
        if (mounted) setState(() {});
      }
    } catch (e) {
      debugPrint("Clock sync failed ($retries retries left): $e");
      
      // Fallback from localhost (adb reverse) to emulator host alias (10.0.2.2) if on Android and initial connection fails.
      if (!kIsWeb && ApiConfig.useAdbReverse && defaultTargetPlatform == TargetPlatform.android) {
        debugPrint("Android connection failed, switching adb-reverse tunnel off to use 10.0.2.2.");
        ApiConfig.useAdbReverse = false;
      }

      if (retries > 0 && mounted) {
        await Future.delayed(const Duration(seconds: 2));
        if (mounted) {
          await _performClockSync(retries: retries - 1);
        }
      }
    }
  }

  // -------------------------------------------------------------------
  // Authenticated HTTP helpers. Every mobile read/write goes through the
  // FastAPI backend (no direct DB), sending the JWT as a Bearer token.
  // -------------------------------------------------------------------
  Future<http.Response> _apiGet(String path, BuildContext context) {
    final apiUrl = ApiConfig.getEffectiveUrl();
    return http.get(
      Uri.parse('$apiUrl$path'),
      headers: {
        'Content-Type': 'application/json',
        if (studentAuthToken.isNotEmpty) 'Authorization': 'Bearer $studentAuthToken',
      },
    ).timeout(const Duration(seconds: 12));
  }

  /// Maps a backend/HTTP failure to a short, user-friendly message.
  String _friendlyError(Object e) {
    final msg = e.toString().replaceAll("Exception: ", "");
    if (e is TimeoutException) {
      return "The server took too long to respond. Check your connection and that the backend is running.";
    }
    if (msg.contains("SocketException") || msg.contains("Connection")) {
      return "Cannot reach the server. Make sure the backend is running and the API address is correct.";
    }
    return msg;
  }

  // Unified Multi-Portal Login Router (backend-only).
  Future<void> handleLogin(String emailOrId, String password, String portalType, BuildContext context) async {
    setState(() => isSyncing = true);
    try {
      final String rawInput = emailOrId.trim();

      // Fetch stable device fingerprint for multi-device session binding.
      final deviceId = await LocalCacheService.getOrCreateDeviceId();

      // Authenticate via backend. The server resolves email OR student/staff ID
      // and returns the full profile, so the app never touches the DB directly.
      final apiUrl = ApiConfig.getEffectiveUrl();
      final http.Response response;
      try {
        response = await http.post(
          Uri.parse('$apiUrl/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'identifier': rawInput, 'password': password, 'device_id': deviceId}),
        ).timeout(const Duration(seconds: 12));
      } on TimeoutException {
        throw Exception("The server took too long to respond. Check your connection and that the backend is running.");
      } catch (_) {
        throw Exception("Cannot reach the server. Make sure the backend is running and the API address is correct.");
      }

      if (response.statusCode == 401) {
        throw Exception(_detailOf(response, 'Invalid email or password'));
      }
      if (response.statusCode != 200) {
        throw Exception(_detailOf(response, 'Login failed'));
      }

      final authData = jsonDecode(response.body);
      final role = authData['role'] as String;
      if (portalType == 'student' && role != 'student') {
        throw Exception("This account is not a student account.");
      }
      if (portalType == 'staff' && role != 'lecturer') {
        throw Exception("This account is not a lecturer/staff account.");
      }

      final token = authData['access_token'] as String;
      final sId = int.tryParse((authData['profile_id'] ?? authData['user_id']).toString()) ?? 0;
      final name = (authData['name'] ?? (portalType == 'student' ? 'Student' : 'Staff')) as String;
      final code = (authData['code'] ?? rawInput) as String;
      final resolvedEmail = (authData['email'] ?? rawInput) as String;
      final faceReg = (authData['is_face_registered'] ?? false) as bool;

      // Save state
      setState(() {
        if (portalType == 'student') {
          studentAuthToken = token;
          studentId = sId;
          studentEmail = resolvedEmail;
          studentName = name;
          studentCode = code;
          isFaceRegistered = faceReg;
          isStudentLoggedIn = true;
        } else {
          staffAuthToken = token;
          staffId = sId;
          staffEmail = resolvedEmail;
          staffName = name;
          staffCode = code;
          staffRole = (authData['staff_role'] ?? authData['role'] ?? 'Lecturer').toString();
          if (staffRole.toLowerCase() == 'lecturer') staffRole = 'Lecturer';
          if (staffRole.toLowerCase() == 'admin') staffRole = 'Admin';
          if (staffRole.toLowerCase() == 'tutor') staffRole = 'Tutor';
          isStaffLoggedIn = true;
        }
      });

      if (portalType == 'student') {
        await syncData(context);
        if (!isFaceRegistered) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _showFaceRegistrationPrompt(context);
          });
        }
      }
    } catch (e) {
      showErrorDialog(_friendlyError(e), context);
    } finally {
      setState(() => isSyncing = false);
    }
  }

  /// Extract a backend error `detail` string, or fall back to [fallback].
  String _detailOf(http.Response r, String fallback) {
    try {
      return (jsonDecode(r.body)['detail'] ?? fallback) as String;
    } catch (_) {
      return fallback;
    }
  }

  Future<void> fetchPublicAnnouncements() async {
    try {
      final effectiveUrl = ApiConfig.getEffectiveUrl();
      final response = await http.get(
        Uri.parse('$effectiveUrl/public/announcements'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final List<dynamic> raw = jsonDecode(response.body) as List<dynamic>;
        final List<Map<String, dynamic>> loaded = [];
        for (final item in raw) {
          loaded.add({
            'id': item['id'],
            'title': item['title'],
            'content': item['content'],
            'faculty': item['faculty'],
            'department': item['department'],
            'created_at': item['created_at'],
            'priority': item['priority'],
            'publisher': item['publisher'],
            'image_base64': item['image_base64'],
          });
        }
        if (mounted) {
          setState(() {
            publicAnnouncements = loaded;
          });
        }
      }
    } catch (e) {
      debugPrint("Failed to fetch public announcements: $e");
    }
  }

  // Load attendance history + today's check-in status + course timetable from backend.
  Future<void> syncData(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    
    // 1. Try loading cached data first for instant user rendering
    final cachedHistory = await LocalCacheService.loadAttendanceCache();
    final cachedScheduleStr = prefs.getString('cached_student_schedule');
    final cachedAnnouncementsStr = prefs.getString('cached_student_announcements');
    
    bool hasCachedData = false;
    
    if (cachedHistory.isNotEmpty || cachedScheduleStr != null || cachedAnnouncementsStr != null) {
      hasCachedData = true;
      final months = const ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Load cached history
      final List<Map<String, dynamic>> mappedHistory = [];
      bool checkedIn = false;
      for (final r in cachedHistory) {
        final markedRaw = r['marked_at'] as String?;
        final markedAt = markedRaw != null ? DateTime.tryParse(markedRaw)?.toLocal() : null;
        final status = (r['status'] ?? 'present') as String;
        String dateLabel = 'Unknown';
        if (markedAt != null) {
          final isToday = markedAt.year == ApiConfig.now.year &&
              markedAt.month == ApiConfig.now.month &&
              markedAt.day == ApiConfig.now.day;
          final timeStr = "${markedAt.hour}:${markedAt.minute.toString().padLeft(2, '0')} ${markedAt.hour >= 12 ? 'PM' : 'AM'}";
          dateLabel = isToday
              ? 'Today, $timeStr'
              : "${months[markedAt.month - 1]} ${markedAt.day}, ${markedAt.year}, $timeStr";
          if (isToday) checkedIn = true;
        }
        mappedHistory.add({
          'courseCode': r['course_code'] ?? 'Unknown',
          'courseName': r['course_name'] ?? 'Unknown',
          'group': r['class_group'] ?? '-',
          'date': dateLabel,
          'status': (status == 'present') ? 'Verified' : 'Absent',
          'wifiVerified': r['network_verified'] ?? false,
          'faceVerified': true,
        });
      }

      // Load cached schedule/timetable
      List<Map<String, dynamic>> mappedSchedule = [];
      if (cachedScheduleStr != null) {
        try {
          final List<dynamic> decoded = jsonDecode(cachedScheduleStr);
          mappedSchedule = decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        } catch (_) {}
      }

      // Load cached announcements
      List<Map<String, dynamic>> mappedAnnouncements = [];
      if (cachedAnnouncementsStr != null) {
        try {
          final List<dynamic> decoded = jsonDecode(cachedAnnouncementsStr);
          mappedAnnouncements = decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        } catch (_) {}
      }

      setState(() {
        attendanceHistory = mappedHistory;
        isCheckedInToday = checkedIn;
        studentSchedule = mappedSchedule;
        studentAnnouncements = mappedAnnouncements;
      });
    }

    if (studentAuthToken.isEmpty) {
      debugPrint("Skipping syncData: User is not authenticated.");
      if (mounted) {
        setState(() => isSyncing = false);
      }
      return;
    }

    // Only show full screen overlay if there is absolutely no cached data
    if (!hasCachedData) {
      setState(() => isSyncing = true);
    }

    try {
      // Sync clock with backend server time
      try {
        final serverTimeRes = await http.get(
          Uri.parse('${ApiConfig.getEffectiveUrl()}/auth/server-time'),
          headers: {'Content-Type': 'application/json'},
        ).timeout(const Duration(seconds: 4));
        if (serverTimeRes.statusCode == 200) {
          final serverTimeStr = jsonDecode(serverTimeRes.body)['server_time'];
          final serverUtc = DateTime.parse(serverTimeStr).toUtc();
          final localUtc = DateTime.now().toUtc();
          ApiConfig.serverOffset = serverUtc.difference(localUtc);
          debugPrint("Synced server UTC time offset: ${ApiConfig.serverOffset.inMilliseconds} ms");
        }
      } catch (e) {
        debugPrint("Warning: could not sync server offset clock: $e");
      }

      // Fetch attendance, courses, and announcements concurrently
      final responses = await Future.wait([
        _apiGet('/students/me/attendance', context),
        _apiGet('/students/me/courses', context),
        _apiGet('/students/me/announcements', context),
      ]);

      final attendanceRes = responses[0];
      final coursesRes = responses[1];
      final announcementsRes = responses[2];

      if (attendanceRes.statusCode != 200) {
        throw Exception(_detailOf(attendanceRes, 'Could not load attendance (${attendanceRes.statusCode}).'));
      }
      if (coursesRes.statusCode != 200) {
        throw Exception(_detailOf(coursesRes, 'Could not load timetable (${coursesRes.statusCode}).'));
      }
      if (announcementsRes.statusCode != 200) {
        throw Exception(_detailOf(announcementsRes, 'Could not load announcements (${announcementsRes.statusCode}).'));
      }

      final List<dynamic> rows = jsonDecode(attendanceRes.body) as List<dynamic>;
      final List<Map<String, dynamic>> history = [];
      bool checkedIn = false;
      final months = const ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      for (final r in rows) {
        final markedRaw = r['marked_at'] as String?;
        final markedAt = markedRaw != null ? DateTime.tryParse(markedRaw)?.toLocal() : null;
        final status = (r['status'] ?? 'present') as String;
        final verifyDetail = r['verify_detail'] as String?;
        
        String dateLabel = 'Unknown';
        if (status == 'absent' && verifyDetail != null && verifyDetail.isNotEmpty) {
          dateLabel = verifyDetail;
        } else if (markedAt != null) {
          final isToday = markedAt.year == ApiConfig.now.year &&
              markedAt.month == ApiConfig.now.month &&
              markedAt.day == ApiConfig.now.day;
          final timeStr = "${markedAt.hour}:${markedAt.minute.toString().padLeft(2, '0')} ${markedAt.hour >= 12 ? 'PM' : 'AM'}";
          dateLabel = isToday
              ? 'Today, $timeStr'
              : "${months[markedAt.month - 1]} ${markedAt.day}, ${markedAt.year}, $timeStr";
          if (isToday) checkedIn = true;
        }

        final netVerified = (r['network_verified'] ?? false) as bool;
        history.add({
          'courseCode': r['course_code'] ?? 'Unknown',
          'courseName': r['course_name'] ?? 'Unknown',
          'group': r['class_group'] ?? '-',
          'date': dateLabel,
          'status': status == 'present' ? 'Verified' : 'Absent',
          'wifiVerified': netVerified,
          'faceVerified': true,
        });
      }

      final List<dynamic> rawCoursesList = jsonDecode(coursesRes.body) as List<dynamic>;
      final List<Map<String, dynamic>> loadedSchedule = [];

      for (final c in rawCoursesList) {
        final day = c['schedule_day'] as String?;
        final start = c['schedule_start'] as String?;
        final end = c['schedule_end'] as String?;
        final room = c['schedule_room'] as String?;
        if (day == null || start == null || end == null) continue;

        loadedSchedule.add({
          'courseCode': c['course_code'] ?? 'Unknown',
          'courseName': c['course_name'] ?? 'Unknown',
          'group': c['role'] ?? 'Lecture',
          'classGroup': c['class_group'] ?? 'All',
          'day': day,
          'startTime': start,
          'endTime': end,
          'room': room ?? 'Main Hall A',
          'lecturerName': c['lecturer_name'] ?? 'TBA',
          'attendanceRate': (c['attendance_rate'] as num?)?.toDouble() ?? 100.0,
        });
      }

      // Sort by day of week and start time
      final daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      loadedSchedule.sort((a, b) {
        final dayA = daysOrder.indexOf(a['day']);
        final dayB = daysOrder.indexOf(b['day']);
        if (dayA != dayB) return dayA.compareTo(dayB);
        return a['startTime'].compareTo(b['startTime']);
      });

      final List<dynamic> rawAnnouncementsList = jsonDecode(announcementsRes.body) as List<dynamic>;
      final List<Map<String, dynamic>> loadedAnnouncements = [];
      for (final a in rawAnnouncementsList) {
        loadedAnnouncements.add({
          'id': a['id'],
          'title': a['title'],
          'content': a['content'],
          'faculty': a['faculty'],
          'department': a['department'],
          'created_at': a['created_at'],
          'priority': a['priority'],
          'image_base64': a['image_base64'],
          'publish_start': a['publish_start'],
          'publish_end': a['publish_end'],
          'target_scope': a['target_scope'],
          'target_role': a['target_role'],
          'target_programme_code': a['target_programme_code'],
          'target_course_code': a['target_course_code'],
        });
      }

      setState(() {
        attendanceHistory = history;
        isCheckedInToday = checkedIn;
        studentSchedule = loadedSchedule;
        studentAnnouncements = loadedAnnouncements;
        isDatabaseOffline = false;
      });

      // Persist to local cache
      final rawRecords = rows.cast<Map<String, dynamic>>();
      await LocalCacheService.saveAttendanceCache(rawRecords);
      await prefs.setString('cached_student_schedule', jsonEncode(loadedSchedule));
      await prefs.setString('cached_student_announcements', jsonEncode(loadedAnnouncements));
    } catch (e) {
      final msg = e.toString();
      debugPrint("Attendance sync failed: $e");
      
      if (!msg.contains("Not authenticated")) {
        setState(() => isDatabaseOffline = true);

        // If we don't have any cached data at all, show the offline snackbar alert
        if (!hasCachedData && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Working Offline: ${_friendlyError(e)}"),
              backgroundColor: const Color(0xFFDC2626),
            ),
          );
        }
      }
    } finally {
      setState(() => isSyncing = false);
    }
  }

  // Real check-in execution.
  //
  // SECURITY: attendance is recorded ONLY through the FastAPI backend so the
  // server can observe the true source IP and enforce campus-network policy.
  // The previous direct-to-Supabase write was removed because a decompiled APK
  // could otherwise bypass every verification layer using the embedded DB
  // credentials.
  Future<void> submitAttendance(
    dynamic sessionId,
    String ssid,
    String courseCode,
    String courseName,
    String imageBase64,
    bool livenessPassed,
    BuildContext context, {
    int? challengeMs,
    Map<String, dynamic>? extraDetails,
  }) async {
    setState(() => isSyncing = true);
    try {
      // 1. Collect live network facts for location corroboration.
      final netInfo = await NetworkInfoService.collect();
      final netPayload = netInfo.toPayload();

      // Prefer the live SSID; fall back to the value passed in by the caller.
      final effectiveSsid = (netPayload['wifi_ssid'] as String).isNotEmpty
          ? netPayload['wifi_ssid'] as String
          : ssid;

      // 2. Submit to the backend (authoritative path — no direct DB write).
      final apiUrl = ApiConfig.getEffectiveUrl();
      final http.Response response;
      final deviceId = await LocalCacheService.getOrCreateDeviceId();
      Map<String, dynamic> checkInPayload = {
        'wifi_ssid': effectiveSsid,
        'image_base64': imageBase64,
        'liveness_passed': livenessPassed,
        'bssid': netPayload['bssid'],
        'gateway_ip': netPayload['gateway_ip'],
        'local_ip': netPayload['local_ip'],
        'liveness_challenge_ms': challengeMs,
        'device_id': deviceId,
      };
      try {
        response = await http.post(
          Uri.parse('$apiUrl/sessions/$sessionId/attend'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $studentAuthToken',
          },
          body: jsonEncode(checkInPayload),
        ).timeout(const Duration(seconds: 15));
      } on TimeoutException {
        await LocalCacheService.enqueueCheckIn(sessionId, checkInPayload);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Server unreachable — check-in queued and will sync when back online."),
              backgroundColor: Color(0xFFF59E0B),
            ),
          );
        }
        return;
      } catch (_) {
        await LocalCacheService.enqueueCheckIn(sessionId, checkInPayload);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("No connection — check-in queued and will sync when back online."),
              backgroundColor: Color(0xFFF59E0B),
            ),
          );
        }
        return;
      }

      if (response.statusCode != 200) {
        String error = 'Verification failed';
        try {
          error = jsonDecode(response.body)['detail'] ?? error;
        } catch (_) {
          error = 'Server error ${response.statusCode}.';
        }
        if (response.statusCode == 400 && error.toLowerCase().contains('already registered')) {
          await syncData(context);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("You're already checked in for this class."),
              backgroundColor: Color(0xFF3B82F6),
            ),
          );
          return;
        }
        throw Exception(error);
      }

      Map<String, dynamic> resJson = {};
      try {
        resJson = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {}

      setState(() => isFaceRegistered = true);
      await syncData(context);

      if (!mounted) return;

      final bool wifiVerified = resJson['wifi_verified'] == true || (resJson['attendance_record']?['wifi_verified'] == true);
      final bool liveVerified = resJson['liveness_passed'] == true || livenessPassed;

      _showCheckInSuccessModalDialog(
        context,
        courseCode: courseCode,
        courseName: courseName,
        timeSlot: extraDetails?['timeSlot']?.toString() ?? 'Active Class Session',
        room: extraDetails?['room']?.toString() ?? 'Main Hall A',
        classGroup: extraDetails?['classGroup']?.toString() ?? 'Tut Group G2',
        lecturerName: extraDetails?['lecturerName']?.toString() ?? 'Dr. Low',
        lecturerRole: extraDetails?['lecturerRole']?.toString() ?? 'Lecturer',
        wifiVerified: wifiVerified,
        livenessPassed: liveVerified,
      );

    } catch (e) {
      showErrorDialog(e.toString().replaceAll("Exception: ", ""), context);
    } finally {
      if (mounted) setState(() => isSyncing = false);
    }
  }

  void _showCheckInSuccessModalDialog(
    BuildContext context, {
    required String courseCode,
    required String courseName,
    required String timeSlot,
    required String room,
    required String classGroup,
    required String lecturerName,
    required String lecturerRole,
    required bool wifiVerified,
    required bool livenessPassed,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        final now = DateTime.now();
        final daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        final dayName = daysOrder[now.weekday - 1];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        final formattedDate = "$dayName, ${now.day.toString().padLeft(2, '0')} ${months[now.month - 1]} ${now.year}";

        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          elevation: 12,
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top Success Icon
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_circle_rounded,
                    color: Color(0xFF10B981),
                    size: 40,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  "Attendance Verified!",
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF10B981),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  "Your check-in has been successfully recorded.",
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
                  ),
                ),
                const SizedBox(height: 20),

                // Card Box for Details
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Course Code & Name
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2563EB).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.school_rounded, color: Color(0xFF2563EB), size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "$courseCode - $courseName",
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                                  ),
                                ),
                                if (classGroup.isNotEmpty || room.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    "$classGroup • $room",
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12.0),
                        child: Divider(height: 1),
                      ),

                      // Time & Date
                      _buildDetailRow(
                        isDark: isDark,
                        icon: Icons.calendar_today_rounded,
                        iconColor: const Color(0xFF0284C7),
                        title: "Date & Time",
                        value: "$timeSlot\n$formattedDate",
                      ),
                      const SizedBox(height: 10),

                      // Teacher / Lecturer & Role
                      _buildDetailRow(
                        isDark: isDark,
                        icon: Icons.person_outline_rounded,
                        iconColor: const Color(0xFF7C3AED),
                        title: "Lecturer / Instructor",
                        value: "$lecturerName ($lecturerRole)",
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Verification Badges Row
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                        decoration: BoxDecoration(
                          color: wifiVerified
                              ? const Color(0xFF10B981).withOpacity(0.1)
                              : const Color(0xFFF59E0B).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: wifiVerified
                                ? const Color(0xFF10B981).withOpacity(0.3)
                                : const Color(0xFFF59E0B).withOpacity(0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.wifi_rounded,
                              size: 14,
                              color: wifiVerified ? const Color(0xFF10B981) : const Color(0xFFD97706),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              wifiVerified ? "WiFi Verified" : "WiFi Bypassed",
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: wifiVerified ? const Color(0xFF059669) : const Color(0xFFD97706),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                        decoration: BoxDecoration(
                          color: livenessPassed
                              ? const Color(0xFF10B981).withOpacity(0.1)
                              : const Color(0xFFF59E0B).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: livenessPassed
                                ? const Color(0xFF10B981).withOpacity(0.3)
                                : const Color(0xFFF59E0B).withOpacity(0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.face_rounded,
                              size: 14,
                              color: livenessPassed ? const Color(0xFF10B981) : const Color(0xFFD97706),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              livenessPassed ? "Liveness Passed" : "Liveness Alert",
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: livenessPassed ? const Color(0xFF059669) : const Color(0xFFD97706),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Close Button
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text(
                      "Done",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetailRow({
    required bool isDark,
    required IconData icon,
    required Color iconColor,
    required String title,
    required String value,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 1),
              Text(
                value,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // Register facial signature via the backend (no direct DB).
  //
  // The parameter is `_` on purpose: `context` below must resolve to the State's
  // own (alive while mounted), and both the parameter and the MaterialPageRoute
  // builder used to shadow it. FaceScannerScreen fires
  // onScanComplete without awaiting it and pops itself immediately, so a builder
  // context would already be deactivated by the time the ~2.5s POST returns:
  // showDialog on it throws "deactivated widget's ancestor", and because that
  // throw happens inside the catch block it surfaced nowhere. A backend 400 then
  // looked to the student like the scan simply did nothing.
  Future<void> registerFace(BuildContext _) async {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => FaceScannerScreen(
          title: "Face Registration",
          onScanComplete: (imageBase64, livenessPassed, {int? challengeMs}) async {
            if (!mounted) return;
            if (imageBase64 == null || imageBase64.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text("Face registration cancelled: no selfie captured."),
                  backgroundColor: Color(0xFFDC2626),
                ),
              );
              return;
            }
            if (!livenessPassed) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text("Liveness check not completed. Please try the gesture challenge again."),
                  backgroundColor: Color(0xFFDC2626),
                ),
              );
              return;
            }

            setState(() => isSyncing = true);
            try {
              // Backend stores the embedding server-side (requires a real JWT).
              final apiUrl = ApiConfig.getEffectiveUrl();
              final http.Response response;
              try {
                response = await http.post(
                  Uri.parse('$apiUrl/students/me/face'),
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer $studentAuthToken',
                  },
                  body: jsonEncode({'image_base64': imageBase64}),
                ).timeout(const Duration(seconds: 15));
              } on TimeoutException {
                throw Exception("The server took too long to respond. Please try again.");
              } catch (_) {
                throw Exception("Cannot reach the server. Make sure the backend is running.");
              }

              if (response.statusCode != 200) {
                throw Exception(_detailOf(response, 'Face registration failed (${response.statusCode}).'));
              }

              if (!mounted) return;
              setState(() => isFaceRegistered = true);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text("Face registration completed successfully!"),
                  backgroundColor: Color(0xFF10B981),
                ),
              );
            } catch (e) {
              if (mounted) showErrorDialog(_friendlyError(e), context);
            } finally {
              if (mounted) setState(() => isSyncing = false);
            }
          },
        ),
      ),
    );
  }

  void _showFaceRegistrationPrompt(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              const Icon(Icons.face_retouching_natural, color: Color(0xFF2563EB), size: 28),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  "Face Profile Required",
                  style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Welcome, $studentName!",
                style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 8),
              Text(
                "To enable attendance check-in and biometric verification, you need to register your face profile.",
                style: GoogleFonts.inter(color: const Color(0xFF475569), fontSize: 13),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFDCFCE7)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.light_mode, color: Color(0xFF16A34A), size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "Please take the selfie in a well-lit area.",
                        style: GoogleFonts.inter(color: const Color(0xFF15803D), fontSize: 11.5, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                "Later",
                style: GoogleFonts.inter(color: const Color(0xFF64748B), fontWeight: FontWeight.w600),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                registerFace(context);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(
                "Register Now",
                style: GoogleFonts.inter(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        );
      },
    );
  }

  void handleStudentLogout() {
    setState(() {
      studentAuthToken = "";
      isStudentLoggedIn = false;
      isCheckedInToday = false;
      attendanceHistory = [];
      studentAnnouncements = [];
    });
    SharedPreferences.getInstance().then((prefs) {
      prefs.remove('cached_student_schedule');
      prefs.remove('cached_student_announcements');
      prefs.remove('cached_active_sessions');
    }).catchError((e) {
      debugPrint("Failed to clear logout cache: $e");
    });
  }

  void handleStaffLogout() {
    setState(() {
      staffAuthToken = "";
      isStaffLoggedIn = false;
    });
  }

  String _friendlyStudentError(String rawMsg) {
    final lower = rawMsg.toLowerCase();

    if (lower.contains('face') && (lower.contains('not match') || lower.contains('mismatch') || lower.contains('no match') || lower.contains('failed'))) {
      return "Face Match Failed: Your face does not match your registered profile. Please make sure your face is clearly visible and try again.";
    }
    if (lower.contains('liveness') || lower.contains('blink') || lower.contains('nod') || lower.contains('suspicious')) {
      return "Liveness Verification Failed: We couldn't detect your blink or head movement. Please look directly at the camera and perform the prompt.";
    }
    if (lower.contains('not registered') || lower.contains('register face')) {
      return "Face Registration Required: Please complete your one-time selfie profile registration first.";
    }
    if (lower.contains('wifi') || lower.contains('network') || lower.contains('bssid') || lower.contains('subnet')) {
      return "Off-Campus Network: You are not connected to the approved campus Wi-Fi network.";
    }
    if (lower.contains('already registered') || lower.contains('already checked in')) {
      return "Already Checked In: Your attendance for this class session is already verified today.";
    }
    if (lower.contains('closed') || lower.contains('expired')) {
      return "Session Closed: This attendance window has expired or has been closed by your lecturer.";
    }
    if (lower.contains('socketexception') || lower.contains('connection') || lower.contains('timeout')) {
      return "Connection Error: Cannot reach the server. Please check your internet connection.";
    }
    return rawMsg.replaceAll("Exception: ", "").trim();
  }

  void showErrorDialog(String message, BuildContext context) {
    final friendlyMsg = _friendlyStudentError(message);
    showDialog(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          title: const Row(
            children: [
              Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 26),
              SizedBox(width: 10),
              Text("Verification Failed", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            ],
          ),
          content: Text(
            friendlyMsg,
            style: TextStyle(
              fontSize: 13,
              height: 1.4,
              color: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF334155),
            ),
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () => Navigator.pop(ctx),
              child: const Text("Got It", style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget bodyContent;
    switch (selectedTab) {
      case 0: // Home Landing
        bodyContent = HomeScreen(
          announcements: publicAnnouncements,
          onRefresh: fetchPublicAnnouncements,
          onSettingsPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const SettingsScreen()),
            );
          },
          onTabSelected: (idx) => setState(() => selectedTab = idx),
        );
        break;
      case 1: // Student Portal
        bodyContent = isStudentLoggedIn
            ? MainScreen(
                studentId: studentId,
                studentName: studentName,
                studentCode: studentCode,
                studentEmail: studentEmail,
                authToken: studentAuthToken,
                isFaceRegistered: isFaceRegistered,
                isCheckedInToday: isCheckedInToday,
                attendanceHistory: attendanceHistory,
                studentSchedule: studentSchedule,
                announcements: studentAnnouncements,
                isDatabaseOffline: isDatabaseOffline,
                isSyncing: isSyncing,
                onLogout: handleStudentLogout,
                onSyncRequested: () => syncData(context),
                onCheckInComplete: (sessId, ssid, courseCode, courseName, imageBase64, livenessPassed, {int? challengeMs, Map<String, dynamic>? extraDetails}) => submitAttendance(sessId, ssid, courseCode, courseName, imageBase64, livenessPassed, context, challengeMs: challengeMs, extraDetails: extraDetails),
                onRegisterFace: () => registerFace(context),
              )
            : LoginScreen(
                portalType: 'student',
                isSyncing: isSyncing,
                onLogin: (emailOrId, pass, portal) => handleLogin(emailOrId, pass, portal, context),
                onBackPressed: () => setState(() => selectedTab = 0),
              );
        break;
      case 2: // Staff Portal
        bodyContent = isStaffLoggedIn
            ? StaffDashboard(
                staffId: staffId,
                staffName: staffName,
                staffCode: staffCode,
                staffEmail: staffEmail,
                staffRole: staffRole,
                authToken: staffAuthToken,
                apiBaseUrl: ApiConfig.getEffectiveUrl(),
                isDatabaseOffline: isDatabaseOffline,
                isSyncing: isSyncing,
                onLogout: handleStaffLogout,
                onSyncRequested: () => syncData(context), // Reuses direct check syncs
              )
            : LoginScreen(
                portalType: 'staff',
                isSyncing: isSyncing,
                onLogin: (emailOrId, pass, portal) => handleLogin(emailOrId, pass, portal, context),
                onBackPressed: () => setState(() => selectedTab = 0),
              );
        break;
      default:
        bodyContent = HomeScreen(
          announcements: publicAnnouncements,
          onRefresh: fetchPublicAnnouncements,
          onSettingsPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const SettingsScreen()),
            );
          },
          onTabSelected: (idx) => setState(() => selectedTab = idx),
        );
    }

    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Stack(
        children: [
          const AuroraBackground(),
          
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: KeyedSubtree(
              key: ValueKey('tab_${selectedTab}_logged_${isStudentLoggedIn || isStaffLoggedIn}'),
              child: bodyContent,
            ),
          ),

          // Loading Overlay (Shimmer Skeleton Screen)
          if (isSyncing)
            Positioned.fill(
              child: Container(
                color: isDarkMode ? const Color(0xFF121212) : const Color(0xFFF8FAFC),
                child: const SafeArea(
                  child: ShimmerLoading(
                    isLoading: true,
                    child: ShimmerSkeleton(),
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: _buildBottomNavigationBar(),
    );
  }

  Widget _buildBottomNavigationBar() {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.only(left: 20, right: 20, bottom: 16),
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: isDarkMode ? Colors.black.withValues(alpha: 0.25) : const Color(0xFF94A3B8).withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 4),
            decoration: BoxDecoration(
              color: isDarkMode ? const Color(0xFF1E1E1E).withValues(alpha: 0.8) : Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isDarkMode ? const Color(0xFF334155).withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.4),
                width: 1.2,
              ),
            ),
            child: BottomNavigationBar(
              currentIndex: selectedTab,
              onTap: (idx) => setState(() => selectedTab = idx),
              backgroundColor: Colors.transparent,
              elevation: 0,
              type: BottomNavigationBarType.fixed,
              selectedFontSize: 10,
              unselectedFontSize: 10,
              selectedItemColor: const Color(0xFF2563EB), // deep branding blue
              unselectedItemColor: isDarkMode ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
              selectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold),
              unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w500),
              items: const [
                BottomNavigationBarItem(
                  icon: Icon(Icons.home_outlined, size: 18),
                  activeIcon: Icon(Icons.home, size: 18, color: Color(0xFF2563EB)),
                  label: 'Home',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.person_outline, size: 18),
                  activeIcon: Icon(Icons.person, size: 18, color: Color(0xFF2563EB)),
                  label: 'Student',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.people_outline, size: 18),
                  activeIcon: Icon(Icons.people, size: 18, color: Color(0xFF2563EB)),
                  label: 'Staff',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
