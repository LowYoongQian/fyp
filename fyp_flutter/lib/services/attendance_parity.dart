/// Attendance wording and numbers the app shares with the web dashboard and the server's rule: approved leave counts as attended
/// but is not a check-in, and a course with no held class has no rate yet (the server sends the placeholder 100.0 then).
library;

import 'academic_calendar.dart';

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
