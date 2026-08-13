import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../main.dart';
import '../../widgets/aurora_background.dart';
import '../../widgets/glass_card.dart';

class FullTimetableScreen extends StatefulWidget {
  final List<Map<String, dynamic>> schedule;
  final Future<List<Map<String, dynamic>>> Function() onRefresh;

  const FullTimetableScreen({
    super.key,
    required this.schedule,
    required this.onRefresh,
  });

  @override
  State<FullTimetableScreen> createState() => _FullTimetableScreenState();
}

class _FullTimetableScreenState extends State<FullTimetableScreen> {
  int _selectedDayIndex = 0; // 0 for Mon, 6 for Sun
  final List<String> _weekDays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  final List<String> _weekDayAbbrevs = [
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
    'SAT',
    'SUN',
  ];
  String _selectedWeek = "Week 1";
  late PageController _pageController;
  late List<Map<String, dynamic>> _schedule;

  @override
  void initState() {
    super.initState();
    // Initialize day tab to today's weekday
    final todayWeekday = ApiConfig.now.weekday; // 1-7
    _schedule = List<Map<String, dynamic>>.from(widget.schedule);
    _selectedDayIndex = math.min(6, math.max(0, todayWeekday - 1));
    _pageController = PageController(initialPage: _selectedDayIndex);

    // Initialize selected week dynamically based on current time
    final now = ApiConfig.now;
    final semesterStart = DateTime(2026, 6, 15);
    int weekNum = 1;
    if (now.isAfter(semesterStart)) {
      final daysDiff = now.difference(semesterStart).inDays;
      weekNum = (daysDiff / 7).floor() + 1;
      if (weekNum > 14) weekNum = 14;
    }
    _selectedWeek = "Week $weekNum";
    WidgetsBinding.instance.addPostFrameCallback((_) => _refreshSchedule());
  }

  @override
  void didUpdateWidget(covariant FullTimetableScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.schedule, widget.schedule)) {
      _schedule = List<Map<String, dynamic>>.from(widget.schedule);
    }
  }

  Future<void> _refreshSchedule() async {
    final latestSchedule = await widget.onRefresh();
    if (!mounted) return;
    setState(() {
      _schedule = List<Map<String, dynamic>>.from(latestSchedule);
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  String _formatTimeWithAmPm(String time24h) {
    try {
      final parts = time24h.split(':');
      if (parts.length < 2) return time24h;
      int hour = int.parse(parts[0]);
      int minute = int.parse(parts[1]);
      final amPm = hour >= 12 ? 'PM' : 'AM';
      final formattedHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
      final minuteStr = minute.toString().padLeft(2, '0');
      return "${formattedHour.toString().padLeft(2, '0')}:$minuteStr $amPm";
    } catch (_) {
      return time24h;
    }
  }

  String _getFormattedDateForDay(int dayIndex) {
    try {
      final weekNumStr = _selectedWeek.replaceAll(RegExp(r'[^0-9]'), '');
      final weekNum = int.tryParse(weekNumStr) ?? 1;
      final semesterStart = DateTime(2026, 6, 15);
      final targetDate = semesterStart.add(
        Duration(days: (weekNum - 1) * 7 + dayIndex),
      );
      final dayStr = targetDate.day.toString().padLeft(2, '0');
      final monthStr = targetDate.month.toString().padLeft(2, '0');
      return "$dayStr/$monthStr/${targetDate.year}";
    } catch (_) {
      return "";
    }
  }

  int get _selectedWeekNumber =>
      int.tryParse(_selectedWeek.replaceAll(RegExp(r'[^0-9]'), '')) ?? 1;

  DateTime _dateForDay(int dayIndex) => DateTime(
    2026,
    6,
    15,
  ).add(Duration(days: (_selectedWeekNumber - 1) * 7 + dayIndex));

  int _timeMinutes(dynamic value) {
    final parts = value.toString().split(':');
    if (parts.length < 2) return 0;
    return (int.tryParse(parts[0]) ?? 0) * 60 + (int.tryParse(parts[1]) ?? 0);
  }

  String _durationLabel(dynamic start, dynamic end) {
    final minutes = math.max(0, _timeMinutes(end) - _timeMinutes(start));
    final hours = minutes ~/ 60;
    final remaining = minutes % 60;
    if (hours == 0) return '${remaining}m';
    return remaining == 0 ? '${hours}h' : '${hours}h ${remaining}m';
  }

  Future<void> _showWeekPicker() async {
    final selected = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Choose semester week',
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '15 June – 20 September 2026',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 18),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  childAspectRatio: 1.65,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemCount: 14,
                itemBuilder: (context, index) {
                  final week = index + 1;
                  final active = week == _selectedWeekNumber;
                  return InkWell(
                    onTap: () => Navigator.pop(context, week),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: active
                            ? const Color(0xFF2563EB)
                            : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: active
                              ? const Color(0xFF2563EB)
                              : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Text(
                        'W$week',
                        style: GoogleFonts.spaceGrotesk(
                          fontWeight: FontWeight.w700,
                          color: active
                              ? Colors.white
                              : const Color(0xFF475569),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
    if (selected != null && mounted) {
      setState(() => _selectedWeek = 'Week $selected');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Class Timetable",
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).brightness == Brightness.dark
                          ? Colors.white
                          : const Color(0xFF0F172A),
                    ),
                  ),
                  Text(
                    "2026 Semester, 15 Jun - 20 Sep",
                    style: GoogleFonts.inter(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            InkWell(
              onTap: _showWeekPicker,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                height: 38,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.calendar_view_week_rounded,
                      size: 15,
                      color: Color(0xFF2563EB),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _selectedWeek,
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF2563EB),
                      ),
                    ),
                    const SizedBox(width: 3),
                    const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: Color(0xFF2563EB),
                      size: 16,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        actions: [
          IconButton(
            icon: const Icon(
              Icons.info_outline,
              color: Color(0xFF64748B),
              size: 20,
            ),
            onPressed: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  title: Text(
                    "Academic Calendar",
                    style: GoogleFonts.spaceGrotesk(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  content: Text(
                    "This timetable displays your dynamic class times for the 2026/05 Academic Semester.\n\nClasses are synchronized between academic registers and your group enrolments.",
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: const Color(0xFF475569),
                      height: 1.4,
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text("Close"),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          const AuroraBackground(),
          Column(
            children: [
              // Weekday Selector Bar
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Row(
                  children: List.generate(7, (index) {
                    final isSelected = _selectedDayIndex == index;
                    final abbrev = _weekDayAbbrevs[index];
                    final date = _dateForDay(index);
                    final isToday =
                        date.year == ApiConfig.now.year &&
                        date.month == ApiConfig.now.month &&
                        date.day == ApiConfig.now.day;
                    return Expanded(
                      child: InkWell(
                        onTap: () {
                          setState(() {
                            _selectedDayIndex = index;
                          });
                          _pageController.animateToPage(
                            index,
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                          );
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 2),
                          padding: const EdgeInsets.symmetric(vertical: 7),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFF2563EB)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected
                                  ? const Color(0xFF2563EB)
                                  : isToday
                                  ? const Color(0xFF93C5FD)
                                  : Colors.transparent,
                            ),
                          ),
                          child: Column(
                            children: [
                              Text(
                                abbrev.substring(0, 1),
                                style: GoogleFonts.inter(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected
                                      ? Colors.white70
                                      : const Color(0xFF94A3B8),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${date.day}',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: isSelected
                                      ? Colors.white
                                      : const Color(0xFF334155),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ),

              // Divider
              Container(height: 1, color: const Color(0xFFE2E8F0)),

              // Timeline PageView Area
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  onPageChanged: (index) {
                    setState(() {
                      _selectedDayIndex = index;
                    });
                  },
                  itemCount: 7,
                  itemBuilder: (context, dayIndex) {
                    final selectedDayName = _weekDays[dayIndex];
                    final selectedDayDate = _getFormattedDateForDay(dayIndex);

                    // Filter schedule for selected day
                    final dayClasses =
                        _schedule.where((item) {
                          return item['day'].toString().toLowerCase() ==
                              selectedDayName.toLowerCase();
                        }).toList()..sort(
                          (a, b) => _timeMinutes(
                            a['startTime'],
                          ).compareTo(_timeMinutes(b['startTime'])),
                        );

                    // Separate normal classes and direct study / projects
                    final normalClasses = dayClasses.where((c) {
                      final grp = c['group'].toString().toLowerCase();
                      return grp != 'project' &&
                          grp != 'direct study' &&
                          !c['courseCode'].toString().toLowerCase().contains(
                            'project',
                          );
                    }).toList();

                    final projectClasses = dayClasses.where((c) {
                      final grp = c['group'].toString().toLowerCase();
                      return grp == 'project' ||
                          grp == 'direct study' ||
                          c['courseCode'].toString().toLowerCase().contains(
                            'project',
                          );
                    }).toList();

                    return RefreshIndicator(
                      onRefresh: _refreshSchedule,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Day & Date Subheader inside scroll list
                            Container(
                              margin: const EdgeInsets.symmetric(vertical: 14),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [
                                    Color(0xFF1D4ED8),
                                    Color(0xFF3B82F6),
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(
                                      0xFF2563EB,
                                    ).withValues(alpha: 0.22),
                                    blurRadius: 20,
                                    offset: const Offset(0, 8),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 48,
                                    height: 48,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(
                                        alpha: 0.16,
                                      ),
                                      borderRadius: BorderRadius.circular(15),
                                    ),
                                    child: Text(
                                      '${_dateForDay(dayIndex).day}',
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 22,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          selectedDayName,
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 18,
                                            fontWeight: FontWeight.w800,
                                            color: Colors.white,
                                          ),
                                        ),
                                        Text(
                                          selectedDayDate,
                                          style: GoogleFonts.inter(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w600,
                                            color: Colors.white70,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(
                                        alpha: 0.16,
                                      ),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      '${dayClasses.length} ${dayClasses.length == 1 ? 'class' : 'classes'}',
                                      style: GoogleFonts.inter(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            if (dayClasses.isEmpty)
                              Container(
                                margin: const EdgeInsets.only(top: 40),
                                child: GlassCard(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 40,
                                    horizontal: 16,
                                  ),
                                  child: Center(
                                    child: Column(
                                      children: [
                                        Icon(
                                          Icons.calendar_today_outlined,
                                          color: const Color(
                                            0xFF94A3B8,
                                          ).withValues(alpha: 0.5),
                                          size: 36,
                                        ),
                                        const SizedBox(height: 12),
                                        Text(
                                          "No classes scheduled for today",
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFF64748B),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          "Enjoy your day off or review self-study materials.",
                                          style: GoogleFonts.inter(
                                            fontSize: 11,
                                            color: const Color(0xFF94A3B8),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              )
                            else ...[
                              // Normal Timeline classes
                              ListView.separated(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                itemCount: normalClasses.length,
                                separatorBuilder: (context, index) =>
                                    const SizedBox(height: 14),
                                itemBuilder: (context, index) {
                                  final item = normalClasses[index];
                                  final start = item['startTime'] ?? '08:00';
                                  final end = item['endTime'] ?? '10:00';
                                  final group = item['group'] ?? 'Lecture';

                                  final groupStr = group
                                      .toString()
                                      .toLowerCase();
                                  final isLecture = groupStr.startsWith('l');
                                  final isTutor = groupStr.startsWith('t');
                                  final badgeLetter = isLecture
                                      ? 'L'
                                      : (isTutor ? 'T' : 'P');
                                  final typeLabel = isLecture
                                      ? 'Lecture'
                                      : (isTutor ? 'Tutorial' : 'Practical');

                                  final Color themeColor = isLecture
                                      ? const Color(0xFF2563EB)
                                      : (isTutor
                                            ? const Color(0xFF10B981)
                                            : const Color(0xFFF59E0B));

                                  return Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      // Time Column
                                      SizedBox(
                                        width: 76,
                                        child: Padding(
                                          padding: const EdgeInsets.only(
                                            top: 4.0,
                                          ),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                _formatTimeWithAmPm(start),
                                                style: GoogleFonts.spaceGrotesk(
                                                  fontSize: 11.5,
                                                  fontWeight: FontWeight.w800,
                                                  color:
                                                      Theme.of(
                                                            context,
                                                          ).brightness ==
                                                          Brightness.dark
                                                      ? Colors.white
                                                      : const Color(0xFF0F172A),
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                _durationLabel(start, end),
                                                style: GoogleFonts.inter(
                                                  fontSize: 9.5,
                                                  fontWeight: FontWeight.w700,
                                                  color: const Color(
                                                    0xFF94A3B8,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),

                                      // Class card details
                                      Expanded(
                                        child: InkWell(
                                          onTap: () => _showClassDetailsModal(
                                            context,
                                            item,
                                            start,
                                            end,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          child: GlassCard(
                                            padding: EdgeInsets.zero,
                                            color:
                                                Theme.of(context).brightness ==
                                                    Brightness.dark
                                                ? const Color(
                                                    0xFF1E293B,
                                                  ).withValues(alpha: 0.9)
                                                : Colors.white.withValues(
                                                    alpha: 0.9,
                                                  ),
                                            borderColor: themeColor.withValues(
                                              alpha: 0.15,
                                            ),
                                            child: IntrinsicHeight(
                                              child: Row(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Container(
                                                    width: 5,
                                                    decoration: BoxDecoration(
                                                      color: themeColor,
                                                      borderRadius:
                                                          const BorderRadius.horizontal(
                                                            left:
                                                                Radius.circular(
                                                                  16,
                                                                ),
                                                          ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 12),
                                                  // Round Letter Badge
                                                  Container(
                                                    width: 34,
                                                    height: 34,
                                                    margin:
                                                        const EdgeInsets.only(
                                                          top: 14,
                                                        ),
                                                    alignment: Alignment.center,
                                                    decoration: BoxDecoration(
                                                      color: themeColor
                                                          .withValues(
                                                            alpha: 0.12,
                                                          ),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            11,
                                                          ),
                                                    ),
                                                    child: Text(
                                                      badgeLetter,
                                                      style:
                                                          GoogleFonts.spaceGrotesk(
                                                            fontSize: 12,
                                                            fontWeight:
                                                                FontWeight.bold,
                                                            color: themeColor,
                                                          ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 10),

                                                  // Details
                                                  Expanded(
                                                    child: Padding(
                                                      padding:
                                                          const EdgeInsets.fromLTRB(
                                                            0,
                                                            12,
                                                            10,
                                                            12,
                                                          ),
                                                      child: Column(
                                                        crossAxisAlignment:
                                                            CrossAxisAlignment
                                                                .start,
                                                        children: [
                                                          Row(
                                                            children: [
                                                              Container(
                                                                padding:
                                                                    const EdgeInsets.symmetric(
                                                                      horizontal:
                                                                          7,
                                                                      vertical:
                                                                          3,
                                                                    ),
                                                                decoration: BoxDecoration(
                                                                  color: themeColor
                                                                      .withValues(
                                                                        alpha:
                                                                            0.1,
                                                                      ),
                                                                  borderRadius:
                                                                      BorderRadius.circular(
                                                                        7,
                                                                      ),
                                                                ),
                                                                child: Text(
                                                                  typeLabel,
                                                                  style: GoogleFonts.inter(
                                                                    fontSize:
                                                                        8.5,
                                                                    fontWeight:
                                                                        FontWeight
                                                                            .w800,
                                                                    color:
                                                                        themeColor,
                                                                  ),
                                                                ),
                                                              ),
                                                              const Spacer(),
                                                              Icon(
                                                                Icons
                                                                    .chevron_right_rounded,
                                                                size: 18,
                                                                color: themeColor
                                                                    .withValues(
                                                                      alpha:
                                                                          0.65,
                                                                    ),
                                                              ),
                                                            ],
                                                          ),
                                                          const SizedBox(
                                                            height: 7,
                                                          ),

                                                          // Course Title and Code
                                                          Text(
                                                            "${item['courseName'].toString().toUpperCase()} (${item['courseCode']})",
                                                            style: GoogleFonts.spaceGrotesk(
                                                              fontSize: 12,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .bold,
                                                              color:
                                                                  Theme.of(
                                                                        context,
                                                                      ).brightness ==
                                                                      Brightness
                                                                          .dark
                                                                  ? Colors.white
                                                                  : const Color(
                                                                      0xFF0F172A,
                                                                    ),
                                                              height: 1.25,
                                                            ),
                                                          ),
                                                          const SizedBox(
                                                            height: 9,
                                                          ),

                                                          Wrap(
                                                            spacing: 10,
                                                            runSpacing: 5,
                                                            children: [
                                                              _buildCompactDetail(
                                                                Icons
                                                                    .schedule_rounded,
                                                                '${_formatTimeWithAmPm(start)} – ${_formatTimeWithAmPm(end)}',
                                                              ),
                                                              _buildCompactDetail(
                                                                Icons
                                                                    .location_on_outlined,
                                                                item['room'] ??
                                                                    'TBA',
                                                              ),
                                                              _buildCompactDetail(
                                                                Icons
                                                                    .person_outline_rounded,
                                                                item['lecturerName'] ??
                                                                    'TBA',
                                                              ),
                                                            ],
                                                          ),
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
                                  );
                                },
                              ),

                              // Direct study / Projects section at bottom
                              if (projectClasses.isNotEmpty) ...[
                                const SizedBox(height: 20),
                                Padding(
                                  padding: const EdgeInsets.only(
                                    left: 4.0,
                                    bottom: 8.0,
                                  ),
                                  child: Text(
                                    "Project / Direct Study",
                                    style: GoogleFonts.spaceGrotesk(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF64748B),
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                                ListView.separated(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  itemCount: projectClasses.length,
                                  separatorBuilder: (context, index) =>
                                      const SizedBox(height: 10),
                                  itemBuilder: (context, index) {
                                    final item = projectClasses[index];
                                    final code =
                                        item['courseCode'] ?? 'PROJECT';
                                    final name =
                                        item['courseName'] ??
                                        'Project/Research Module';

                                    return GlassCard(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 12,
                                      ),
                                      color: const Color(
                                        0xFFF1F5F9,
                                      ).withValues(alpha: 0.6),
                                      borderColor: const Color(0xFFE2E8F0),
                                      child: Row(
                                        children: [
                                          CircleAvatar(
                                            radius: 14,
                                            backgroundColor: const Color(
                                              0xFF991B1B,
                                            ).withValues(alpha: 0.1),
                                            child: Text(
                                              "Z",
                                              style: GoogleFonts.spaceGrotesk(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: const Color(0xFF991B1B),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  "$name ($code)",
                                                  style:
                                                      GoogleFonts.spaceGrotesk(
                                                        fontSize: 11.5,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        color: const Color(
                                                          0xFF991B1B,
                                                        ),
                                                      ),
                                                ),
                                                const SizedBox(height: 4),
                                                Row(
                                                  children: [
                                                    const Icon(
                                                      Icons.person_outline,
                                                      size: 11,
                                                      color: Color(0xFF64748B),
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Expanded(
                                                      child: Text(
                                                        item['lecturerName'] ??
                                                            'TBA',
                                                        style:
                                                            GoogleFonts.inter(
                                                              fontSize: 9.5,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w600,
                                                              color:
                                                                  const Color(
                                                                    0xFF64748B,
                                                                  ),
                                                            ),
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
                                  },
                                ),
                              ],
                            ],
                            const SizedBox(height: 30),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCompactDetail(IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: const Color(0xFF64748B)),
        const SizedBox(width: 3),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 145),
          child: Text(
            value,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF64748B),
            ),
          ),
        ),
      ],
    );
  }

  void _showClassDetailsModal(
    BuildContext context,
    Map<String, dynamic> item,
    String start,
    String end,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (ctx) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          elevation: 10,
          child: Padding(
            padding: const EdgeInsets.all(22.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        "${item['courseCode']} (${item['group'] ?? 'Lecture'})",
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF2563EB),
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                Text(
                  item['courseName'].toString().toUpperCase(),
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 14.0),
                  child: Divider(height: 1),
                ),

                _buildModalRow(
                  context: context,
                  icon: Icons.access_time_filled_rounded,
                  iconColor: const Color(0xFFD97706),
                  title: "Class Time",
                  value:
                      "${_formatTimeWithAmPm(start)} - ${_formatTimeWithAmPm(end)}",
                ),
                const SizedBox(height: 12),

                _buildModalRow(
                  context: context,
                  icon: Icons.location_on_rounded,
                  iconColor: const Color(0xFF059669),
                  title: "Class Location / Room",
                  value: item['room'] ?? 'Main Hall A',
                ),
                const SizedBox(height: 12),

                _buildModalRow(
                  context: context,
                  icon: Icons.person_rounded,
                  iconColor: const Color(0xFF7C3AED),
                  title: "Teacher / Lecturer in Charge",
                  value:
                      "${item['lecturerName'] ?? 'TBA'} (${item['group'] ?? 'Instructor'})",
                ),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F172A),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text(
                      "Close Details",
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildModalRow({
    required BuildContext context,
    required IconData icon,
    required Color iconColor,
    required String title,
    required String value,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: iconColor),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.inter(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? const Color(0xFF94A3B8)
                      : const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 1),
              Text(
                value,
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : const Color(0xFF0F172A),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
