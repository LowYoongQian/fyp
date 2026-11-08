// ignore_for_file: deprecated_member_use, use_build_context_synchronously
import '../../i18n/tr.dart';
import '../../widgets/brand_refresh.dart';
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/shimmer_loading.dart';
import '../../main.dart';
import '../system/profile_screen.dart';
import 'attendance_request_screen.dart';
import '../../services/live_updates.dart';
import '../../services/academic_calendar.dart';
import '../../services/user_service.dart';
import '../../widgets/avatar_image.dart';

// -----------------------------------------------------------------
// SCREEN 3: Lecturer/Staff Dashboard widget
// -----------------------------------------------------------------
class StaffDashboard extends StatefulWidget {
  final int staffId;
  final String staffName;
  final String staffCode;
  final String staffEmail;
  final String staffRole;
  final String authToken;
  final String apiBaseUrl;
  final bool isDatabaseOffline;
  final bool isSyncing;
  final VoidCallback onLogout;
  final VoidCallback onSyncRequested;

  const StaffDashboard({
    super.key,
    required this.staffId,
    required this.staffName,
    required this.staffCode,
    required this.staffEmail,
    this.staffRole = 'Staff',
    required this.authToken,
    required this.apiBaseUrl,
    required this.isDatabaseOffline,
    required this.isSyncing,
    required this.onLogout,
    required this.onSyncRequested,
  });

  @override
  State<StaffDashboard> createState() => _StaffDashboardState();
}

class _StaffDashboardState extends State<StaffDashboard> {
  bool isLoading = true;
  String? loadError;

  List<dynamic> myTimetable = [];
  List<dynamic> myActiveSessions = [];
  List<dynamic> todayClasses = [];
  List<dynamic> classesNeedingAttention = [];
  List<dynamic> myCourses = [];
  List<dynamic> courseSessionsHistory = [];
  bool isFetchingHistory = false;

  int historyCurrentPage = 1;
  int historyPageSize = 4;
  int _dashboardTabIndex = 0;
  int _tabTransitionDirection = 1;
  double _tabDragOffset = 0;
  bool _isTabDragging = false;
  int _reviewPage = 0;
  static const int _reviewPageSize = 2;
  String _reviewCourseFilter = 'All';
  String _reviewGroupFilter = 'Any';

  String? selectedCourseId;
  String selectedGroup = 'All';

  Timer? _poller;
  bool _pollInProgress = false;
  LiveUpdates? _live;
  DateTime _lastRefresh = DateTime.now();
  final Set<String> _pendingTopics = {};

  String? _avatarUrl;

  String get _timetableCacheKey => 'cached_staff_${widget.staffId}_timetable';
  String get _coursesCacheKey => 'cached_staff_${widget.staffId}_courses';

  @override
  void initState() {
    super.initState();
    loadLecturerData();
    _loadAvatar();
    _startLive();
    _poller = Timer.periodic(const Duration(seconds: 10), (_) {
      if (_live?.foreground != false && (_live?.connected != true || DateTime.now().difference(_lastRefresh).inSeconds >= 60)) {
        unawaited(_pollDashboardData());
      }
    });
  }

  @override
  void dispose() {
    _poller?.cancel();
    _live?.dispose();
    super.dispose();
  }

  Future<void> loadLecturerData() async {
    if (!mounted) return;
    setState(() {
      isLoading = true;
      loadError = null;
    });

    final hadCache = await _loadCachedLecturerData();
    if (hadCache && mounted) setState(() => isLoading = false);

    try {
      await Future.wait([
        fetchTimetable(),
        fetchMyCourses(),
        fetchActiveSessions(),
        fetchTodayClasses(),
        fetchClassesNeedingAttention(),
      ]);
    } catch (e) {
      debugPrint("Error loading lecturer data: $e");
      if (mounted) {
        setState(() {
          loadError = "Network error loading data. Showing cached view.";
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          isLoading = false;
        });
      }
    }
  }

  /// The profile photo saved on the account, so the header shows the same picture as the web.
  Future<void> _loadAvatar() async {
    final profile = await UserService.fetchUserProfile(authToken: widget.authToken, apiBaseUrl: widget.apiBaseUrl);
    if (mounted && profile != null) setState(() => _avatarUrl = profile['avatar_url']?.toString());
  }

  Future<bool> _loadCachedLecturerData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final timetableRaw = prefs.getString(_timetableCacheKey);
      final coursesRaw = prefs.getString(_coursesCacheKey);
      if (timetableRaw == null && coursesRaw == null) return false;

      final cachedTimetable = timetableRaw == null
          ? <dynamic>[]
          : jsonDecode(timetableRaw) as List<dynamic>;
      final cachedCourses = coursesRaw == null
          ? <dynamic>[]
          : jsonDecode(coursesRaw) as List<dynamic>;
      if (!mounted) return false;
      setState(() {
        myTimetable = cachedTimetable;
        myCourses = cachedCourses;
        if (myCourses.isNotEmpty &&
            (selectedCourseId == null || selectedCourseId!.isEmpty)) {
          selectedCourseId =
              myCourses[0]['id']?.toString() ??
              myCourses[0]['course_id']?.toString();
        }
      });
      return true;
    } catch (e) {
      debugPrint('Failed to load lecturer cache: $e');
      return false;
    }
  }

  Future<void> fetchTimetable() async {
    final uri = Uri.parse("${widget.apiBaseUrl}/lecturers/me/timetable");
    final response = await http
        .get(
          uri,
          headers: {
            "Authorization": "Bearer ${widget.authToken}",
            "Content-Type": "application/json",
          },
        )
        .timeout(const Duration(seconds: 8));

    if (response.statusCode != 200) return;
    final List<dynamic> data = jsonDecode(response.body);
    final timetable = data
        .map(
          (t) => {
            'id': t['id'],
            'courseId': t['course_id'] ?? t['courseId'] ?? '',
            'course_id': t['course_id'] ?? t['courseId'] ?? '',
            'courseCode': t['course_code'] ?? t['courseCode'] ?? '',
            'semester': t['semester'],
            'course_code': t['course_code'] ?? t['courseCode'] ?? '',
            'courseName': t['course_name'] ?? t['courseName'] ?? '',
            'course_name': t['course_name'] ?? t['courseName'] ?? '',
            'day': t['schedule_day'] ?? t['day'] ?? 'Monday',
            'startTime': t['schedule_start'] ?? t['startTime'] ?? '08:00',
            'endTime': t['schedule_end'] ?? t['endTime'] ?? '10:00',
            'room': t['schedule_room'] ?? t['room'] ?? 'TBA',
            'role': t['role'] ?? 'Lecture',
            'classGroup': t['class_group'] ?? t['classGroup'] ?? 'All',
          },
        )
        .toList();
    if (mounted) setState(() => myTimetable = timetable);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_timetableCacheKey, jsonEncode(timetable));
  }

  Future<void> fetchTodayClasses() async {
    final response = await http
        .get(
          Uri.parse("${widget.apiBaseUrl}/sessions/today"),
          headers: {
            "Authorization": "Bearer ${widget.authToken}",
            "Content-Type": "application/json",
          },
        )
        .timeout(const Duration(seconds: 8));
    if (response.statusCode == 200 && mounted) {
      setState(() => todayClasses = jsonDecode(response.body) as List<dynamic>);
    }
  }

  Future<void> fetchClassesNeedingAttention() async {
    final response = await http
        .get(
          Uri.parse("${widget.apiBaseUrl}/sessions/needs-attention"),
          headers: {
            "Authorization": "Bearer ${widget.authToken}",
            "Content-Type": "application/json",
          },
        )
        .timeout(const Duration(seconds: 8));
    if (response.statusCode == 200 && mounted) {
      setState(
        () => classesNeedingAttention =
            jsonDecode(response.body) as List<dynamic>,
      );
    }
  }

  Future<void> _openTodayClass(Map<String, dynamic> lesson) async {
    final response = await http.post(
      Uri.parse("${widget.apiBaseUrl}/sessions/${lesson['id']}/open"),
      headers: {"Authorization": "Bearer ${widget.authToken}"},
    );
    if (!mounted) return;
    if (response.statusCode == 200) {
      await Future.wait([fetchTodayClasses(), fetchActiveSessions()]);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            tr('Class opened. Sign-in follows the scheduled class time.'),
          ),
          backgroundColor: Color(0xFF059669),
        ),
      );
    } else {
      final error = jsonDecode(response.body);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tr(error['detail'] ?? 'Could not open class.')),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
    }
  }

  Future<void> _cancelTodayClass(Map<String, dynamic> lesson) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(tr('Cancel class')),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 5,
          maxLength: 1000,
          decoration: InputDecoration(labelText: tr('Reason')),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(tr('Back')),
          ),
          FilledButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.length >= 3) Navigator.pop(dialogContext, value);
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
            ),
            child: Text(tr('Cancel class')),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null) return;
    final response = await http.post(
      Uri.parse("${widget.apiBaseUrl}/sessions/${lesson['id']}/cancel"),
      headers: {
        "Authorization": "Bearer ${widget.authToken}",
        "Content-Type": "application/json",
      },
      body: jsonEncode({'reason': reason}),
    );
    if (!mounted) return;
    if (response.statusCode == 200) {
      await Future.wait([fetchTodayClasses(), fetchClassesNeedingAttention()]);
      if (!mounted) return;
      final addReplacement = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(tr('Class cancelled')),
          content: Text(tr('Add a replacement class now?')),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(tr('Done')),
            ),
            FilledButton.icon(
              onPressed: () => Navigator.pop(dialogContext, true),
              icon: const Icon(Icons.event_repeat),
              label: Text(tr('Add Replacement')),
            ),
          ],
        ),
      );
      if (addReplacement == true && mounted) {
        await _arrangeReplacement(lesson);
      }
    } else {
      final error = jsonDecode(response.body);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr(error['detail'] ?? 'Could not cancel class.'))),
      );
    }
  }

  Future<void> _markClassHeld(Map<String, dynamic> lesson) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(tr('Class held?')),
        content: Text(
          tr('This completes the class and lets you correct student attendance.'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(tr('Back')),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(dialogContext, true),
            icon: const Icon(Icons.check_circle_outline),
            label: Text(tr('Class Held')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final response = await http.post(
      Uri.parse("${widget.apiBaseUrl}/sessions/${lesson['id']}/held"),
      headers: {"Authorization": "Bearer ${widget.authToken}"},
    );
    if (!mounted) return;
    if (response.statusCode == 200) {
      await Future.wait([fetchTodayClasses(), fetchClassesNeedingAttention()]);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            tr('Class completed. Open Attendance to correct student records.'),
          ),
          backgroundColor: Color(0xFF059669),
        ),
      );
    } else {
      final error = jsonDecode(response.body);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tr(error['detail'] ?? 'Could not resolve class.')),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
    }
  }

  Future<void> _arrangeReplacement(Map<String, dynamic> lesson) async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 180)),
    );
    if (date == null || !mounted) return;
    final startTime = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 9, minute: 0),
    );
    if (startTime == null || !mounted) return;
    final endTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: (startTime.hour + 2).clamp(0, 23),
        minute: startTime.minute,
      ),
    );
    if (endTime == null || !mounted) return;
    final start = DateTime(
      date.year,
      date.month,
      date.day,
      startTime.hour,
      startTime.minute,
    );
    final end = DateTime(
      date.year,
      date.month,
      date.day,
      endTime.hour,
      endTime.minute,
    );
    if (!end.isAfter(start)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('End time must be after start time.'))),
      );
      return;
    }
    final roomController = TextEditingController();
    final room = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(tr('Replacement room')),
        content: TextField(
          controller: roomController,
          maxLength: 200,
          decoration: InputDecoration(labelText: tr('Room')),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(tr('Back')),
          ),
          FilledButton(
            onPressed: () {
              final value = roomController.text.trim();
              if (value.isNotEmpty) Navigator.pop(dialogContext, value);
            },
            child: Text(tr('Arrange class')),
          ),
        ],
      ),
    );
    roomController.dispose();
    if (room == null) return;
    final response = await http.post(
      Uri.parse("${widget.apiBaseUrl}/sessions/${lesson['id']}/replacement"),
      headers: {
        "Authorization": "Bearer ${widget.authToken}",
        "Content-Type": "application/json",
      },
      body: jsonEncode({
        'scheduled_start': start.toUtc().toIso8601String(),
        'scheduled_end': end.toUtc().toIso8601String(),
        'room': room,
      }),
    );
    if (!mounted) return;
    if (response.statusCode == 201) {
      await fetchTodayClasses();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            tr('Replacement class arranged. Students and administrators were notified.'),
          ),
          backgroundColor: Color(0xFF059669),
        ),
      );
    } else {
      final error = jsonDecode(response.body);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            tr(error['detail'] ?? 'Could not arrange replacement class.'),
          ),
        ),
      );
    }
  }

  Widget _staffHero(bool isDarkMode) {
    final name = widget.staffName.trim();
    final initials = (name.isEmpty ? 'S' : name.substring(0, name.length >= 2 ? 2 : name.length)).toUpperCase();
    final hour = ApiConfig.now.hour;
    final greeting = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
    final photo = avatarImage(_avatarUrl);
    final textColor = isDarkMode ? Colors.white : const Color(0xFF0F172A);
    final mutedColor = isDarkMode ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    final lineColor = isDarkMode ? const Color(0xFF333333) : const Color(0xFFE2E8F0);
    final accent = isDarkMode ? const Color(0xFF60A5FA) : const Color(0xFF2563EB);
    Widget pill(String text, IconData icon) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
          decoration: BoxDecoration(
            color: isDarkMode ? const Color(0xFF2D2D2D) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 12, color: mutedColor),
            const SizedBox(width: 4),
            Text(tr(text), style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: textColor)),
          ]),
        );
    Widget stat(int value, String label, IconData icon, Color color) => Expanded(
          child: Semantics(
            label: '$value $label',
            excludeSemantics: true,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
              decoration: BoxDecoration(
                color: isDarkMode ? const Color(0xFF2D2D2D) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: lineColor),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: isDarkMode ? 0.18 : 0.10),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, size: 14, color: color),
                  ),
                  const SizedBox(width: 8),
                  Text('$value', style: GoogleFonts.spaceGrotesk(fontSize: 17, height: 1.1, fontWeight: FontWeight.w800, color: textColor)),
                ]),
                const SizedBox(height: 6),
                Text(tr(label), maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: mutedColor)),
              ]),
            ),
          ),
        );
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDarkMode ? const Color(0xFF222222) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: lineColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDarkMode ? 0.16 : 0.05),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: accent.withValues(alpha: 0.45), width: 2)),
            child: CircleAvatar(
              radius: 25,
              backgroundColor: isDarkMode ? const Color(0xFF2D2D2D) : const Color(0xFFEFF6FF),
              backgroundImage: photo,
              onBackgroundImageError: photo == null ? null : (error, stack) {},
              child: photo == null
                  ? Text(tr(initials), style: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.w800, color: accent))
                  : null,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(greeting), style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: mutedColor)),
              Text(tr(widget.staffName), maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.spaceGrotesk(fontSize: 19, fontWeight: FontWeight.w800, color: textColor)),
              Text(tr(widget.staffEmail), maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(fontSize: 11.5, color: mutedColor)),
            ]),
          ),
        ]),
        const SizedBox(height: 12),
        Wrap(spacing: 6, runSpacing: 6, children: [
          pill(widget.staffRole, Icons.badge_outlined),
          pill(tr('Staff ID {code}', {'code': widget.staffCode}), Icons.tag_rounded),
        ]),
        const SizedBox(height: 14),
        Divider(height: 1, color: lineColor),
        const SizedBox(height: 14),
        Row(children: [
          stat(todayClasses.length, 'Today', Icons.today_rounded, const Color(0xFF2563EB)),
          const SizedBox(width: 8),
          stat(classesNeedingAttention.length, 'To review', Icons.pending_actions_rounded, const Color(0xFFD97706)),
          const SizedBox(width: 8),
          stat(myActiveSessions.length, 'Live gates', Icons.sensors_rounded, const Color(0xFF10B981)),
        ]),
      ]),
    );
  }

  /// One section heading style for the whole dashboard: a tinted icon chip, the title, and an optional action.
  Widget _sectionTitle(String title, IconData icon, Color color, Color textColor, bool isDarkMode, {Widget? trailing}) {
    return Row(children: [
      Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: color.withValues(alpha: isDarkMode ? 0.18 : 0.12),
          borderRadius: BorderRadius.circular(9),
        ),
        child: Icon(icon, size: 16, color: color),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Text(tr(title), style: GoogleFonts.spaceGrotesk(fontSize: 15, fontWeight: FontWeight.bold, color: textColor)),
      ),
      ?trailing,
    ]);
  }

  /// Label and colour for a class status, used by the status pill on each class card.
  (String, Color) _statusLook(String status) => switch (status) {
        'open' => ('Sign-in open', const Color(0xFF10B981)),
        'completed' => ('Completed', const Color(0xFF64748B)),
        'needs_attention' => ('Needs review', const Color(0xFFD97706)),
        'cancelled' => ('Cancelled', const Color(0xFFDC2626)),
        _ => ('Scheduled', const Color(0xFF2563EB)),
      };

  Widget _dashboardTabs(bool isDarkMode) {
    return Container(
      height: 44,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDarkMode ? const Color(0xFF222222) : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDarkMode ? const Color(0xFF333333) : const Color(0xFFE2E8F0),
        ),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final tabWidth = constraints.maxWidth / 2;
          return Stack(
            children: [
              AnimatedPositioned(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeInOut,
                left: _dashboardTabIndex * tabWidth,
                width: tabWidth,
                top: 0,
                bottom: 0,
                child: Container(
                  decoration: BoxDecoration(
                    color: isDarkMode
                        ? const Color(0xFF333333)
                        : Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(
                          alpha: isDarkMode ? 0.2 : 0.04,
                        ),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                ),
              ),
              Row(
                children: [
                  _dashboardTab(
                    0,
                    'Classes',
                    Icons.calendar_month_outlined,
                    isDarkMode,
                  ),
                  _dashboardTab(
                    1,
                    'Attendance',
                    Icons.fact_check_outlined,
                    isDarkMode,
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  void _handleTabSwipeStart(DragStartDetails details) {
    setState(() => _isTabDragging = true);
  }

  void _handleTabSwipeUpdate(DragUpdateDetails details) {
    final delta = details.primaryDelta ?? 0;
    if ((_dashboardTabIndex == 0 && delta > 0) ||
        (_dashboardTabIndex == 1 && delta < 0)) {
      return;
    }
    setState(() {
      _tabDragOffset = (_tabDragOffset + delta).clamp(-90.0, 90.0);
    });
  }

  void _handleTabSwipe(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    final moveForward = velocity < -220 || _tabDragOffset < -55;
    final moveBack = velocity > 220 || _tabDragOffset > 55;
    if (moveForward && _dashboardTabIndex == 0) {
      _selectDashboardTab(1);
    } else if (moveBack && _dashboardTabIndex == 1) {
      _selectDashboardTab(0);
    }
    if (mounted) {
      setState(() {
        _isTabDragging = false;
        _tabDragOffset = 0;
      });
    }
  }

  void _handleTabSwipeCancel() {
    setState(() {
      _isTabDragging = false;
      _tabDragOffset = 0;
    });
  }

  void _selectDashboardTab(int index) {
    if (index == _dashboardTabIndex) return;
    setState(() {
      _tabTransitionDirection = index > _dashboardTabIndex ? 1 : -1;
      _dashboardTabIndex = index;
    });
  }

  Widget _dashboardTab(int index, String label, IconData icon, bool isDarkMode) {
    final selected = _dashboardTabIndex == index;
    return Expanded(
      child: InkWell(
        onTap: () => _selectDashboardTab(index),
        borderRadius: BorderRadius.circular(9),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: selected ? const Color(0xFF2563EB) : const Color(0xFF94A3B8)),
              const SizedBox(width: 7),
              Text(
                tr(label),
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? (isDarkMode ? Colors.white : const Color(0xFF1E293B))
                      : const Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _todayClassesSection(
    Color primaryTextColor,
    Color secondaryTextColor,
    bool isDarkMode,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(
          "Today's Classes",
          Icons.today_rounded,
          const Color(0xFF2563EB),
          primaryTextColor,
          isDarkMode,
          trailing: IconButton(
            tooltip: tr('Refresh classes'),
            onPressed: fetchTodayClasses,
            icon: const Icon(Icons.refresh, size: 18),
          ),
        ),
        const SizedBox(height: 6),
        if (todayClasses.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
            decoration: BoxDecoration(
              color: isDarkMode ? const Color(0xFF222222) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: isDarkMode ? const Color(0xFF333333) : const Color(0xFFE2E8F0)),
            ),
            child: Column(children: [
              Icon(Icons.free_breakfast_outlined, size: 26, color: secondaryTextColor),
              const SizedBox(height: 8),
              Text(
                tr('No classes scheduled today.'),
                style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.w600, color: secondaryTextColor),
              ),
            ]),
          )
        else
          ...todayClasses.map((raw) {
            final lesson = Map<String, dynamic>.from(raw as Map);
            final status = (lesson['status'] ?? 'scheduled').toString();
            final start = DateTime.tryParse(
              (lesson['scheduled_start'] ?? '').toString(),
            )?.toLocal();
            final end = DateTime.tryParse(
              (lesson['scheduled_end'] ?? '').toString(),
            )?.toLocal();
            final time = start == null || end == null
                ? ''
                : '${TimeOfDay.fromDateTime(start).format(context)} - ${TimeOfDay.fromDateTime(end).format(context)}';
            final (statusLabel, statusColor) = _statusLook(status);
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDarkMode ? const Color(0xFF222222) : Colors.white,
                border: Border.all(
                  color: isDarkMode
                      ? const Color(0xFF333333)
                      : const Color(0xFFE2E8F0),
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: isDarkMode ? 0.12 : 0.04),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: isDarkMode ? 0.18 : 0.10),
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Icon(
                          lesson['role'] == 'Lecture' ? Icons.co_present_outlined : Icons.groups_outlined,
                          size: 19,
                          color: statusColor,
                        ),
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${lesson['course_code']} · ${tr(lesson['role'])} ${lesson['class_group'] == 'All' ? '' : lesson['class_group']}',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: primaryTextColor,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${lesson['course_name']}',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: secondaryTextColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: isDarkMode ? 0.2 : 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          tr(statusLabel),
                          style: GoogleFonts.inter(
                            fontSize: 11.5,
                            fontWeight: FontWeight.bold,
                            color: isDarkMode ? Color.lerp(statusColor, Colors.white, 0.35) : statusColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 14,
                    runSpacing: 4,
                    children: [
                      if (time.isNotEmpty)
                        Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.schedule_rounded, size: 14, color: secondaryTextColor),
                          const SizedBox(width: 4),
                          Text(tr(time), style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w600, color: secondaryTextColor)),
                        ]),
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.room_outlined, size: 14, color: secondaryTextColor),
                        const SizedBox(width: 4),
                        Text('${lesson['room'] ?? 'Room TBA'}', style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w600, color: secondaryTextColor)),
                      ]),
                    ],
                  ),
                  if (lesson['cancel_reason'] != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${lesson['cancel_reason']}',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: const Color(0xFFDC2626),
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (status == 'scheduled')
                        FilledButton.icon(
                          onPressed: () => _openTodayClass(lesson),
                          icon: const Icon(Icons.play_arrow, size: 16),
                          label: Text(tr('Open Class')),
                        ),
                      if (status == 'scheduled' || status == 'needs_attention')
                        OutlinedButton.icon(
                          onPressed: () => _cancelTodayClass(lesson),
                          icon: const Icon(Icons.event_busy, size: 16),
                          label: Text(tr('Cancel Class')),
                        ),
                      if (status == 'needs_attention')
                        FilledButton.icon(
                          onPressed: () => _markClassHeld(lesson),
                          icon: const Icon(
                            Icons.check_circle_outline,
                            size: 16,
                          ),
                          label: Text(tr('Class Held')),
                        ),
                      if (status == 'cancelled')
                        OutlinedButton.icon(
                          onPressed: () => _arrangeReplacement(lesson),
                          icon: const Icon(Icons.event_repeat, size: 16),
                          label: Text(tr('Arrange Replacement')),
                        ),
                    ],
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _classesNeedingReviewSection(
    Color primaryTextColor,
    Color secondaryTextColor,
    bool isDarkMode,
  ) {
    final todayIds = todayClasses.map((item) => '${item['id']}').toSet();
    final reviews = classesNeedingAttention
        .where((item) => !todayIds.contains('${item['id']}'))
        .toList();
    if (reviews.isEmpty) return const SizedBox.shrink();
    final courseCodes = reviews
        .map((item) => '${item['course_code']}')
        .where((code) => code.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    final effectiveReviewFilter = courseCodes.contains(_reviewCourseFilter)
        ? _reviewCourseFilter
        : 'All';
    final courseFilteredReviews = effectiveReviewFilter == 'All'
        ? reviews
        : reviews.where((item) => '${item['course_code']}' == effectiveReviewFilter).toList();
    final groupCodes = courseFilteredReviews
        .map((item) => '${item['class_group'] ?? 'All'}')
        .toSet()
        .toList()
      ..sort();
    final effectiveGroupFilter = groupCodes.contains(_reviewGroupFilter)
        ? _reviewGroupFilter
        : 'Any';
    final filteredReviews = effectiveGroupFilter == 'Any'
        ? courseFilteredReviews
        : courseFilteredReviews
            .where((item) => '${item['class_group'] ?? 'All'}' == effectiveGroupFilter)
            .toList();
    final pageCount = filteredReviews.isEmpty
        ? 1
        : (filteredReviews.length / _reviewPageSize).ceil();
    final safePage = _reviewPage >= pageCount ? pageCount - 1 : _reviewPage;
    final pageReviews = filteredReviews
        .skip(safePage * _reviewPageSize)
        .take(_reviewPageSize)
        .toList();
    Widget filterSelect({
      required String value,
      required List<String> items,
      required IconData icon,
      required String Function(String) label,
      required ValueChanged<String?> onChanged,
    }) {
      return Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: isDarkMode ? const Color(0xFF222222) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: isDarkMode ? const Color(0xFF404040) : const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: const Color(0xFF64748B)),
            const SizedBox(width: 7),
            Expanded(
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: value,
                  isExpanded: true,
                  dropdownColor: isDarkMode ? const Color(0xFF222222) : Colors.white,
                  icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18),
                  style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w600, color: primaryTextColor),
                  items: items.map((item) => DropdownMenuItem(value: item, child: Text(tr(label(item)), overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: onChanged,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDarkMode ? const Color(0xFF222222) : Colors.white,
        border: Border.all(
          color: isDarkMode ? const Color(0xFF333333) : const Color(0xFFE2E8F0),
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDarkMode ? 0.14 : 0.04),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Icon(
                  Icons.pending_actions_outlined,
                  size: 18,
                  color: Color(0xFFD97706),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr('Classes to review'),
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: primaryTextColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      tr('{filteredReviewsCount} pending confirmation', {'filteredReviewsCount': filteredReviews.length}),
                      style: GoogleFonts.inter(fontSize: 11, color: secondaryTextColor),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${reviews.length}',
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFFD97706)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            tr('Confirm classes that happened, or cancel those that did not.'),
            style: GoogleFonts.inter(fontSize: 11, color: secondaryTextColor),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: filterSelect(
                  value: effectiveReviewFilter,
                  items: ['All', ...courseCodes],
                  icon: Icons.menu_book_outlined,
                  label: (value) => value == 'All' ? 'All classes' : value,
                  onChanged: (value) => setState(() {
                    _reviewCourseFilter = value ?? 'All';
                    _reviewGroupFilter = 'Any';
                    _reviewPage = 0;
                  }),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: filterSelect(
                  value: effectiveGroupFilter,
                  items: ['Any', ...groupCodes],
                  icon: Icons.groups_outlined,
                  label: (value) => value == 'Any'
                      ? 'All groups'
                      : value == 'All'
                          ? 'Lecture'
                          : value,
                  onChanged: (value) => setState(() {
                    _reviewGroupFilter = value ?? 'Any';
                    _reviewPage = 0;
                  }),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ...pageReviews.map((raw) {
            final lesson = Map<String, dynamic>.from(raw as Map);
            final start = DateTime.tryParse(
              (lesson['scheduled_start'] ?? '').toString(),
            )?.toLocal();
            return Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDarkMode ? const Color(0xFF222222) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDarkMode
                      ? const Color(0xFF404040)
                      : const Color(0xFFE2E8F0),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${lesson['course_code']} · ${tr(lesson['role'])} ${lesson['class_group'] == 'All' ? '' : lesson['class_group']}',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: primaryTextColor,
                          ),
                        ),
                      ),
                      if (lesson['escalated'] == true)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEF4444).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            tr('OVERDUE'),
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFFDC2626),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${start == null ? 'Previous class' : MaterialLocalizations.of(context).formatMediumDate(start)} · ${lesson['room'] ?? 'Room TBA'}',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: secondaryTextColor,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => _markClassHeld(lesson),
                          icon: const Icon(Icons.check_circle_outline, size: 15),
                          label: Text(tr('Class Held')),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _cancelTodayClass(lesson),
                          icon: const Icon(Icons.event_busy, size: 15),
                          label: Text(tr('Cancel Class')),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
          if (filteredReviews.length > _reviewPageSize) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Text(
                  tr('{v}-{v2} of {filteredReviewsCount}', {'v': safePage * _reviewPageSize + 1, 'v2': (safePage * _reviewPageSize + pageReviews.length), 'filteredReviewsCount': filteredReviews.length}),
                  style: GoogleFonts.inter(fontSize: 11, color: secondaryTextColor),
                ),
                const Spacer(),
                IconButton(
                  tooltip: tr('Previous page'),
                  onPressed: safePage > 0 ? () => setState(() => _reviewPage = safePage - 1) : null,
                  icon: const Icon(Icons.chevron_left, size: 18),
                ),
                Text('${safePage + 1} / $pageCount', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold)),
                IconButton(
                  tooltip: tr('Next page'),
                  onPressed: safePage + 1 < pageCount ? () => setState(() => _reviewPage = safePage + 1) : null,
                  icon: const Icon(Icons.chevron_right, size: 18),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  void _startLive() {
    _live?.dispose();
    _live = LiveUpdates(baseUrl: widget.apiBaseUrl, token: widget.authToken,
        onTopics: (topics) => _pollDashboardData(topics: topics));
  }

  @override
  void didUpdateWidget(covariant StaffDashboard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.authToken != widget.authToken || oldWidget.apiBaseUrl != widget.apiBaseUrl) _startLive();
  }

  Future<void> _pollDashboardData({Set<String>? topics}) async {
    _pendingTopics.addAll(topics ?? {'timetable', 'sessions', 'attendance'});
    if (!mounted || _pollInProgress) return;
    _pollInProgress = true;
    try {
      while (mounted && _pendingTopics.isNotEmpty) {
        final changed = Set<String>.from(_pendingTopics);
        _pendingTopics.clear();
        if (changed.containsAll({'timetable', 'sessions', 'attendance'})) _lastRefresh = DateTime.now();
        await Future.wait([
          if (changed.contains('timetable')) fetchTimetable(),
          if (changed.contains('timetable')) fetchMyCourses(),
          if (changed.contains('sessions') || changed.contains('attendance')) ...[
            fetchActiveSessions(), fetchTodayClasses(), fetchClassesNeedingAttention(),
          ],
          if (changed.contains('attendance') && selectedCourseId != null) fetchCourseSessions(selectedCourseId!, silent: true),
        ]);
      }
    } finally {
      _pollInProgress = false;
    }
  }

  Future<void> fetchActiveSessions() async {
    try {
      final uri = Uri.parse("${widget.apiBaseUrl}/sessions/active");
      final res = await http
          .get(uri, headers: {"Authorization": "Bearer ${widget.authToken}"})
          .timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        // /sessions/active already filters by lecturer server-side
        // (owned-or-assigned), so no client-side filter is needed.
        final List<dynamic> data = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            myActiveSessions = data;
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching active sessions: $e");
    }
  }

  Future<void> fetchMyCourses() async {
    try {
      final uri = Uri.parse("${widget.apiBaseUrl}/lecturers/me/courses");
      final res = await http
          .get(
            uri,
            headers: {
              "Authorization": "Bearer ${widget.authToken}",
              "Content-Type": "application/json",
            },
          )
          .timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final List<dynamic> data = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            myCourses = data;
            if (myCourses.isNotEmpty &&
                (selectedCourseId == null || selectedCourseId!.isEmpty)) {
              selectedCourseId =
                  myCourses[0]['id']?.toString() ??
                  myCourses[0]['course_id']?.toString();
            }
          });
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_coursesCacheKey, jsonEncode(data));
          if (selectedCourseId != null && selectedCourseId!.isNotEmpty) {
            await fetchCourseSessions(selectedCourseId!);
          }
        }
      }
    } catch (e) {
      debugPrint("Error fetching lecturer courses: $e");
    }
  }

  Future<void> fetchCourseSessions(String courseId, {bool silent = false}) async {
    if (!mounted) return;
    if (!silent) setState(() { isFetchingHistory = true; });

    try {
      final uri = Uri.parse(
        "${widget.apiBaseUrl}/sessions/course/$courseId/sessions",
      );
      final res = await http
          .get(
            uri,
            headers: {
              "Authorization": "Bearer ${widget.authToken}",
              "Content-Type": "application/json",
            },
          )
          .timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final List<dynamic> data = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            courseSessionsHistory = data;
            if (!silent) historyCurrentPage = 1;
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching course sessions history: $e");
    } finally {
      if (mounted) {
        setState(() {
          isFetchingHistory = false;
        });
      }
    }
  }

  String _formatDateTimeStr(String isoString) {
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return "${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}";
    } catch (_) {
      return isoString;
    }
  }

  List<int> _getSmartPageNumbers(int current, int total) {
    if (total <= 4) {
      return List.generate(total, (i) => i + 1);
    }
    if (current <= 2) {
      return [1, 2, 3, total];
    } else if (current >= total - 1) {
      return [1, total - 2, total - 1, total];
    } else {
      return [1, current, total];
    }
  }

  List<Map<String, String>> _getAvailableCourses() {
    final list = <Map<String, String>>[];
    final seen = <String>{};

    if (myCourses.isNotEmpty) {
      for (final c in myCourses) {
        final id = c['id']?.toString() ?? c['course_id']?.toString() ?? '';
        if (id.isNotEmpty && !seen.contains(id)) {
          seen.add(id);
          list.add({
            'id': id,
            'code': c['course_code']?.toString() ?? id,
            'name': c['course_name']?.toString() ?? 'Course',
          });
        }
      }
    }

    if (list.isEmpty && myTimetable.isNotEmpty) {
      for (final t in myTimetable) {
        final id =
            t['courseId']?.toString() ?? t['course_id']?.toString() ?? '';
        if (id.isNotEmpty && !seen.contains(id)) {
          seen.add(id);
          list.add({
            'id': id,
            'code':
                t['courseCode']?.toString() ??
                t['course_code']?.toString() ??
                id,
            'name':
                t['courseName']?.toString() ??
                t['course_name']?.toString() ??
                'Course',
          });
        }
      }
    }

    return list;
  }

  Future<void> launchCourseSession(String courseId, String group) async {
    final status = _getCourseScheduleStatus(courseId, group);
    if (!(status['canStart'] as bool)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tr(status['hintText'] as String)),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
      return;
    }

    try {
      final uri = Uri.parse("${widget.apiBaseUrl}/sessions/open");
      final body = jsonEncode({"course_id": courseId, "class_group": group});

      final res = await http.post(
        uri,
        headers: {
          "Authorization": "Bearer ${widget.authToken}",
          "Content-Type": "application/json",
        },
        body: body,
      );

      if (res.statusCode == 200 || res.statusCode == 201) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(tr('Attendance gate successfully opened for {group}!', {'group': group})),
              backgroundColor: const Color(0xFF059669),
            ),
          );
        }
        await fetchActiveSessions();
      } else {
        final err = jsonDecode(res.body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(tr(err['detail'] ?? "Failed to open attendance gate")),
              backgroundColor: const Color(0xFFDC2626),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('Network error opening session: {e}', {'e': e})),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    }
  }

  Future<void> showManualRosterModal(String courseId, String group) async {
    var activeSession = myActiveSessions.firstWhere(
      (s) => s['courseId'] == courseId || s['course_id'] == courseId,
      orElse: () => null,
    );

    if (activeSession == null) {
      try {
        final uri = Uri.parse("${widget.apiBaseUrl}/sessions/open");
        final res = await http.post(
          uri,
          headers: {
            "Authorization": "Bearer ${widget.authToken}",
            "Content-Type": "application/json",
          },
          body: jsonEncode({"course_id": courseId, "class_group": group}),
        );
        if (res.statusCode == 200 || res.statusCode == 201) {
          final data = jsonDecode(res.body);
          activeSession = data;
          await fetchActiveSessions();
        }
      } catch (e) {
        debugPrint("Error opening session for roster: $e");
      }
    }

    if (activeSession != null) {
      final sessionId = activeSession['id'];
      final courseCode =
          activeSession['courseCode'] ??
          activeSession['course_code'] ??
          courseId;
      _showAttendeesModal(context, sessionId, courseCode);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              tr('Could not initialize session roster. Please try opening gate first.'),
            ),
            backgroundColor: Color(0xFFDC2626),
          ),
        );
      }
    }
  }

  Future<void> handleOpenSession(Map<String, dynamic> slot) async {
    final now = ApiConfig.now;
    final startDt = slot['startDateTime'] as DateTime;

    final diff = startDt.difference(now);
    if (diff.inMinutes > 60) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            tr('Cannot open gate yet. Session opens 1 hour before class ({v}:{v2}).', {'v': startDt.hour.toString().padLeft(2, '0'), 'v2': startDt.minute.toString().padLeft(2, '0')}),
          ),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
      return;
    }

    try {
      final uri = Uri.parse("${widget.apiBaseUrl}/sessions/open");
      final body = jsonEncode({
        "course_id": slot['courseId'] ?? slot['course_id'],
        "class_group": slot['role'] == 'Lecture'
            ? 'All'
            : (slot['classGroup'] ?? 'All'),
      });

      final res = await http.post(
        uri,
        headers: {
          "Authorization": "Bearer ${widget.authToken}",
          "Content-Type": "application/json",
        },
        body: body,
      );

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                tr(data['message'] ?? "Attendance gate successfully opened!"),
              ),
              backgroundColor: const Color(0xFF059669),
            ),
          );
        }
        await fetchActiveSessions();
      } else {
        final err = jsonDecode(res.body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(tr(err['detail'] ?? "Failed to open attendance gate")),
              backgroundColor: const Color(0xFFDC2626),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('Network error: {e}', {'e': e})),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    }
  }

  Map<String, dynamic> _getCourseScheduleStatus(
    String? courseId,
    String group,
  ) {
    if (courseId == null || courseId.isEmpty) {
      return {
        'canStart': false,
        'statusText': 'Select Course',
        'hintText': 'Please select a course first.',
      };
    }
    final now = ApiConfig.now;

    final matchingSlots = myTimetable.where((slot) {
      final cId = slot['courseId'] ?? slot['course_id'];
      if (cId != courseId) return false;
      if (group == 'All') return true;
      final grp = slot['classGroup'] ?? slot['class_group'] ?? 'All';
      return grp == 'All' ||
          grp == group ||
          group.contains(grp) ||
          grp.contains(group);
    }).toList();

    if (matchingSlots.isEmpty) {
      return {
        'canStart': true,
        'statusText': '🟢 Ready to Launch',
        'hintText': 'Course gate can be launched.',
      };
    }

    for (final slot in matchingSlots) {
      final dayName = slot['day'] as String;
      final startTimeStr = slot['startTime'] as String;
      final endTimeStr = slot['endTime'] as String;

      final startDt = _getSlotDateTime(dayName, startTimeStr, now);
      final endDt = _getSlotDateTime(dayName, endTimeStr, now);

      final diff = startDt.difference(now);

      if (now.isAfter(startDt) && now.isBefore(endDt)) {
        return {
          'canStart': true,
          'statusText': '🟢 Class in Progress',
          'hintText': tr('Class is currently active until {time}.', {'time': endTimeStr}),
        };
      }

      if (diff.inMinutes > 0 && diff.inMinutes <= 60) {
        return {
          'canStart': true,
          'statusText': '🟢 Ready to Launch',
          'hintText':
              tr('Starts in {n}m. Gate unlocked for check-in.', {'n': diff.inMinutes}),
        };
      }

      if (diff.inMinutes > 60) {
        String countStr = diff.inDays > 0
            ? tr('{d}d {h}h', {'d': diff.inDays, 'h': diff.inHours % 24})
            : (diff.inHours > 0
                  ? tr('{h}h {m}m', {'h': diff.inHours, 'm': diff.inMinutes % 60})
                  : tr('{m}m', {'m': diff.inMinutes}));

        return {
          'canStart': false,
          'statusText': '🔒 Locked',
          'hintText':
              tr('Time Remaining: Starts in {time} (Opens 1h before class).', {'time': countStr}),
        };
      }
    }

    return {
      'canStart': true,
      'statusText': '🟢 Ready to Launch',
      'hintText': 'Unlocked for check-in.',
    };
  }

  Map<String, dynamic>? _getUpcomingSlot() {
    if (myTimetable.isEmpty) return null;
    final now = ApiConfig.now;
    final todayName = _dayOfWeekName(now.weekday);

    final todaySlots = myTimetable.where((slot) {
      return (slot['day'] as String).toLowerCase() == todayName.toLowerCase() && (SemesterWindow.parse(slot['semester'])?.contains(now) ?? true);
    }).toList();
    todaySlots.sort(
      (a, b) => (a['startTime'] as String).compareTo(b['startTime'] as String),
    );

    for (var slot in todaySlots) {
      final startDt = _getSlotDateTime(
        slot['day'] as String,
        slot['startTime'] as String,
        now,
      );
      final endDt = _getSlotDateTime(
        slot['day'] as String,
        slot['endTime'] as String,
        now,
      );

      if (now.isBefore(endDt)) {
        return {...slot, 'startDateTime': startDt, 'endDateTime': endDt};
      }
    }

    final futureSlots = <Map<String, dynamic>>[];
    for (int dayOffset = 1; dayOffset <= 7; dayOffset++) {
      final targetDate = now.add(Duration(days: dayOffset));
      final targetDayName = _dayOfWeekName(targetDate.weekday);

      final matchingSlots = myTimetable.where((slot) {
        return (slot['day'] as String).toLowerCase() ==
            targetDayName.toLowerCase() && (SemesterWindow.parse(slot['semester'])?.contains(targetDate) ?? true);
      }).toList();

      for (var slot in matchingSlots) {
        final startDt = _getSlotDateTimeForDate(
          targetDate,
          slot['startTime'] as String,
        );
        final endDt = _getSlotDateTimeForDate(
          targetDate,
          slot['endTime'] as String,
        );
        futureSlots.add({
          ...slot,
          'startDateTime': startDt,
          'endDateTime': endDt,
        });
      }
      if (futureSlots.isNotEmpty) break;
    }

    if (futureSlots.isNotEmpty) {
      futureSlots.sort(
        (a, b) => (a['startDateTime'] as DateTime).compareTo(
          b['startDateTime'] as DateTime,
        ),
      );
      return futureSlots.first;
    }

    return null;
  }

  DateTime _getSlotDateTime(
    String dayName,
    String timeStr,
    DateTime referenceNow,
  ) {
    return _getSlotDateTimeForDate(referenceNow, timeStr);
  }

  DateTime _getSlotDateTimeForDate(DateTime baseDate, String timeStr) {
    final parts = timeStr.split(':');
    final hour = int.parse(parts[0]);
    final minute = int.parse(parts[1]);
    return DateTime(baseDate.year, baseDate.month, baseDate.day, hour, minute);
  }

  String _dayOfWeekName(int weekday) {
    switch (weekday) {
      case DateTime.monday:
        return "Monday";
      case DateTime.tuesday:
        return "Tuesday";
      case DateTime.wednesday:
        return "Wednesday";
      case DateTime.thursday:
        return "Thursday";
      case DateTime.friday:
        return "Friday";
      case DateTime.saturday:
        return "Saturday";
      case DateTime.sunday:
        return "Sunday";
      default:
        return "Monday";
    }
  }

  void _showAttendeesModal(
    BuildContext context,
    dynamic sessionId,
    String courseCode,
  ) async {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final primaryTextColor = isDarkMode
        ? Colors.white
        : const Color(0xFF0F172A);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        String searchQuery = "";
        bool isFetching = true;
        String? fetchError;
        List<dynamic> attendanceList = [];

        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            void loadRoster() async {
              try {
                final res = await http.get(
                  Uri.parse(
                    "${widget.apiBaseUrl}/sessions/$sessionId/attendance",
                  ),
                  headers: {"Authorization": "Bearer ${widget.authToken}"},
                );
                if (res.statusCode == 200) {
                  final data = jsonDecode(res.body);
                  setModalState(() {
                    attendanceList = data['attendance_list'] ?? [];
                    isFetching = false;
                  });
                } else {
                  final res2 = await http.get(
                    Uri.parse(
                      "${widget.apiBaseUrl}/attendance/session-attendees/$sessionId",
                    ),
                    headers: {"Authorization": "Bearer ${widget.authToken}"},
                  );
                  if (res2.statusCode == 200) {
                    final data2 = jsonDecode(res2.body);
                    setModalState(() {
                      attendanceList = (data2 as List)
                          .map(
                            (a) => {
                              'student_id':
                                  a['studentId'] ?? a['student_id'] ?? 0,
                              'student_name':
                                  a['studentName'] ??
                                  a['student_name'] ??
                                  'Student',
                              'student_code':
                                  a['studentCode'] ?? a['student_code'] ?? '—',
                              'status': 'present',
                            },
                          )
                          .toList();
                      isFetching = false;
                    });
                  } else {
                    setModalState(() {
                      fetchError = "Failed to load attendance list";
                      isFetching = false;
                    });
                  }
                }
              } catch (e) {
                setModalState(() {
                  fetchError = "Network error loading attendance list";
                  isFetching = false;
                });
              }
            }

            if (isFetching && fetchError == null) {
              loadRoster();
            }

            Future<void> toggleAttendance(
              int studentId,
              String currentStatus,
              String studentName,
            ) async {
              final nextStatus = currentStatus == 'present'
                  ? 'absent'
                  : 'present';
              try {
                final res = await http.put(
                  Uri.parse(
                    "${widget.apiBaseUrl}/sessions/$sessionId/attendance/$studentId",
                  ),
                  headers: {
                    "Authorization": "Bearer ${widget.authToken}",
                    "Content-Type": "application/json",
                  },
                  body: jsonEncode({"status": nextStatus}),
                );

                if (res.statusCode == 200) {
                  setModalState(() {
                    final item = attendanceList.firstWhere(
                      (s) => s['student_id'] == studentId,
                      orElse: () => null,
                    );
                    if (item != null) {
                      item['status'] = nextStatus;
                    }
                  });
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          tr('{studentName} marked as {v}', {'studentName': studentName, 'v': nextStatus.toUpperCase()}),
                        ),
                        duration: const Duration(seconds: 2),
                        backgroundColor: nextStatus == 'present'
                            ? const Color(0xFF10B981)
                            : const Color(0xFFEF4444),
                      ),
                    );
                  }
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(tr('Failed to update attendance status')),
                    ),
                  );
                }
              }
            }

            final filtered = attendanceList.where((s) {
              if (searchQuery.trim().isEmpty) return true;
              final q = searchQuery.toLowerCase();
              final name = (s['student_name'] ?? '').toString().toLowerCase();
              final code = (s['student_code'] ?? '').toString().toLowerCase();
              return name.contains(q) || code.contains(q);
            }).toList();

            final presentCount = attendanceList
                .where((s) => s['status'] == 'present')
                .length;
            final totalCount = attendanceList.length;

            return Container(
              height: MediaQuery.of(context).size.height * 0.82,
              decoration: BoxDecoration(
                color: isDarkMode ? const Color(0xFF222222) : Colors.white,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tr('{courseCode} - Student Attendance', {'courseCode': courseCode}),
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: primaryTextColor,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            tr('Check & take attendance manually for students'),
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(ctx),
                        icon: Icon(
                          Icons.close,
                          size: 20,
                          color: isDarkMode
                              ? Colors.white70
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFF10B981,
                          ).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          tr('Present: {presentCount}', {'presentCount': presentCount}),
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF10B981),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFFEF4444,
                          ).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          tr('Absent: {v}', {'v': totalCount - presentCount}),
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFFEF4444),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFF3B82F6,
                          ).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          tr('Total: {totalCount}', {'totalCount': totalCount}),
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF3B82F6),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    onChanged: (val) => setModalState(() => searchQuery = val),
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: primaryTextColor,
                    ),
                    decoration: InputDecoration(
                      hintText: tr('Search student name or ID...'),
                      hintStyle: GoogleFonts.inter(
                        fontSize: 11,
                        color: const Color(0xFF94A3B8),
                      ),
                      prefixIcon: const Icon(
                        Icons.search,
                        size: 18,
                        color: Color(0xFF94A3B8),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        vertical: 8,
                        horizontal: 12,
                      ),
                      filled: true,
                      fillColor: isDarkMode
                          ? const Color(0xFF181818)
                          : const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: isDarkMode
                              ? const Color(0xFF333333)
                              : const Color(0xFFE2E8F0),
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: isDarkMode
                              ? const Color(0xFF333333)
                              : const Color(0xFFE2E8F0),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: isFetching
                        ? const Center(child: CircularProgressIndicator())
                        : fetchError != null
                        ? Center(
                            child: Text(
                              tr(fetchError!),
                              style: TextStyle(
                                color: isDarkMode
                                    ? Colors.white70
                                    : Colors.black54,
                              ),
                            ),
                          )
                        : filtered.isEmpty
                        ? Center(
                            child: Text(
                              tr('No students found.'),
                              style: TextStyle(
                                color: isDarkMode
                                    ? Colors.white70
                                    : Colors.black54,
                              ),
                            ),
                          )
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (c, i) => Divider(
                              color: isDarkMode
                                  ? const Color(0xFF333333)
                                  : const Color(0xFFE2E8F0),
                            ),
                            itemBuilder: (c, idx) {
                              final student = filtered[idx];
                              final isPresent = student['status'] == 'present';
                              final sId = student['student_id'];
                              final sName =
                                  student['student_name'] ?? 'Student';
                              final sCode = student['student_code'] ?? '—';

                              return ListTile(
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                  vertical: 2,
                                ),
                                leading: CircleAvatar(
                                  backgroundColor:
                                      (isPresent
                                              ? const Color(0xFF10B981)
                                              : const Color(0xFF64748B))
                                          .withValues(alpha: 0.15),
                                  child: Icon(
                                    isPresent
                                        ? Icons.check_circle_rounded
                                        : Icons.cancel_rounded,
                                    color: isPresent
                                        ? const Color(0xFF10B981)
                                        : const Color(0xFF64748B),
                                    size: 20,
                                  ),
                                ),
                                title: Text(
                                  tr(sName),
                                  style: GoogleFonts.spaceGrotesk(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: primaryTextColor,
                                  ),
                                ),
                                subtitle: Text(
                                  tr('ID: {sCode} · Status: {v}', {'sCode': sCode, 'v': tr(student['status']?.toUpperCase() ?? 'ABSENT')}),
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: isPresent
                                        ? const Color(0xFF10B981)
                                        : const Color(0xFFEF4444),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                trailing: ElevatedButton.icon(
                                  onPressed: () => toggleAttendance(
                                    sId,
                                    student['status'] ?? 'absent',
                                    sName,
                                  ),
                                  icon: Icon(
                                    isPresent
                                        ? Icons.remove_circle_outline
                                        : Icons.add_circle_outline,
                                    size: 14,
                                  ),
                                  label: Text(
                                    tr(isPresent ? "Mark Absent" : "Mark Present"),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: isPresent
                                        ? const Color(0xFFEF4444)
                                        : const Color(0xFF10B981),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 6,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    textStyle: GoogleFonts.inter(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                    ),
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
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final primaryTextColor = isDarkMode
        ? Colors.white
        : const Color(0xFF0F172A);
    final secondaryTextColor = isDarkMode
        ? const Color(0xFFCBD5E1)
        : const Color(0xFF64748B);

    // High Contrast Theme Colors for Staff Dashboard
    // The web staff theme: one blue accent (no maroon), slightly brighter on the dark greys.
    final Color primaryColor = isDarkMode ? const Color(0xFF3B82F6) : const Color(0xFF2563EB);
    final Color headerButtonBg = isDarkMode
        ? const Color(0xFF222222)
        : primaryColor.withValues(alpha: 0.1);
    final Color headerButtonIconColor = isDarkMode
        ? const Color(0xFF60A5FA)
        : primaryColor;

    return SafeArea(
      child: Stack(
        children: [
          Column(
            children: [
              // Top Bar
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16.0,
                  vertical: 8.0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                      children: [
                        Container(
                          height: 36,
                          width: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFF2563EB),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.school,
                              color: Colors.white,
                              size: 18,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Flexible(
                          child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              tr('Staff Portal'),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: primaryTextColor,
                              ),
                            ),
                            Text(
                              tr('MANAGEMENT & REGISTRY'),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                color: secondaryTextColor,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                        ),
                      ],
                    ),
                    ),
                    Row(
                      children: [
                        IconButton(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ProfileScreen(
                                  authToken: widget.authToken,
                                  apiBaseUrl: widget.apiBaseUrl,
                                ),
                              ),
                            ).then((_) => _loadAvatar());
                          },
                          tooltip: tr('My profile'),
                          icon: Icon(
                            Icons.person_rounded,
                            color: headerButtonIconColor,
                            size: 18,
                          ),
                          style: IconButton.styleFrom(
                            backgroundColor: headerButtonBg,
                            padding: const EdgeInsets.all(8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                              side: BorderSide(
                                color: isDarkMode
                                    ? const Color(0xFF333333)
                                    : Colors.transparent,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => AttendanceRequestScreen(
                                  authToken: widget.authToken,
                                  apiBaseUrl: widget.apiBaseUrl,
                                ),
                              ),
                            );
                          },
                          icon: Icon(
                            Icons.notifications_outlined,
                            color: headerButtonIconColor,
                            size: 18,
                          ),
                          style: IconButton.styleFrom(
                            backgroundColor: headerButtonBg,
                            padding: const EdgeInsets.all(8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                              side: BorderSide(
                                color: isDarkMode
                                    ? const Color(0xFF333333)
                                    : Colors.transparent,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: widget.onLogout,
                          icon: const Icon(
                            Icons.logout,
                            color: Color(0xFFEF4444),
                            size: 18,
                          ),
                          style: IconButton.styleFrom(
                            backgroundColor: isDarkMode
                                ? const Color(0xFF451A1A)
                                : const Color(0xFFFEF2F2),
                            padding: const EdgeInsets.all(8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Status Warning Banner
              if (loadError != null)
                Container(
                  margin: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 4,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: isDarkMode
                        ? const Color(0xFF451A1A)
                        : const Color(0xFFFFF1F2),
                    border: Border.all(
                      color: const Color(0xFFF43F5E).withValues(alpha: 0.3),
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.cloud_off,
                        color: Color(0xFFE11D48),
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          tr(loadError!),
                          style: GoogleFonts.inter(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: isDarkMode
                                ? const Color(0xFFFECDD3)
                                : const Color(0xFFBE123C),
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: loadLecturerData,
                        child: Text(
                          tr('Retry'),
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFFF43F5E),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // Content Area with Shimmer Loading Placeholder
              Expanded(
                child: isLoading
                    ? const ShimmerLoading(
                        isLoading: true,
                        child: ShimmerSkeleton(),
                      )
                    : BrandRefresh(
                        onRefresh: () async {
                          widget.onSyncRequested();
                          await loadLecturerData();
                        },
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(16.0),
                          child: GestureDetector(
                            behavior: HitTestBehavior.translucent,
                            onHorizontalDragStart: _handleTabSwipeStart,
                            onHorizontalDragUpdate: _handleTabSwipeUpdate,
                            onHorizontalDragEnd: _handleTabSwipe,
                            onHorizontalDragCancel: _handleTabSwipeCancel,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                              _staffHero(isDarkMode),
                              const SizedBox(height: 16),
                              _dashboardTabs(isDarkMode),
                              const SizedBox(height: 20),

                              AnimatedContainer(
                                duration: _isTabDragging
                                    ? Duration.zero
                                    : const Duration(milliseconds: 220),
                                curve: Curves.easeOutCubic,
                                transform: Matrix4.translationValues(
                                  _tabDragOffset,
                                  0,
                                  0,
                                ),
                                child: TweenAnimationBuilder<double>(
                                  key: ValueKey<int>(_dashboardTabIndex),
                                  tween: Tween<double>(begin: 0, end: 1),
                                  duration: const Duration(milliseconds: 260),
                                  curve: Curves.easeOutCubic,
                                  builder: (context, value, child) {
                                    return ClipRect(
                                      child: Opacity(
                                        opacity: value,
                                        child: Transform.translate(
                                          offset: Offset(
                                            _tabTransitionDirection *
                                                24 *
                                                (1 - value),
                                            0,
                                          ),
                                          child: child,
                                        ),
                                      ),
                                    );
                                  },
                                  child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                              if (_dashboardTabIndex == 0) ...[
                              _classesNeedingReviewSection(
                                primaryTextColor,
                                secondaryTextColor,
                                isDarkMode,
                              ),
                              if (classesNeedingAttention.any(
                                (item) => !todayClasses.any(
                                  (today) =>
                                      '${today['id']}' == '${item['id']}',
                                ),
                              ))
                                const SizedBox(height: 20),

                              _todayClassesSection(
                                primaryTextColor,
                                secondaryTextColor,
                                isDarkMode,
                              ),
                              const SizedBox(height: 20),

                              // Upcoming Class Check-In Card Header
                              _sectionTitle(
                                "Upcoming Class Check-In",
                                Icons.how_to_reg_outlined,
                                const Color(0xFF8B5CF6),
                                primaryTextColor,
                                isDarkMode,
                              ),
                              const SizedBox(height: 8),
                              Builder(
                                builder: (context) {
                                  final upcomingSlot = _getUpcomingSlot();
                                  if (upcomingSlot == null) {
                                    return GlassCard(
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 20,
                                        ),
                                        child: Center(
                                          child: Text(
                                            tr('No upcoming classes found in your timetable.'),
                                            style: GoogleFonts.inter(
                                              fontSize: 11,
                                              color: secondaryTextColor,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ),
                                      ),
                                    );
                                  }

                                  final startDt =
                                      upcomingSlot['startDateTime'] as DateTime;
                                  final endDt =
                                      upcomingSlot['endDateTime'] as DateTime;
                                  final now = ApiConfig.now;

                                  final isCurrentlyActive =
                                      now.isAfter(startDt) &&
                                      now.isBefore(endDt);
                                  final isOpenWindow =
                                      now.isAfter(
                                        startDt.subtract(
                                          const Duration(hours: 1),
                                        ),
                                      ) &&
                                      now.isBefore(endDt);

                                  final isAlreadyOpen =
                                      isOpenWindow &&
                                      myActiveSessions.any(
                                        (s) =>
                                            s['courseId'] ==
                                                upcomingSlot['courseId'] &&
                                            (upcomingSlot['role'] == 'Lecture'
                                                ? s['classGroup'] == 'All'
                                                : s['classGroup']
                                                      .toString()
                                                      .startsWith('G')),
                                      );

                                  String hintText = "";
                                  String buttonText = "Open Attendance Gate";
                                  bool buttonEnabled = false;

                                  final timeRemainingUntilEnd = endDt
                                      .difference(now);
                                  String endCountdownStr =
                                      timeRemainingUntilEnd.inHours > 0
                                      ? tr('{h}h {m}m', {'h': timeRemainingUntilEnd.inHours, 'm': timeRemainingUntilEnd.inMinutes % 60})
                                      : tr('{m}m', {'m': timeRemainingUntilEnd.inMinutes});

                                  if (isAlreadyOpen) {
                                    hintText =
                                        tr('Attendance gate is live ({time} remaining until class ends).', {'time': endCountdownStr});
                                    buttonText =
                                        tr('Gate is Live ({time} Left)', {'time': endCountdownStr});
                                    buttonEnabled = false;
                                  } else if (isCurrentlyActive) {
                                    hintText =
                                        tr('Class is in progress ({time} remaining until {end}).', {'time': endCountdownStr, 'end': upcomingSlot['endTime']});
                                    buttonText =
                                        tr('Class in Progress ({time} Left)', {'time': endCountdownStr});
                                    buttonEnabled = false;
                                  } else if (isOpenWindow) {
                                    final diff = startDt.difference(now);
                                    hintText =
                                        tr('Class starts in {n}m. Check-in gate can be opened now.', {'n': diff.inMinutes});
                                    buttonText =
                                        tr('Open Attendance Gate (Starts in {n}m)', {'n': diff.inMinutes});
                                    buttonEnabled = true;
                                  } else {
                                    final diff = startDt.difference(now);
                                    String countdownStr = "";
                                    if (diff.inDays > 0) {
                                      countdownStr =
                                          tr('{d}d {h}h', {'d': diff.inDays, 'h': diff.inHours % 24});
                                    } else if (diff.inHours > 0) {
                                      countdownStr =
                                          tr('{h}h {m}m', {'h': diff.inHours, 'm': diff.inMinutes % 60});
                                    } else {
                                      countdownStr = tr('{m}m', {'m': diff.inMinutes});
                                    }
                                    hintText =
                                        tr('Time Remaining: Starts in {time} (Unlocks 1h before class).', {'time': countdownStr});
                                    buttonText =
                                        tr('Locked (Opens in {time})', {'time': countdownStr});
                                    buttonEnabled = false;
                                  }

                                  return GlassCard(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 8,
                                                    vertical: 3,
                                                  ),
                                              decoration: BoxDecoration(
                                                color: isDarkMode
                                                    ? const Color(0xFF333333)
                                                    : primaryColor.withValues(
                                                        alpha: 0.1,
                                                      ),
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                tr(upcomingSlot['role'] as String).toUpperCase(),
                                                style: GoogleFonts.inter(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: primaryColor,
                                                ),
                                              ),
                                            ),
                                            Text(
                                              "${tr(upcomingSlot['day'])} · ${upcomingSlot['startTime']} - ${upcomingSlot['endTime']}",
                                              style: GoogleFonts.inter(
                                                fontSize: 11,
                                                color: secondaryTextColor,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 12),

                                        // COURSE TITLE (CRITICAL FIX: High contrast white in dark mode, dark slate in light mode)
                                        Text(
                                          "${upcomingSlot['courseCode']} - ${upcomingSlot['courseName']}",
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 15,
                                            fontWeight: FontWeight.bold,
                                            color: primaryTextColor,
                                          ),
                                        ),
                                        const SizedBox(height: 4),

                                        // Room location info
                                        Row(
                                          children: [
                                            Icon(
                                              Icons.room_outlined,
                                              size: 13,
                                              color: secondaryTextColor,
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              tr(upcomingSlot['room'] as String),
                                              style: GoogleFonts.inter(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w600,
                                                color: secondaryTextColor,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 16),

                                        // Session Notice Box
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 10,
                                          ),
                                          decoration: BoxDecoration(
                                            color: isAlreadyOpen
                                                ? (isDarkMode
                                                      ? const Color(0xFF064E3B)
                                                      : const Color(0xFFECFDF5))
                                                : (buttonEnabled
                                                      ? (isDarkMode
                                                            ? const Color(
                                                                0xFF78350F,
                                                              )
                                                            : const Color(
                                                                0xFFFFFBEB,
                                                              ))
                                                      : (isDarkMode
                                                            ? const Color(
                                                                0xFF222222,
                                                              )
                                                            : const Color(
                                                                0xFFF1F5F9,
                                                              ))),
                                            borderRadius: BorderRadius.circular(
                                              10,
                                            ),
                                            border: Border.all(
                                              color: isAlreadyOpen
                                                  ? const Color(
                                                      0xFF10B981,
                                                    ).withValues(alpha: 0.3)
                                                  : (buttonEnabled
                                                        ? const Color(
                                                            0xFFF59E0B,
                                                          ).withValues(
                                                            alpha: 0.3,
                                                          )
                                                        : (isDarkMode
                                                              ? const Color(
                                                                  0xFF333333,
                                                                )
                                                              : const Color(
                                                                  0xFFE2E8F0,
                                                                ))),
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              Icon(
                                                isAlreadyOpen
                                                    ? Icons.check_circle_outline
                                                    : (buttonEnabled
                                                          ? Icons.info_outline
                                                          : Icons
                                                                .lock_clock_outlined),
                                                size: 14,
                                                color: isAlreadyOpen
                                                    ? const Color(0xFF10B981)
                                                    : (buttonEnabled
                                                          ? (isDarkMode
                                                                ? const Color(
                                                                    0xFFFBBF24,
                                                                  )
                                                                : const Color(
                                                                    0xFFD97706,
                                                                  ))
                                                          : (isDarkMode
                                                                ? const Color(
                                                                    0xFFA0A0A0,
                                                                  )
                                                                : const Color(
                                                                    0xFF64748B,
                                                                  ))),
                                              ),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Text(
                                                  tr(hintText),
                                                  style: GoogleFonts.inter(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.w600,
                                                    color: isAlreadyOpen
                                                        ? (isDarkMode
                                                              ? const Color(
                                                                  0xFFA7F3D0,
                                                                )
                                                              : const Color(
                                                                  0xFF047857,
                                                                ))
                                                        : (buttonEnabled
                                                              ? (isDarkMode
                                                                    ? const Color(
                                                                        0xFFFDE68A,
                                                                      )
                                                                    : const Color(
                                                                        0xFFB45309,
                                                                      ))
                                                              : (isDarkMode
                                                                    ? const Color(
                                                                        0xFFE2E8F0,
                                                                      )
                                                                    : const Color(
                                                                        0xFF475569,
                                                                      ))),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(height: 14),

                                        // Open Gate Action Button
                                        ElevatedButton.icon(
                                          onPressed:
                                              (isLoading || !buttonEnabled)
                                              ? null
                                              : () => handleOpenSession(
                                                  upcomingSlot,
                                                ),
                                          icon: Icon(
                                            isAlreadyOpen
                                                ? Icons.check_circle
                                                : Icons.add_circle_outline,
                                            size: 15,
                                          ),
                                          label: Text(tr(buttonText)),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: buttonEnabled
                                                ? primaryColor
                                                : (isDarkMode
                                                      ? const Color(0xFF222222)
                                                      : Colors.white),
                                            foregroundColor: buttonEnabled
                                                ? Colors.white
                                                : (isDarkMode
                                                      ? const Color(0xFFA0A0A0)
                                                      : const Color(
                                                          0xFF64748B,
                                                        )),
                                            disabledBackgroundColor: isDarkMode
                                                ? const Color(0xFF222222)
                                                : Colors.white,
                                            disabledForegroundColor: isDarkMode
                                                ? const Color(0xFFA0A0A0)
                                                : const Color(0xFF64748B),
                                            elevation: buttonEnabled ? 1 : 0,
                                            padding: const EdgeInsets.symmetric(
                                              vertical: 12,
                                            ),
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                              side: BorderSide(
                                                color: buttonEnabled
                                                    ? Colors.transparent
                                                    : (isDarkMode
                                                          ? const Color(
                                                              0xFF404040,
                                                            )
                                                          : const Color(
                                                              0xFFCBD5E1,
                                                            )),
                                              ),
                                            ),
                                            textStyle: GoogleFonts.spaceGrotesk(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                              const SizedBox(height: 24),
                              ],

                              if (_dashboardTabIndex == 1) ...[
                              // Course Sessions & Attendance History Section
                              _sectionTitle(
                                "Course Sessions & Attendance History",
                                Icons.history_edu_outlined,
                                const Color(0xFF2563EB),
                                primaryTextColor,
                                isDarkMode,
                              ),
                              const SizedBox(height: 8),
                              Builder(
                                builder: (context) {
                                  final availableCourses =
                                      _getAvailableCourses();
                                  final effectiveCourseId =
                                      (availableCourses.any(
                                        (c) => c['id'] == selectedCourseId,
                                      ))
                                      ? selectedCourseId
                                      : (availableCourses.isNotEmpty
                                            ? availableCourses[0]['id']
                                            : null);

                                  return GlassCard(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              tr('Select Course'),
                                              style: GoogleFonts.inter(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: secondaryTextColor,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),

                                        // Enhanced Course Dropdown Selector
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: isDarkMode
                                                ? const Color(0xFF222222)
                                                : const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(
                                              12,
                                            ),
                                            border: Border.all(
                                              color: isDarkMode
                                                  ? const Color(0xFF333333)
                                                  : const Color(0xFFCBD5E1),
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: Colors.black.withValues(
                                                  alpha: 0.03,
                                                ),
                                                blurRadius: 4,
                                                offset: const Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                          child: DropdownButtonHideUnderline(
                                            child: DropdownButton<String>(
                                              isExpanded: true,
                                              value: effectiveCourseId,
                                              icon: Icon(
                                                Icons
                                                    .keyboard_arrow_down_rounded,
                                                color: primaryColor,
                                                size: 22,
                                              ),
                                              hint: Text(
                                                tr('Select Course'),
                                                style: TextStyle(
                                                  color: secondaryTextColor,
                                                  fontSize: 12,
                                                ),
                                              ),
                                              dropdownColor: isDarkMode
                                                  ? const Color(0xFF222222)
                                                  : Colors.white,
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                              items: availableCourses.map((c) {
                                                return DropdownMenuItem<String>(
                                                  value: c['id'],
                                                  child: Padding(
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          vertical: 4,
                                                        ),
                                                    child: Row(
                                                      children: [
                                                        Container(
                                                          padding:
                                                              const EdgeInsets.symmetric(
                                                                horizontal: 6,
                                                                vertical: 2,
                                                              ),
                                                          decoration: BoxDecoration(
                                                            color: primaryColor
                                                                .withValues(
                                                                  alpha: 0.12,
                                                                ),
                                                            borderRadius:
                                                                BorderRadius.circular(
                                                                  6,
                                                                ),
                                                            border: Border.all(
                                                              color: primaryColor
                                                                  .withValues(
                                                                    alpha: 0.2,
                                                                  ),
                                                            ),
                                                          ),
                                                          child: Text(
                                                            tr(c['code']!),
                                                            style: GoogleFonts.inter(
                                                              fontSize: 11,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .bold,
                                                              color:
                                                                  primaryColor,
                                                            ),
                                                          ),
                                                        ),
                                                        const SizedBox(
                                                          width: 8,
                                                        ),
                                                        Expanded(
                                                          child: Text(
                                                            tr(c['name']!),
                                                            style: GoogleFonts.spaceGrotesk(
                                                              fontSize: 12,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .bold,
                                                              color:
                                                                  primaryTextColor,
                                                            ),
                                                            overflow:
                                                                TextOverflow
                                                                    .ellipsis,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                );
                                              }).toList(),
                                              onChanged: (val) {
                                                if (val != null) {
                                                  setState(
                                                    () =>
                                                        selectedCourseId = val,
                                                  );
                                                  fetchCourseSessions(val);
                                                }
                                              },
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 14),

                                        // Class Sessions History List Header
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              tr('Class Sessions (Current & Past)'),
                                              style: GoogleFonts.inter(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: secondaryTextColor,
                                              ),
                                            ),
                                            if (isFetchingHistory)
                                              const SizedBox(
                                                width: 12,
                                                height: 12,
                                                child:
                                                    CircularProgressIndicator(
                                                      strokeWidth: 2,
                                                    ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),

                                        // Course Sessions History List with Modern Pagination
                                        if (isFetchingHistory)
                                          const Padding(
                                            padding: EdgeInsets.symmetric(
                                              vertical: 16,
                                            ),
                                            child: Center(
                                              child:
                                                  CircularProgressIndicator(),
                                            ),
                                          )
                                        else if (courseSessionsHistory.isEmpty)
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              vertical: 16,
                                              horizontal: 12,
                                            ),
                                            decoration: BoxDecoration(
                                              color: isDarkMode
                                                  ? const Color(0xFF222222)
                                                  : const Color(0xFFF8FAFC),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                              border: Border.all(
                                                color: isDarkMode
                                                    ? const Color(0xFF333333)
                                                    : const Color(0xFFE2E8F0),
                                              ),
                                            ),
                                            child: Center(
                                              child: Text(
                                                tr('No class sessions recorded yet for this course.'),
                                                style: GoogleFonts.inter(
                                                  fontSize: 11.5,
                                                  color: secondaryTextColor,
                                                ),
                                                textAlign: TextAlign.center,
                                              ),
                                            ),
                                          )
                                        else
                                          Builder(
                                            builder: (context) {
                                              final int totalItems =
                                                  courseSessionsHistory.length;
                                              final int totalPages =
                                                  (totalItems / historyPageSize)
                                                      .ceil();
                                              final int safeCurrentPage =
                                                  totalPages > 0
                                                  ? (historyCurrentPage >
                                                            totalPages
                                                        ? totalPages
                                                        : (historyCurrentPage <
                                                                  1
                                                              ? 1
                                                              : historyCurrentPage))
                                                  : 1;
                                              final int startIndex =
                                                  (safeCurrentPage - 1) *
                                                  historyPageSize;
                                              final int endIndex =
                                                  (startIndex +
                                                          historyPageSize) >
                                                      totalItems
                                                  ? totalItems
                                                  : (startIndex +
                                                        historyPageSize);

                                              final pagedSessions =
                                                  courseSessionsHistory.sublist(
                                                    startIndex,
                                                    endIndex,
                                                  );

                                              return Column(
                                                children: [
                                                  Column(
                                                    children: pagedSessions.map((
                                                      sess,
                                                    ) {
                                                      final bool isOpen =
                                                          sess['is_open'] ==
                                                          true;
                                                      final String sessId =
                                                          sess['id']
                                                              ?.toString() ??
                                                          '';
                                                      final String groupStr =
                                                          sess['class_group'] ??
                                                          'All';
                                                      final String openedAtStr =
                                                          sess['opened_at'] !=
                                                              null
                                                          ? _formatDateTimeStr(
                                                              sess['opened_at']
                                                                  as String,
                                                            )
                                                          : 'Unknown Date';

                                                      return Container(
                                                        margin:
                                                            const EdgeInsets.only(
                                                              bottom: 8,
                                                            ),
                                                        decoration: BoxDecoration(
                                                          color: isDarkMode
                                                              ? const Color(
                                                                  0xFF222222,
                                                                )
                                                              : const Color(
                                                                  0xFFF8FAFC,
                                                                ),
                                                          borderRadius:
                                                              BorderRadius.circular(
                                                                10,
                                                              ),
                                                          border: Border.all(
                                                            color: isOpen
                                                                ? const Color(
                                                                    0xFF10B981,
                                                                  ).withValues(
                                                                    alpha: 0.4,
                                                                  )
                                                                : (isDarkMode
                                                                      ? const Color(
                                                                          0xFF333333,
                                                                        )
                                                                      : const Color(
                                                                          0xFFE2E8F0,
                                                                        )),
                                                          ),
                                                        ),
                                                        child: ListTile(
                                                          dense: true,
                                                          contentPadding:
                                                              const EdgeInsets.symmetric(
                                                                horizontal: 10,
                                                                vertical: 2,
                                                              ),
                                                          leading: Container(
                                                            padding:
                                                                const EdgeInsets.all(
                                                                  6,
                                                                ),
                                                            decoration: BoxDecoration(
                                                              color:
                                                                  (isOpen
                                                                          ? const Color(
                                                                              0xFF10B981,
                                                                            )
                                                                          : const Color(
                                                                              0xFF64748B,
                                                                            ))
                                                                      .withValues(
                                                                        alpha:
                                                                            0.15,
                                                                      ),
                                                              shape: BoxShape
                                                                  .circle,
                                                            ),
                                                            child: Icon(
                                                              isOpen
                                                                  ? Icons
                                                                        .sensors
                                                                  : Icons
                                                                        .history,
                                                              color: isOpen
                                                                  ? const Color(
                                                                      0xFF10B981,
                                                                    )
                                                                  : secondaryTextColor,
                                                              size: 16,
                                                            ),
                                                          ),
                                                          title: Text(
                                                            tr('Session: {openedAtStr}', {'openedAtStr': openedAtStr}),
                                                            style: GoogleFonts.spaceGrotesk(
                                                              fontSize: 11.5,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .bold,
                                                              color:
                                                                  primaryTextColor,
                                                            ),
                                                          ),
                                                          subtitle: Text(
                                                            tr('Group: {groupStr} · Status: {v}', {'groupStr': groupStr, 'v': isOpen ? tr('LIVE GATE') : tr('COMPLETED SESSION')}),
                                                            style: GoogleFonts.inter(
                                                              fontSize: 11,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w600,
                                                              color: isOpen
                                                                  ? const Color(
                                                                      0xFF10B981,
                                                                    )
                                                                  : secondaryTextColor,
                                                            ),
                                                          ),
                                                          trailing: ElevatedButton.icon(
                                                            onPressed: () {
                                                              final courseCode =
                                                                  availableCourses.firstWhere(
                                                                    (c) =>
                                                                        c['id'] ==
                                                                        effectiveCourseId,
                                                                    orElse: () => {
                                                                      'code':
                                                                          'Course',
                                                                    },
                                                                  )['code']!;
                                                              _showAttendeesModal(
                                                                context,
                                                                sessId,
                                                                courseCode,
                                                              );
                                                            },
                                                            icon: const Icon(
                                                              Icons
                                                                  .people_alt_outlined,
                                                              size: 12,
                                                            ),
                                                            label: Text(
                                                              tr(isOpen
                                                                  ? "Current Roster"
                                                                  : "Past Roster"),
                                                            ),
                                                            style: ElevatedButton.styleFrom(
                                                              backgroundColor:
                                                                  isOpen
                                                                  ? const Color(
                                                                      0xFF10B981,
                                                                    )
                                                                  : primaryColor,
                                                              foregroundColor:
                                                                  Colors.white,
                                                              padding:
                                                                  const EdgeInsets.symmetric(
                                                                    horizontal:
                                                                        8,
                                                                    vertical: 4,
                                                                  ),
                                                              shape: RoundedRectangleBorder(
                                                                borderRadius:
                                                                    BorderRadius.circular(
                                                                      8,
                                                                    ),
                                                              ),
                                                              textStyle:
                                                                  GoogleFonts.inter(
                                                                    fontSize:
                                                                        9.5,
                                                                    fontWeight:
                                                                        FontWeight
                                                                            .bold,
                                                                  ),
                                                            ),
                                                          ),
                                                        ),
                                                      );
                                                    }).toList(),
                                                  ),

                                                  // Modern Responsive Pagination Footer
                                                  if (totalPages > 1) ...[
                                                    const SizedBox(height: 8),
                                                    Container(
                                                      padding:
                                                          const EdgeInsets.symmetric(
                                                            horizontal: 10,
                                                            vertical: 6,
                                                          ),
                                                      decoration: BoxDecoration(
                                                        color: isDarkMode
                                                            ? const Color(
                                                                0xFF222222,
                                                              )
                                                            : const Color(
                                                                0xFFF8FAFC,
                                                              ),
                                                        borderRadius:
                                                            BorderRadius.circular(
                                                              10,
                                                            ),
                                                        border: Border.all(
                                                          color: isDarkMode
                                                              ? const Color(
                                                                  0xFF333333,
                                                                )
                                                              : const Color(
                                                                  0xFFE2E8F0,
                                                                ),
                                                        ),
                                                      ),
                                                      child: Row(
                                                        mainAxisAlignment:
                                                            MainAxisAlignment
                                                                .spaceBetween,
                                                        children: [
                                                          Flexible(
                                                            child: Text(
                                                              tr('Showing {v}–{endIndex} of {totalItems}', {'v': startIndex + 1, 'endIndex': endIndex, 'totalItems': totalItems}),
                                                              style: GoogleFonts.inter(
                                                                fontSize: 11,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w600,
                                                                color:
                                                                    secondaryTextColor,
                                                              ),
                                                              overflow:
                                                                  TextOverflow
                                                                      .ellipsis,
                                                            ),
                                                          ),
                                                          const SizedBox(
                                                            width: 6,
                                                          ),
                                                          SingleChildScrollView(
                                                            scrollDirection:
                                                                Axis.horizontal,
                                                            child: Row(
                                                              mainAxisSize:
                                                                  MainAxisSize
                                                                      .min,
                                                              children: [
                                                                IconButton(
                                                                  onPressed:
                                                                      safeCurrentPage >
                                                                          1
                                                                      ? () => setState(
                                                                          () => historyCurrentPage =
                                                                              safeCurrentPage -
                                                                              1,
                                                                        )
                                                                      : null,
                                                                  icon: const Icon(
                                                                    Icons
                                                                        .chevron_left,
                                                                    size: 16,
                                                                  ),
                                                                  padding:
                                                                      EdgeInsets
                                                                          .zero,
                                                                  constraints:
                                                                      const BoxConstraints(
                                                                        minWidth:
                                                                            26,
                                                                        minHeight:
                                                                            26,
                                                                      ),
                                                                  style: IconButton.styleFrom(
                                                                    backgroundColor:
                                                                        safeCurrentPage >
                                                                            1
                                                                        ? (isDarkMode
                                                                              ? const Color(
                                                                                  0xFF333333,
                                                                                )
                                                                              : const Color(
                                                                                  0xFFE2E8F0,
                                                                                ))
                                                                        : Colors
                                                                              .transparent,
                                                                    foregroundColor:
                                                                        safeCurrentPage >
                                                                            1
                                                                        ? primaryTextColor
                                                                        : secondaryTextColor.withValues(
                                                                            alpha:
                                                                                0.3,
                                                                          ),
                                                                    shape: RoundedRectangleBorder(
                                                                      borderRadius:
                                                                          BorderRadius.circular(
                                                                            6,
                                                                          ),
                                                                    ),
                                                                  ),
                                                                ),
                                                                const SizedBox(
                                                                  width: 2,
                                                                ),
                                                                ..._getSmartPageNumbers(
                                                                  safeCurrentPage,
                                                                  totalPages,
                                                                ).map((
                                                                  pageNum,
                                                                ) {
                                                                  final isSelected =
                                                                      pageNum ==
                                                                      safeCurrentPage;

                                                                  return Padding(
                                                                    padding:
                                                                        const EdgeInsets.symmetric(
                                                                          horizontal:
                                                                              2,
                                                                        ),
                                                                    child: InkWell(
                                                                      onTap: () => setState(
                                                                        () => historyCurrentPage =
                                                                            pageNum,
                                                                      ),
                                                                      borderRadius:
                                                                          BorderRadius.circular(
                                                                            6,
                                                                          ),
                                                                      child: Container(
                                                                        width:
                                                                            24,
                                                                        height:
                                                                            24,
                                                                        alignment:
                                                                            Alignment.center,
                                                                        decoration: BoxDecoration(
                                                                          color:
                                                                              isSelected
                                                                              ? primaryColor
                                                                              : (isDarkMode
                                                                                    ? const Color(
                                                                                        0xFF222222,
                                                                                      )
                                                                                    : const Color(
                                                                                        0xFFF1F5F9,
                                                                                      )),
                                                                          borderRadius:
                                                                              BorderRadius.circular(
                                                                                6,
                                                                              ),
                                                                          border: Border.all(
                                                                            color:
                                                                                isSelected
                                                                                ? primaryColor
                                                                                : (isDarkMode
                                                                                      ? const Color(
                                                                                          0xFF333333,
                                                                                        )
                                                                                      : const Color(
                                                                                          0xFFCBD5E1,
                                                                                        )),
                                                                          ),
                                                                        ),
                                                                        child: Text(
                                                                          "$pageNum",
                                                                          style: GoogleFonts.inter(
                                                                            fontSize:
                                                                                9.5,
                                                                            fontWeight:
                                                                                FontWeight.bold,
                                                                            color:
                                                                                isSelected
                                                                                ? Colors.white
                                                                                : primaryTextColor,
                                                                          ),
                                                                        ),
                                                                      ),
                                                                    ),
                                                                  );
                                                                }),
                                                                const SizedBox(
                                                                  width: 2,
                                                                ),
                                                                IconButton(
                                                                  onPressed:
                                                                      safeCurrentPage <
                                                                          totalPages
                                                                      ? () => setState(
                                                                          () => historyCurrentPage =
                                                                              safeCurrentPage +
                                                                              1,
                                                                        )
                                                                      : null,
                                                                  icon: const Icon(
                                                                    Icons
                                                                        .chevron_right,
                                                                    size: 16,
                                                                  ),
                                                                  padding:
                                                                      EdgeInsets
                                                                          .zero,
                                                                  constraints:
                                                                      const BoxConstraints(
                                                                        minWidth:
                                                                            26,
                                                                        minHeight:
                                                                            26,
                                                                      ),
                                                                  style: IconButton.styleFrom(
                                                                    backgroundColor:
                                                                        safeCurrentPage <
                                                                            totalPages
                                                                        ? (isDarkMode
                                                                              ? const Color(
                                                                                  0xFF333333,
                                                                                )
                                                                              : const Color(
                                                                                  0xFFE2E8F0,
                                                                                ))
                                                                        : Colors
                                                                              .transparent,
                                                                    foregroundColor:
                                                                        safeCurrentPage <
                                                                            totalPages
                                                                        ? primaryTextColor
                                                                        : secondaryTextColor.withValues(
                                                                            alpha:
                                                                                0.3,
                                                                          ),
                                                                    shape: RoundedRectangleBorder(
                                                                      borderRadius:
                                                                          BorderRadius.circular(
                                                                            6,
                                                                          ),
                                                                    ),
                                                                  ),
                                                                ),
                                                              ],
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  ],
                                                ],
                                              );
                                            },
                                          ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                              const SizedBox(height: 24),

                              // Session List
                              _sectionTitle(
                                "Active Attendance Gates",
                                Icons.sensors_rounded,
                                const Color(0xFF10B981),
                                primaryTextColor,
                                isDarkMode,
                              ),
                              const SizedBox(height: 8),
                              Builder(
                                builder: (context) {
                                  final now = ApiConfig.now;
                                  final activeSessionsToShow = myActiveSessions
                                      .where((session) {
                                        final slot = myTimetable.firstWhere(
                                          (t) =>
                                              t['courseId'] ==
                                                  session['courseId'] &&
                                              (t['role'] == 'Lecture'
                                                  ? session['classGroup'] ==
                                                        'All'
                                                  : session['classGroup'] ==
                                                        t['classGroup']),
                                          orElse: () => <String, dynamic>{},
                                        );
                                        if (slot.isEmpty) return false;

                                        final startDt = _getSlotDateTime(
                                          slot['day'] as String,
                                          slot['startTime'] as String,
                                          now,
                                        );
                                        final endDt = _getSlotDateTime(
                                          slot['day'] as String,
                                          slot['endTime'] as String,
                                          now,
                                        );

                                        if (now.isAfter(endDt)) {
                                          return false;
                                        }

                                        final isOpenWindow =
                                            now.isAfter(
                                              startDt.subtract(
                                                const Duration(hours: 1),
                                              ),
                                            ) &&
                                            now.isBefore(endDt);
                                        return isOpenWindow;
                                      })
                                      .toList();

                                  if (activeSessionsToShow.isEmpty) {
                                    return GlassCard(
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 24.0,
                                        ),
                                        child: Center(
                                          child: Column(
                                            children: [
                                              Icon(
                                                Icons.sensors,
                                                color: secondaryTextColor,
                                                size: 24,
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                tr('No open check-in gates currently active.'),
                                                style: GoogleFonts.inter(
                                                  fontSize: 11,
                                                  color: secondaryTextColor,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    );
                                  }

                                  return Column(
                                    children: activeSessionsToShow.map((
                                      session,
                                    ) {
                                      return Container(
                                        margin: const EdgeInsets.only(
                                          bottom: 12,
                                        ),
                                        child: GlassCard(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.stretch,
                                            children: [
                                              Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment
                                                        .spaceBetween,
                                                children: [
                                                  Container(
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          horizontal: 8,
                                                          vertical: 3,
                                                        ),
                                                    decoration: BoxDecoration(
                                                      color: isDarkMode
                                                          ? const Color(
                                                              0xFF333333,
                                                            )
                                                          : primaryColor
                                                                .withValues(
                                                                  alpha: 0.1,
                                                                ),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            6,
                                                          ),
                                                    ),
                                                    child: Text(
                                                      tr('ACTIVE GATE'),
                                                      style: GoogleFonts.inter(
                                                        fontSize: 10,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        color: primaryColor,
                                                      ),
                                                    ),
                                                  ),
                                                  Text(
                                                    tr('Tut Group: {v}', {'v': session['classGroup']}),
                                                    style: GoogleFonts.inter(
                                                      fontSize: 10.5,
                                                      color: primaryColor,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 10),
                                              Text(
                                                "${session['courseCode']} - ${session['courseName']}",
                                                style: GoogleFonts.spaceGrotesk(
                                                  fontSize: 14.5,
                                                  fontWeight: FontWeight.bold,
                                                  color: primaryTextColor,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                tr('Open since {v} · {v2} Checked-In', {'v': session['openTime'] ?? tr('Active'), 'v2': session['verifiedCount'] ?? 0}),
                                                style: GoogleFonts.inter(
                                                  fontSize: 11,
                                                  color: secondaryTextColor,
                                                ),
                                              ),
                                              const SizedBox(height: 14),
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: OutlinedButton.icon(
                                                      onPressed: () =>
                                                          _showAttendeesModal(
                                                            context,
                                                            session['id'],
                                                            session['courseCode'],
                                                          ),
                                                      icon: const Icon(
                                                        Icons
                                                            .assignment_turned_in_outlined,
                                                        size: 14,
                                                      ),
                                                      label: Text(
                                                        tr('Check & Take Attendance'),
                                                      ),
                                                      style: OutlinedButton.styleFrom(
                                                        foregroundColor:
                                                            primaryColor,
                                                        side: BorderSide(
                                                          color: primaryColor
                                                              .withValues(
                                                                alpha: 0.5,
                                                              ),
                                                        ),
                                                        shape: RoundedRectangleBorder(
                                                          borderRadius:
                                                              BorderRadius.circular(
                                                                8,
                                                              ),
                                                        ),
                                                        textStyle:
                                                            GoogleFonts.inter(
                                                              fontSize: 11,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .bold,
                                                            ),
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      );
                                    }).toList(),
                                  );
                                },
                              ),
                              ],
                                  ],
                                  ),
                                ),
                              ),
                              ],
                            ),
                          ),
                        ),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
