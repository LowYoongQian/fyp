// ignore_for_file: deprecated_member_use, use_build_context_synchronously
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import '../../main.dart'; // for ApiConfig
import '../../widgets/glass_card.dart';
import '../../widgets/shimmer_loading.dart';
import 'face_scanner_screen.dart';
import 'full_timetable_screen.dart';

// -----------------------------------------------------------------
// SCREEN 2: Student Main Dashboard Shell (Tab Layout)
// -----------------------------------------------------------------
class MainScreen extends StatefulWidget {
  final int studentId;
  final String studentName;
  final String studentCode;
  final String studentEmail;
  final String authToken;
  final bool isFaceRegistered;
  final bool isCheckedInToday;
  final List<Map<String, dynamic>> attendanceHistory;
  final List<Map<String, dynamic>> studentSchedule;
  final List<Map<String, dynamic>> announcements;
  final bool isDatabaseOffline;
  final bool isSyncing;

  final VoidCallback onLogout;
  final Future<void> Function() onSyncRequested;
  final Function(int, String, String, String, String, bool, {int? challengeMs}) onCheckInComplete;
  final VoidCallback onRegisterFace;

  const MainScreen({
    super.key,
    required this.studentId,
    required this.studentName,
    required this.studentCode,
    required this.studentEmail,
    required this.authToken,
    required this.isFaceRegistered,
    required this.isCheckedInToday,
    required this.attendanceHistory,
    required this.studentSchedule,
    required this.announcements,
    required this.isDatabaseOffline,
    required this.isSyncing,
    required this.onLogout,
    required this.onSyncRequested,
    required this.onCheckInComplete,
    required this.onRegisterFace,
  });

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _activeTabIndex = 0; // 0 for Check-In, 1 for Schedule, 2 for History
  late PageController _pageController;
  
  // Real active sessions queried from backend
  List<Map<String, dynamic>> activeSessions = [];
  bool isLoadingSessions = false;
  String? sessionsError;

  // Report state variables
  int _attendanceFilterIndex = 0; // 0 for Today, 1 for Overall

  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _activeTabIndex);
    fetchActiveSessions();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  String _monthAbbreviation(int month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  }

  String _monthFullName(int month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  }

  Widget _buildPriorityBadge(String priority) {
    Color bgColor;
    Color textColor;
    IconData icon;

    if (priority == 'High') {
      bgColor = const Color(0xFFFEE2E2); // soft red
      textColor = const Color(0xFFEF4444); // red
      icon = Icons.error_outline;
    } else if (priority == 'Medium') {
      bgColor = const Color(0xFFFEF3C7); // soft amber
      textColor = const Color(0xFFD97706); // amber
      icon = Icons.warning_amber_outlined;
    } else {
      bgColor = const Color(0xFFF1F5F9); // soft slate
      textColor = const Color(0xFF64748B); // slate
      icon = Icons.info_outline;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: textColor, size: 10),
          const SizedBox(width: 4),
          Text(
            priority,
            style: GoogleFonts.inter(
              fontSize: 9,
              fontWeight: FontWeight.bold,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }

  String _dayOfWeekName(int day) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[day - 1];
  }

  int getMarkedCountForDate(DateTime date) {
    final isToday = date.year == ApiConfig.now.year &&
        date.month == ApiConfig.now.month &&
        date.day == ApiConfig.now.day;
    
    final matchLabel = "${_monthAbbreviation(date.month)} ${date.day}, ${date.year}".toLowerCase();

    return widget.attendanceHistory.where((log) {
      final logDate = log['date'].toString().toLowerCase();
      final isVerified = log['status'].toString().toLowerCase() == 'verified';
      if (!isVerified) return false;

      if (isToday) {
        return logDate.contains('today');
      } else {
        return logDate.contains(matchLabel);
      }
    }).length;
  }

  String getTodayCheckInTime() {
    final todayLog = widget.attendanceHistory.firstWhere(
      (log) {
        final logDate = log['date'].toString().toLowerCase();
        final isVerified = log['status'].toString().toLowerCase() == 'verified';
        return logDate.contains('today') && isVerified;
      },
      orElse: () => <String, dynamic>{},
    );
    if (todayLog.isEmpty) return "-";
    final dateStr = todayLog['date'].toString();
    if (dateStr.contains(',')) {
      return dateStr.split(',').last.trim();
    }
    return dateStr;
  }

  // Parse a "HH:mm" (24h) timetable string into a DateTime anchored to today.
  DateTime? _parseTodayTime(String? hhmm) {
    if (hhmm == null || !hhmm.contains(':')) return null;
    final parts = hhmm.split(':');
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    final now = ApiConfig.now;
    return DateTime(now.year, now.month, now.day, h, m);
  }

  // Format a "HH:mm" timetable string into a 12h display label e.g. "02:00 PM".
  String _formatDisplayTime(String? hhmm) {
    final dt = _parseTodayTime(hhmm);
    if (dt == null) return "-";
    final hour = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
    final amPm = dt.hour >= 12 ? 'PM' : 'AM';
    return "${hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} $amPm";
  }

  // Pick today's relevant class from the timetable: the one running now,
  // else the next upcoming today, else the last finished one. Null = no class.
  Map<String, dynamic>? getTodaySessionWindow() {
    final now = ApiConfig.now;
    final todayName = _dayOfWeekName(now.weekday);
    final todays = widget.studentSchedule.where((s) => s['day'] == todayName).toList();
    if (todays.isEmpty) return null;
    todays.sort((a, b) => (a['startTime'] as String).compareTo(b['startTime'] as String));

    Map<String, dynamic>? active;
    Map<String, dynamic>? upcoming;
    Map<String, dynamic>? finished;
    for (final s in todays) {
      final start = _parseTodayTime(s['startTime']);
      final end = _parseTodayTime(s['endTime']);
      if (start == null || end == null) continue;
      if (!now.isBefore(start) && now.isBefore(end)) {
        active = s;
      } else if (now.isBefore(start)) {
        upcoming ??= s;
      } else {
        finished = s;
      }
    }
    return active ?? upcoming ?? finished;
  }

  // Returns 'none' | 'before' | 'active' | 'after' for the given class window.
  String windowStatus(Map<String, dynamic>? window) {
    if (window == null) return 'none';
    final now = ApiConfig.now;
    final start = _parseTodayTime(window['startTime']);
    final end = _parseTodayTime(window['endTime']);
    if (start == null || end == null) return 'none';
    if (now.isBefore(start)) return 'before';
    if (now.isBefore(end)) return 'active';
    return 'after';
  }

  // Shared authed GET helper — every read goes through the backend with JWT.
  Future<http.Response> _authedGet(String path) {
    final apiUrl = ApiConfig.getEffectiveUrl();
    return http.get(
      Uri.parse('$apiUrl$path'),
      headers: {
        'Content-Type': 'application/json',
        if (widget.authToken.isNotEmpty) 'Authorization': 'Bearer ${widget.authToken}',
      },
    ).timeout(const Duration(seconds: 12));
  }

  // Query active lectures matching this student's enrolments (backend API).
  Future<void> fetchActiveSessions() async {
    if (isLoadingSessions) return;
    setState(() {
      isLoadingSessions = true;
      sessionsError = null;
    });

    try {
      final response = await _authedGet('/students/me/active-sessions');
      if (response.statusCode != 200) {
        throw Exception('Could not load sessions (${response.statusCode}).');
      }
      final List<dynamic> rawList = jsonDecode(response.body) as List<dynamic>;
      final List<Map<String, dynamic>> loadedList = [];
      for (final item in rawList) {
        loadedList.add({
          'sessionId': item['id'],
          'courseCode': item['course_code'] ?? 'Unknown',
          'courseName': item['course_name'] ?? 'Unknown',
          'classGroup': item['class_group'] ?? 'All',
          'isOpen': item['is_open'] ?? true,
          'alreadyCheckedIn': item['already_checked_in'] ?? false,
        });
      }
      setState(() => activeSessions = loadedList);
    } catch (e) {
      debugPrint("Error loading active sessions: $e");
      setState(() => sessionsError = _friendlyError(e));
    } finally {
      if (mounted) setState(() => isLoadingSessions = false);
    }
  }

  String _friendlyError(Object e) {
    final msg = e.toString().replaceAll("Exception: ", "");
    if (e is TimeoutException) {
      return "Server timed out. Check your connection and that the backend is running.";
    }
    if (msg.contains("SocketException") || msg.contains("Connection")) {
      return "Cannot reach the server. Make sure the backend is running.";
    }
    return msg;
  }



  Widget _buildFaceVerificationNotice() {
    if (widget.isFaceRegistered) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Color(0xFFF59E0B), size: 20),
                const SizedBox(width: 8),
                Text(
                  "Face Verification Required",
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF1E293B),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              "You need to register your selfie profile to enable smart biometric attendance check-in.",
              style: GoogleFonts.inter(
                fontSize: 11,
                color: const Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: widget.onRegisterFace,
              icon: const Icon(Icons.face_retouching_natural, size: 14),
              label: const Text("Verify"),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 1,
                textStyle: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTodayTimetableSection() {
    final todayName = _dayOfWeekName(ApiConfig.now.weekday);
    final todayClasses = widget.studentSchedule.where((item) {
      return item['day'].toString().toLowerCase() == todayName.toLowerCase();
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => FullTimetableScreen(schedule: widget.studentSchedule),
              ),
            );
          },
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "Timetable",
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const Icon(Icons.chevron_right, color: Color(0xFF64748B), size: 20),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        if (todayClasses.isEmpty)
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16.0),
              child: Center(
                child: Column(
                  children: [
                    const Icon(Icons.event_busy_outlined, color: Color(0xFF94A3B8), size: 20),
                    const SizedBox(height: 6),
                    Text(
                      "No classes scheduled for today.",
                      style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: todayClasses.length,
            separatorBuilder: (context, index) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final item = todayClasses[index];
              final group = item['group'] ?? 'Lecture';
              final groupStr = group.toString().toLowerCase();
              final isLecture = groupStr.startsWith('l');
              final isTutor = groupStr.startsWith('t');
              final badgeLetter = isLecture ? 'L' : (isTutor ? 'T' : 'P');
              
              final Color themeColor = isLecture
                  ? const Color(0xFF2563EB)
                  : (isTutor ? const Color(0xFF10B981) : const Color(0xFFF59E0B));
              
              return GlassCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 14,
                      backgroundColor: themeColor.withOpacity(0.15),
                      child: Text(
                        badgeLetter,
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: themeColor,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "${item['startTime']} - ${item['endTime']} · Room ${item['room']}",
                            style: GoogleFonts.inter(
                              fontSize: 9.5,
                              fontWeight: FontWeight.bold,
                              color: themeColor,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            "${item['courseName']} (${item['courseCode']})",
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          )
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          // Top Navigation Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      height: 36,
                      width: 36,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF2563EB), Color(0xFF3B82F6)],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Center(
                        child: Icon(Icons.qr_code_scanner, color: Colors.white, size: 18),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              "${ApiConfig.now.day.toString().padLeft(2, '0')}-${ApiConfig.now.month.toString().padLeft(2, '0')}",
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF0F172A),
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              _dayOfWeekName(ApiConfig.now.weekday),
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF64748B),
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "Smart Attendance Portal Client",
                          style: GoogleFonts.inter(
                            fontSize: 8,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF64748B),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                Row(
                  children: [
                    IconButton(
                      onPressed: () async {
                        await widget.onSyncRequested();
                        await fetchActiveSessions();
                      },
                      icon: const Icon(Icons.sync, color: Color(0xFF2563EB), size: 18),
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFEFF6FF),
                        padding: const EdgeInsets.all(8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: widget.onLogout,
                      icon: const Icon(Icons.logout, color: Color(0xFFEF4444), size: 18),
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFFEF2F2),
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

          // Welcome Card (Positioned directly under the Appbar)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
            child: GlassCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: const Color(0xFF2563EB).withValues(alpha: 0.1),
                    child: Text(
                      widget.studentName.substring(0, min(2, widget.studentName.length)).toUpperCase(),
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF2563EB),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Welcome, ${widget.studentName}",
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "ID: ${widget.studentCode} · ${widget.studentEmail}",
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            color: const Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Segmented Tab Selector
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9).withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0).withValues(alpha: 0.5)),
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                final tabWidth = width / 2;
                return Stack(
                  children: [
                    // Sliding Selection Pill
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 250),
                      curve: Curves.easeInOut,
                      left: _activeTabIndex * tabWidth,
                      width: tabWidth,
                      top: 0,
                      bottom: 0,
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            )
                          ],
                        ),
                      ),
                    ),
                    // Tab Buttons
                    Row(
                      children: [
                        Expanded(
                          child: _buildSegmentButton(0, "Dashboard List", Icons.qr_code_scanner),
                        ),
                        Expanded(
                          child: _buildSegmentButton(1, "Attendance", Icons.history),
                        ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),

          // Main View Render
          Expanded(
            child: PageView(
              controller: _pageController,
              onPageChanged: (idx) {
                setState(() => _activeTabIndex = idx);
              },
              children: [
                _buildCheckInTab(),
                _buildHistoryTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSegmentButton(int index, String label, IconData icon) {
    final isSelected = _activeTabIndex == index;
    return Material(
      key: ValueKey('segment_material_$index'),
      type: MaterialType.transparency,
      child: InkWell(
        key: ValueKey('segment_inkwell_$index'),
        onTap: () {
          if (_activeTabIndex == index) return;
          setState(() => _activeTabIndex = index);
          _pageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        },
        borderRadius: BorderRadius.circular(8),
        splashColor: const Color(0xFF2563EB).withValues(alpha: 0.08),
        highlightColor: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          color: Colors.transparent, // Always transparent, background is drawn by the stack's pill
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF64748B)),
              const SizedBox(width: 6),
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  color: isSelected ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCheckInTab() {
    return RefreshIndicator(
      onRefresh: () async {
        await widget.onSyncRequested();
        await fetchActiveSessions();
      },
      child: SingleChildScrollView(
        key: const ValueKey('check_in_tab'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildFaceVerificationNotice(),
            // Active Lectures from backend
            Text(
              "Available Session Windows",
              style: GoogleFonts.spaceGrotesk(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 8),
            (() {
              final now = ApiConfig.now;
              final todayName = _dayOfWeekName(now.weekday);
              final todayClasses = widget.studentSchedule.where((item) {
                return item['day'].toString().toLowerCase() == todayName.toLowerCase();
              }).toList();

              // Filter out classes that have already ended
              final remainingClasses = todayClasses.where((cls) {
                final endTimeStr = cls['endTime'].toString();
                final endDt = _parseTodayTime(endTimeStr);
                if (endDt == null) return true;
                return !now.isAfter(endDt);
              }).toList();

              remainingClasses.sort((a, b) => (a['startTime'] as String).compareTo(b['startTime'] as String));

              if (isLoadingSessions) {
                return ShimmerLoading(
                  isLoading: true,
                  child: Column(
                    children: List.generate(1, (index) => 
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: GlassCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Container(
                                    width: 80,
                                    height: 14,
                                    decoration: BoxDecoration(
                                      color: Colors.grey.shade300,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                  ),
                                  Container(
                                    width: 60,
                                    height: 14,
                                    decoration: BoxDecoration(
                                      color: Colors.grey.shade300,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Container(
                                height: 18,
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade300,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Container(
                                width: 150,
                                height: 14,
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade300,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                              ),
                              const SizedBox(height: 16),
                              Container(
                                height: 38,
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade300,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }

              if (sessionsError != null) {
                return GlassCard(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 8),
                    child: Column(
                      children: [
                        const Icon(Icons.cloud_off, color: Color(0xFFEF4444), size: 24),
                        const SizedBox(height: 6),
                        Text(
                          sessionsError!,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
                        ),
                        const SizedBox(height: 10),
                        OutlinedButton.icon(
                          onPressed: fetchActiveSessions,
                          icon: const Icon(Icons.refresh, size: 14),
                          label: const Text("Retry"),
                        ),
                      ],
                    ),
                  ),
                );
              }

              final List<Widget> cards = [];

              if (remainingClasses.isNotEmpty) {
                final cls = remainingClasses.first;
                final courseCode = cls['courseCode'].toString();
                final courseName = cls['courseName'].toString();
                final classGroup = cls['classGroup'].toString();
                final startTimeStr = cls['startTime'].toString();
                final endTimeStr = cls['endTime'].toString();
                final room = cls['room'].toString();

                final startDt = _parseTodayTime(startTimeStr);
                final endDt = _parseTodayTime(endTimeStr);

                final isLectureSlot = cls['group'].toString().toLowerCase().startsWith('l');
                
                final activeSess = activeSessions.firstWhere(
                  (s) => s['courseCode'] == courseCode &&
                         (isLectureSlot ? s['classGroup'] == 'All' : s['classGroup'] != 'All'),
                  orElse: () => <String, dynamic>{},
                );

                final bool isSessionOpen = activeSess.isNotEmpty && activeSess['isOpen'] == true;
                final int? sessionId = activeSess.isNotEmpty ? activeSess['sessionId'] as int? : null;

                final isThisSessionCheckedIn = widget.isCheckedInToday &&
                    widget.attendanceHistory.any((record) =>
                        record['courseCode'] == courseCode &&
                        record['date'].toString().contains('Today') &&
                        record['status'] == 'Verified');

                bool classStarted = false;
                bool classEnded = false;
                String remainingHint = "";

                if (startDt != null && endDt != null) {
                  classStarted = !now.isBefore(startDt);
                  classEnded = now.isAfter(endDt);

                  if (!classStarted) {
                    final diff = startDt.difference(now);
                    if (diff.inHours > 0) {
                      remainingHint = "Class starts in ${diff.inHours}h ${diff.inMinutes % 60}m";
                    } else {
                      remainingHint = "Class starts in ${diff.inMinutes}m";
                    }
                  } else if (!classEnded) {
                    final diff = endDt.difference(now);
                    if (diff.inHours > 0) {
                      remainingHint = "Class ends in ${diff.inHours}h ${diff.inMinutes % 60}m";
                    } else {
                      remainingHint = "Class ends in ${diff.inMinutes}m";
                    }
                  } else {
                    remainingHint = "Class ended at ${_formatDisplayTime(endTimeStr)}";
                  }
                }

                final bool canCheckIn = isSessionOpen && classStarted && !classEnded && !isThisSessionCheckedIn;

                final Color themeColor = isSessionOpen && classStarted && !classEnded
                    ? const Color(0xFF2563EB)
                    : const Color(0xFF94A3B8);

                cards.add(
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: GlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: isSessionOpen && classStarted && !classEnded
                                      ? const Color(0xFFEFF6FF)
                                      : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  isThisSessionCheckedIn
                                      ? "COMPLETED"
                                      : isSessionOpen
                                          ? (classStarted
                                              ? (classEnded ? "CLOSED" : "ACTIVE WINDOW")
                                              : "UPCOMING (OPEN)")
                                          : "SESSION NOT ACTIVE",
                                  style: GoogleFonts.inter(
                                    fontSize: 8,
                                    fontWeight: FontWeight.bold,
                                    color: isThisSessionCheckedIn
                                        ? const Color(0xFF10B981)
                                        : isSessionOpen && classStarted && !classEnded
                                            ? const Color(0xFF2563EB)
                                            : const Color(0xFF64748B),
                                  ),
                                ),
                              ),
                              Text(
                                "Tut Group: $classGroup",
                                style: GoogleFonts.inter(
                                  fontSize: 9,
                                  color: isSessionOpen && classStarted && !classEnded
                                      ? const Color(0xFF2563EB)
                                      : const Color(0xFF64748B),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            "$courseCode - $courseName",
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "${_formatDisplayTime(startTimeStr)} - ${_formatDisplayTime(endTimeStr)} · Room $room",
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              color: const Color(0xFF64748B),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          if (remainingHint.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Icon(
                                  Icons.access_time,
                                  size: 11,
                                  color: isSessionOpen && classStarted && !classEnded
                                      ? const Color(0xFF2563EB)
                                      : const Color(0xFF94A3B8),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  remainingHint,
                                  style: GoogleFonts.inter(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w600,
                                    color: isSessionOpen && classStarted && !classEnded
                                        ? const Color(0xFF2563EB)
                                        : const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 16),

                          isThisSessionCheckedIn
                              ? Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFECFDF5),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.2)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(Icons.check_circle_outline, color: Color(0xFF10B981), size: 16),
                                      const SizedBox(width: 6),
                                      Text(
                                        "CHECK-IN REGISTERED",
                                        style: GoogleFonts.inter(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF10B981),
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              : ElevatedButton.icon(
                                  onPressed: !canCheckIn
                                      ? null
                                      : () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) => FaceScannerScreen(
                                                title: "$courseCode Check-In",
                                                onScanComplete: (imageBase64, livenessPassed, {int? challengeMs}) {
                                                  if (imageBase64 == null || imageBase64.isEmpty || !livenessPassed) {
                                                    ScaffoldMessenger.of(context).showSnackBar(
                                                      const SnackBar(
                                                        content: Text("Check-in cancelled: face scan or liveness was not completed."),
                                                        backgroundColor: Color(0xFFDC2626),
                                                      ),
                                                    );
                                                    return;
                                                  }
                                                  widget.onCheckInComplete(
                                                    sessionId!,
                                                    "Campus-Staff-WiFi",
                                                    courseCode,
                                                    courseName,
                                                    imageBase64,
                                                    livenessPassed,
                                                    challengeMs: challengeMs,
                                                  );
                                                },
                                              ),
                                            ),
                                          );
                                        },
                                  icon: Icon(
                                    isSessionOpen
                                        ? (classStarted
                                            ? (classEnded ? Icons.lock_clock : Icons.qr_code_scanner)
                                            : Icons.lock_clock)
                                        : Icons.lock_clock,
                                    size: 14,
                                  ),
                                  label: Text(
                                    isSessionOpen
                                        ? (classStarted
                                            ? (classEnded ? "Attendance Closed" : "Perform Face & WiFi Check-In")
                                            : "Opens at ${_formatDisplayTime(startTimeStr)}")
                                        : "Session Not Open",
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: themeColor,
                                    foregroundColor: Colors.white,
                                    disabledBackgroundColor: const Color(0xFFCBD5E1),
                                    disabledForegroundColor: const Color(0xFF94A3B8),
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    elevation: canCheckIn ? 2 : 0,
                                    textStyle: GoogleFonts.inter(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                        ],
                      ),
                    ),
                  ),
                );
              }

              if (cards.isEmpty) {
                return GlassCard(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16.0),
                    child: Center(
                      child: Column(
                        children: [
                          const Icon(Icons.notifications_none, color: Color(0xFF94A3B8), size: 24),
                          const SizedBox(height: 6),
                          Text(
                            "No active session windows available at this time.",
                            style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }

              return Column(
                children: cards,
              );
            })(),
            const SizedBox(height: 20),
            _buildTodayTimetableSection(),
            const SizedBox(height: 20), // Announcements Header
            Text(
              "Important Announcements",
              style: GoogleFonts.spaceGrotesk(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 8),

            if (widget.announcements.isEmpty)
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Center(
                    child: Text(
                      "No announcements published at this time.",
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: const Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              )
            else
              ...widget.announcements.map((ann) {
                final dateRaw = ann['created_at'] as String?;
                String dateStr = 'Unknown Date';
                if (dateRaw != null) {
                  final dt = DateTime.tryParse(dateRaw)?.toLocal();
                  if (dt != null) {
                    final months = const ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                    dateStr = "${months[dt.month - 1]} ${dt.day}, ${dt.year}";
                  }
                }
                
                final hasImage = ann['image_base64'] != null && ann['image_base64'].toString().isNotEmpty;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: GlassCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (hasImage)
                          ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                            child: AspectRatio(
                              aspectRatio: 16 / 9,
                              child: Image.memory(
                                base64Decode(ann['image_base64'].toString().split(',').last),
                                width: double.infinity,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.campaign_outlined,
                                      color: Color(0xFF2563EB),
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                ann['title'] ?? 'Notice',
                                                style: GoogleFonts.spaceGrotesk(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.bold,
                                                  color: const Color(0xFF1E293B),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            _buildPriorityBadge(ann['priority'] as String? ?? 'Low'),
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          "Posted: $dateStr",
                                          style: GoogleFonts.inter(
                                            fontSize: 9,
                                            color: const Color(0xFF64748B),
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(
                                ann['content'] ?? '',
                                style: GoogleFonts.inter(
                                  fontSize: 10.5,
                                  color: const Color(0xFF64748B),
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }


  Widget _buildHistoryTab() {
    final now = ApiConfig.now;
    final dayAbbrev = const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][now.weekday - 1];
    final monthAbbrev = _monthAbbreviation(now.month);
    final todayLabelStr = "$dayAbbrev, ${now.day} $monthAbbrev ${now.year} (today)";

    final reportDayOfWeek = _dayOfWeekName(now.weekday);
    final reportMonthName = _monthFullName(now.month);
    final reportDateLabelStr = "$reportDayOfWeek, $reportMonthName ${now.day}, ${now.year}";

    final todayCheckInTime = getTodayCheckInTime();
    final hasCheckedInToday = todayCheckInTime != "-";

    // Today's scheduled class window (drives the Live Attendance times + button gating).
    final todaySession = getTodaySessionWindow();
    final sessionStatus = windowStatus(todaySession);
    final sessionStartLabel = _formatDisplayTime(todaySession?['startTime']);
    final sessionEndLabel = _formatDisplayTime(todaySession?['endTime']);
    // Clock-in only allowed inside the window, and only if not already done.
    final canClockIn = sessionStatus == 'active' && !hasCheckedInToday;

    final filteredLogs = widget.attendanceHistory.where((log) {
      if (_attendanceFilterIndex == 0) {
        return log['date'].toString().toLowerCase().contains('today');
      }
      return true;
    }).toList();

    return RefreshIndicator(
      onRefresh: () async {
        await widget.onSyncRequested();
        await fetchActiveSessions();
      },
      child: SingleChildScrollView(
        key: const ValueKey('history_tab'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildFaceVerificationNotice(),
          // 1. Daily Attendance Report Section
          Text(
            "Daily Attendance Report",
            style: GoogleFonts.spaceGrotesk(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            reportDateLabelStr,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFBFDBFE).withValues(alpha: 0.5)),
                  ),
                  child: Column(
                    children: [
                      Text(
                        "Marked",
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: const Color(0xFF2563EB),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "${getMarkedCountForDate(now)}",
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF1E293B),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFBFDBFE).withValues(alpha: 0.5)),
                  ),
                  child: Column(
                    children: [
                      Text(
                        "Enrolled",
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: const Color(0xFF2563EB),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "26",
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF1E293B),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // 2. Live Attendance Section
          Text(
            "Live attendance",
            style: GoogleFonts.spaceGrotesk(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 8),

          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF64748B)),
                    const SizedBox(width: 8),
                    Text(
                      todayLabelStr,
                      style: GoogleFonts.inter(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Padding(
                  padding: const EdgeInsets.only(left: 22.0),
                  child: Text(
                    todaySession != null
                        ? "${todaySession['courseCode']} · ${todaySession['group']} ($sessionStartLabel - $sessionEndLabel)"
                        : "No scheduled class today",
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Start time",
                          style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF94A3B8), fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          sessionStartLabel,
                          style: GoogleFonts.spaceGrotesk(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF1E293B)),
                        ),
                      ],
                    ),
                    Expanded(
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 16),
                        child: Row(
                          children: [
                            Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFFCBD5E1), shape: BoxShape.circle)),
                            Expanded(child: Container(height: 1, color: const Color(0xFFCBD5E1))),
                            Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFFCBD5E1), shape: BoxShape.circle)),
                          ],
                        ),
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          "End time",
                          style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF94A3B8), fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          sessionEndLabel,
                          style: GoogleFonts.spaceGrotesk(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF1E293B)),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      "Time is  ",
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const _LiveClock(),
                  ],
                ),
                const SizedBox(height: 16),

                ElevatedButton.icon(
                  onPressed: (!hasCheckedInToday && !canClockIn)
                      ? null // disabled outside the class window / no class
                      : () {
                    if (hasCheckedInToday) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text("You have already checked in today at $todayCheckInTime!"),
                          backgroundColor: const Color(0xFF10B981),
                        ),
                      );
                      return;
                    }

                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => FaceScannerScreen(
                          title: "Daily Attendance Scan",
                          onScanComplete: (imageBase64, livenessPassed, {int? challengeMs}) {
                            if (imageBase64 == null || imageBase64.isEmpty || !livenessPassed) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text("Check-in cancelled: face scan or liveness was not completed."),
                                  backgroundColor: Color(0xFFDC2626),
                                ),
                              );
                              return;
                            }
                            if (activeSessions.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text("No open session to check in to right now."),
                                  backgroundColor: Color(0xFFF59E0B),
                                ),
                              );
                              return;
                            }
                            final session = activeSessions.first;
                            widget.onCheckInComplete(
                              session['sessionId'],
                              "Campus-Staff-WiFi",
                              session['courseCode'],
                              session['courseName'],
                              imageBase64,
                              livenessPassed,
                              challengeMs: challengeMs,
                            );
                          },
                        ),
                      ),
                    );
                  },
                  icon: Icon(
                    hasCheckedInToday
                        ? Icons.check_circle
                        : (canClockIn ? Icons.qr_code_scanner : Icons.lock_clock),
                    size: 14,
                  ),
                  label: Text(
                    hasCheckedInToday
                        ? "Clocked In Successfully"
                        : sessionStatus == 'active'
                            ? "Clock in"
                            : sessionStatus == 'before'
                                ? "Opens at $sessionStartLabel"
                                : sessionStatus == 'after'
                                    ? "Attendance closed"
                                    : "No class today",
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: hasCheckedInToday ? const Color(0xFF10B981) : const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(0xFF94A3B8),
                    disabledForegroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 1,
                    textStyle: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // 3. Attendance Log Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Attendance Log",
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF0F172A),
                ),
              ),
              Row(
                children: [
                  _buildFilterChip("Today", 0),
                  const SizedBox(width: 8),
                  _buildFilterChip("Overall", 1),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),

          if (_attendanceFilterIndex == 0)
            (filteredLogs.isEmpty
                ? GlassCard(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24.0),
                      child: Center(
                        child: Text(
                          "No attendance logs recorded today.",
                          style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8)),
                        ),
                      ),
                    ),
                  )
                : ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: filteredLogs.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final log = filteredLogs[index];
                      final isVerified = log['status'] == 'Verified';
                      final courseCode = log['courseCode'].toString().toUpperCase();
                      final courseName = log['courseName'].toString().toUpperCase();
                      final firstChar = courseCode.isNotEmpty ? courseCode.substring(0, 1) : "C";

                      final logDate = log['date'].toString();
                      final timePart = logDate.contains(',') ? logDate.split(',').last.trim() : logDate;
                      final timeRoomHeader = "$timePart, Room ${log['group']}";

                      final footerLabel = isVerified ? "Registered at $timePart" : "Absent";

                      String lecturerName = "DR. WONG KANG SHIANG";
                      if (courseCode.contains('GEN') || courseCode.contains('T_')) {
                        lecturerName = "JULIAN GOH TOK MIN";
                      }

                      return GlassCard(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 16,
                              backgroundColor: const Color(0xFF2563EB).withValues(alpha: 0.1),
                              child: Text(
                                firstChar,
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF2563EB),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    timeRoomHeader,
                                    style: GoogleFonts.inter(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFF2563EB),
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    "$courseName ($courseCode)",
                                    style: GoogleFonts.spaceGrotesk(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF0F172A),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      const Icon(Icons.person_outline, size: 11, color: Color(0xFF64748B)),
                                      const SizedBox(width: 4),
                                      Text(
                                        lecturerName,
                                        style: GoogleFonts.inter(
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w500,
                                          color: const Color(0xFF64748B),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Column(
                              mainAxisAlignment: MainAxisAlignment.end,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                const SizedBox(height: 26),
                                Text(
                                  footerLabel,
                                  style: GoogleFonts.inter(
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                    color: isVerified ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ))
          else
            _buildOverallCoursesTab(),
        ],
      ),
    ));
  }

  List<Map<String, dynamic>> _getOverallCourseStats() {
    final List<Map<String, dynamic>> result = [];
    final Set<String> seenCodes = {};

    // 1. Gather all enrolled courses the student has in their timetable schedule.
    for (final course in widget.studentSchedule) {
      final code = course['courseCode'].toString().toUpperCase();
      final name = course['courseName'].toString().toUpperCase();
      final rate = course['attendanceRate'] as double? ?? 100.0;

      if (!seenCodes.contains(code)) {
        seenCodes.add(code);
        result.add({
          'courseCode': code,
          'courseName': name,
          'percentage': rate,
        });
      }
    }

    // 2. Also incorporate any course from attendanceHistory that isn't in studentSchedule.
    final Map<String, List<Map<String, dynamic>>> groupedLogs = {};
    for (final log in widget.attendanceHistory) {
      final code = log['courseCode'].toString().toUpperCase();
      groupedLogs.putIfAbsent(code, () => []).add(log);
    }

    for (final entry in groupedLogs.entries) {
      final code = entry.key;
      if (seenCodes.contains(code)) continue;

      final logs = entry.value;
      final name = logs.first['courseName'].toString().toUpperCase();
      final total = logs.length;
      final attended = logs.where((l) => l['status'].toString().toLowerCase() == 'verified').length;
      final percentage = total > 0 ? (attended / total) * 100.0 : 0.0;

      seenCodes.add(code);
      result.add({
        'courseCode': code,
        'courseName': name,
        'percentage': percentage,
      });
    }

    return result;
  }

  Widget _buildCircularPercentage(double percentage) {
    final Color color;
    if (percentage < 80.0) {
      color = const Color(0xFFEF4444);
    } else if (percentage < 90.0) {
      color = const Color(0xFFF59E0B);
    } else {
      color = const Color(0xFF10B981);
    }

    return SizedBox(
      height: 48,
      width: 48,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CircularProgressIndicator(
            value: percentage / 100.0,
            strokeWidth: 4.5,
            backgroundColor: color.withValues(alpha: 0.1),
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
          Text(
            "${percentage.toInt()}%",
            style: GoogleFonts.spaceGrotesk(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverallCoursesTab() {
    final overallStats = _getOverallCourseStats();

    if (overallStats.isEmpty) {
      return GlassCard(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 24.0),
          child: Center(
            child: Text(
              "No enrolled courses available.",
              style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8)),
            ),
          ),
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: overallStats.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final course = overallStats[index];
        final courseCode = course['courseCode'].toString().toUpperCase();
        final courseName = course['courseName'].toString().toUpperCase();
        final percentage = course['percentage'] as double;

        return GlassCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      courseName,
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "($courseCode)",
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              _buildCircularPercentage(percentage),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFilterChip(String label, int index) {
    final isSelected = _attendanceFilterIndex == index;
    return InkWell(
      onTap: () => setState(() => _attendanceFilterIndex = index),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFBFDBFE).withValues(alpha: 0.5),
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 9,
            fontWeight: FontWeight.bold,
            color: isSelected ? Colors.white : const Color(0xFF2563EB),
          ),
        ),
      ),
    );
  }

  int min(int a, int b) => a < b ? a : b;
}

// Isolated clock widget — owns its own 1-second timer so it never triggers
// a rebuild of the parent StudentDashboard.
class _LiveClock extends StatefulWidget {
  const _LiveClock();

  @override
  State<_LiveClock> createState() => _LiveClockState();
}

class _LiveClockState extends State<_LiveClock> {
  late Timer _timer;
  late String _timeStr;

  @override
  void initState() {
    super.initState();
    _timeStr = _format(ApiConfig.now);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _timeStr = _format(ApiConfig.now));
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  String _format(DateTime t) {
    final hour = t.hour == 0 ? 12 : (t.hour > 12 ? t.hour - 12 : t.hour);
    final amPm = t.hour >= 12 ? 'PM' : 'AM';
    return "${hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}:${t.second.toString().padLeft(2, '0')} $amPm";
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      _timeStr,
      style: GoogleFonts.spaceGrotesk(
        fontSize: 24,
        fontWeight: FontWeight.bold,
        color: const Color(0xFF2563EB),
      ),
    );
  }
}
