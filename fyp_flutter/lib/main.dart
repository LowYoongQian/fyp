// ignore_for_file: deprecated_member_use, use_build_context_synchronously
import 'i18n/tr.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'services/network_info_service.dart';
import 'services/local_cache_service.dart';
import 'services/attendance_parity.dart';
import 'widgets/check_in_success_dialog.dart';
import 'services/offline_checkin_sync.dart';
import 'services/server_discovery_service.dart';
import 'services/user_service.dart';
import 'services/account_security.dart';
import 'services/mobile_push.dart';
import 'services/day_cycle.dart';
import 'screens/system/notifications_screen.dart';
import 'config/app_config.dart';
import 'widgets/aurora_background.dart';
import 'screens/security/login_screen.dart';
import 'screens/student/student_dashboard_screen.dart';
import 'screens/staff/staff_dashboard_screen.dart';
import 'screens/student/face_scanner_screen.dart';
import 'screens/student/face_registration_required.dart';
import 'screens/system/home_screen.dart';
import 'screens/system/settings_screen.dart';
import 'widgets/shimmer_loading.dart';
import 'widgets/startup_intro.dart';
import 'widgets/recovery_email_dialog.dart';
import 'widgets/mobile_theme.dart';
import 'widgets/offline_queue_sheet.dart';
import 'i18n/app_localizations.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await MobilePush.initialize();
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

class MainAppState extends State<MainApp> with SingleTickerProviderStateMixin {
  ThemeMode _themeMode = ThemeMode.light;
  // 'light', 'dark', 'system' or 'cycle' (Day/Night: light by day, dark at night, by campus time like the web sky).
  String _themePreference = 'light';
  Timer? _cycleTimer;
  final GlobalKey _screenKey = GlobalKey();
  ui.Image? _fadeFrom;
  late final AnimationController
  _fade; // made in initState: a lazy one would first be built inside dispose()

  String get themePreference => _themePreference;
  String _languageCode = 'en';
  Map<String, dynamic> _translations = const {
    'en': {
      'common': {
        'dashboard': 'Dashboard',
        'timetable': 'Timetable',
        'attendance': 'Attendance',
        'settings': 'Settings',
        'logout': 'Sign Out',
        'save': 'Save Preferences',
        'cancel': 'Cancel',
        'search': 'Search language or region...',
        'language': 'Language & Locale',
        'theme': 'Appearance Theme',
        'notifications': 'Notifications',
        'security': 'Security & Biometrics',
      },
    },
  };

  static final ThemeData _lightThemeData = mobileTheme(
    ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF2563EB),
        primary: const Color(0xFF2563EB),
        brightness: Brightness.light,
      ),
      textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
    ),
  );

  static final ThemeData _darkThemeData = mobileTheme(
    ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      // The web's dark theme greys (--theme-bg #181818, surface #222222, elevated #2d2d2d, border #333333, secondary text #a0a0a0).
      // A blue seed alone tints every Material surface navy, so the neutral roles are set explicitly and elevation adds no blue tint.
      scaffoldBackgroundColor: const Color(0xFF181818),
      colorScheme:
          ColorScheme.fromSeed(
            seedColor: const Color(0xFF2563EB),
            primary: const Color(0xFF2563EB),
            brightness: Brightness.dark,
          ).copyWith(
            onPrimary: Colors
                .white, // primary is the brand blue #2563EB, which needs white text (the seed's dark default is navy)
            surface: const Color(0xFF222222),
            surfaceDim: const Color(0xFF181818),
            surfaceBright: const Color(0xFF333333),
            surfaceContainerLowest: const Color(0xFF181818),
            surfaceContainerLow: const Color(0xFF1E1E1E),
            surfaceContainer: const Color(0xFF222222),
            surfaceContainerHigh: const Color(0xFF2D2D2D),
            surfaceContainerHighest: const Color(0xFF333333),
            onSurface: Colors.white,
            onSurfaceVariant: const Color(0xFFA0A0A0),
            outline: const Color(0xFF4A4A4A),
            outlineVariant: const Color(0xFF333333),
            secondaryContainer: const Color(0xFF2D2D2D),
            onSecondaryContainer: Colors.white,
            surfaceTint: Colors.transparent,
          ),
      textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
    ),
  );

  @override
  void initState() {
    super.initState();
    _fade = AnimationController(vsync: this);
    _loadThemeMode();
    _loadFontSize();
    _loadLanguage();
  }

  Future<void> _loadThemeMode() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (mounted) {
        _applyThemePreference(
          prefs.getString('theme_mode') ?? 'light',
          animate: false,
        );
      }
    } catch (e) {
      debugPrint("Failed to load theme mode: $e");
    }
  }

  static ThemeMode _modeFor(String preference) => switch (preference) {
    'dark' => ThemeMode.dark,
    'system' => ThemeMode.system,
    'cycle' => skyAt(campusHour()).isDark ? ThemeMode.dark : ThemeMode.light,
    _ => ThemeMode.light,
  };

  void _applyThemePreference(
    String preference, {
    bool animate = true,
    Duration fade = const Duration(milliseconds: 450),
  }) {
    final cycle = preference == 'cycle';
    dayCycleOn.value = cycle;
    _cycleTimer?.cancel();
    // While Day/Night is on, look at the clock each half minute; the theme turns at dusk and dawn with a slow cross-fade.
    if (cycle) {
      _cycleTimer = Timer.periodic(
        const Duration(seconds: 30),
        (_) => _checkCycle(),
      );
    }
    final mode = _modeFor(preference);
    if (preference == _themePreference && mode == _themeMode) return;
    _switchTheme(
      () {
        _themePreference = preference;
        _themeMode = mode;
      },
      animate: animate,
      fade: fade,
    );
  }

  void _checkCycle() {
    if (!mounted || _themePreference != 'cycle') return;
    final mode = _modeFor('cycle');
    if (mode != _themeMode) {
      _switchTheme(
        () => _themeMode = mode,
        fade: const Duration(milliseconds: 1400),
      );
    }
  }

  /// Changes the theme in one frame, then fades a still picture of the old look away over the new one. Only that picture
  /// animates, so the switch is smooth without rebuilding the app for every frame of the fade (which is what caused lag).
  void _switchTheme(
    VoidCallback change, {
    bool animate = true,
    Duration fade = const Duration(milliseconds: 450),
  }) {
    ui.Image? before;
    final boundary = _screenKey.currentContext?.findRenderObject();
    final reduceMotion = WidgetsBinding
        .instance
        .platformDispatcher
        .accessibilityFeatures
        .disableAnimations;
    if (animate &&
        !reduceMotion &&
        boundary is RenderRepaintBoundary &&
        boundary.hasSize) {
      try {
        before = boundary.toImageSync(
          pixelRatio: View.of(context).devicePixelRatio,
        );
      } catch (_) {
        before = null; // no picture (not painted yet): switch without the fade
      }
    }
    setState(() {
      change();
      _fadeFrom?.dispose();
      _fadeFrom = before;
    });
    if (before == null) return;
    _fade.duration = fade;
    _fade.forward(from: 0).whenComplete(() {
      if (!mounted || _fadeFrom != before) return;
      setState(() {
        _fadeFrom?.dispose();
        _fadeFrom = null;
      });
    });
  }

  /// The Font Size setting: 'small', 'medium' or 'large', the same steps as the web (14 / 16 / 18 px).
  String _fontSize = 'medium';
  static double fontScaleFor(String size) => switch (size) {
    'small' => .875,
    'large' => 1.125,
    _ => 1.0,
  };

  Future<void> _loadFontSize() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() => _fontSize = prefs.getString('font_size') ?? 'medium');
    }
  }

  /// Settings calls this; every screen's text resizes at once.
  Future<void> updateFontSize(String size) async {
    setState(() => _fontSize = size);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('font_size', size);
  }

  /// Settings calls this with 'light', 'dark', 'system' or 'cycle'.
  Future<void> updateThemePreference(String preference) async {
    _applyThemePreference(preference);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('theme_mode', preference);
    } catch (e) {
      debugPrint("Failed to save theme mode: $e");
    }
  }

  @override
  void dispose() {
    _cycleTimer?.cancel();
    _fade.dispose();
    _fadeFrom?.dispose();
    super.dispose();
  }

  /// The languages the app's own text is translated into (the same list as Settings).
  static const supportedLanguages = [
    'en',
    'ms',
    'zh',
    'ta',
    'ja',
    'ko',
    'es',
    'fr',
    'de',
    'ar',
  ];

  void _setLanguage(String code) {
    final normalised = code == 'zh_CN' || code == 'zh_TW' ? 'zh' : code;
    _languageCode = supportedLanguages.contains(normalised) ? normalised : 'en';
    AppLanguage.code = _languageCode;
  }

  /// Redraws every screen already built (including ones under the current page) in the new language, in place.
  void _redrawInNewLanguage() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) AppLanguage.rebuildAll(context);
    });
  }

  Future<void> _loadLanguage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      // Apply the saved language straight away; the server catalogue (older key-based labels) follows when it arrives.
      setState(() => _setLanguage(prefs.getString('language') ?? 'en'));
      _redrawInNewLanguage();
      await _refreshCatalogue();
    } catch (e) {
      debugPrint('Failed to load app language: $e');
    }
  }

  Future<void> _refreshCatalogue() async {
    final catalogue = await UserService.fetchSystemLanguages();
    final remoteTranslations = catalogue?['translations'];
    if (!mounted || remoteTranslations is! Map) return;
    setState(
      () => _translations = Map<String, dynamic>.from(remoteTranslations),
    );
  }

  Future<void> updateLanguage(String languageCode) async {
    setState(() => _setLanguage(languageCode));
    _redrawInNewLanguage();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('language', _languageCode);
    await _refreshCatalogue();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: tr('Smart Attendance Portal'),
      debugShowCheckedModeBanner: false,
      locale: Locale(_languageCode),
      // Flutter's own words (date and time pickers, OK / Cancel, Back, Paste) in the same language.
      supportedLocales: [for (final code in supportedLanguages) Locale(code)],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: _lightThemeData,
      darkTheme: _darkThemeData,
      themeMode: _themeMode,
      // Switch in one frame: blending two themes rebuilt the whole app (every card blurring the live sky) on each frame and caused the lag.
      themeAnimationDuration: Duration.zero,
      builder: (context, child) {
        // The chosen size multiplies the phone's own text size, so accessibility scaling is kept.
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: TextScaler.linear(
              media.textScaler.scale(1) * fontScaleFor(_fontSize),
            ),
          ),
          child: AppLocalizations(
            languageCode: _languageCode,
            translations: _translations,
            child: Directionality(
              textDirection: _languageCode == 'ar'
                  ? TextDirection.rtl
                  : TextDirection.ltr,
              child: Stack(
                children: [
                  RepaintBoundary(
                    key: _screenKey,
                    child: child ?? const AppRoot(),
                  ),
                  if (_fadeFrom != null)
                    Positioned.fill(
                      child: IgnorePointer(
                        child: FadeTransition(
                          opacity: ReverseAnimation(
                            CurvedAnimation(
                              parent: _fade,
                              curve: Curves.easeInOut,
                            ),
                          ),
                          child: RawImage(image: _fadeFrom, fit: BoxFit.fill),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
      home: const StartupIntro(child: AppRoot()),
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
      if (customUrl != null &&
          customUrl!.trim().isNotEmpty &&
          customUrl!.trim().startsWith('https://')) {
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

class _AppRootState extends State<AppRoot> with WidgetsBindingObserver {
  String _studentUserId = "";
  Timer? _offlineTimer;
  bool _checkingSessions = false;
  bool _offlineBusy = false;
  List<Map<String, Object?>> _offlineRows = [];
  int selectedTab = 0; // 0: Home, 1: Student Portal, 2: Staff Portal

  String studentAuthToken = "";
  String staffAuthToken = "";
  bool isSyncing = false;
  // The portal being signed in to ('student' / 'staff'), so its sign-in shows that portal's skeleton even when the
  // other portal is already signed in (the old check hid the skeleton as soon as either account was signed in).
  String? _signingInPortal;

  /// A login page is busy only while it is signing in itself, or while the app starts and nobody is signed in.
  /// The shared isSyncing flag is also set by the other portal's background refresh, which must not lock this form.
  bool _portalBusy(String portal) =>
      _signingInPortal == portal ||
      (_signingInPortal == null &&
          isSyncing &&
          !isStudentLoggedIn &&
          !isStaffLoggedIn);
  bool isDatabaseOffline = false;

  // Student State
  bool isStudentLoggedIn = false;
  int studentId = 0;
  String studentName = "";
  String studentCode = "";
  String studentEmail = "";
  bool isFaceRegistered = false;
  String? _faceRegistrationVersion;
  int _faceStatusGeneration = 0;
  bool _registeringFace = false;
  bool _savingFace = false;
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
  String staffRole = "Staff";

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _offlineTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        unawaited(_syncOffline());
        unawaited(_checkSessions());
      }
    });
    _initApp();
    AccountSecurity.endedToken.addListener(_sessionEnded);
    MobilePush.onOpen = (notifications, token) {
      if (!mounted || (token != studentAuthToken && token != staffAuthToken)) {
        return;
      }
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => NotificationsScreen(
            authToken: token,
            apiBaseUrl: ApiConfig.getEffectiveUrl(),
            initialNotifications: notifications,
          ),
        ),
      );
    };
  }

  @override
  void dispose() {
    _offlineTimer?.cancel();
    MobilePush.onOpen = null;
    AccountSecurity.endedToken.removeListener(_sessionEnded);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_syncOffline());
      unawaited(_checkSessions());
    }
  }

  void _sessionEnded() {
    final token = AccountSecurity.endedToken.value;
    if (!mounted || token.isEmpty) return;
    if (token == studentAuthToken) {
      handleStudentLogout();
    } else if (token == staffAuthToken) {
      handleStaffLogout();
    } else {
      return;
    }
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  Future<void> _checkSessions() async {
    if (_checkingSessions) return;
    _checkingSessions = true;
    try {
      for (final token in [
        studentAuthToken,
        staffAuthToken,
      ].where((value) => value.isNotEmpty).toList()) {
        final response = await http
            .get(
              Uri.parse('${ApiConfig.getEffectiveUrl()}/auth/me'),
              headers: {'Authorization': 'Bearer $token'},
            )
            .timeout(const Duration(seconds: 12));
        if (!mounted) continue;
        if (response.statusCode == 200 && token == studentAuthToken) {
          try {
            await refreshStudentFaceStatus();
          } catch (_) {}
        }
        if (![401, 403].contains(response.statusCode)) continue;
        if (token == studentAuthToken) {
          handleStudentLogout();
        } else if (token == staffAuthToken) {
          handleStaffLogout();
        } else {
          continue;
        }
        Navigator.of(context).popUntil((route) => route.isFirst);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('Your session ended. Please sign in again.')),
          ),
        );
      }
    } catch (_) {
      /* Offline does not falsely suspend an account. */
    } finally {
      _checkingSessions = false;
    }
  }

  void _selectPortal(int index) {
    setState(() => selectedTab = index);
    final token = index == 2 ? staffAuthToken : studentAuthToken;
    if (token.isNotEmpty) {
      unawaited(MobilePush.bind(token, ApiConfig.getEffectiveUrl()));
    }
  }

  void _openSettings() {
    final staff =
        selectedTab == 2 ||
        (studentAuthToken.isEmpty && staffAuthToken.isNotEmpty);
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SettingsScreen(
          authToken: staff ? staffAuthToken : studentAuthToken,
          apiBaseUrl: ApiConfig.getEffectiveUrl(),
        ),
      ),
    );
  }

  Future<void> _syncOffline() async {
    if (_offlineBusy || !isStudentLoggedIn || _studentUserId.isEmpty || kIsWeb) {
      return;
    }
    _offlineBusy = true;
    final owner = _studentUserId,
        token = studentAuthToken,
        server = ApiConfig.getEffectiveUrl();
    bool current() =>
        mounted &&
        owner == _studentUserId &&
        token == studentAuthToken &&
        server == ApiConfig.getEffectiveUrl();
    final client = http.Client();
    bool recorded = false;
    try {
      final rows = await LocalCacheService.pendingCheckIns(owner, server);
      if (current()) setState(() => _offlineRows = rows);
      for (final row in rows) {
        if (!current()) break;
        if (row['owner'] != owner ||
            !['pending', 'needs_review'].contains(row['status'])) {
          continue;
        }
        final result = await syncOfflineCheckIn(
          client: client,
          server: server,
          token: token,
          row: row,
          stillCurrent: current,
          networkFacts: () async =>
              (await NetworkInfoService.collect()).toPayload(),
        );
        await LocalCacheService.updateCheckIn(
          row['id'] as int,
          owner,
          result.status,
          result.message,
        );
        recorded = recorded || result.status == 'synced';
        if (result.status == 'pending') break;
      }
      final updated = await LocalCacheService.pendingCheckIns(owner, server);
      if (current()) setState(() => _offlineRows = updated);
    } catch (e) {
      debugPrint('Offline check-in processing deferred: ${e.runtimeType}');
    } finally {
      client.close();
      _offlineBusy = false;
    }
    if (recorded && current() && !isSyncing) unawaited(syncData(context));
  }

  String _offlineLabel(Map<String, Object?> row) {
    return offlineStatus(row['status']);
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
            debugPrint(
              "Cached API Server is unreachable. Initiating auto-discovery...",
            );
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
      debugPrint(
        "Remote backend configured (${AppConfig.productionApiUrl}); skipping LAN discovery.",
      );
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
      final serverTimeRes = await http
          .get(
            Uri.parse('$effectiveUrl/auth/server-time'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 5));
      if (serverTimeRes.statusCode == 200) {
        final serverTimeStr = jsonDecode(serverTimeRes.body)['server_time'];
        final serverTime = DateTime.parse(serverTimeStr).toLocal();
        final localTime = DateTime.now();
        ApiConfig.serverOffset = serverTime.difference(localTime);
        debugPrint(
          "Synced server time offset: ${ApiConfig.serverOffset.inMilliseconds} ms",
        );
        if (mounted) setState(() {});
      }
    } catch (e) {
      debugPrint("Clock sync failed ($retries retries left): $e");

      // Fallback from localhost (adb reverse) to emulator host alias (10.0.2.2) if on Android and initial connection fails.
      if (!kIsWeb &&
          ApiConfig.useAdbReverse &&
          defaultTargetPlatform == TargetPlatform.android) {
        debugPrint(
          "Android connection failed, switching adb-reverse tunnel off to use 10.0.2.2.",
        );
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
  final Map<String, Future<http.Response>> _pendingApiGets = {};

  Future<http.Response> _apiGet(String path, BuildContext context) {
    final existing = _pendingApiGets[path];
    if (existing != null) return existing;
    final apiUrl = ApiConfig.getEffectiveUrl();
    final request = http
        .get(
          Uri.parse('$apiUrl$path'),
          headers: {
            'Content-Type': 'application/json',
            if (studentAuthToken.isNotEmpty)
              'Authorization': 'Bearer $studentAuthToken',
          },
        )
        .timeout(const Duration(seconds: 12))
        .whenComplete(() => _pendingApiGets.remove(path));
    _pendingApiGets[path] = request;
    return request;
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
  Future<void> handleLogin(
    String emailOrId,
    String password,
    String portalType,
    BuildContext context,
  ) async {
    setState(() {
      isSyncing = true;
      _signingInPortal = portalType;
    });
    try {
      final String rawInput = emailOrId.trim();

      // Fetch stable device fingerprint for multi-device session binding.
      final deviceId = await LocalCacheService.getOrCreateDeviceId();

      // Authenticate via backend. Students sign in with their school email only; staff may use their staff ID.
      // The server returns the full profile, so the app never touches the DB directly.
      final apiUrl = ApiConfig.getEffectiveUrl();
      final http.Response response;
      try {
        response = await http
            .post(
              Uri.parse('$apiUrl/auth/login'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'identifier': rawInput,
                'password': password,
                'device_id': deviceId,
                'portal': portalType,
              }),
            )
            .timeout(const Duration(seconds: 12));
      } on TimeoutException {
        throw Exception(
          "The server took too long to respond. Check your connection and that the backend is running.",
        );
      } catch (_) {
        throw Exception(
          "Cannot reach the server. Make sure the backend is running and the API address is correct.",
        );
      }

      if (response.statusCode == 401) {
        throw Exception(_detailOf(response, 'Invalid email or password'));
      }
      if (response.statusCode != 200) {
        throw Exception(_detailOf(response, 'Login failed'));
      }

      var authData = jsonDecode(response.body);
      if (authData['requires_two_factor'] == true) {
        if (!context.mounted) return;
        final verified = await AccountSecurity.verifyLogin(
          context,
          apiUrl,
          authData['challenge_token'],
        );
        if (verified == null) return;
        authData = verified;
      }
      final role = authData['role'] as String;
      if (portalType == 'student' && role != 'student') {
        throw Exception("This account is not a student account.");
      }
      if (portalType == 'staff' && role != 'lecturer') {
        throw Exception("This account is not a lecturer/staff account.");
      }

      final token = authData['access_token'] as String;
      final sId =
          int.tryParse(
            (authData['profile_id'] ?? authData['user_id']).toString(),
          ) ??
          0;
      final name =
          (authData['name'] ?? (portalType == 'student' ? 'Student' : 'Staff'))
              as String;
      final code = (authData['code'] ?? rawInput) as String;
      final resolvedEmail = (authData['email'] ?? rawInput) as String;
      final faceReg = (authData['is_face_registered'] ?? false) as bool;

      // Save state
      setState(() {
        if (portalType == 'student') {
          _studentUserId = authData['user_id']?.toString() ?? '';
          _offlineRows = [];
          studentAuthToken = token;
          studentId = sId;
          studentEmail = resolvedEmail;
          studentName = name;
          studentCode = code;
          isFaceRegistered = faceReg;
          _faceRegistrationVersion = null;
          _faceStatusGeneration++;
          isStudentLoggedIn = true;
        } else {
          staffAuthToken = token;
          staffId = sId;
          staffEmail = resolvedEmail;
          staffName = name;
          staffCode = code;
          staffRole =
              (authData['staff_role'] ??
                      (authData['role'] == 'admin' ? 'Admin' : 'Staff'))
                  .toString()
                  .trim();
          if (staffRole.toLowerCase() == 'lecturer') staffRole = 'Lecturer';
          if (staffRole.toLowerCase() == 'admin') staffRole = 'Admin';
          if (staffRole.toLowerCase() == 'tutor') staffRole = 'Tutor';
          isStaffLoggedIn = true;
        }
      });

      unawaited(MobilePush.bind(token, apiUrl));

      if (portalType == 'student') {
        // Authentication is complete: reveal the cached/empty dashboard now and
        // refresh its data in the background. A slow endpoint must not trap the
        // user behind the full-screen login skeleton.
        setState(() {
          isSyncing = false;
          _signingInPortal = null;
        });
        if (authData['recovery_email_verified'] != true) {
          await _setupRecoveryEmail(context, token);
        }
        unawaited(syncData(context));
        unawaited(refreshStudentFaceStatus().catchError((Object _) {}));
      }
    } catch (e) {
      showErrorDialog(_friendlyError(e), context);
    } finally {
      setState(() {
        isSyncing = false;
        _signingInPortal = null;
      });
    }
  }

  Future<void> _setupRecoveryEmail(BuildContext context, String token) =>
      showRecoveryEmailDialog(
        context,
        request: (email) => UserService.requestRecoveryEmail(email, token),
        verify: (code) => UserService.verifyRecoveryEmail(code, token),
      );

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
      final response = await http
          .get(
            Uri.parse('$effectiveUrl/public/announcements'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 8));

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

  List<Map<String, dynamic>> _mapStudentSchedule(List<dynamic> courses) {
    final schedule = <Map<String, dynamic>>[];
    for (final c in courses) {
      final day = c['schedule_day'] as String?;
      final start = c['schedule_start'] as String?;
      final end = c['schedule_end'] as String?;
      final room = c['schedule_room'] as String?;
      if (day == null || start == null || end == null) continue;

      schedule.add({
        'courseId': c['course_id'],
        'meetingId': c['id'],
        'semester': c['semester'],
        'courseCode': c['course_code'] ?? 'Unknown',
        'courseName': c['course_name'] ?? 'Unknown',
        'group': c['role'] ?? 'Lecture',
        'classGroup': c['class_group'] ?? 'All',
        'day': day,
        'startTime': start,
        'endTime': end,
        'room': room ?? 'Main Hall A',
        'lecturerName': c['lecturer_name'] ?? 'TBA',
        'attendanceRate': courseRate(c),
      });
    }

    const daysOrder = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    schedule.sort((a, b) {
      final dayA = daysOrder.indexOf(a['day']);
      final dayB = daysOrder.indexOf(b['day']);
      if (dayA != dayB) return dayA.compareTo(dayB);
      return a['startTime'].compareTo(b['startTime']);
    });
    return schedule;
  }

  Future<List<Map<String, dynamic>>> refreshStudentTimetable() async {
    if (studentAuthToken.isEmpty) return studentSchedule;
    try {
      // A unique query and explicit no-cache headers prevent an old empty timetable
      // from being reused by the device, CDN, or reverse proxy after an admin edit.
      final apiUrl = ApiConfig.getEffectiveUrl();
      final refreshKey = DateTime.now().millisecondsSinceEpoch;
      final response = await http
          .get(
            Uri.parse('$apiUrl/students/me/courses?refresh=$refreshKey'),
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store',
              'Pragma': 'no-cache',
              'Authorization': 'Bearer $studentAuthToken',
            },
          )
          .timeout(const Duration(seconds: 12));
      if (response.statusCode != 200) return studentSchedule;

      final courses = jsonDecode(response.body) as List<dynamic>;
      final schedule = _mapStudentSchedule(courses);
      if (!mounted) return schedule;

      setState(() => studentSchedule = schedule);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_student_schedule', jsonEncode(schedule));
      return schedule;
    } catch (e) {
      debugPrint('Timetable refresh failed: $e');
      return studentSchedule;
    }
  }

  // Load attendance history + today's check-in status + course timetable from backend.
  Future<void> refreshStudentAttendance() async {
    final token = studentAuthToken;
    if (token.isEmpty) return;
    final response = await _apiGet('/students/me/attendance', context);
    if (!mounted || studentAuthToken != token || response.statusCode != 200) {
      return;
    }
    final rows = jsonDecode(response.body) as List;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    bool checkedIn = false;
    final history = rows.map((r) {
      final marked = DateTime.tryParse(r['marked_at'] ?? '')?.toLocal();
      final status = r['status'] ?? 'present';
      final detail = r['verify_detail'] as String?;
      String label = 'Unknown';
      if (status == 'absent' && detail != null && detail.isNotEmpty) {
        label = detail;
      } else if (marked != null) {
        final today =
            marked.year == ApiConfig.now.year &&
            marked.month == ApiConfig.now.month &&
            marked.day == ApiConfig.now.day;
        final hour = marked.hour % 12 == 0 ? 12 : marked.hour % 12;
        final time =
            '$hour:${marked.minute.toString().padLeft(2, '0')} ${marked.hour >= 12 ? 'PM' : 'AM'}';
        label = today
            ? tr('Today, {time}', {'time': time})
            : '${tr(months[marked.month - 1])} ${marked.day}, ${marked.year}, $time';
        if (today) checkedIn = true;
      }
      return <String, dynamic>{
        'courseCode': r['course_code'] ?? 'Unknown',
        'courseName': r['course_name'] ?? 'Unknown',
        'group': r['class_group'] ?? '-',
        'date': label,
        'status': historyStatus(status),
        'wifiVerified': r['network_verified'] ?? false,
        'faceVerified': r['liveness_passed'] == true,
      };
    }).toList();
    setState(() {
      attendanceHistory = history;
      isCheckedInToday = checkedIn;
    });
    if (studentAuthToken == token) {
      await LocalCacheService.saveAttendanceCache(
        rows.map((row) => Map<String, dynamic>.from(row)).toList(),
      );
    }
  }

  Future<void> refreshStudentAnnouncements() async {
    final token = studentAuthToken;
    if (token.isEmpty) return;
    final response = await _apiGet('/students/me/announcements', context);
    if (!mounted || studentAuthToken != token || response.statusCode != 200) {
      return;
    }
    final notices = (jsonDecode(response.body) as List)
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    setState(() => studentAnnouncements = notices);
    final prefs = await SharedPreferences.getInstance();
    if (studentAuthToken == token) {
      await prefs.setString(
        'cached_student_announcements',
        jsonEncode(notices),
      );
    }
  }

  Future<void> syncData(BuildContext context) async {
    await _syncOffline();
    final prefs = await SharedPreferences.getInstance();

    // 1. Try loading cached data first for instant user rendering
    final cachedHistory = await LocalCacheService.loadAttendanceCache();
    final cachedScheduleStr = prefs.getString('cached_student_schedule');
    final cachedAnnouncementsStr = prefs.getString(
      'cached_student_announcements',
    );

    bool hasCachedData = false;

    if (cachedHistory.isNotEmpty ||
        cachedScheduleStr != null ||
        cachedAnnouncementsStr != null) {
      hasCachedData = true;
      final months = const [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      // Load cached history
      final List<Map<String, dynamic>> mappedHistory = [];
      bool checkedIn = false;
      for (final r in cachedHistory) {
        final markedRaw = r['marked_at'] as String?;
        final markedAt = markedRaw != null
            ? DateTime.tryParse(markedRaw)?.toLocal()
            : null;
        final status = (r['status'] ?? 'present') as String;
        String dateLabel = 'Unknown';
        if (markedAt != null) {
          final isToday =
              markedAt.year == ApiConfig.now.year &&
              markedAt.month == ApiConfig.now.month &&
              markedAt.day == ApiConfig.now.day;
          final timeStr =
              "${markedAt.hour}:${markedAt.minute.toString().padLeft(2, '0')} ${markedAt.hour >= 12 ? 'PM' : 'AM'}";
          dateLabel = isToday
              ? tr('Today, {time}', {'time': timeStr})
              : "${tr(months[markedAt.month - 1])} ${markedAt.day}, ${markedAt.year}, $timeStr";
          if (isToday) checkedIn = true;
        }
        mappedHistory.add({
          'courseCode': r['course_code'] ?? 'Unknown',
          'courseName': r['course_name'] ?? 'Unknown',
          'group': r['class_group'] ?? '-',
          'date': dateLabel,
          'status': historyStatus(status),
          'wifiVerified': r['network_verified'] ?? false,
          'faceVerified': true,
        });
      }

      // Load cached schedule/timetable
      List<Map<String, dynamic>> mappedSchedule = [];
      if (cachedScheduleStr != null) {
        try {
          final List<dynamic> decoded = jsonDecode(cachedScheduleStr);
          mappedSchedule = decoded
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
        } catch (_) {}
      }

      // Load cached announcements
      List<Map<String, dynamic>> mappedAnnouncements = [];
      if (cachedAnnouncementsStr != null) {
        try {
          final List<dynamic> decoded = jsonDecode(cachedAnnouncementsStr);
          mappedAnnouncements = decoded
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
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
      // Clock synchronization runs beside data requests so it does not delay rendering.
      final clockSync = () async {
        try {
          final serverTimeRes = await http
              .get(
                Uri.parse('${ApiConfig.getEffectiveUrl()}/auth/server-time'),
                headers: {'Content-Type': 'application/json'},
              )
              .timeout(const Duration(seconds: 4));
          if (serverTimeRes.statusCode == 200) {
            final serverTimeStr = jsonDecode(serverTimeRes.body)['server_time'];
            final serverUtc = DateTime.parse(serverTimeStr).toUtc();
            final localUtc = DateTime.now().toUtc();
            ApiConfig.serverOffset = serverUtc.difference(localUtc);
            debugPrint(
              "Synced server UTC time offset: ${ApiConfig.serverOffset.inMilliseconds} ms",
            );
          }
        } catch (e) {
          debugPrint("Warning: could not sync server offset clock: $e");
        }
      }();
      unawaited(clockSync);

      // Fetch attendance, courses, announcements, and clock concurrently.
      final responses = await Future.wait([
        _apiGet('/students/me/attendance', context),
        _apiGet('/students/me/courses', context),
        _apiGet('/students/me/announcements', context),
      ]);
      final attendanceRes = responses[0];
      final coursesRes = responses[1];
      final announcementsRes = responses[2];

      if (attendanceRes.statusCode != 200) {
        throw Exception(
          _detailOf(
            attendanceRes,
            tr('Could not load attendance ({code}).', {
              'code': attendanceRes.statusCode,
            }),
          ),
        );
      }
      if (coursesRes.statusCode != 200) {
        throw Exception(
          _detailOf(
            coursesRes,
            tr('Could not load timetable ({code}).', {
              'code': coursesRes.statusCode,
            }),
          ),
        );
      }
      if (announcementsRes.statusCode != 200) {
        throw Exception(
          _detailOf(
            announcementsRes,
            tr('Could not load announcements ({code}).', {
              'code': announcementsRes.statusCode,
            }),
          ),
        );
      }

      final List<dynamic> rows =
          jsonDecode(attendanceRes.body) as List<dynamic>;
      final List<Map<String, dynamic>> history = [];
      bool checkedIn = false;
      final months = const [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      for (final r in rows) {
        final markedRaw = r['marked_at'] as String?;
        final markedAt = markedRaw != null
            ? DateTime.tryParse(markedRaw)?.toLocal()
            : null;
        final status = (r['status'] ?? 'present') as String;
        final verifyDetail = r['verify_detail'] as String?;

        String dateLabel = 'Unknown';
        if (status == 'absent' &&
            verifyDetail != null &&
            verifyDetail.isNotEmpty) {
          dateLabel = verifyDetail;
        } else if (markedAt != null) {
          final isToday =
              markedAt.year == ApiConfig.now.year &&
              markedAt.month == ApiConfig.now.month &&
              markedAt.day == ApiConfig.now.day;
          final timeStr =
              "${markedAt.hour}:${markedAt.minute.toString().padLeft(2, '0')} ${markedAt.hour >= 12 ? 'PM' : 'AM'}";
          dateLabel = isToday
              ? tr('Today, {time}', {'time': timeStr})
              : "${tr(months[markedAt.month - 1])} ${markedAt.day}, ${markedAt.year}, $timeStr";
          if (isToday) checkedIn = true;
        }

        final netVerified = (r['network_verified'] ?? false) as bool;
        history.add({
          'courseCode': r['course_code'] ?? 'Unknown',
          'courseName': r['course_name'] ?? 'Unknown',
          'group': r['class_group'] ?? '-',
          'date': dateLabel,
          'status': historyStatus(status),
          'wifiVerified': netVerified,
          'faceVerified': true,
        });
      }

      final List<dynamic> rawCoursesList =
          jsonDecode(coursesRes.body) as List<dynamic>;
      final loadedSchedule = _mapStudentSchedule(rawCoursesList);

      final List<dynamic> rawAnnouncementsList =
          jsonDecode(announcementsRes.body) as List<dynamic>;
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
          'publisher': a['publisher'],
          'image_base64': a['image_base64'],
          'publish_start': a['publish_start'],
          'publish_end': a['publish_end'],
          'target_scope': a['target_scope'],
          'target_role': a['target_role'],
          'target_programme_code': a['target_programme_code'],
          'target_course_code': a['target_course_code'],
          'target_group': a['target_group'],
          'attachment_name': a['attachment_name'],
          'external_link': a['external_link'],
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
      await prefs.setString(
        'cached_student_schedule',
        jsonEncode(loadedSchedule),
      );
      await prefs.setString(
        'cached_student_announcements',
        jsonEncode(loadedAnnouncements),
      );
    } catch (e) {
      final msg = e.toString();
      debugPrint("Attendance sync failed: $e");

      if (!msg.contains("Not authenticated")) {
        setState(() => isDatabaseOffline = true);

        // If we don't have any cached data at all, show the offline snackbar alert
        if (!hasCachedData && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                tr('Working Offline: {v}', {'v': _friendlyError(e)}),
              ),
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
    final owner = _studentUserId,
        token = studentAuthToken,
        server = ApiConfig.getEffectiveUrl();
    final requestId = newCheckInId();
    final capturedAt = DateTime.now().toUtc();
    bool current() =>
        mounted && owner == _studentUserId && token == studentAuthToken;
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
      final apiUrl = server;
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
        'challenge_token': extraDetails?['challenge_token'],
        'device_id': deviceId,
      };
      if (!current()) return;
      try {
        response = await http
            .post(
              Uri.parse('$apiUrl/sessions/$sessionId/attend'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
              body: jsonEncode(checkInPayload),
            )
            .timeout(const Duration(seconds: 45));
      } on TimeoutException {
        await LocalCacheService.enqueueCheckIn(
          owner,
          server,
          sessionId,
          requestId,
          capturedAt,
          checkInPayload,
          classLabel: '$courseCode — $courseName',
        );
        if (current()) {
          _offlineRows = await LocalCacheService.pendingCheckIns(owner, server);
          if (!current()) return;
          setState(() {});
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                tr(
                  'Saved on this phone, not confirmed. Reconnect with the app open; after class, lecturer review is required.',
                ),
              ),
              backgroundColor: Color(0xFFF59E0B),
            ),
          );
        }
        return;
      } on http.ClientException {
        await LocalCacheService.enqueueCheckIn(
          owner,
          server,
          sessionId,
          requestId,
          capturedAt,
          checkInPayload,
          classLabel: '$courseCode — $courseName',
        );
        if (current()) {
          _offlineRows = await LocalCacheService.pendingCheckIns(owner, server);
          if (!current()) return;
          setState(() {});
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                tr(
                  'Saved on this phone, not confirmed. Reconnect with the app open; after class, lecturer review is required.',
                ),
              ),
              backgroundColor: Color(0xFFF59E0B),
            ),
          );
        }
        return;
      }

      if (!current()) return;
      if (response.statusCode != 200) {
        String error = 'Verification failed';
        try {
          error = jsonDecode(response.body)['detail'] ?? error;
        } catch (_) {
          error = tr('Server error {code}.', {'code': response.statusCode});
        }
        if (response.statusCode == 400 &&
            error.toLowerCase().contains('already registered')) {
          await syncData(context);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(tr('You\'re already checked in for this class.')),
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

      for (final row in await LocalCacheService.pendingCheckIns(
        owner,
        server,
      )) {
        if (row['owner'] == owner &&
            row['session_id'].toString() == sessionId.toString()) {
          await LocalCacheService.updateCheckIn(
            row['id'] as int,
            owner,
            'synced',
            'Attendance recorded.',
          );
        }
      }
      if (!current()) return;
      try {
        await refreshStudentFaceStatus();
      } catch (_) {}
      await syncData(context);

      if (!mounted) return;

      final bool wifiVerified =
          resJson['wifi_verified'] == true ||
          (resJson['attendance_record']?['wifi_verified'] == true);
      final bool liveVerified =
          resJson['liveness_passed'] == true || livenessPassed;

      showCheckInSuccessDialog(
        context,
        courseCode: courseCode,
        courseName: courseName,
        timeSlot:
            extraDetails?['timeSlot']?.toString() ?? 'Active Class Session',
        room: extraDetails?['room']?.toString() ?? 'Main Hall A',
        classGroup: extraDetails?['classGroup']?.toString() ?? 'Tut Group G2',
        lecturerName: extraDetails?['lecturerName']?.toString() ?? 'Dr. Low',
        lecturerRole: extraDetails?['lecturerRole']?.toString() ?? 'Lecturer',
        wifiVerified: wifiVerified,
        livenessPassed: liveVerified,
      );
    } catch (e) {
      if (current()) {
        // Red result with the reason; Try again reopens the scan when the dashboard passed a way to do so.
        final retry = extraDetails?['retry'];
        showCheckInFailedDialog(
          context,
          message: _friendlyStudentError(e.toString().replaceAll("Exception: ", "")),
          onRetry: retry is Future<void> Function() ? () => retry() : null,
        );
      }
    } finally {
      if (mounted) setState(() => isSyncing = false);
    }
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
    if (_registeringFace || _savingFace || isSyncing) return;
    setState(() => _registeringFace = true);
    final ownerToken = studentAuthToken;
    final ownerServer = ApiConfig.getEffectiveUrl();
    bool current() =>
        mounted &&
        studentAuthToken == ownerToken &&
        isStudentLoggedIn &&
        ApiConfig.getEffectiveUrl() == ownerServer;
    try {
      await refreshStudentFaceStatus();
      if (!current()) return;
      if (isFaceRegistered) {
        showErrorDialog(
          'Your face is already registered and cannot be changed in the app. Visit the administration office if you need a reset.',
          context,
        );
        return;
      }
    } catch (error) {
      if (current()) showErrorDialog(_friendlyError(error), context);
      return;
    } finally {
      if (current()) setState(() => _registeringFace = false);
    }
    if (!current() || isFaceRegistered) return;
    final registrationVersion = _faceRegistrationVersion;
    setState(() => _registeringFace = true);
    try {
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => FaceScannerScreen(
            title: tr('Face Registration'),
            onScanComplete:
                (
                  imageBase64,
                  livenessPassed, {
                  int? challengeMs,
                  String? challengeToken,
                }) async {
                  if (!current()) return;
                  if (imageBase64 == null || imageBase64.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          tr(
                            'Face registration cancelled: no selfie captured.',
                          ),
                        ),
                        backgroundColor: Color(0xFFDC2626),
                      ),
                    );
                    return;
                  }
                  if (!livenessPassed) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          tr(
                            'Liveness check not completed. Please try the gesture challenge again.',
                          ),
                        ),
                        backgroundColor: Color(0xFFDC2626),
                      ),
                    );
                    return;
                  }

                  setState(() {
                    _savingFace = true;
                    isSyncing = true;
                  });
                  try {
                    // Registration is confirmed only after the server verifies the live face.
                    final apiUrl = ownerServer;
                    final http.Response response;
                    try {
                      response = await http
                          .post(
                            Uri.parse('$apiUrl/students/me/face'),
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': 'Bearer $ownerToken',
                            },
                            body: jsonEncode({
                              'image_base64': imageBase64,
                              'registration_version': registrationVersion,
                            }),
                          )
                          .timeout(const Duration(seconds: 45));
                    } on TimeoutException {
                      throw Exception(
                        "The server took too long to respond. Please try again.",
                      );
                    } catch (_) {
                      throw Exception(
                        "Cannot reach the server. Make sure the backend is running.",
                      );
                    }

                    if (response.statusCode != 200) {
                      throw Exception(
                        _detailOf(
                          response,
                          tr('Face registration failed ({code}).', {
                            'code': response.statusCode,
                          }),
                        ),
                      );
                    }

                    if (!current()) return;
                    final result =
                        jsonDecode(response.body) as Map<String, dynamic>;
                    if (result['is_face_registered'] != true) {
                      throw StateError(
                        'Registration was not confirmed. Refresh and try again.',
                      );
                    }
                    setState(() {
                      _faceStatusGeneration++;
                      isFaceRegistered = true;
                      _faceRegistrationVersion =
                          result['registration_version'] as String?;
                    });
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          tr(
                            'Face registered successfully. Only the administration office can reset it.',
                          ),
                        ),
                        backgroundColor: Color(0xFF10B981),
                      ),
                    );
                  } catch (e) {
                    // A timed-out POST may have committed; fetch truth before allowing retry.
                    if (current()) {
                      try {
                        await refreshStudentFaceStatus();
                      } catch (_) {}
                    }
                    if (current()) showErrorDialog(_friendlyError(e), context);
                  } finally {
                    if (current()) {
                      setState(() {
                        _savingFace = false;
                        isSyncing = false;
                      });
                    }
                  }
                },
          ),
        ),
      );
    } finally {
      if (current()) setState(() => _registeringFace = false);
    }
  }

  Future<void> refreshStudentFaceStatus() async {
    final token = studentAuthToken;
    final server = ApiConfig.getEffectiveUrl();
    if (token.isEmpty) return;
    final generation = ++_faceStatusGeneration;
    // Do not reuse the path-only GET cache across account/server switches.
    final response = await http
        .get(
          Uri.parse('$server/students/me/face/status'),
          headers: {'Authorization': 'Bearer $token'},
        )
        .timeout(const Duration(seconds: 12));
    if (!mounted ||
        generation != _faceStatusGeneration ||
        token != studentAuthToken ||
        server != ApiConfig.getEffectiveUrl()) {
      return;
    }
    if (response.statusCode != 200) {
      throw StateError(
        _detailOf(response, 'Unable to load face registration status.'),
      );
    }
    final result = jsonDecode(response.body) as Map<String, dynamic>;
    if (result['is_face_registered'] is! bool ||
        !result.containsKey('registration_version')) {
      throw StateError(
        'Face registration status could not be confirmed. Please refresh and try again.',
      );
    }
    setState(() {
      isFaceRegistered = result['is_face_registered'] == true;
      _faceRegistrationVersion = result['registration_version'] as String?;
    });
  }

  Future<void> _endServerSession(String token) async {
    if (token.isEmpty) return;
    // Request revocation immediately, independently of device unregistration.
    unawaited(MobilePush.unbind(token));
    try {
      await AccountSecurity.request(
        ApiConfig.getEffectiveUrl(),
        token,
        '/auth/logout',
        body: {},
      );
    } catch (failure) {
      if (failure is SecurityFailure && [401, 403].contains(failure.status)) {
        return;
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              tr('Signed out locally; server sign-out could not be confirmed.'),
            ),
          ),
        );
      }
    }
  }

  void handleStudentLogout() {
    final token = studentAuthToken;
    unawaited(_endServerSession(token));
    setState(() {
      studentAuthToken = "";
      _studentUserId = "";
      _offlineRows = [];
      isStudentLoggedIn = false;
      isFaceRegistered = false;
      _faceRegistrationVersion = null;
      _faceStatusGeneration++;
      _registeringFace = false;
      _savingFace = false;
      isCheckedInToday = false;
      attendanceHistory = [];
      studentAnnouncements = [];
    });
    SharedPreferences.getInstance()
        .then((prefs) {
          prefs.remove('cached_student_schedule');
          prefs.remove('cached_student_announcements');
          prefs.remove('cached_active_sessions');
        })
        .catchError((e) {
          debugPrint("Failed to clear logout cache: $e");
        });
  }

  void handleStaffLogout() {
    final token = staffAuthToken;
    unawaited(_endServerSession(token));
    final previousStaffId = staffId;
    setState(() {
      staffAuthToken = "";
      isStaffLoggedIn = false;
    });
    SharedPreferences.getInstance()
        .then((prefs) async {
          await prefs.remove('cached_staff_${previousStaffId}_timetable');
          await prefs.remove('cached_staff_${previousStaffId}_courses');
        })
        .catchError((e) {
          debugPrint("Failed to clear staff logout cache: $e");
        });
  }

  String _friendlyStudentError(String rawMsg) {
    final lower = rawMsg.toLowerCase();

    if (lower.contains('face') &&
        (lower.contains('not match') ||
            lower.contains('mismatch') ||
            lower.contains('no match') ||
            lower.contains('failed'))) {
      return "Face Match Failed: Your face does not match your registered profile. Please make sure your face is clearly visible and try again.";
    }
    if (lower.contains('liveness') ||
        lower.contains('blink') ||
        lower.contains('nod') ||
        lower.contains('suspicious')) {
      return "Liveness Verification Failed: We couldn't detect your blink or head movement. Please look directly at the camera and perform the prompt.";
    }
    if (lower.contains('not registered') || lower.contains('register face')) {
      return "Face Registration Required: Please complete your one-time selfie profile registration first.";
    }
    if (lower.contains('wifi') ||
        lower.contains('network') ||
        lower.contains('bssid') ||
        lower.contains('subnet')) {
      return "Off-Campus Network: You are not connected to the approved campus Wi-Fi network.";
    }
    if (lower.contains('already registered') ||
        lower.contains('already checked in')) {
      return "Already Checked In: Your attendance for this class session is already verified today.";
    }
    if (lower.contains('closed') || lower.contains('expired')) {
      return "Session Closed: This attendance window has expired or has been closed by your lecturer.";
    }
    if (lower.contains('socketexception') ||
        lower.contains('connection') ||
        lower.contains('timeout')) {
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
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          backgroundColor: isDark ? const Color(0xFF222222) : Colors.white,
          title: Row(
            children: [
              Icon(
                Icons.error_outline_rounded,
                color: Color(0xFFEF4444),
                size: 26,
              ),
              SizedBox(width: 10),
              Text(
                tr('Verification Failed'),
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
            ],
          ),
          content: Text(
            tr(friendlyMsg),
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
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                tr('Got It'),
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
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
          onSettingsPressed: _openSettings,
          onTabSelected: _selectPortal,
        );
        break;
      case 1: // Student Portal
        bodyContent = isStudentLoggedIn
            ? !isFaceRegistered
                  ? FaceRegistrationRequired(
                      studentName: studentName,
                      busy: _registeringFace || _savingFace || isSyncing,
                      onRegister: () => registerFace(context),
                      onLogout: handleStudentLogout,
                      onRefresh: () async {
                        try {
                          await refreshStudentFaceStatus();
                        } catch (error) {
                          if (mounted) {
                            showErrorDialog(_friendlyError(error), context);
                          }
                        }
                      },
                    )
                  : MainScreen(
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
                      onTimetableRefresh: refreshStudentTimetable,
                      onAttendanceRefresh: refreshStudentAttendance,
                      onAnnouncementsRefresh: refreshStudentAnnouncements,
                      onCheckInComplete:
                          (
                            sessId,
                            ssid,
                            courseCode,
                            courseName,
                            imageBase64,
                            livenessPassed, {
                            int? challengeMs,
                            Map<String, dynamic>? extraDetails,
                          }) => submitAttendance(
                            sessId,
                            ssid,
                            courseCode,
                            courseName,
                            imageBase64,
                            livenessPassed,
                            context,
                            challengeMs: challengeMs,
                            extraDetails: extraDetails,
                          ),
                      onRegisterFace: () => registerFace(context),
                      onFaceStatusRefresh: refreshStudentFaceStatus,
                    )
            : LoginScreen(
                portalType: 'student',
                isSyncing: _portalBusy('student'),
                onLogin: (emailOrId, pass, portal) =>
                    handleLogin(emailOrId, pass, portal, context),
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
                onSyncRequested: () =>
                    syncData(context), // Reuses direct check syncs
              )
            : LoginScreen(
                portalType: 'staff',
                isSyncing: _portalBusy('staff'),
                onLogin: (emailOrId, pass, portal) =>
                    handleLogin(emailOrId, pass, portal, context),
                onBackPressed: () => setState(() => selectedTab = 0),
              );
        break;
      default:
        bodyContent = HomeScreen(
          announcements: publicAnnouncements,
          onRefresh: fetchPublicAnnouncements,
          onSettingsPressed: _openSettings,
          onTabSelected: _selectPortal,
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
              key: ValueKey(
                'tab_${selectedTab}_logged_${isStudentLoggedIn || isStaffLoggedIn}',
              ),
              child: bodyContent,
            ),
          ),

          // Loading Overlay (Shimmer Skeleton Screen)
          if (_signingInPortal != null ||
              (isSyncing && !isStudentLoggedIn && !isStaffLoggedIn))
            Positioned.fill(
              child: Container(
                color: isDarkMode
                    ? const Color(0xFF181818)
                    : const Color(0xFFF8FAFC),
                child: SafeArea(
                  child: ShimmerLoading(
                    isLoading: true,
                    // Each portal previews its own dashboard while signing in.
                    child:
                        (_signingInPortal ??
                                (selectedTab == 2 ? 'staff' : 'student')) ==
                            'staff'
                        ? const ShimmerStaffSkeleton()
                        : const ShimmerSkeleton(),
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isStudentLoggedIn && selectedTab == 1 && _offlineRows.isNotEmpty)
            SafeArea(
              top: false,
              child: ListTile(
                leading: const Icon(Icons.sync),
                title: Text(
                  tr('Saved attendance attempts ({_offlineRowsCount})', {
                    '_offlineRowsCount': _offlineRows.length,
                  }),
                ),
                subtitle: Text(
                  tr(_offlineRows.map(_offlineLabel).toSet().join(' · ')),
                  maxLines: 2,
                ),
                onTap: () => showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  useSafeArea: true,
                  builder: (ctx) => OfflineQueueSheet(
                    rows: _offlineRows,
                    onRefresh: () async {
                      await _syncOffline();
                      return _offlineRows;
                    },
                  ),
                ),
              ),
            ),
          _buildBottomNavigationBar(),
        ],
      ),
    );
  }

  Widget _buildBottomNavigationBar() {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = isDarkMode ? const Color(0xFF222222) : Colors.white;
    return Container(
      decoration: BoxDecoration(
        color: surfaceColor,
        border: Border(
          top: BorderSide(
            color: isDarkMode
                ? const Color(0xFF333333)
                : const Color(0xFFE2E8F0),
            width: 1,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: isDarkMode
                ? Colors.black.withValues(alpha: 0.3)
                : const Color(0xFF64748B).withValues(alpha: 0.1),
            blurRadius: 14,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        minimum: const EdgeInsets.only(top: 4),
        child: SizedBox(
          width: double.infinity,
          child: BottomNavigationBar(
            currentIndex: selectedTab,
            onTap: _selectPortal,
            backgroundColor: surfaceColor,
            elevation: 0,
            type: BottomNavigationBarType.fixed,
            selectedFontSize: 12,
            unselectedFontSize: 12,
            selectedItemColor: const Color(0xFF2563EB),
            unselectedItemColor: isDarkMode
                ? const Color(0xFFCBD5E1)
                : const Color(0xFF475569),
            selectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold),
            unselectedLabelStyle: GoogleFonts.inter(
              fontWeight: FontWeight.w500,
            ),
            items: [
              BottomNavigationBarItem(
                icon: Icon(Icons.home_outlined, size: 18),
                activeIcon: Icon(
                  Icons.home,
                  size: 18,
                  color: Color(0xFF2563EB),
                ),
                label: tr('Home'),
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.person_outline, size: 18),
                activeIcon: Icon(
                  Icons.person,
                  size: 18,
                  color: Color(0xFF2563EB),
                ),
                label: tr('Student'),
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.people_outline, size: 18),
                activeIcon: Icon(
                  Icons.people,
                  size: 18,
                  color: Color(0xFF2563EB),
                ),
                label: tr('Staff'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
