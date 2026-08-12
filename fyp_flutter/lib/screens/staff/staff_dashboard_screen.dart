// ignore_for_file: deprecated_member_use, use_build_context_synchronously
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
    this.staffRole = 'Lecturer',
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
  List<dynamic> myCourses = [];
  List<dynamic> courseSessionsHistory = [];
  bool isFetchingHistory = false;

  int historyCurrentPage = 1;
  int historyPageSize = 4;

  String? selectedCourseId;
  String selectedGroup = 'All';

  Timer? _poller;
  bool _pollInProgress = false;

  String get _timetableCacheKey => 'cached_staff_${widget.staffId}_timetable';
  String get _coursesCacheKey => 'cached_staff_${widget.staffId}_courses';

  @override
  void initState() {
    super.initState();
    loadLecturerData();
    _poller = Timer.periodic(const Duration(seconds: 10), (_) {
      unawaited(_pollDashboardData());
    });
  }

  @override
  void dispose() {
    _poller?.cancel();
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

  Future<void> _pollDashboardData() async {
    if (!mounted || _pollInProgress) return;
    _pollInProgress = true;
    try {
      await Future.wait([fetchTimetable(), fetchActiveSessions()]);
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

  Future<void> fetchCourseSessions(String courseId) async {
    if (!mounted) return;
    setState(() {
      isFetchingHistory = true;
    });

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
            historyCurrentPage = 1;
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
          content: Text(status['hintText'] as String),
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
              content: Text("Attendance gate successfully opened for $group!"),
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
              content: Text(err['detail'] ?? "Failed to open attendance gate"),
              backgroundColor: const Color(0xFFDC2626),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Network error opening session: $e"),
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
          const SnackBar(
            content: Text(
              "Could not initialize session roster. Please try opening gate first.",
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
            "Cannot open gate yet. Session opens 1 hour before class (${startDt.hour.toString().padLeft(2, '0')}:${startDt.minute.toString().padLeft(2, '0')}).",
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
                data['message'] ?? "Attendance gate successfully opened!",
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
              content: Text(err['detail'] ?? "Failed to open attendance gate"),
              backgroundColor: const Color(0xFFDC2626),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Network error: $e"),
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
          'hintText': 'Class is currently active until $endTimeStr.',
        };
      }

      if (diff.inMinutes > 0 && diff.inMinutes <= 60) {
        return {
          'canStart': true,
          'statusText': '🟢 Ready to Launch',
          'hintText':
              'Starts in ${diff.inMinutes}m. Gate unlocked for check-in.',
        };
      }

      if (diff.inMinutes > 60) {
        String countStr = diff.inDays > 0
            ? "${diff.inDays}d ${diff.inHours % 24}h"
            : (diff.inHours > 0
                  ? "${diff.inHours}h ${diff.inMinutes % 60}m"
                  : "${diff.inMinutes}m");

        return {
          'canStart': false,
          'statusText': '🔒 Locked',
          'hintText':
              'Time Remaining: Starts in $countStr (Opens 1h before class).',
        };
      }
    }

    return {
      'canStart': true,
      'statusText': '🟢 Ready to Launch',
      'hintText': 'Unlocked for check-in.',
    };
  }

  Future<void> handleCloseSession(dynamic sessionId) async {
    try {
      final uri = Uri.parse(
        "${widget.apiBaseUrl}/attendance/close-session/$sessionId",
      );
      final res = await http.post(
        uri,
        headers: {"Authorization": "Bearer ${widget.authToken}"},
      );

      if (res.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Attendance gate closed."),
              backgroundColor: Color(0xFF059669),
            ),
          );
        }
        await fetchActiveSessions();
      }
    } catch (e) {
      debugPrint("Error closing session: $e");
    }
  }

  Map<String, dynamic>? _getUpcomingSlot() {
    if (myTimetable.isEmpty) return null;
    final now = ApiConfig.now;
    final todayName = _dayOfWeekName(now.weekday);

    final todaySlots = myTimetable.where((slot) {
      return (slot['day'] as String).toLowerCase() == todayName.toLowerCase();
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
            targetDayName.toLowerCase();
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
                          "$studentName marked as ${nextStatus.toUpperCase()}",
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
                    const SnackBar(
                      content: Text("Failed to update attendance status"),
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
                color: isDarkMode ? const Color(0xFF1E293B) : Colors.white,
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
                            "$courseCode - Student Attendance",
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: primaryTextColor,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "Check & take attendance manually for students",
                            style: GoogleFonts.inter(
                              fontSize: 10,
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
                          "Present: $presentCount",
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
                          "Absent: ${totalCount - presentCount}",
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
                          "Total: $totalCount",
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
                      hintText: "Search student name or ID...",
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
                          ? const Color(0xFF0F172A)
                          : const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: isDarkMode
                              ? const Color(0xFF334155)
                              : const Color(0xFFE2E8F0),
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: isDarkMode
                              ? const Color(0xFF334155)
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
                              fetchError!,
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
                              "No students found.",
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
                                  ? const Color(0xFF334155)
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
                                  sName,
                                  style: GoogleFonts.spaceGrotesk(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: primaryTextColor,
                                  ),
                                ),
                                subtitle: Text(
                                  "ID: $sCode · Status: ${student['status']?.toUpperCase() ?? 'ABSENT'}",
                                  style: GoogleFonts.inter(
                                    fontSize: 10,
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
                                    isPresent ? "Mark Absent" : "Mark Present",
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
                                      fontSize: 10,
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
    final Color primaryColor = isDarkMode
        ? const Color(0xFFF87171)
        : const Color(
            0xFF800000,
          ); // Bright Rose/Coral in Dark Mode, Maroon in Light Mode
    final Color headerButtonBg = isDarkMode
        ? const Color(0xFF1E293B)
        : primaryColor.withValues(alpha: 0.1);
    final Color headerButtonIconColor = isDarkMode
        ? const Color(0xFFF87171)
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
                    Row(
                      children: [
                        Container(
                          height: 36,
                          width: 36,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: isDarkMode
                                  ? [
                                      const Color(0xFFEF4444),
                                      const Color(0xFFDC2626),
                                    ]
                                  : [
                                      const Color(0xFF800000),
                                      const Color(0xFFAA0000),
                                    ],
                            ),
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
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Staff Portal",
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: primaryTextColor,
                              ),
                            ),
                            Text(
                              "MANAGEMENT & REGISTRY",
                              style: GoogleFonts.inter(
                                fontSize: 8,
                                fontWeight: FontWeight.w600,
                                color: secondaryTextColor,
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
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ProfileScreen(
                                  authToken: widget.authToken,
                                  apiBaseUrl: widget.apiBaseUrl,
                                ),
                              ),
                            );
                          },
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
                                    ? const Color(0xFF334155)
                                    : Colors.transparent,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("No new staff notifications."),
                                duration: Duration(seconds: 2),
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
                                    ? const Color(0xFF334155)
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
                          loadError!,
                          style: GoogleFonts.inter(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: isDarkMode
                                ? const Color(0xFFFECDD3)
                                : const Color(0xFFBE123C),
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: loadLecturerData,
                        child: const Text(
                          "Retry",
                          style: TextStyle(
                            fontSize: 10,
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
                    : RefreshIndicator(
                        onRefresh: () async {
                          widget.onSyncRequested();
                          await loadLecturerData();
                        },
                        color: primaryColor,
                        backgroundColor: isDarkMode
                            ? const Color(0xFF1E293B)
                            : Colors.white,
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
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
                                      backgroundColor: isDarkMode
                                          ? const Color(0xFF334155)
                                          : primaryColor.withValues(alpha: 0.1),
                                      child: Text(
                                        widget.staffName
                                            .substring(
                                              0,
                                              widget.staffName.length >= 2
                                                  ? 2
                                                  : widget.staffName.length,
                                            )
                                            .toUpperCase(),
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
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            widget.staffName,
                                            style: GoogleFonts.spaceGrotesk(
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                              color: primaryTextColor,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: primaryColor.withValues(
                                                alpha: 0.12,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(6),
                                              border: Border.all(
                                                color: primaryColor.withValues(
                                                  alpha: 0.25,
                                                ),
                                              ),
                                            ),
                                            child: Text(
                                              "Role: ${widget.staffRole}",
                                              style: GoogleFonts.inter(
                                                fontSize: 9.5,
                                                fontWeight: FontWeight.bold,
                                                color: primaryColor,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            "Staff ID: ${widget.staffCode} · ${widget.staffEmail}",
                                            style: GoogleFonts.inter(
                                              fontSize: 10,
                                              color: secondaryTextColor,
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

                              // Upcoming Class Check-In Card Header
                              Text(
                                "Upcoming Class Check-In",
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: primaryTextColor,
                                ),
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
                                            "No upcoming classes found in your timetable.",
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
                                      ? "${timeRemainingUntilEnd.inHours}h ${timeRemainingUntilEnd.inMinutes % 60}m"
                                      : "${timeRemainingUntilEnd.inMinutes}m";

                                  if (isAlreadyOpen) {
                                    hintText =
                                        "Attendance gate is live ($endCountdownStr remaining until class ends).";
                                    buttonText =
                                        "Gate is Live ($endCountdownStr Left)";
                                    buttonEnabled = false;
                                  } else if (isCurrentlyActive) {
                                    hintText =
                                        "Class is in progress ($endCountdownStr remaining until ${upcomingSlot['endTime']}).";
                                    buttonText =
                                        "Class in Progress ($endCountdownStr Left)";
                                    buttonEnabled = false;
                                  } else if (isOpenWindow) {
                                    final diff = startDt.difference(now);
                                    hintText =
                                        "Class starts in ${diff.inMinutes}m. Check-in gate can be opened now.";
                                    buttonText =
                                        "Open Attendance Gate (Starts in ${diff.inMinutes}m)";
                                    buttonEnabled = true;
                                  } else {
                                    final diff = startDt.difference(now);
                                    String countdownStr = "";
                                    if (diff.inDays > 0) {
                                      countdownStr =
                                          "${diff.inDays}d ${diff.inHours % 24}h";
                                    } else if (diff.inHours > 0) {
                                      countdownStr =
                                          "${diff.inHours}h ${diff.inMinutes % 60}m";
                                    } else {
                                      countdownStr = "${diff.inMinutes}m";
                                    }
                                    hintText =
                                        "Time Remaining: Starts in $countdownStr (Unlocks 1h before class).";
                                    buttonText =
                                        "Locked (Opens in $countdownStr)";
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
                                                    ? const Color(0xFF334155)
                                                    : primaryColor.withValues(
                                                        alpha: 0.1,
                                                      ),
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                (upcomingSlot['role'] as String)
                                                    .toUpperCase(),
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
                                              upcomingSlot['room'] as String,
                                              style: GoogleFonts.inter(
                                                fontSize: 10.5,
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
                                                                0xFF1E293B,
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
                                                                  0xFF334155,
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
                                                                    0xFF94A3B8,
                                                                  )
                                                                : const Color(
                                                                    0xFF64748B,
                                                                  ))),
                                              ),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Text(
                                                  hintText,
                                                  style: GoogleFonts.inter(
                                                    fontSize: 10,
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
                                          label: Text(buttonText),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: buttonEnabled
                                                ? primaryColor
                                                : (isDarkMode
                                                      ? const Color(0xFF1E293B)
                                                      : Colors.white),
                                            foregroundColor: buttonEnabled
                                                ? Colors.white
                                                : (isDarkMode
                                                      ? const Color(0xFF94A3B8)
                                                      : const Color(
                                                          0xFF64748B,
                                                        )),
                                            disabledBackgroundColor: isDarkMode
                                                ? const Color(0xFF1E293B)
                                                : Colors.white,
                                            disabledForegroundColor: isDarkMode
                                                ? const Color(0xFF94A3B8)
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
                                                              0xFF475569,
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

                              // Course Sessions & Attendance History Section
                              Text(
                                "Course Sessions & Attendance History",
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: primaryTextColor,
                                ),
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
                                              "Select Course",
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
                                                ? const Color(0xFF1E293B)
                                                : const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(
                                              12,
                                            ),
                                            border: Border.all(
                                              color: isDarkMode
                                                  ? const Color(0xFF334155)
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
                                                "Select Course",
                                                style: TextStyle(
                                                  color: secondaryTextColor,
                                                  fontSize: 12,
                                                ),
                                              ),
                                              dropdownColor: isDarkMode
                                                  ? const Color(0xFF1E293B)
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
                                                            c['code']!,
                                                            style: GoogleFonts.inter(
                                                              fontSize: 10,
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
                                                            c['name']!,
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
                                              "Class Sessions (Current & Past)",
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
                                                  ? const Color(0xFF1E293B)
                                                  : const Color(0xFFF8FAFC),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                              border: Border.all(
                                                color: isDarkMode
                                                    ? const Color(0xFF334155)
                                                    : const Color(0xFFE2E8F0),
                                              ),
                                            ),
                                            child: Center(
                                              child: Text(
                                                "No class sessions recorded yet for this course.",
                                                style: GoogleFonts.inter(
                                                  fontSize: 10.5,
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
                                                                  0xFF1E293B,
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
                                                                          0xFF334155,
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
                                                            "Session: $openedAtStr",
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
                                                            "Group: $groupStr · Status: ${isOpen ? 'LIVE GATE' : 'COMPLETED SESSION'}",
                                                            style: GoogleFonts.inter(
                                                              fontSize: 9.5,
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
                                                              isOpen
                                                                  ? "Current Roster"
                                                                  : "Past Roster",
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
                                                                0xFF1E293B,
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
                                                                  0xFF334155,
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
                                                              "Showing ${startIndex + 1}–$endIndex of $totalItems",
                                                              style: GoogleFonts.inter(
                                                                fontSize: 9.5,
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
                                                                                  0xFF334155,
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
                                                                                        0xFF1E293B,
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
                                                                                          0xFF334155,
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
                                                                                  0xFF334155,
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
                              Text(
                                "Active Attendance Gates",
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: primaryTextColor,
                                ),
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
                                                "No open check-in gates currently active.",
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
                                                              0xFF334155,
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
                                                      "ACTIVE GATE",
                                                      style: GoogleFonts.inter(
                                                        fontSize: 8,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        color: primaryColor,
                                                      ),
                                                    ),
                                                  ),
                                                  Text(
                                                    "Tut Group: ${session['classGroup']}",
                                                    style: GoogleFonts.inter(
                                                      fontSize: 9,
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
                                                "Open since ${session['openTime'] ?? 'Active'} · ${session['verifiedCount'] ?? 0} Checked-In",
                                                style: GoogleFonts.inter(
                                                  fontSize: 10,
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
                                                      label: const Text(
                                                        "Check & Take Attendance",
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
                                                  const SizedBox(width: 8),
                                                  Expanded(
                                                    child: ElevatedButton.icon(
                                                      onPressed: () =>
                                                          handleCloseSession(
                                                            session['id'],
                                                          ),
                                                      icon: const Icon(
                                                        Icons
                                                            .stop_circle_outlined,
                                                        size: 14,
                                                      ),
                                                      label: const Text(
                                                        "Close Gate",
                                                      ),
                                                      style: ElevatedButton.styleFrom(
                                                        backgroundColor:
                                                            const Color(
                                                              0xFFDC2626,
                                                            ),
                                                        foregroundColor:
                                                            Colors.white,
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
