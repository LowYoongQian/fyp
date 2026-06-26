// ignore_for_file: deprecated_member_use, use_build_context_synchronously
import 'dart:async';
import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import '../../widgets/glass_card.dart';
import '../../main.dart';

// -----------------------------------------------------------------
// SCREEN 3: Lecturer/Staff Dashboard widget
// -----------------------------------------------------------------
class StaffDashboard extends StatefulWidget {
  final int staffId;
  final String staffName;
  final String staffCode;
  final String staffEmail;
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
  List<Map<String, dynamic>> myCourses = [];
  List<Map<String, dynamic>> myTimetable = [];
  List<Map<String, dynamic>> myActiveSessions = [];
  bool isLoading = false;
  String? loadError;
  int? selectedCourseId;
  String selectedGroup = 'All';
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    loadLecturerData();
    _countdownTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (widget.authToken.isNotEmpty) 'Authorization': 'Bearer ${widget.authToken}',
      };

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

  String _detailOf(http.Response r, String fallback) {
    try {
      return (jsonDecode(r.body)['detail'] ?? fallback) as String;
    } catch (_) {
      return fallback;
    }
  }

  String _fmtTime(String? iso) {
    if (iso == null) return "";
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return "";
    final h = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
    return "${h.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} ${dt.hour >= 12 ? 'PM' : 'AM'}";
  }

  // Load lecturer courses, timetable, and active sessions from the backend API.
  Future<void> loadLecturerData() async {
    if (isLoading) return;
    setState(() {
      isLoading = true;
      loadError = null;
    });

    try {
      // 1. Courses taught by this lecturer
      final coursesResp = await http
          .get(Uri.parse('${widget.apiBaseUrl}/sessions/my-courses'), headers: _headers)
          .timeout(const Duration(seconds: 12));
      if (coursesResp.statusCode != 200) {
        throw Exception(_detailOf(coursesResp, 'Could not load courses (${coursesResp.statusCode}).'));
      }
      final List<dynamic> rawCourses = jsonDecode(coursesResp.body) as List<dynamic>;
      final courses = rawCourses
          .map((c) => {'id': c['id'] as int, 'name': c['course_name'] ?? 'Unknown', 'code': c['course_code'] ?? '?'})
          .toList();

      // 2. Timetable slots for this lecturer
      final timetableResp = await http
          .get(Uri.parse('${widget.apiBaseUrl}/lecturers/me/timetable'), headers: _headers)
          .timeout(const Duration(seconds: 12));
      if (timetableResp.statusCode != 200) {
        throw Exception(_detailOf(timetableResp, 'Could not load timetable (${timetableResp.statusCode}).'));
      }
      final List<dynamic> rawTimetable = jsonDecode(timetableResp.body) as List<dynamic>;
      final timetable = rawTimetable.map((t) => {
        'id': t['id'] as int,
        'courseId': t['course_id'] as int,
        'courseCode': t['course_code'] ?? '',
        'courseName': t['course_name'] ?? '',
        'day': t['schedule_day'] ?? '',
        'startTime': t['schedule_start'] ?? '',
        'endTime': t['schedule_end'] ?? '',
        'room': t['schedule_room'] ?? '',
        'role': t['role'] ?? 'Lecture',
      }).toList();

      // 3. Active sessions for this lecturer's courses
      final sessResp = await http
          .get(Uri.parse('${widget.apiBaseUrl}/sessions/active'), headers: _headers)
          .timeout(const Duration(seconds: 12));
      if (sessResp.statusCode != 200) {
        throw Exception(_detailOf(sessResp, 'Could not load sessions (${sessResp.statusCode}).'));
      }
      final List<dynamic> rawSessions = jsonDecode(sessResp.body) as List<dynamic>;
      final courseById = {for (final c in courses) c['id']: c};
      final sessions = rawSessions.map((s) {
        final c = courseById[s['course_id']];
        return {
          'sessionId': s['id'],
          'courseId': s['course_id'],
          'courseCode': c?['code'] ?? '?',
          'courseName': c?['name'] ?? 'Course ${s['course_id']}',
          'classGroup': s['class_group'] ?? 'All',
          'time': "Opened at ${_fmtTime(s['opened_at'])}",
        };
      }).toList();

      setState(() {
        myCourses = courses;
        myTimetable = timetable;
        myActiveSessions = sessions;
        if (courses.isNotEmpty && selectedCourseId == null) {
          selectedCourseId = courses.first['id'] as int;
        }
      });
    } catch (e) {
      debugPrint("Failed to load lecturer data: $e");
      setState(() => loadError = _friendlyError(e));
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  DateTime _getSlotDateTime(String day, String timeStr, DateTime now) {
    final weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    final targetWeekday = weekdays.indexOf(day.toLowerCase()) + 1;
    if (targetWeekday == 0) return now;

    final daysDiff = targetWeekday - now.weekday;
    var targetDate = now.add(Duration(days: daysDiff));

    final parts = timeStr.split(':');
    final h = int.tryParse(parts[0]) ?? 0;
    final m = int.tryParse(parts[1]) ?? 0;
    return DateTime(targetDate.year, targetDate.month, targetDate.day, h, m);
  }

  Map<String, dynamic>? _getUpcomingSlot() {
    if (myTimetable.isEmpty) return null;

    final now = ApiConfig.now;
    final List<Map<String, dynamic>> slotsWithConcreteDates = [];

    for (final t in myTimetable) {
      var startDt = _getSlotDateTime(t['day'] as String, t['startTime'] as String, now);
      var endDt = _getSlotDateTime(t['day'] as String, t['endTime'] as String, now);

      if (now.isAfter(endDt)) {
        startDt = startDt.add(const Duration(days: 7));
        endDt = endDt.add(const Duration(days: 7));
      }

      slotsWithConcreteDates.add({
        ...t,
        'startDateTime': startDt,
        'endDateTime': endDt,
      });
    }

    // Sort by startDateTime ascending
    slotsWithConcreteDates.sort((a, b) {
      return (a['startDateTime'] as DateTime).compareTo(b['startDateTime'] as DateTime);
    });

    return slotsWithConcreteDates.isEmpty ? null : slotsWithConcreteDates.first;
  }

  // Open a new attendance check-in window via the backend.
  Future<void> handleOpenSession(Map<String, dynamic> upcomingSlot) async {
    final courseId = upcomingSlot['courseId'] as int;
    final role = upcomingSlot['role'] as String;
    final classGroupToSend = (role == 'Lecture') ? 'All' : 'G1';

    setState(() => isLoading = true);

    try {
      final resp = await http
          .post(
            Uri.parse('${widget.apiBaseUrl}/sessions/open'),
            headers: _headers,
            body: jsonEncode({'course_id': courseId, 'class_group': classGroupToSend}),
          )
          .timeout(const Duration(seconds: 12));

      if (resp.statusCode != 201 && resp.statusCode != 200) {
        throw Exception(_detailOf(resp, 'Could not open session (${resp.statusCode}).'));
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Check-In window opened for ${upcomingSlot['courseCode']}!"),
          backgroundColor: const Color(0xFF10B981),
        ),
      );

      await loadLecturerData();
    } catch (e) {
      showErrorDialog(_friendlyError(e));
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  // Close an attendance check-in window via the backend.
  Future<void> handleCloseSession(int sessionId, String courseCode) async {
    setState(() => isLoading = true);
    try {
      final resp = await http
          .post(Uri.parse('${widget.apiBaseUrl}/sessions/$sessionId/close'), headers: _headers)
          .timeout(const Duration(seconds: 12));
      if (resp.statusCode != 200) {
        throw Exception(_detailOf(resp, 'Could not close session (${resp.statusCode}).'));
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Check-In window closed for $courseCode."),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );

      await loadLecturerData();
    } catch (e) {
      showErrorDialog(_friendlyError(e));
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  // View checked-in students for a session via the backend.
  Future<void> handleViewAttendees(int sessionId, String courseCode) async {
    setState(() => isLoading = true);
    List<Map<String, dynamic>> attendees = [];

    try {
      final resp = await http
          .get(Uri.parse('${widget.apiBaseUrl}/sessions/$sessionId/attendance'), headers: _headers)
          .timeout(const Duration(seconds: 12));
      if (resp.statusCode != 200) {
        throw Exception(_detailOf(resp, 'Could not load attendees (${resp.statusCode}).'));
      }

      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      final List<dynamic> list = data['attendance_list'] as List<dynamic>? ?? [];
      for (final a in list) {
        if (a['status'] != 'present') continue; // show only those checked in
        attendees.add({
          'name': a['student_name'] ?? 'Unknown',
          'code': a['student_code'] ?? '',
          'wifi': a['network_verified'] ?? false,
          'face': true,
          'time': _fmtTime(a['marked_at'] as String?),
        });
      }
    } catch (e) {
      if (mounted) setState(() => isLoading = false);
      showErrorDialog(_friendlyError(e));
      return;
    }

    if (mounted) setState(() => isLoading = false);
    if (!mounted) return;

    showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (ctx) {
          return ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
              child: Container(
                color: Colors.white.withValues(alpha: 0.9),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "$courseCode Attendees (${attendees.length})",
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(ctx),
                          icon: const Icon(Icons.close, size: 20),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (attendees.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 30.0),
                        child: Center(
                          child: Text(
                            "No student check-ins registered yet.",
                            style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
                          ),
                        ),
                      )
                    else
                      Flexible(
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: attendees.length,
                          separatorBuilder: (c, idx) => const Divider(color: Color(0xFFE2E8F0)),
                          itemBuilder: (c, idx) {
                            final student = attendees[idx];
                            return Row(
                              children: [
                                CircleAvatar(
                                  radius: 16,
                                  backgroundColor: const Color(0xFF800000).withValues(alpha: 0.1),
                                  child: const Icon(Icons.person, size: 14, color: Color(0xFF800000)),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        student['name'],
                                        style: GoogleFonts.inter(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF1E293B),
                                        ),
                                      ),
                                      Text(
                                        student['code'],
                                        style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF64748B)),
                                      ),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(
                                          student['wifi'] ? Icons.wifi : Icons.wifi_off,
                                          size: 12,
                                          color: student['wifi'] ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                        ),
                                        const SizedBox(width: 4),
                                        Icon(
                                          student['face'] ? Icons.face : Icons.error_outline,
                                          size: 12,
                                          color: student['face'] ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      student['time'],
                                      style: GoogleFonts.inter(fontSize: 9, color: const Color(0xFF94A3B8)),
                                    ),
                                  ],
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      );
  }

  void showErrorDialog(String error) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Operation Failed", style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold)),
        content: Text(error, style: const TextStyle(fontSize: 12)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("OK")),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final Color primaryColor = const Color(0xFF800000); // Staff Maroon

    return SafeArea(
      child: Stack(
        children: [
          Column(
            children: [
              // Top Bar
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
                            gradient: LinearGradient(
                              colors: [primaryColor, const Color(0xFFAA0000)],
                            ),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Center(
                            child: Icon(Icons.school, color: Colors.white, size: 18),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Lecturer Portal",
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                            Text(
                              "MANAGEMENT & REGISTRY",
                              style: GoogleFonts.inter(
                                  fontSize: 8,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF64748B),
                                  letterSpacing: 1.0,
                                ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        IconButton(
                          onPressed: () {
                            widget.onSyncRequested();
                            loadLecturerData();
                          },
                          icon: Icon(Icons.sync, color: primaryColor, size: 18),
                          style: IconButton.styleFrom(
                            backgroundColor: primaryColor.withOpacity(0.1),
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

              // Status Warning Banner
              if (loadError != null)
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF1F2),
                    border: Border.all(color: const Color(0xFFF43F5E).withOpacity(0.3)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_off, color: Color(0xFFE11D48), size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          loadError!,
                          style: GoogleFonts.inter(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFFBE123C),
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: loadLecturerData,
                        child: const Text("Retry", style: TextStyle(fontSize: 10)),
                      ),
                    ],
                  ),
                ),


              // Content Area
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Profile Card
                      GlassCard(
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 24,
                              backgroundColor: primaryColor.withOpacity(0.1),
                              child: Text(
                                widget.staffName.substring(0, widget.staffName.length >= 2 ? 2 : widget.staffName.length).toUpperCase(),
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: primaryColor,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    widget.staffName,
                                    style: GoogleFonts.spaceGrotesk(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF0F172A),
                                    ),
                                  ),
                                  Text(
                                    "Staff ID: ${widget.staffCode} · ${widget.staffEmail}",
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
                      const SizedBox(height: 20),

                      // Upcoming Class Check-In Card
                      Text(
                        "Upcoming Class Check-In",
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Builder(
                        builder: (context) {
                          final upcomingSlot = _getUpcomingSlot();
                          if (upcomingSlot == null) {
                            return const GlassCard(
                              child: Padding(
                                padding: EdgeInsets.symmetric(vertical: 20),
                                child: Center(
                                  child: Text(
                                    "No upcoming classes found in your timetable.",
                                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                  ),
                                ),
                              ),
                            );
                          }

                                                  final startDt = upcomingSlot['startDateTime'] as DateTime;
                          final endDt = upcomingSlot['endDateTime'] as DateTime;
                          final now = ApiConfig.now;

                          final isCurrentlyActive = now.isAfter(startDt) && now.isBefore(endDt);
                          final isOpenWindow = now.isAfter(startDt.subtract(const Duration(hours: 1))) && now.isBefore(endDt);
                          
                          // Check if already open (only within the valid pre-open/active window)
                          final isAlreadyOpen = isOpenWindow && myActiveSessions.any((s) =>
                              s['courseId'] == upcomingSlot['courseId'] &&
                              (upcomingSlot['role'] == 'Lecture' ? s['classGroup'] == 'All' : s['classGroup'].toString().startsWith('G')));

                          String hintText = "";
                          String buttonText = "Open Attendance Gate";
                          bool buttonEnabled = false;

                          if (isAlreadyOpen) {
                            hintText = "Attendance gate is currently live.";
                            buttonText = "Attendance Gate is Live";
                            buttonEnabled = false;
                          } else if (isCurrentlyActive) {
                            hintText = "Class is currently in progress.";
                            buttonText = "Open Attendance Gate";
                            buttonEnabled = true;
                          } else if (isOpenWindow) {
                            final diff = startDt.difference(now);
                            hintText = "Class starts in ${diff.inMinutes}m. Check-in gate can be opened now.";
                            buttonText = "Open Attendance Gate";
                            buttonEnabled = true;
                          } else {
                            final diff = startDt.difference(now);
                            String countdownStr = "";
                            if (diff.inDays > 0) {
                              countdownStr = "${diff.inDays}d ${diff.inHours % 24}h";
                            } else if (diff.inHours > 0) {
                              countdownStr = "${diff.inHours}h ${diff.inMinutes % 60}m";
                            } else {
                              countdownStr = "${diff.inMinutes}m";
                            }
                            hintText = "Attendance session is unavailable";
                            buttonText = "Opens in $countdownStr";
                            buttonEnabled = false;
                          }

                          return GlassCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: primaryColor.withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        (upcomingSlot['role'] as String).toUpperCase(),
                                        style: GoogleFonts.inter(
                                          fontSize: 8,
                                          fontWeight: FontWeight.bold,
                                          color: primaryColor,
                                        ),
                                      ),
                                    ),
                                    Text(
                                      "${upcomingSlot['day']} · ${upcomingSlot['startTime']} - ${upcomingSlot['endTime']}",
                                      style: GoogleFonts.inter(
                                        fontSize: 9.5,
                                        color: const Color(0xFF64748B),
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  "${upcomingSlot['courseCode']} - ${upcomingSlot['courseName']}",
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.bold,
                                    color: const Color(0xFF1E293B),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(Icons.room_outlined, size: 12, color: Color(0xFF94A3B8)),
                                    const SizedBox(width: 4),
                                    Text(
                                      upcomingSlot['room'] as String,
                                      style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: isAlreadyOpen
                                        ? const Color(0xFFECFDF5)
                                        : (buttonEnabled ? const Color(0xFFFFFBEB) : const Color(0xFFF1F5F9)),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: isAlreadyOpen
                                          ? const Color(0xFF10B981).withOpacity(0.2)
                                          : (buttonEnabled ? const Color(0xFFF59E0B).withOpacity(0.2) : const Color(0xFFE2E8F0)),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(
                                        isAlreadyOpen
                                            ? Icons.check_circle_outline
                                            : (buttonEnabled ? Icons.info_outline : Icons.lock_clock_outlined),
                                        size: 13,
                                        color: isAlreadyOpen
                                            ? const Color(0xFF10B981)
                                            : (buttonEnabled ? const Color(0xFFD97706) : const Color(0xFF64748B)),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          hintText,
                                          style: GoogleFonts.inter(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.w600,
                                            color: isAlreadyOpen
                                                ? const Color(0xFF047857)
                                                : (buttonEnabled ? const Color(0xFFB45309) : const Color(0xFF475569)),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 14),
                                ElevatedButton.icon(
                                  onPressed: (isLoading || !buttonEnabled) ? null : () => handleOpenSession(upcomingSlot),
                                  icon: const Icon(Icons.add_circle_outline, size: 14),
                                  label: Text(buttonText),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: primaryColor,
                                    foregroundColor: Colors.white,
                                    elevation: 1,
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    textStyle: GoogleFonts.inter(
                                      fontSize: 11,
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

                      // Session List
                      Text(
                        "Active Attendance Gates",
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 8),                      Builder(
                        builder: (context) {
                          final now = ApiConfig.now;
                          final activeSessionsToShow = myActiveSessions.where((session) {
                            final slot = myTimetable.firstWhere(
                              (t) => t['courseId'] == session['courseId'] && 
                                     (t['role'] == 'Lecture' ? session['classGroup'] == 'All' : session['classGroup'] == t['classGroup']),
                              orElse: () => <String, dynamic>{},
                            );
                            if (slot.isEmpty) return false;

                            final startDt = _getSlotDateTime(slot['day'] as String, slot['startTime'] as String, now);
                            final endDt = _getSlotDateTime(slot['day'] as String, slot['endTime'] as String, now);

                            if (now.isAfter(endDt)) {
                              return false;
                            }

                            final isOpenWindow = now.isAfter(startDt.subtract(const Duration(hours: 1))) && now.isBefore(endDt);
                            return isOpenWindow;
                          }).toList();

                          if (activeSessionsToShow.isEmpty) {
                            return GlassCard(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 24.0),
                                child: Center(
                                  child: Column(
                                    children: [
                                      const Icon(Icons.sensors, color: Color(0xFF94A3B8), size: 24),
                                      const SizedBox(height: 6),
                                      Text(
                                        "No open check-in gates currently active.",
                                        style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }

                          return Column(
                            children: activeSessionsToShow.map((session) {
                              return Container(
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
                                              color: primaryColor.withOpacity(0.1),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              "ACTIVE GATE",
                                              style: GoogleFonts.inter(
                                                fontSize: 8,
                                                fontWeight: FontWeight.bold,
                                                color: primaryColor,
                                              ),
                                            ),
                                          ),
                                          Text(
                                            "Tut Group: ${session['classGroup']}",
                                            style: GoogleFonts.inter(
                                              fontSize: 9,
                                              color: primaryColor,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Text(
                                        "${session['courseCode']} - ${session['courseName']}",
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 14.5,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF1E293B),
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        session['time'],
                                        style: GoogleFonts.inter(fontSize: 9.5, color: const Color(0xFF94A3B8)),
                                      ),
                                      const SizedBox(height: 16),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: OutlinedButton.icon(
                                              onPressed: () => handleViewAttendees(session['sessionId'], session['courseCode']),
                                              icon: const Icon(Icons.people_outline, size: 14),
                                              label: const Text("View Attendees", style: TextStyle(fontSize: 11)),
                                              style: OutlinedButton.styleFrom(
                                                foregroundColor: const Color(0xFF334155),
                                                side: const BorderSide(color: Color(0xFFE2E8F0)),
                                                shape: RoundedRectangleBorder(
                                                  borderRadius: BorderRadius.circular(10),
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
                  ),
                ),
              ),
            ],
          ),

          // Loading Overlay spinner
          if (isLoading)
            Positioned.fill(
              child: Container(
                color: Colors.black.withOpacity(0.15),
                child: Center(
                  child: GlassCard(
                    width: 220,
                    height: 120,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(strokeWidth: 3, color: primaryColor),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          "Updating gate metrics...",
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF1E293B),
                          ),
                        )
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
