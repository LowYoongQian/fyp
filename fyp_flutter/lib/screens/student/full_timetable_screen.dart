import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../main.dart';
import '../../widgets/aurora_background.dart';
import '../../widgets/glass_card.dart';

class FullTimetableScreen extends StatefulWidget {
  final List<Map<String, dynamic>> schedule;
  const FullTimetableScreen({super.key, required this.schedule});

  @override
  State<FullTimetableScreen> createState() => _FullTimetableScreenState();
}

class _FullTimetableScreenState extends State<FullTimetableScreen> {
  int _selectedDayIndex = 0; // 0 for Mon, 6 for Sun
  final List<String> _weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  final List<String> _weekDayAbbrevs = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  String _selectedWeek = "Week 1";
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    // Initialize day tab to today's weekday
    final todayWeekday = ApiConfig.now.weekday; // 1-7
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
      final targetDate = semesterStart.add(Duration(days: (weekNum - 1) * 7 + dayIndex));
      final dayStr = targetDate.day.toString().padLeft(2, '0');
      final monthStr = targetDate.month.toString().padLeft(2, '0');
      return "$dayStr/$monthStr/${targetDate.year}";
    } catch (_) {
      return "";
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
                      color: const Color(0xFF0F172A),
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
            // Week Selector Dropdown
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFBFDBFE).withValues(alpha: 0.5)),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedWeek,
                  isDense: true,
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF2563EB),
                  ),
                  icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF2563EB), size: 14),
                  items: List.generate(14, (idx) => "Week ${idx + 1}").map((w) {
                    return DropdownMenuItem<String>(
                      value: w,
                      child: Text(w),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _selectedWeek = val;
                      });
                    }
                  },
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
            icon: const Icon(Icons.info_outline, color: Color(0xFF64748B), size: 20),
            onPressed: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  title: Text(
                    "Academic Calendar",
                    style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold),
                  ),
                  content: Text(
                    "This timetable displays your dynamic class times for the 2026/05 Academic Semester.\n\nClasses are synchronized between academic registers and your group enrolments.",
                    style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF475569), height: 1.4),
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
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: List.generate(7, (index) {
                    final isSelected = _selectedDayIndex == index;
                    final abbrev = _weekDayAbbrevs[index];
                    return InkWell(
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
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          border: isSelected
                              ? const Border(
                                  bottom: BorderSide(
                                    color: Color(0xFF2563EB),
                                    width: 2.5,
                                  ),
                                )
                              : null,
                        ),
                        child: Text(
                          abbrev,
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 11.5,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                            letterSpacing: 0.5,
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
                    final dayClasses = widget.schedule.where((item) {
                      return item['day'].toString().toLowerCase() == selectedDayName.toLowerCase();
                    }).toList();

                    // Separate normal classes and direct study / projects
                    final normalClasses = dayClasses.where((c) {
                      final grp = c['group'].toString().toLowerCase();
                      return grp != 'project' && grp != 'direct study' && !c['courseCode'].toString().toLowerCase().contains('project');
                    }).toList();

                    final projectClasses = dayClasses.where((c) {
                      final grp = c['group'].toString().toLowerCase();
                      return grp == 'project' || grp == 'direct study' || c['courseCode'].toString().toLowerCase().contains('project');
                    }).toList();

                    return RefreshIndicator(
                      onRefresh: () async {
                        await Future.delayed(const Duration(milliseconds: 600));
                      },
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Day & Date Subheader inside scroll list
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16.0),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    selectedDayName,
                                    style: GoogleFonts.spaceGrotesk(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF1E293B),
                                    ),
                                  ),
                                  Text(
                                    selectedDayDate,
                                    style: GoogleFonts.spaceGrotesk(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            if (dayClasses.isEmpty)
                              Container(
                                margin: const EdgeInsets.only(top: 40),
                                child: GlassCard(
                                  padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 16),
                                  child: Center(
                                    child: Column(
                                      children: [
                                        Icon(Icons.calendar_today_outlined, color: const Color(0xFF94A3B8).withValues(alpha: 0.5), size: 36),
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
                                separatorBuilder: (context, index) => const SizedBox(height: 14),
                                itemBuilder: (context, index) {
                                  final item = normalClasses[index];
                                  final start = item['startTime'] ?? '08:00';
                                  final end = item['endTime'] ?? '10:00';
                                  final group = item['group'] ?? 'Lecture';
                                  
                                  final groupStr = group.toString().toLowerCase();
                                  final isLecture = groupStr.startsWith('l');
                                  final isTutor = groupStr.startsWith('t');
                                  final badgeLetter = isLecture ? 'L' : (isTutor ? 'T' : 'P');

                                  final Color themeColor = isLecture
                                      ? const Color(0xFF2563EB)
                                      : (isTutor ? const Color(0xFF10B981) : const Color(0xFFF59E0B));
                                  
                                  return Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Time Column
                                      SizedBox(
                                        width: 80,
                                        child: Padding(
                                          padding: const EdgeInsets.only(top: 8.0),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                _formatTimeWithAmPm(start),
                                                style: GoogleFonts.spaceGrotesk(
                                                  fontSize: 12.5,
                                                  fontWeight: FontWeight.w800,
                                                  color: const Color(0xFF0F172A),
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                _formatTimeWithAmPm(end),
                                                style: GoogleFonts.spaceGrotesk(
                                                  fontSize: 12.5,
                                                  fontWeight: FontWeight.w800,
                                                  color: const Color(0xFF0F172A),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),

                                      // Class card details
                                      Expanded(
                                        child: GlassCard(
                                          padding: const EdgeInsets.all(12),
                                          color: Colors.white.withValues(alpha: 0.9),
                                          borderColor: themeColor.withValues(alpha: 0.15),
                                          child: Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              // Round Letter Badge
                                              CircleAvatar(
                                                radius: 15,
                                                backgroundColor: themeColor.withValues(alpha: 0.15),
                                                child: Text(
                                                  badgeLetter,
                                                  style: GoogleFonts.spaceGrotesk(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.bold,
                                                    color: themeColor,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 10),

                                              // Details
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    // Room Name / Info
                                                    Row(
                                                      children: [
                                                        const Icon(Icons.home_outlined, size: 13, color: Color(0xFF2563EB)),
                                                        const SizedBox(width: 4),
                                                        Expanded(
                                                          child: Text(
                                                            item['room'] ?? 'TBA',
                                                            style: GoogleFonts.inter(
                                                              fontSize: 10.5,
                                                              fontWeight: FontWeight.w700,
                                                              color: const Color(0xFF2563EB),
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                    const SizedBox(height: 5),

                                                    // Course Title and Code
                                                    Text(
                                                      "${item['courseName'].toString().toUpperCase()} (${item['courseCode']})",
                                                      style: GoogleFonts.spaceGrotesk(
                                                        fontSize: 11.5,
                                                        fontWeight: FontWeight.bold,
                                                        color: const Color(0xFF0F172A),
                                                        height: 1.25,
                                                      ),
                                                    ),
                                                    const SizedBox(height: 8),

                                                    // Lecturer details
                                                    Row(
                                                      children: [
                                                        const Icon(Icons.person_outline, size: 12, color: Color(0xFF64748B)),
                                                        const SizedBox(width: 4),
                                                        Expanded(
                                                          child: Text(
                                                            item['lecturerName'] ?? 'TBA',
                                                            style: GoogleFonts.inter(
                                                              fontSize: 9.5,
                                                              fontWeight: FontWeight.w600,
                                                              color: const Color(0xFF64748B),
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
                                  padding: const EdgeInsets.only(left: 4.0, bottom: 8.0),
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
                                  separatorBuilder: (context, index) => const SizedBox(height: 10),
                                  itemBuilder: (context, index) {
                                    final item = projectClasses[index];
                                    final code = item['courseCode'] ?? 'PROJECT';
                                    final name = item['courseName'] ?? 'Project/Research Module';
                                    
                                    return GlassCard(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                      color: const Color(0xFFF1F5F9).withValues(alpha: 0.6),
                                      borderColor: const Color(0xFFE2E8F0),
                                      child: Row(
                                        children: [
                                          CircleAvatar(
                                            radius: 14,
                                            backgroundColor: const Color(0xFF991B1B).withValues(alpha: 0.1),
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
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  "$name ($code)",
                                                  style: GoogleFonts.spaceGrotesk(
                                                    fontSize: 11.5,
                                                    fontWeight: FontWeight.bold,
                                                    color: const Color(0xFF991B1B),
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Row(
                                                  children: [
                                                    const Icon(Icons.person_outline, size: 11, color: Color(0xFF64748B)),
                                                    const SizedBox(width: 4),
                                                    Expanded(
                                                      child: Text(
                                                        item['lecturerName'] ?? 'TBA',
                                                        style: GoogleFonts.inter(
                                                          fontSize: 9.5,
                                                          fontWeight: FontWeight.w600,
                                                          color: const Color(0xFF64748B),
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
}
