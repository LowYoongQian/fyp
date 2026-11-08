import '../../i18n/tr.dart';
import '../../widgets/brand_refresh.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../widgets/glass_card.dart';
import '../../main.dart';
import 'announcements.dart';

class HomeScreen extends StatefulWidget {
  final List<Map<String, dynamic>> announcements;
  final Future<void> Function() onRefresh;
  final VoidCallback onSettingsPressed;
  final Function(int) onTabSelected;
  const HomeScreen({
    super.key,
    required this.announcements,
    required this.onRefresh,
    required this.onSettingsPressed,
    required this.onTabSelected,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final List<Map<String, dynamic>> gridItems = [
    {'title': 'News', 'icon': Icons.campaign, 'color': Color(0xFF3B82F6)},
    {'title': 'Contact Us', 'icon': Icons.phone_outlined, 'color': Color(0xFFF59E0B)},
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.onRefresh();
    });
  }

  void _openAllAnnouncements() => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => AnnouncementsScreen(announcements: widget.announcements)),
      );

  String _dayOfWeekName(int day) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[day - 1];
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final primaryTextColor = isDarkMode ? Colors.white : const Color(0xFF0F172A);
    final secondaryTextColor = isDarkMode ? const Color(0xFFA0A0A0) : const Color(0xFF475569);
    final slateTextColor = isDarkMode ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    final cardBgColor = isDarkMode ? const Color(0xFF222222) : Colors.white;
    final borderColor = isDarkMode ? const Color(0xFF333333) : const Color(0xFFE2E8F0);

    return SafeArea(
      child: Column(
        children: [
          // Header Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            child: Row(
              children: [
                // Custom Emblem Logo (Generic School Emblem)
                Container(
                  height: 48,
                  width: 44,
                  decoration: BoxDecoration(
                    color: cardBgColor,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: isDarkMode ? 0.2 : 0.04),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      )
                    ],
                    border: Border.all(color: borderColor),
                  ),
                  child: const Center(
                    child: Icon(Icons.school_outlined, color: Color(0xFF2563EB), size: 22),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            "${ApiConfig.now.day.toString().padLeft(2, '0')}-${ApiConfig.now.month.toString().padLeft(2, '0')}",
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: primaryTextColor,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            tr(_dayOfWeekName(ApiConfig.now.weekday)),
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: slateTextColor,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        tr('Smart Attendance Portal System'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.inter(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          color: secondaryTextColor,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: widget.onSettingsPressed,
                  icon: Icon(Icons.settings, color: slateTextColor, size: 20),
                  style: IconButton.styleFrom(
                    backgroundColor: isDarkMode ? const Color(0xFF222222).withValues(alpha: 0.5) : Colors.white.withValues(alpha: 0.5),
                    padding: const EdgeInsets.all(8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: isDarkMode ? const Color(0xFF333333).withValues(alpha: 0.5) : const Color(0xFFE2E8F0).withValues(alpha: 0.5)),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Main Home Scrollable Area
          Expanded(
            child: BrandRefresh(
              onRefresh: widget.onRefresh,
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                  const SizedBox(height: 8),
                  
                  // Welcome Banner
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF2563EB), Color(0xFF3B82F6)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF2563EB).withValues(alpha: 0.25),
                          blurRadius: 16,
                          offset: const Offset(0, 8),
                        )
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tr('Welcome to Smart Attendance Portal'),
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          tr('Manage your classes, biometric keys, and view live attendance logs seamlessly.'),
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: Colors.white.withValues(alpha: 0.85),
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Portal Access Quick Cards
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => widget.onTabSelected(1),
                          borderRadius: BorderRadius.circular(16),
                          child: GlassCard(
                            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                            child: Column(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.school,
                                    color: Color(0xFF2563EB),
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  tr('Student Portal'),
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: primaryTextColor,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  tr('Check-in & view logs'),
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.inter(
                                    fontSize: 9.5,
                                    color: slateTextColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: InkWell(
                          onTap: () => widget.onTabSelected(2),
                          borderRadius: BorderRadius.circular(16),
                          child: GlassCard(
                            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                            child: Column(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.admin_panel_settings,
                                    color: Color(0xFF2563EB),
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  tr('Staff Portal'),
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: primaryTextColor,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  tr('Manage sessions & lists'),
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.inter(
                                    fontSize: 9.5,
                                    color: slateTextColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Option Grid
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 24,
                      mainAxisSpacing: 16,
                      childAspectRatio: 1.6,
                    ),
                    itemCount: gridItems.length,
                    itemBuilder: (context, index) {
                      final item = gridItems[index];
                      return InkWell(
                        onTap: () {
                          if (item['title'] == 'News') {
                            _openAllAnnouncements();
                            return;
                          }
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(tr('{v} feature is handled via school registrar web console.', {'v': tr(item['title'])})),
                              duration: const Duration(seconds: 2),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        borderRadius: BorderRadius.circular(16),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              height: 52,
                              width: 52,
                              decoration: BoxDecoration(
                                color: cardBgColor.withValues(alpha: 0.8),
                                shape: BoxShape.circle,
                                border: Border.all(color: borderColor),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: isDarkMode ? 0.2 : 0.03),
                                    blurRadius: 6,
                                    offset: const Offset(0, 3),
                                  )
                                ],
                              ),
                              child: Icon(
                                item['icon'],
                                color: item['color'],
                                size: 22,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              tr(item['title']),
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(
                                fontSize: 9.5,
                                fontWeight: FontWeight.bold,
                                color: isDarkMode ? const Color(0xFFE2E8F0) : const Color(0xFF334155),
                                height: 1.2,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 24),

                  // Announcements: the newest three here, all of them (five per page) behind Show more.
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          tr('Announcements'),
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: primaryTextColor,
                          ),
                        ),
                      ),
                      if (widget.announcements.isNotEmpty)
                        TextButton(
                          onPressed: _openAllAnnouncements,
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFF2563EB),
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            visualDensity: VisualDensity.compact,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(tr('Show More'), style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.w700)),
                              const Icon(Icons.chevron_right_rounded, size: 18),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (widget.announcements.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      decoration: BoxDecoration(
                        color: cardBgColor,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: borderColor),
                      ),
                      child: Column(
                        children: [
                          Icon(Icons.campaign_outlined, size: 28, color: slateTextColor),
                          const SizedBox(height: 8),
                          Text(
                            tr('No announcements at this time'),
                            style: GoogleFonts.inter(fontSize: 12, color: slateTextColor),
                          ),
                        ],
                      ),
                    )
                  else
                    for (final notice in widget.announcements.take(3))
                      AnnouncementCard(notice: notice),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
}

// Decorative graphic lines matching the banner style
class LinesPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    final step = 15.0;
    for (double i = -size.height; i < size.width; i += step) {
      canvas.drawLine(
        Offset(i, 0),
        Offset(i + size.height, size.height),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
