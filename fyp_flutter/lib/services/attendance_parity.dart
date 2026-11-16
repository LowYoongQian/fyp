/// Attendance wording and numbers the app shares with the web dashboard and the server's rule: approved leave counts as attended
/// but is not a check-in, and a course with no held class has no rate yet (the server sends the placeholder 100.0 then).
library;

import 'academic_calendar.dart';
import '../i18n/tr.dart';

/// Server timestamps are instants; school dates always use Malaysia UTC+8,
/// independent of the phone timezone or the translated display label.
DateTime? attendanceCampusTime(Map<dynamic, dynamic> row) {
  final marked = DateTime.tryParse(row['marked_at']?.toString() ?? '');
  if (marked == null) return null;
  // Legacy server values without an offset were also stored as UTC.
  final utc = marked.isUtc ? marked : DateTime.utc(marked.year, marked.month,
      marked.day, marked.hour, marked.minute, marked.second, marked.millisecond, marked.microsecond);
  return utc.add(const Duration(hours: 8));
}

bool attendanceOnDate(Map<dynamic, dynamic> row, DateTime campusDate) {
  final marked = attendanceCampusTime(row);
  return marked != null && marked.year == campusDate.year &&
      marked.month == campusDate.month && marked.day == campusDate.day;
}

String attendanceTimeLabel(DateTime marked) {
  final hour = marked.hour % 12 == 0 ? 12 : marked.hour % 12;
  return '$hour:${marked.minute.toString().padLeft(2, '0')} ${marked.hour >= 12 ? 'PM' : 'AM'}';
}

/// Used by full sync, focused refresh and raw SQLite cache restoration.
/// Only an explicit server biometric result can establish face verification.
Map<String, dynamic> attendanceHistoryRow(Map<dynamic, dynamic> row, DateTime today) {
  final marked = attendanceCampusTime(row);
  final status = row['status'];
  final detail = row['verify_detail']?.toString();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var label = 'Unknown';
  if (status == 'absent' && detail != null && detail.isNotEmpty) {
    label = detail;
  } else if (marked != null) {
    final time = attendanceTimeLabel(marked);
    label = attendanceOnDate(row, today)
        ? tr('Today, {time}', {'time': time})
        : '${tr(months[marked.month - 1])} ${marked.day}, ${marked.year}, $time';
  }
  return {
    'courseCode': row['course_code'] ?? 'Unknown',
    'courseName': row['course_name'] ?? 'Unknown',
    'group': row['class_group'] ?? '-',
    'marked_at': row['marked_at'],
    'date': label,
    'status': historyStatus(status),
    'wifiVerified': row['network_verified'] == true,
    'faceVerified': status == 'present' && row['face_verified'] == true,
  };
}

/// The history label for a stored attendance status.
String historyStatus(Object? status) => switch (status?.toString()) {
  'present' => 'Verified',
  'leave' => 'Excused',
  _ => 'Absent',
};

/// Whether a history label counts toward attendance (present or approved leave).
bool creditedStatus(Object? label) {
  final value = label?.toString().toLowerCase();
  return value == 'verified' || value == 'excused';
}

/// The rate to show for a course row from the server, or null for "no data yet".
/// An older server sends no `completed_classes`; then its rate is used as it is.
double? courseRate(Map<dynamic, dynamic> row, [Object? raw]) {
  final completed = row['completed_classes'];
  if (completed is num && completed <= 0) return null;
  final value = raw ?? row['attendance_rate'];
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '');
}

/// The course cards for the dashboard's "Overall" view: each current course once, with its server rate (null = no data yet).
/// A saved or offline schedule can outlive its semester, so a course whose semester window does not include [today] (the last day counts) is left out;
/// courses that only appear in the attendance history never are listed here, the history screens keep them.
List<Map<String, dynamic>> currentCourseStats(List<Map<String, dynamic>> schedule, DateTime today) {
  final seen = <String>{};
  final result = <Map<String, dynamic>>[];
  for (final course in schedule) {
    if (!(SemesterWindow.parse(course['semester'])?.contains(today) ?? true)) continue;
    final code = course['courseCode'].toString().toUpperCase();
    if (!seen.add(code)) continue;
    result.add({'courseCode': code, 'courseName': course['courseName'].toString().toUpperCase(), 'percentage': courseRate(course, course['attendanceRate'])});
  }
  return result;
}
