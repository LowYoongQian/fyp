import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

import '../../widgets/glass_card.dart';
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
        _expandedWeeks = _sessions
            .map((row) => (row['week_number'] as num?)?.toInt() ?? 1)
            .toSet();
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
      if (row['week_number'] == null && semesterStart != null) {
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
    'present' => Icons.check_rounded,
    'leave' => Icons.event_busy_rounded,
    _ => Icons.close_rounded,
  };

  String _dateLabel(dynamic raw) {
    final date = DateTime.tryParse(raw?.toString() ?? '')?.toLocal();
    if (date == null) return 'Date unavailable';
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
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final hour = date.hour == 0
        ? 12
        : (date.hour > 12 ? date.hour - 12 : date.hour);
    final minute = date.minute.toString().padLeft(2, '0');
    final period = date.hour >= 12 ? 'PM' : 'AM';
    return '${days[date.weekday - 1]}, ${date.day} ${months[date.month - 1]} · $hour:$minute $period';
  }

  List<Map<String, dynamic>> get _filtered => _filter == 'all'
      ? _sessions
      : _sessions.where((item) => _statusOf(item) == _filter).toList();

  Map<int, List<Map<String, dynamic>>> get _byWeek {
    final grouped = <int, List<Map<String, dynamic>>>{};
    for (final session in _filtered) {
      final week = (session['week_number'] as num?)?.toInt() ?? 1;
      grouped.putIfAbsent(week, () => []).add(session);
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
    if (type == 'Lecture' || group.isEmpty || group == 'All') return type;
    return '$type · $group';
  }

  Widget _summaryCard(String label, int value, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        decoration: BoxDecoration(
          color: color.withValues(alpha: .09),
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: color.withValues(alpha: .18)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(height: 8),
            Text(
              '$value',
              style: GoogleFonts.spaceGrotesk(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _filterChip(String value, String label) {
    final selected = _filter == value;
    return ChoiceChip(
      selected: selected,
      onSelected: (_) => setState(() => _filter = value),
      label: Text(label),
      showCheckmark: false,
      side: BorderSide(
        color: selected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
      ),
      selectedColor: const Color(0xFF2563EB),
      backgroundColor: Theme.of(context).brightness == Brightness.dark
          ? const Color(0xFF1E293B)
          : Colors.white,
      labelStyle: GoogleFonts.inter(
        color: selected ? Colors.white : const Color(0xFF64748B),
        fontSize: 10,
        fontWeight: FontWeight.w700,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
  }

  Widget _sessionCard(Map<String, dynamic> session) {
    final status = _statusOf(session);
    final color = _statusColor(status);
    final dark = Theme.of(context).brightness == Brightness.dark;
    return GlassCard(
      padding: const EdgeInsets.all(15),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .11),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(_statusIcon(status), color: color, size: 21),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        session['course_code']?.toString() ?? '',
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: dark ? Colors.white : const Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: .11),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _statusLabel(status),
                        style: GoogleFonts.inter(
                          color: color,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  session['course_name']?.toString() ?? '',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    height: 1.3,
                    color: const Color(0xFF64748B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 9),
                Row(
                  children: [
                    const Icon(
                      Icons.schedule_rounded,
                      size: 13,
                      color: Color(0xFF94A3B8),
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        _dateLabel(session['opened_at']),
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ),
                    Text(
                      _classLabel(session),
                      style: GoogleFonts.inter(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
              ],
            ),
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
          children: List.generate(
            5,
            (_) => Container(
              height: 112,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),
        ),
      ),
    ],
  );

  Widget _weekSection(int week, bool dark) {
    final sessions = _byWeek[week]!;
    final expanded = _expandedWeeks.contains(week);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => setState(() {
                final next = Set<int>.from(_expandedWeeks);
                expanded ? next.remove(week) : next.add(week);
                _expandedWeeks = next;
              }),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.fromLTRB(11, 6, 7, 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2563EB),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Week $week',
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(width: 2),
                          AnimatedRotation(
                            turns: expanded ? .5 : 0,
                            duration: const Duration(milliseconds: 240),
                            curve: Curves.easeOutCubic,
                            child: const Icon(
                              Icons.keyboard_arrow_down_rounded,
                              size: 16,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Divider(
                        color: dark
                            ? const Color(0xFF334155)
                            : const Color(0xFFE2E8F0),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '${sessions.length} sessions',
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        color: const Color(0xFF94A3B8),
                      ),
                    ),
                  ],
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
                      padding: const EdgeInsets.only(top: 5),
                      child: Column(
                        children: sessions
                            .map(
                              (session) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: _sessionCard(session),
                              ),
                            )
                            .toList(),
                      ),
                    )
                  : const SizedBox(width: double.infinity),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final weeks = _byWeek.keys.toList()..sort((a, b) => b.compareTo(a));
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: dark ? const Color(0xFF0F172A) : const Color(0xFFF6F8FF),
      appBar: AppBar(
        backgroundColor: dark ? const Color(0xFF0F172A) : Colors.white,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.courseCode,
              style: GoogleFonts.spaceGrotesk(
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              '${widget.courseName} · Week 1 to now',
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
          ? RefreshIndicator(
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
                      _error!,
                      style: GoogleFonts.inter(color: const Color(0xFF64748B)),
                    ),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                children: [
                  Row(
                    children: [
                      _summaryCard(
                        'Present',
                        _count('present'),
                        const Color(0xFF10B981),
                        Icons.check_circle_rounded,
                      ),
                      const SizedBox(width: 9),
                      _summaryCard(
                        'Absent',
                        _count('absent'),
                        const Color(0xFFEF4444),
                        Icons.cancel_rounded,
                      ),
                      const SizedBox(width: 9),
                      _summaryCard(
                        'On Leave',
                        _count('leave'),
                        const Color(0xFF64748B),
                        Icons.event_busy_rounded,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _filterChip('all', 'All'),
                        const SizedBox(width: 8),
                        _filterChip('present', 'Present'),
                        const SizedBox(width: 8),
                        _filterChip('absent', 'Absent'),
                        const SizedBox(width: 8),
                        _filterChip('leave', 'On Leave'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  if (weeks.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 90),
                      child: Column(
                        children: [
                          const Icon(
                            Icons.event_note_rounded,
                            size: 46,
                            color: Color(0xFFCBD5E1),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No attendance records',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    ...weeks.map((week) => _weekSection(week, dark)),
                ],
              ),
            ),
    );
  }
}
