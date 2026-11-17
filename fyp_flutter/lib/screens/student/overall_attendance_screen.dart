import '../../i18n/tr.dart';
import '../../widgets/brand_refresh.dart';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

import '../../widgets/shimmer_loading.dart';

class OverallAttendanceScreen extends StatefulWidget {
  final String authToken;
  final String apiBaseUrl;
  final String courseCode;
  final String courseName;
  final List<Map<String, dynamic>> courseSchedule;

  const OverallAttendanceScreen({
    super.key,
    required this.authToken,
    required this.apiBaseUrl,
    required this.courseCode,
    required this.courseName,
    required this.courseSchedule,
  });

  @override
  State<OverallAttendanceScreen> createState() =>
      _OverallAttendanceScreenState();
}

const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _months = [
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

class _OverallAttendanceScreenState extends State<OverallAttendanceScreen> {
  bool _loading = true;
  String? _error;
  String _filter = 'all';
  List<Map<String, dynamic>> _sessions = [];
  Set<int> _expandedWeeks = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      var response = await http
          .get(
            Uri.parse('${widget.apiBaseUrl}/students/me/attendance-sessions'),
            headers: {
              'Authorization': 'Bearer ${widget.authToken}',
              'Cache-Control': 'no-store',
              'Pragma': 'no-cache',
            },
          )
          .timeout(const Duration(seconds: 15));
      if (response.statusCode == 404) {
        response = await http
            .get(
              Uri.parse('${widget.apiBaseUrl}/students/me/attendance'),
              headers: {
                'Authorization': 'Bearer ${widget.authToken}',
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache',
              },
            )
            .timeout(const Duration(seconds: 15));
      }
      if (response.statusCode != 200) throw Exception();
      final rawRows = jsonDecode(response.body) as List<dynamic>;
      final rows = _normaliseRows(rawRows);
      if (!mounted) return;
      setState(() {
        _sessions = rows
            .where(
              (row) =>
                  row['course_code']?.toString().toUpperCase() ==
                  widget.courseCode.toUpperCase(),
            )
            .toList();
        _expandedWeeks = _sessions.map(_week).toSet();
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load attendance.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _normaliseRows(List<dynamic> rawRows) {
    final rows = rawRows
        .map((row) => Map<String, dynamic>.from(row as Map))
        .toList();
    if (rows.isEmpty) return rows;

    final datedRows =
        rows
            .map(
              (row) => DateTime.tryParse(
                (row['opened_at'] ?? row['marked_at'] ?? '').toString(),
              ),
            )
            .whereType<DateTime>()
            .toList()
          ..sort();
    final firstDate = datedRows.isEmpty ? null : datedRows.first.toLocal();
    final semesterStart = firstDate == null
        ? null
        : DateTime(
            firstDate.year,
            firstDate.month,
            firstDate.day,
          ).subtract(Duration(days: firstDate.weekday - 1));

    for (final row in rows) {
      row['opened_at'] ??= row['marked_at'];
      row['closed_at'] ??= row['marked_at'];
      // Only the older /students/me/attendance answer lacks weeks. The sessions answer sends null on purpose for a class
      // held before the course's semester, so that one is never renumbered here.
      if (!row.containsKey('week_number') && semesterStart != null) {
        final date = DateTime.tryParse(
          row['opened_at']?.toString() ?? '',
        )?.toLocal();
        row['week_number'] = date == null
            ? 1
            : (DateTime(
                        date.year,
                        date.month,
                        date.day,
                      ).difference(semesterStart).inDays ~/
                      7) +
                  1;
      }
      if ((row['class_type']?.toString().trim().isEmpty ?? true)) {
        final date = DateTime.tryParse(
          row['opened_at']?.toString() ?? '',
        )?.toLocal();
        final sameDay = date == null
            ? <Map<String, dynamic>>[]
            : widget.courseSchedule.where((meeting) {
                return meeting['day']?.toString().toLowerCase() ==
                    const [
                      'monday',
                      'tuesday',
                      'wednesday',
                      'thursday',
                      'friday',
                      'saturday',
                      'sunday',
                    ][date.weekday - 1];
              }).toList();
        if (sameDay.length == 1) {
          row['class_type'] = sameDay.first['group'];
          row['class_group'] = sameDay.first['classGroup'];
        } else {
          row['class_type'] = 'Class';
        }
      }
    }
    return rows;
  }

  /// The group a class is listed under: its teaching week, or 0 ("Before this semester") for a class held before the
  /// course's semester began. An older server sent such classes as a negative week.
  int _week(Map<String, dynamic> session) {
    final week = (session['week_number'] as num?)?.toInt();
    return week == null || week < 1 ? 0 : week;
  }

  String _statusOf(Map<String, dynamic> session) {
    final value = session['status']?.toString().toLowerCase() ?? 'absent';
    if (value == 'leave' || value == 'on_leave' || value == 'excused') {
      return 'leave';
    }
    return value == 'present' ? 'present' : 'absent';
  }

  Color _statusColor(String status) => switch (status) {
    'present' => const Color(0xFF10B981),
    'leave' => const Color(0xFF64748B),
    _ => const Color(0xFFEF4444),
  };

  String _statusLabel(String status) => switch (status) {
    'present' => 'Present',
    'leave' => 'On Leave',
    _ => 'Absent',
  };

  IconData _statusIcon(String status) => switch (status) {
    'present' => Icons.check_circle_rounded,
    'leave' => Icons.event_busy_rounded,
    _ => Icons.cancel_rounded,
  };

  DateTime? _local(dynamic raw) =>
      DateTime.tryParse(raw?.toString() ?? '')?.toLocal();

  String _timeLabel(DateTime date) {
    final hour = date.hour == 0
        ? 12
        : (date.hour > 12 ? date.hour - 12 : date.hour);
    return '$hour:${date.minute.toString().padLeft(2, '0')} ${tr(date.hour >= 12 ? 'PM' : 'AM')}';
  }

  String _dateLabel(dynamic raw) {
    final date = _local(raw);
    if (date == null) return '—';
    return '${tr(_days[date.weekday - 1])}, ${dayMonth(date)} · ${_timeLabel(date)}';
  }

  List<Map<String, dynamic>> get _filtered => _filter == 'all'
      ? _sessions
      : _sessions.where((item) => _statusOf(item) == _filter).toList();

  Map<int, List<Map<String, dynamic>>> get _byWeek {
    final grouped = <int, List<Map<String, dynamic>>>{};
    for (final session in _filtered) {
      grouped.putIfAbsent(_week(session), () => []).add(session);
    }
    return grouped;
  }

  int _count(String status) =>
      _sessions.where((item) => _statusOf(item) == status).length;

  String _classLabel(Map<String, dynamic> session) {
    final rawType = session['class_type']?.toString().trim() ?? 'Class';
    final type = switch (rawType.toLowerCase()) {
      'tutor' || 'tutorial' => 'Tutorial',
      'practical' || 'lab' => 'Practical',
      'lecture' || 'lecturer' => 'Lecture',
      _ => 'Class',
    };
    final group = session['class_group']?.toString().trim() ?? '';
    if (type == 'Lecture' || group.isEmpty || group == 'All') return tr(type);
    return '${tr(type)} · $group';
  }

  String _classes(int n) =>
      n == 1 ? tr('1 class') : tr('{n} classes', {'n': n});

  String _value(dynamic value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? '—' : text;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Overview: a ring of present / on leave / absent with the counts beside it.
  // ---------------------------------------------------------------------------------------------------------------

  Widget _overview(bool dark) {
    final total = _sessions.length;
    const onHero = {
      'present': Color(0xFF6EE7B7),
      'leave': Color(0xFFE2E8F0),
      'absent': Color(0xFFFCA5A5),
    };
    final parts = [
      for (final status in const ['present', 'leave', 'absent'])
        (total == 0 ? 0.0 : _count(status) / total, onHero[status]!),
    ];
    final animate = !MediaQuery.of(context).disableAnimations;
    Widget glow(double size) => Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: .08),
      ),
    );
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2563EB), Color(0xFF4F46E5), Color(0xFF7C3AED)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4F46E5).withValues(alpha: dark ? .22 : .32),
            blurRadius: 26,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(26),
        child: Stack(
          children: [
            Positioned(right: -46, top: -56, child: glow(160)),
            Positioned(left: -36, bottom: -70, child: glow(130)),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
              child: Row(
                children: [
                  Semantics(
                    label: [
                      _classes(total),
                      for (final status in const ['present', 'absent', 'leave'])
                        '${tr(_statusLabel(status))} ${_count(status)}',
                    ].join(', '),
                    excludeSemantics: true,
                    child: SizedBox(
                      width: 108,
                      height: 108,
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(begin: animate ? 0.0 : 1.0, end: 1.0),
                        duration: const Duration(milliseconds: 950),
                        curve: Curves.easeOutCubic,
                        builder: (context, progress, child) => CustomPaint(
                          painter: _RingPainter(
                            parts,
                            progress,
                            Colors.white.withValues(alpha: .18),
                          ),
                          child: child,
                        ),
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.event_note_rounded,
                                size: 15,
                                color: Colors.white.withValues(alpha: .75),
                              ),
                              Text(
                                '$total',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  height: 1.1,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 18),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _classes(total),
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 8),
                        for (final status in const [
                          'present',
                          'absent',
                          'leave',
                        ])
                          _legendRow(
                            status,
                            _count(status),
                            total,
                            onHero[status]!,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _legendRow(String status, int count, int total, Color dot) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.5),
      child: Row(
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(
              color: dot,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(color: dot.withValues(alpha: .6), blurRadius: 6),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              tr(_statusLabel(status)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: Colors.white.withValues(alpha: .92),
              ),
            ),
          ),
          Text(
            '$count',
            style: GoogleFonts.spaceGrotesk(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          SizedBox(
            width: 40,
            child: Text(
              total == 0 ? '0%' : '${(count * 100 / total).round()}%',
              textAlign: TextAlign.right,
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: Colors.white.withValues(alpha: .7),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Filter: one bar, each option with its count.
  // ---------------------------------------------------------------------------------------------------------------

  Widget _filterBar(bool dark) {
    final options = [
      ('all', 'All', _sessions.length),
      ('present', 'Present', _count('present')),
      ('absent', 'Absent', _count('absent')),
      ('leave', 'On Leave', _count('leave')),
    ];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF222222) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0),
        ),
        boxShadow: dark
            ? null
            : [
                BoxShadow(
                  color: const Color(0xFF0F172A).withValues(alpha: .04),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Row(
        children: [
          for (final (value, label, count) in options)
            Expanded(child: _segment(value, label, count, dark)),
        ],
      ),
    );
  }

  Widget _segment(String value, String label, int count, bool dark) {
    final selected = _filter == value;
    final color = value == 'all'
        ? const Color(0xFF2563EB)
        : _statusColor(value);
    final muted = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => setState(() => _filter = value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            constraints: const BoxConstraints(minHeight: 48),
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
            decoration: BoxDecoration(
              color: selected ? color : Colors.transparent,
              borderRadius: BorderRadius.circular(14),
              boxShadow: selected
                  ? [
                      BoxShadow(
                        color: color.withValues(alpha: .32),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : null,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$count',
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: selected ? Colors.white : color,
                    height: 1.1,
                  ),
                ),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    tr(label),
                    maxLines: 1,
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: selected
                          ? Colors.white.withValues(alpha: .92)
                          : muted,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Weeks and their classes.
  // ---------------------------------------------------------------------------------------------------------------

  /// "16–22 Nov" for a teaching week (Monday to Sunday), or the span of the classes held before the semester.
  String? _weekRange(int week, List<Map<String, dynamic>> sessions) {
    final dates =
        sessions
            .map((s) => _local(s['opened_at']))
            .whereType<DateTime>()
            .toList()
          ..sort();
    if (dates.isEmpty) return null;
    if (week == 0) {
      final a = dates.first, b = dates.last;
      return a.year == b.year && a.month == b.month && a.day == b.day
          ? dayMonth(a)
          : dayRange(a, b);
    }
    final first = dates.first;
    final monday = DateTime(
      first.year,
      first.month,
      first.day,
    ).subtract(Duration(days: first.weekday - 1));
    return dayRange(monday, monday.add(const Duration(days: 6)));
  }

  Widget _miniBar(List<Map<String, dynamic>> sessions) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: SizedBox(
        width: 38,
        height: 5,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment
              .stretch, // segments have no child, so they take the bar's height from here
          children: [
            for (final status in const ['present', 'leave', 'absent'])
              if (sessions.any((s) => _statusOf(s) == status))
                Expanded(
                  flex: sessions.where((s) => _statusOf(s) == status).length,
                  child: ColoredBox(color: _statusColor(status)),
                ),
          ],
        ),
      ),
    );
  }

  Widget _weekSection(int week, int position, bool dark) {
    final sessions = _byWeek[week]!;
    final expanded = _expandedWeeks.contains(week);
    final before = week == 0;
    final range = _weekRange(week, sessions);
    final muted = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    return _Reveal(
      key: ValueKey('week-$_filter-$week'),
      index: position,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(
          children: [
            Semantics(
              button: true,
              expanded: expanded,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => setState(() {
                    final next = Set<int>.from(_expandedWeeks);
                    expanded ? next.remove(week) : next.add(week);
                    _expandedWeeks = next;
                  }),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 44),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          // The label comes first (up to 72% of the room), the dates take the rest; both end in "…" before
                          // the count would be pushed off a narrow phone or by a long language.
                          Expanded(
                            child: LayoutBuilder(
                              builder: (context, box) => Row(
                                children: [
                                  ConstrainedBox(
                                    constraints: BoxConstraints(
                                      maxWidth: box.maxWidth * .72,
                                    ),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 11,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(11),
                                        gradient: LinearGradient(
                                          colors: before
                                              ? const [
                                                  Color(0xFF64748B),
                                                  Color(0xFF475569),
                                                ]
                                              : const [
                                                  Color(0xFF2563EB),
                                                  Color(0xFF4F46E5),
                                                ],
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color:
                                                (before
                                                        ? const Color(
                                                            0xFF475569,
                                                          )
                                                        : const Color(
                                                            0xFF2563EB,
                                                          ))
                                                    .withValues(alpha: .28),
                                            blurRadius: 10,
                                            offset: const Offset(0, 4),
                                          ),
                                        ],
                                      ),
                                      child: Text(
                                        before
                                            ? tr('Before this semester')
                                            : tr('Week {week}', {'week': week}),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.inter(
                                          color: Colors.white,
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Flexible(
                                    child: Text(
                                      range ?? '',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w600,
                                        color: muted,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          _miniBar(sessions),
                          const SizedBox(width: 8),
                          Text(
                            _classes(sessions.length),
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              color: const Color(0xFF94A3B8),
                            ),
                          ),
                          AnimatedRotation(
                            turns: expanded ? .5 : 0,
                            duration: const Duration(milliseconds: 240),
                            curve: Curves.easeOutCubic,
                            child: Icon(
                              Icons.keyboard_arrow_down_rounded,
                              size: 20,
                              color: muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            ClipRect(
              child: AnimatedSize(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOutCubic,
                alignment: Alignment.topCenter,
                child: expanded
                    ? Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Column(
                          children: [
                            for (final (i, session) in sessions.indexed)
                              _Reveal(
                                key: ValueKey(
                                  'class-$_filter-${session['session_id'] ?? i}',
                                ),
                                index: i,
                                child: _sessionCard(session, dark),
                              ),
                          ],
                        ),
                      )
                    : const SizedBox(width: double.infinity),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sessionCard(Map<String, dynamic> session, bool dark) {
    final status = _statusOf(session);
    final color = _statusColor(status);
    final when = _local(session['opened_at']);
    final number =
        _sessions.length -
        _sessions.indexOf(session); // class 1 is the course's first class
    final ink = dark ? Colors.white : const Color(0xFF0F172A);
    final muted = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    final staff = _value(session['staff_name']);
    final initial = staff
        .replaceFirst(
          RegExp(r'^(Dr|Prof|Mr|Ms|Mrs|Madam)\.?\s+', caseSensitive: false),
          '',
        )
        .trim();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF222222) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: dark ? const Color(0xFF333333) : const Color(0xFFE8EDF5),
        ),
        boxShadow: dark
            ? null
            : [
                BoxShadow(
                  color: const Color(0xFF0F172A).withValues(alpha: .05),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, color: color),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _dateTile(when, color),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  when == null
                                      ? '—'
                                      : '${tr(_days[when.weekday - 1])} · ${_timeLabel(when)}',
                                  style: GoogleFonts.inter(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w800,
                                    color: ink,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: dark
                                        ? const Color(0xFF1E293B)
                                        : const Color(0xFFEFF4FF),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    _classLabel(session),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.inter(
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF3B82F6),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          _statusBadge(status),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Container(
                            width: 26,
                            height: 26,
                            alignment: Alignment.center,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(
                                colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                              ),
                            ),
                            child: Text(
                              staff == '—' || initial.isEmpty
                                  ? '?'
                                  : initial.characters.first.toUpperCase(),
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              staff,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: ink,
                              ),
                            ),
                          ),
                          Text(
                            '#$number',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: muted,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      _infoPanel(session, dark),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _dateTile(DateTime? when, Color color) {
    return Container(
      width: 46,
      padding: const EdgeInsets.symmetric(vertical: 7),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(13),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [color.withValues(alpha: .18), color.withValues(alpha: .06)],
        ),
      ),
      child: Column(
        children: [
          Text(
            when == null ? '—' : '${when.day}',
            style: GoogleFonts.spaceGrotesk(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
              height: 1,
            ),
          ),
          const SizedBox(height: 3),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              when == null ? '' : tr(_months[when.month - 1]).toUpperCase(),
              style: GoogleFonts.inter(
                fontSize: 8.5,
                fontWeight: FontWeight.w800,
                letterSpacing: .6,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusBadge(String status) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: .25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_statusIcon(status), size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            tr(_statusLabel(status)),
            style: GoogleFonts.inter(
              fontSize: 9.5,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoPanel(Map<String, dynamic> session, bool dark) {
    final ink = dark ? Colors.white : const Color(0xFF0F172A);
    const muted = Color(0xFF94A3B8);
    Widget item(IconData icon, String label, String value, String? detail) =>
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 14, color: muted),
              const SizedBox(width: 6),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr(label),
                      style: GoogleFonts.inter(
                        fontSize: 8.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: .3,
                        color: muted,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      tr(value),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: ink,
                      ),
                    ),
                    if (detail != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        detail,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.inter(
                          fontSize: 9,
                          height: 1.3,
                          color: muted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF1B1B1B) : const Color(0xFFF6F8FC),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          item(
            Icons.how_to_reg_rounded,
            'TAKEN BY / TIME',
            _value(session['taken_by']),
            session['taken_at'] == null
                ? null
                : _dateLabel(session['taken_at']),
          ),
          const SizedBox(width: 10),
          item(
            Icons.place_rounded,
            'LOCATION / NETWORK',
            _value(session['room']),
            tr('Network: {network}\nDevice: {device}', {
              'network': _value(session['network_ip']),
              'device': _value(session['device_ip']),
            }),
          ),
        ],
      ),
    );
  }

  Widget _loadingView() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      ShimmerLoading(
        isLoading: true,
        child: Column(
          children: [
            for (final (height, radius) in const [
              (144.0, 26.0),
              (58.0, 18.0),
              (150.0, 18.0),
              (150.0, 18.0),
              (150.0, 18.0),
            ])
              Container(
                height: height,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(radius),
                ),
              ),
          ],
        ),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final weeks = _byWeek.keys.toList()
      ..sort(
        (a, b) => b.compareTo(a),
      ); // newest week first; 0 (before the semester) last
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: dark ? const Color(0xFF181818) : const Color(0xFFF6F8FF),
      appBar: AppBar(
        backgroundColor: dark ? const Color(0xFF181818) : Colors.white,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr(widget.courseCode),
              style: GoogleFonts.spaceGrotesk(
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              tr('{courseName} · Week 1 to now', {
                'courseName': widget.courseName,
              }),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(
                fontSize: 10,
                color: const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
      body: _loading
          ? _loadingView()
          : _error != null
          ? BrandRefresh(
              onRefresh: _load,
              child: ListView(
                children: [
                  SizedBox(height: MediaQuery.sizeOf(context).height * .28),
                  const Icon(
                    Icons.cloud_off_rounded,
                    size: 44,
                    color: Color(0xFF94A3B8),
                  ),
                  const SizedBox(height: 12),
                  Center(
                    child: Text(
                      tr(_error!),
                      style: GoogleFonts.inter(color: const Color(0xFF64748B)),
                    ),
                  ),
                ],
              ),
            )
          : BrandRefresh(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                children: [
                  _Reveal(index: 0, child: _overview(dark)),
                  const SizedBox(height: 14),
                  _Reveal(index: 1, child: _filterBar(dark)),
                  const SizedBox(height: 16),
                  if (weeks.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 60),
                      child: Column(
                        children: [
                          const Icon(
                            Icons.event_note_rounded,
                            size: 46,
                            color: Color(0xFFCBD5E1),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            tr('No attendance records'),
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    for (final (i, week) in weeks.indexed)
                      _weekSection(week, i + 2, dark),
                ],
              ),
            ),
    );
  }
}

/// Fades and lifts content in as it first appears, a little later for each [index]; none when the phone asks for less motion.
class _Reveal extends StatelessWidget {
  const _Reveal({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 280 + math.min(index, 8) * 45),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, (1 - value) * 14),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

/// The overview ring: one arc per status, in proportion, drawn up to [progress] (0–1) of the way round.
class _RingPainter extends CustomPainter {
  _RingPainter(this.parts, this.progress, this.track);

  final List<(double, Color)> parts;
  final double progress;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 11.0;
    final arc = (Offset.zero & size).deflate(stroke / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(arc, 0, math.pi * 2, false, paint..color = track);
    final gap = parts.where((part) => part.$1 > 0).length > 1 ? 0.12 : 0.0;
    var start = -math.pi / 2;
    for (final (fraction, color) in parts) {
      if (fraction <= 0) continue;
      final sweep = fraction * math.pi * 2 * progress;
      canvas.drawArc(
        arc,
        start + gap / 2,
        math.max(0.0, sweep - gap),
        false,
        paint..color = color,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress ||
      old.track != track ||
      old.parts.length != parts.length ||
      [
        for (var i = 0; i < parts.length; i++) parts[i] != old.parts[i],
      ].any((changed) => changed);
}
