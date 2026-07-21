import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../widgets/glass_card.dart';
import '../../main.dart';

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
    {'title': 'Online Application', 'icon': Icons.assignment_outlined, 'color': Color(0xFFEF4444)},
    {'title': 'Programme Offered', 'icon': Icons.school_outlined, 'color': Color(0xFF10B981)},
    {'title': 'KL Campus Tour', 'icon': Icons.explore_outlined, 'color': Color(0xFF8B5CF6)},
    {'title': 'Contact Us', 'icon': Icons.phone_outlined, 'color': Color(0xFFF59E0B)},
    {'title': 'Library', 'icon': Icons.menu_book_outlined, 'color': Color(0xFF06B6D4)},
    {'title': 'Events', 'icon': Icons.event_note_outlined, 'color': Color(0xFFEC4899)},
    {'title': 'More', 'icon': Icons.more_horiz_outlined, 'color': Color(0xFF64748B)},
  ];

  String _dayOfWeekName(int day) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[day - 1];
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final primaryTextColor = isDarkMode ? Colors.white : const Color(0xFF0F172A);
    final secondaryTextColor = isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF475569);
    final slateTextColor = isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final cardBgColor = isDarkMode ? const Color(0xFF1E1E1E) : Colors.white;
    final borderColor = isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0);

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
                            _dayOfWeekName(ApiConfig.now.weekday),
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
                        "Smart Attendance Portal System",
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
                    backgroundColor: isDarkMode ? const Color(0xFF1E1E1E).withValues(alpha: 0.5) : Colors.white.withValues(alpha: 0.5),
                    padding: const EdgeInsets.all(8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: isDarkMode ? const Color(0xFF334155).withValues(alpha: 0.5) : const Color(0xFFE2E8F0).withValues(alpha: 0.5)),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Main Home Scrollable Area
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              physics: const BouncingScrollPhysics(),
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
                          "Welcome to Smart Attendance Portal",
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          "Manage your classes, biometric keys, and view live attendance logs seamlessly.",
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
                                  "Student Portal",
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: primaryTextColor,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  "Check-in & view logs",
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
                                    color: const Color(0xFF800000).withValues(alpha: 0.1),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.admin_panel_settings,
                                    color: Color(0xFF800000),
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  "Staff Portal",
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: primaryTextColor,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  "Manage sessions & lists",
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
                      crossAxisCount: 4,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 16,
                      childAspectRatio: 0.82,
                    ),
                    itemCount: gridItems.length,
                    itemBuilder: (context, index) {
                      final item = gridItems[index];
                      return InkWell(
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text("${item['title']} feature is handled via school registrar web console."),
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
                              item['title'],
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

                  // Intakes & Promo Banners
                  Text(
                    "Announcements & Banners",
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: primaryTextColor,
                    ),
                  ),
                  const SizedBox(height: 12),

                  if (widget.announcements.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24.0),
                        child: Text(
                          "No announcements at this time",
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: slateTextColor,
                          ),
                        ),
                      ),
                    )
                  else
                    ...widget.announcements.asMap().entries.map((entry) {
                      final int idx = entry.key;
                      final Map<String, dynamic> ann = entry.value;

                      // Handle background image
                      DecorationImage? bgImage;
                      final imageBase64 = ann['image_base64'] as String?;
                      if (imageBase64 != null && imageBase64.isNotEmpty) {
                        try {
                          final base64Clean = imageBase64.split(',').last;
                          final decodedBytes = base64Decode(base64Clean);
                           bgImage = DecorationImage(
                            image: MemoryImage(decodedBytes),
                            fit: BoxFit.cover,
                            colorFilter: ColorFilter.mode(
                              Colors.black.withValues(alpha: 0.55),
                              BlendMode.darken,
                            ),
                          );
                        } catch (e) {
                          debugPrint("Failed to decode announcement image: $e");
                        }
                      }

                      // Alternating default gradients if no image
                      final decoration = BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        image: bgImage,
                        gradient: bgImage == null
                            ? LinearGradient(
                                colors: idx % 2 == 0
                                    ? [const Color(0xFF0F172A), const Color(0xFF1E293B)]
                                    : [const Color(0xFF0369A1), const Color(0xFF0EA5E9)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              )
                            : null,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          )
                        ],
                      );

                      final String badgeText = (ann['faculty'] ?? ann['publisher'] ?? 'ADMIN').toString().toUpperCase();
                      final String titleText = (ann['title'] ?? '').toString();
                      final String contentText = (ann['content'] ?? '').toString();

                      // Action button text and colors
                      final bool isIntake = titleText.toUpperCase().contains("INTAKE");
                      final String btnText = isIntake ? "APPLY NOW" : "More";
                      final Color btnBgColor = idx % 2 == 0 ? const Color(0xFF2563EB) : Colors.white;
                      final Color btnTextColor = idx % 2 == 0 ? Colors.white : const Color(0xFF0369A1);

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16.0),
                        child: Container(
                          width: double.infinity,
                          height: 140,
                          decoration: decoration,
                          child: Stack(
                            children: [
                              Padding(
                                padding: const EdgeInsets.all(18.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        badgeText,
                                        style: GoogleFonts.inter(
                                          fontSize: 8,
                                          fontWeight: FontWeight.w800,
                                          color: Colors.white,
                                          letterSpacing: 1.0,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    SizedBox(
                                      width: MediaQuery.of(context).size.width - 160,
                                      child: Text(
                                        titleText,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 17,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                          letterSpacing: -0.5,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    SizedBox(
                                      width: MediaQuery.of(context).size.width - 160,
                                      child: Text(
                                        contentText,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.inter(
                                          fontSize: 10,
                                          color: const Color(0xFFE2E8F0),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Positioned(
                                bottom: 16,
                                right: 16,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: btnBgColor,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        btnText,
                                        style: GoogleFonts.inter(
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                          color: btnTextColor,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Icon(Icons.arrow_forward_ios, color: btnTextColor, size: 8),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  const SizedBox(height: 8),
                ],
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
