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
import 'config/app_config.dart';
import 'widgets/aurora_background.dart';
import 'screens/security/login_screen.dart';
import 'screens/student/student_dashboard_screen.dart';
import 'screens/staff/staff_dashboard_screen.dart';
import 'screens/student/face_scanner_screen.dart';
import 'screens/system/home_screen.dart';
import 'screens/system/settings_screen.dart';
import 'widgets/shimmer_loading.dart';

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

  @override
  void initState() {
    super.initState();
    _loadThemeMode();
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

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Smart Attendance Portal',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          primary: const Color(0xFF2563EB),
          brightness: Brightness.light,
        ),
        textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
      ),
      darkTheme: ThemeData(
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
      ),
      themeMode: _themeMode,
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

  // Server-aligned current time getter
  static DateTime get now => DateTime.now().add(serverOffset);

  static String getEffectiveUrl() {
    if (customUrl != null && customUrl!.trim().isNotEmpty) {
      String url = customUrl!.trim();
      if (url.endsWith('/')) {
        url = url.substring(0, url.length - 1);
      }
      return url;
    }
    String url = baseUrl.trim();
    if (!useAdbReverse && defaultTargetPlatform == TargetPlatform.android) {
      // No tunnel — fall back to the emulator host alias.
      url = emulatorBaseUrl.trim();
    }
    if (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }
    return url;
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

  @override
  void initState() {
    super.initState();
    _initApp();
  }

  Future<void> _initApp() async {
    setState(() => isSyncing = true);
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
      if (ApiConfig.useAdbReverse && defaultTargetPlatform == TargetPlatform.android) {
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
      final sId = (authData['profile_id'] ?? authData['user_id']) as int;
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
          final serverTime = DateTime.parse(serverTimeStr).toLocal();
          final localTime = DateTime.now();
          ApiConfig.serverOffset = serverTime.difference(localTime);
          debugPrint("Synced server time offset: ${ApiConfig.serverOffset.inMilliseconds} ms");
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
      debugPrint("Attendance sync failed: $e");
      
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
  Future<void> submitAttendance(int sessionId, String ssid, String courseCode, String courseName, String imageBase64, bool livenessPassed, BuildContext context, {int? challengeMs}) async {
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
      // Device fingerprint of this phone, recorded per check-in for audit.
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
        // Server unreachable — queue for later sync.
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
        // Also queue on any other connection failure.
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
        // "Already checked in" is not a failure — the student is already marked
        // present for this session (e.g. a double-tap). Show a friendly notice
        // instead of a red error dialog, and refresh so their status reflects it.
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

      setState(() => isFaceRegistered = true);
      await syncData(context);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Attendance recorded and verified successfully!"),
          backgroundColor: Color(0xFF10B981),
        ),
      );

    } catch (e) {
      showErrorDialog(e.toString().replaceAll("Exception: ", ""), context);
    } finally {
      if (mounted) setState(() => isSyncing = false);
    }
  }

  // Register facial signature via the backend (no direct DB).
  Future<void> registerFace(BuildContext context) async {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => FaceScannerScreen(
          title: "Face Registration",
          onScanComplete: (imageBase64, livenessPassed, {int? challengeMs}) async {
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

              setState(() => isFaceRegistered = true);
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text("Face registration completed successfully!"),
                  backgroundColor: Color(0xFF10B981),
                ),
              );
            } catch (e) {
              showErrorDialog(_friendlyError(e), context);
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

  void showErrorDialog(String message, BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Sync Error", style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold)),
        content: Text(message, style: const TextStyle(fontSize: 13)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("OK"),
          )
        ],
      ),
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
                onCheckInComplete: (sessId, ssid, courseCode, courseName, imageBase64, livenessPassed, {int? challengeMs}) => submitAttendance(sessId, ssid, courseCode, courseName, imageBase64, livenessPassed, context, challengeMs: challengeMs),
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
