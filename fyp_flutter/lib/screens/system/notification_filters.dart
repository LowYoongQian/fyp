import 'package:flutter/material.dart';

enum NoticeCategory { all, updates, today, classes }

extension NoticeCategoryLabel on NoticeCategory {
  String get label => switch (this) {
        NoticeCategory.all => 'All',
        NoticeCategory.updates => 'Updates',
        NoticeCategory.today => 'Today',
        NoticeCategory.classes => 'Classes',
      };
}

/// Kinds about a class itself: reminders, timetable changes, cancellations, replacements and class sessions. Everything else is an update.
const classKinds = {'class_reminder', 'timetable_change', 'class_cancelled', 'replacement_class', 'class_needs_attention', 'class_attention_escalated', 'session'};

bool isClassNotice(Map<String, dynamic> notice) => classKinds.contains(notice['kind']?.toString());

DateTime? noticeTime(Map<String, dynamic> notice) => DateTime.tryParse(notice['created_at']?.toString() ?? '')?.toLocal();

/// An optional date range (whole days, inclusive) and an optional time-of-day window; a window like 22:00–06:00 runs overnight.
class NoticeTimeFilter {
  final DateTimeRange? days;
  final TimeOfDay? from, to;
  const NoticeTimeFilter({this.days, this.from, this.to});

  bool get isActive => days != null || from != null || to != null;

  bool matches(DateTime? at) {
    if (!isActive) return true;
    if (at == null) return false;
    if (days != null) {
      final day = DateTime(at.year, at.month, at.day);
      final start = DateTime(days!.start.year, days!.start.month, days!.start.day);
      final end = DateTime(days!.end.year, days!.end.month, days!.end.day);
      if (day.isBefore(start) || day.isAfter(end)) return false;
    }
    final minute = at.hour * 60 + at.minute;
    final low = from == null ? 0 : from!.hour * 60 + from!.minute;
    final high = to == null ? 24 * 60 - 1 : to!.hour * 60 + to!.minute;
    return low <= high ? minute >= low && minute <= high : minute >= low || minute <= high;
  }
}

bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

bool inCategory(Map<String, dynamic> notice, NoticeCategory category, DateTime now) => switch (category) {
      NoticeCategory.all => true,
      NoticeCategory.classes => isClassNotice(notice),
      NoticeCategory.updates => !isClassNotice(notice),
      NoticeCategory.today => noticeTime(notice) != null && _sameDay(noticeTime(notice)!, now),
    };

/// Positions (in the original list) of the notices to show, so reading one still marks the right item.
List<int> visibleNotices(List<Map<String, dynamic>> notices, NoticeCategory category, NoticeTimeFilter filter, DateTime now) => [
      for (var i = 0; i < notices.length; i++)
        if (inCategory(notices[i], category, now) && filter.matches(noticeTime(notices[i]))) i,
    ];

/// "Today", "Yesterday" or a date, for the section headings of the list.
String dayHeading(DateTime? at, DateTime now) {
  if (at == null) return 'Earlier';
  if (_sameDay(at, now)) return 'Today';
  if (_sameDay(at, now.subtract(const Duration(days: 1)))) return 'Yesterday';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${at.day} ${months[at.month - 1]} ${at.year}';
}
