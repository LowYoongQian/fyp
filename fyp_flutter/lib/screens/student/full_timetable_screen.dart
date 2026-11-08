import '../../i18n/tr.dart';
import '../../widgets/brand_refresh.dart';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../main.dart';
import '../../services/academic_calendar.dart';
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
  late DateTime _weekMonday;
  SemesterWindow? get _semester => sharedSemester(_schedule);

  /// "2–8 Nov" or "27 Oct – 2 Nov".
  String _rangeLabel(DateTime a, DateTime b) => dayRange(a, b);

  DateTime get _thisMonday => calendarMonday(ApiConfig.now);

  String get _selectedWeek {
    final term = _semester;
    if (term == null) return relativeWeekLabel(_weekMonday, _thisMonday);
    final week = term.weekFor(_weekMonday);
    if (_weekMonday.add(const Duration(days: 6)).isBefore(term.start)) {
      return 'Semester upcoming';
    }
    if (_weekMonday.isAfter(term.end)) return 'Semester ended';
    return tr('Week {n}', {'n': week});
  }

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

    _weekMonday = calendarMonday(ApiConfig.now);
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
      final targetDate = _dateForDay(dayIndex);
      final dayStr = targetDate.day.toString().padLeft(2, '0');
      final monthStr = targetDate.month.toString().padLeft(2, '0');
      return "$dayStr/$monthStr/${targetDate.year}";
    } catch (_) {
      return "";
    }
  }

  DateTime _dateForDay(int dayIndex) =>
      _weekMonday.add(Duration(days: dayIndex));

  int _timeMinutes(dynamic value) {
    final parts = value.toString().split(':');
    if (parts.length < 2) return 0;
    return (int.tryParse(parts[0]) ?? 0) * 60 + (int.tryParse(parts[1]) ?? 0);
  }

  String _durationLabel(dynamic start, dynamic end) {
    final minutes = math.max(0, _timeMinutes(end) - _timeMinutes(start));
    final hours = minutes ~/ 60;
    final remaining = minutes % 60;
    if (hours == 0) return tr('{m}m', {'m': remaining});
    return remaining == 0 ? tr('{h}h', {'h': hours}) : tr('{h}h {m}m', {'h': hours, 'm': remaining});
  }

  void _shiftWeek(int weeks) => setState(() => _weekMonday = _weekMonday.add(Duration(days: 7 * weeks)));

  /// Previous / next stay inside the semester's weeks when there are semester dates.
  bool get _canGoBack => _semester == null || _weekMonday.isAfter(_semester!.firstMonday);
  bool get _canGoForward =>
      _semester == null || _weekMonday.isBefore(_semester!.firstMonday.add(Duration(days: 7 * (_semester!.weeks - 1))));

  void _goToToday() {
    final today = math.min(6, math.max(0, ApiConfig.now.weekday - 1));
    setState(() {
      _weekMonday = _thisMonday;
      _selectedDayIndex = today;
    });
    if (_pageController.hasClients) {
      _pageController.animateToPage(today, duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    }
  }

  /// Opens for every timetable. With semester dates it lists the semester's weeks; without them (no classes yet,
  /// or courses in different semesters) it lists the weeks around today. Before, it silently did nothing then.
  Future<void> _showWeekPicker() async {
    final term = _semester;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final thisMonday = _thisMonday;
    final mondays = pickerWeeks(term);
    final muted = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    final selected = await showModalBottomSheet<DateTime>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      backgroundColor: dark ? const Color(0xFF222222) : Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * .75),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (term == null)
                  // No semester dates for these classes: nothing to pick, so say so instead of inventing weeks.
                  Padding(
                    padding: const EdgeInsets.fromLTRB(0, 12, 0, 20),
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: const Color(0xFF2563EB).withValues(alpha: dark ? .18 : .1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.event_busy_rounded, size: 30, color: Color(0xFF2563EB)),
                        ),
                        const SizedBox(height: 14),
                        Text(tr('No semester dates yet'),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.spaceGrotesk(fontSize: 17, fontWeight: FontWeight.w700, color: dark ? Colors.white : const Color(0xFF0F172A))),
                        const SizedBox(height: 4),
                        Text(tr('No available timetable'),
                            textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 13, color: muted)),
                      ]),
                    ),
                  )
                else ...[
                Row(children: [
                  Expanded(
                    child: Text(tr('Choose a week'),
                        style: GoogleFonts.spaceGrotesk(fontSize: 18, fontWeight: FontWeight.w700, color: dark ? Colors.white : const Color(0xFF0F172A))),
                  ),
                  if (mondays.contains(thisMonday))
                    TextButton.icon(
                      onPressed: () => Navigator.pop(context, thisMonday),
                      icon: const Icon(Icons.today_rounded, size: 16),
                      label: Text(tr('This week')),
                    ),
                ]),
                Text(
                  '${term.name} · ${_rangeLabel(term.start, term.end)} ${term.end.year}',
                  style: GoogleFonts.inter(fontSize: 12, color: muted),
                ),
                const SizedBox(height: 14),
                Flexible(
                  child: GridView.builder(
                    shrinkWrap: true,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      childAspectRatio: 1.6,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    itemCount: mondays.length,
                    itemBuilder: (context, index) {
                      final monday = mondays[index];
                      final active = monday == _weekMonday;
                      final current = monday == thisMonday;
                      final title = tr('Week {n}', {'n': index + 1});
                      return Material(
                        color: active ? const Color(0xFF2563EB) : (dark ? const Color(0xFF2D2D2D) : const Color(0xFFF1F5F9)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                          side: BorderSide(
                            color: active
                                ? const Color(0xFF2563EB)
                                : current
                                    ? const Color(0xFF93C5FD)
                                    : (dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0)),
                            width: current && !active ? 1.6 : 1,
                          ),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => Navigator.pop(context, monday),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Text(tr(title),
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: active ? Colors.white : (dark ? Colors.white : const Color(0xFF1E293B)),
                                )),
                            const SizedBox(height: 2),
                            Text(tr(_rangeLabel(monday, monday.add(const Duration(days: 6)))),
                                style: GoogleFonts.inter(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                  color: active ? Colors.white70 : (dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B)),
                                )),
                          ]),
                        ),
                      );
                    },
                  ),
                ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
    if (selected != null && mounted) setState(() => _weekMonday = selected);
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final bar = dark ? const Color(0xFF181818) : Colors.white;
    final muted = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    final line = dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0);
    final weekEnd = _weekMonday.add(const Duration(days: 6));
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr('Class Timetable'),
              style: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold, color: dark ? Colors.white : const Color(0xFF0F172A)),
            ),
            Text(
              tr(_semester != null
                  ? '${_semester!.name} · ${_rangeLabel(_semester!.start, _semester!.end)} ${_semester!.end.year}'
                  : 'Your weekly classes'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: muted),
            ),
          ],
        ),
        backgroundColor: bar,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        actions: [
          IconButton(
            tooltip: tr('About these dates'),
            icon: Icon(
              Icons.info_outline,
              color: muted,
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
                    tr('Academic Calendar'),
                    style: GoogleFonts.spaceGrotesk(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  content: Text(
                    tr('Dates use Malaysia time and the current server clock. Semester dates are set by the academic office; courses without a configured semester retain their weekly timetable.'),
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: const Color(0xFF475569),
                      height: 1.4,
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: Text(tr('Close')),
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
              // Week bar: previous / next week, the week (tap to choose another) and a way back to today.
              Container(
                color: bar,
                padding: const EdgeInsets.fromLTRB(6, 2, 6, 0),
                child: Row(children: [
                  IconButton(
                    tooltip: tr('Previous week'),
                    onPressed: _canGoBack ? () => _shiftWeek(-1) : null,
                    icon: const Icon(Icons.chevron_left_rounded),
                  ),
                  Expanded(
                    child: InkWell(
                      onTap: _showWeekPicker,
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Column(children: [
                          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            const Icon(Icons.calendar_view_week_rounded, size: 16, color: Color(0xFF2563EB)),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(tr(_selectedWeek),
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.spaceGrotesk(fontSize: 14, fontWeight: FontWeight.bold, color: dark ? Colors.white : const Color(0xFF0F172A))),
                            ),
                            Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: muted),
                          ]),
                          Text('${_rangeLabel(_weekMonday, weekEnd)} ${weekEnd.year}',
                              style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: muted)),
                        ]),
                      ),
                    ),
                  ),
                  if (_weekMonday != _thisMonday)
                    TextButton(
                      onPressed: _goToToday,
                      style: TextButton.styleFrom(visualDensity: VisualDensity.compact, padding: const EdgeInsets.symmetric(horizontal: 8)),
                      child: Text(tr('Today')),
                    ),
                  IconButton(
                    tooltip: tr('Next week'),
                    onPressed: _canGoForward ? () => _shiftWeek(1) : null,
                    icon: const Icon(Icons.chevron_right_rounded),
                  ),
                ]),
              ),
              // Weekday Selector Bar
              Container(
                color: bar,
                padding: const EdgeInsets.fromLTRB(10, 2, 10, 10),
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
                                // English keeps its single letter; other languages show their short day name.
                                AppLanguage.code == 'en' ? abbrev.substring(0, 1) : tr(const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]),
                                style: GoogleFonts.inter(
                                  fontSize: 10.5,
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
                                      : (dark ? Colors.white : const Color(0xFF334155)),
                                ),
                              ),
                              const SizedBox(height: 3),
                              // Today gets a small dot, also when another day is selected.
                              Container(
                                width: 4,
                                height: 4,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: isToday ? (isSelected ? Colors.white : const Color(0xFF2563EB)) : Colors.transparent,
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
              Container(height: 1, color: line),

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
                                  selectedDayName.toLowerCase() &&
                              (SemesterWindow.parse(
                                    item['semester'],
                                  )?.contains(_dateForDay(dayIndex)) ??
                                  true);
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

                    return BrandRefresh(
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
                                          tr(selectedDayName),
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 18,
                                            fontWeight: FontWeight.w800,
                                            color: Colors.white,
                                          ),
                                        ),
                                        Text(
                                          tr(selectedDayDate),
                                          style: GoogleFonts.inter(
                                            fontSize: 11.5,
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
                                      dayClasses.length == 1 ? tr('1 class') : tr('{n} classes', {'n': dayClasses.length}),
                                      style: GoogleFonts.inter(
                                        fontSize: 11,
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
                                          dayIndex == ApiConfig.now.weekday - 1 && _weekMonday == _thisMonday ? tr("No classes today") : tr('No classes on {day}', {'day': tr(selectedDayName)}),
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFF64748B),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          tr('Enjoy the free time, or catch up on self-study.'),
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
                                                tr(_formatTimeWithAmPm(start)),
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
                                                tr(_durationLabel(start, end)),
                                                style: GoogleFonts.inter(
                                                  fontSize: 11,
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
                                                    0xFF222222,
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
                                                      tr(badgeLetter),
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
                                                                  tr(typeLabel),
                                                                  style: GoogleFonts.inter(
                                                                    fontSize:
                                                                        10,
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
                                    tr('Project / Direct Study'),
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
                                                        tr(item['lecturerName'] ??
                                                            'TBA'),
                                                        style:
                                                            GoogleFonts.inter(
                                                              fontSize: 11,
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
            tr(value),
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              fontSize: 10.5,
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
          backgroundColor: isDark ? const Color(0xFF222222) : Colors.white,
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
                  tr(item['courseName'].toString().toUpperCase()),
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
                  title: tr('Class Time'),
                  value:
                      "${_formatTimeWithAmPm(start)} - ${_formatTimeWithAmPm(end)}",
                ),
                const SizedBox(height: 12),

                _buildModalRow(
                  context: context,
                  icon: Icons.location_on_rounded,
                  iconColor: const Color(0xFF059669),
                  title: tr('Class Location / Room'),
                  value: item['room'] ?? 'Main Hall A',
                ),
                const SizedBox(height: 12),

                _buildModalRow(
                  context: context,
                  icon: Icons.person_rounded,
                  iconColor: const Color(0xFF7C3AED),
                  title: tr('Teacher / Lecturer in Charge'),
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
                    child: Text(
                      tr('Close Details'),
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
                tr(title),
                style: GoogleFonts.inter(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? const Color(0xFFA0A0A0)
                      : const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 1),
              Text(
                tr(value),
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
