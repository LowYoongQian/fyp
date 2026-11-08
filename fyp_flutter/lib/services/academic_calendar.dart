import '../i18n/tr.dart';
// Dates below are campus calendar values, not timestamps to convert to device time.
DateTime calendarDate(DateTime value) =>
    DateTime.utc(value.year, value.month, value.day);
DateTime calendarMonday(DateTime value) =>
    calendarDate(value).subtract(Duration(days: value.weekday - 1));

class SemesterWindow {
  final String id;
  final String name;
  final DateTime start;
  final DateTime end;
  SemesterWindow(this.id, this.name, this.start, this.end);
  DateTime get firstMonday => calendarMonday(start);
  int get weeks => end.difference(firstMonday).inDays ~/ 7 + 1;
  int weekFor(DateTime monday) =>
      calendarDate(monday).difference(firstMonday).inDays ~/ 7 + 1;
  bool contains(DateTime day) =>
      !calendarDate(day).isBefore(start) && !calendarDate(day).isAfter(end);
  static SemesterWindow? parse(dynamic value) {
    if (value is! Map) return null;
    final start = DateTime.tryParse(value['start_date']?.toString() ?? '');
    final end = DateTime.tryParse(value['end_date']?.toString() ?? '');
    if (start == null || end == null || end.isBefore(start)) return null;
    return SemesterWindow(
      value['id'].toString(),
      value['name'].toString(),
      calendarDate(start),
      calendarDate(end),
    );
  }
}

SemesterWindow? sharedSemester(List<Map<String, dynamic>> schedule) {
  SemesterWindow? result;
  for (final item in schedule) {
    final term = SemesterWindow.parse(item['semester']);
    if (term == null || (result != null && result.id != term.id)) return null;
    result = term;
  }
  return result;
}

/// The Mondays the week picker offers: only the weeks of the semester the classes belong to (a 5-week semester
/// gives 5). Without semester dates there are none, and the picker says no timetable is available.
List<DateTime> pickerWeeks(SemesterWindow? term) =>
    term == null ? const [] : [for (var i = 0; i < term.weeks; i++) term.firstMonday.add(Duration(days: 7 * i))];

/// "This week", "Next week", "Last week" or "Week of 3 Nov" for a week without semester numbering.
String relativeWeekLabel(DateTime monday, DateTime thisMonday) {
  return switch (calendarDate(monday).difference(calendarDate(thisMonday)).inDays ~/ 7) {
    0 => tr('This week'),
    1 => tr('Next week'),
    -1 => tr('Last week'),
    _ => tr('Week of {date}', {'date': dayMonth(monday)}),
  };
}
