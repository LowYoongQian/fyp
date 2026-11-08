// ignore_for_file: deprecated_member_use
// The confirmation shown after the server records a check-in. Moved unchanged out of main.dart so it can also be shown on its own
// (the public site's demo capture renders it with sample data); the app calls it exactly as before.
import '../i18n/tr.dart';
import 'dart:math' as math;
import 'package:flutter/material.dart';

// Result colours: green means the check-in is done, red means it was not recorded.
const _green = Color(0xFF16A34A);
const _greenLight = Color(0xFF22C55E);
const _lime = Color(0xFF84CC16);
const _red = Color(0xFFDC2626);
const _pink = Color(0xFFF43F5E);

void showCheckInSuccessDialog(
  BuildContext context, {
  required String courseCode,
  required String courseName,
  required String timeSlot,
  required String room,
  required String classGroup,
  required String lecturerName,
  required String lecturerRole,
  required bool wifiVerified,
  required bool livenessPassed,
}) {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (ctx) {
      final isDark = Theme.of(ctx).brightness == Brightness.dark;
      final now = DateTime.now();
      final daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      final dayName = tr(daysOrder[now.weekday - 1]);
      final formattedDate = '$dayName, ${dayMonth(now, year: true)}';
      final surface = isDark ? const Color(0xFF222222) : Colors.white;
      final ink = isDark ? Colors.white : const Color(0xFF0F172A);
      final line = isDark ? const Color(0xFF333333) : const Color(0xFFE2E8F0);

      return Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: surface,
        clipBehavior: Clip.antiAlias,
        elevation: 16,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header: the brand gradient with the animated result badge.
              Container(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 22),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [_green, _greenLight, _lime],
                  ),
                ),
                child: Column(children: [
                  _ResultBadge(icon: Icons.check_rounded, color: _green),
                  const SizedBox(height: 14),
                  Text(
                    tr('Attendance recorded'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: Colors.white),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tr('Your check-in has been successfully recorded.'),
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: .9)),
                  ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  // The class
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2D2D2D) : const Color(0xFFF5F9FF),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: line),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [_green, _greenLight]),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.school_rounded, color: Colors.white, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(courseCode, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: .4, color: isDark ? const Color(0xFF86EFAC) : _green)),
                            const SizedBox(height: 1),
                            Text(courseName, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: ink)),
                          ]),
                        ),
                      ]),
                      const SizedBox(height: 12),
                      Divider(height: 1, color: line),
                      const SizedBox(height: 12),
                      _buildDetailRow(isDark: isDark, icon: Icons.schedule_rounded, iconColor: _green, title: 'Date & Time', value: '$timeSlot\n$formattedDate'),
                      if (classGroup.isNotEmpty || room.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        _buildDetailRow(
                          isDark: isDark,
                          icon: Icons.room_outlined,
                          iconColor: _green,
                          title: 'Room',
                          value: [if (room.isNotEmpty) room, if (classGroup.isNotEmpty) tr(classGroup)].join(' · '),
                        ),
                      ],
                      const SizedBox(height: 10),
                      _buildDetailRow(isDark: isDark, icon: Icons.person_outline_rounded, iconColor: _green, title: 'Lecturer / Instructor', value: '$lecturerName (${tr(lecturerRole)})'),
                    ]),
                  ),
                  const SizedBox(height: 14),
                  // How it was verified
                  Row(children: [
                    Expanded(child: _check(isDark, Icons.wifi_rounded, wifiVerified ? 'Wi-Fi verified' : 'Wi-Fi bypassed', wifiVerified)),
                    const SizedBox(width: 10),
                    Expanded(child: _check(isDark, Icons.face_retouching_natural_rounded, livenessPassed ? 'Liveness passed' : 'Liveness alert', livenessPassed)),
                  ]),
                  const SizedBox(height: 18),
                  // Done: the brand gradient, growing with accessibility text sizes.
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [_green, _greenLight]),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [BoxShadow(color: _green.withValues(alpha: isDark ? .25 : .3), blurRadius: 16, offset: const Offset(0, 6))],
                    ),
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        minimumSize: const Size.fromHeight(52),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      onPressed: () => Navigator.pop(ctx),
                      child: Text(tr('Done'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    ),
                  ),
                ]),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// One verification result: a tinted tile with a tick (passed) or a warning (needs a look).
Widget _check(bool isDark, IconData icon, String label, bool ok) {
  final color = ok ? _green : const Color(0xFFF59E0B);
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
    decoration: BoxDecoration(
      color: color.withValues(alpha: isDark ? .16 : .09),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: color.withValues(alpha: .35)),
    ),
    child: Row(children: [
      Icon(icon, size: 17, color: color),
      const SizedBox(width: 6),
      Expanded(
        child: Text(tr(label),
            maxLines: 2,
            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: isDark ? Colors.white : const Color(0xFF0F172A))),
      ),
      Icon(ok ? Icons.check_circle_rounded : Icons.error_outline_rounded, size: 16, color: color),
    ]),
  );
}

Widget _buildDetailRow({
  required bool isDark,
  required IconData icon,
  required Color iconColor,
  required String title,
  required String value,
}) {
  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(color: iconColor.withValues(alpha: isDark ? .2 : .1), borderRadius: BorderRadius.circular(9)),
        child: Icon(icon, size: 15, color: iconColor),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr(title),
              style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: isDark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B)),
            ),
            const SizedBox(height: 1),
            Text(
              tr(value),
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B)),
            ),
          ],
        ),
      ),
    ],
  );
}

/// The check-in was not recorded: a red header with the reason, and Try again (scan again) when [onRetry] is given.
void showCheckInFailedDialog(BuildContext context, {required String message, VoidCallback? onRetry}) {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (ctx) {
      final isDark = Theme.of(ctx).brightness == Brightness.dark;
      final ink = isDark ? const Color(0xFFE2E8F0) : const Color(0xFF334155);
      return Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: isDark ? const Color(0xFF222222) : Colors.white,
        clipBehavior: Clip.antiAlias,
        elevation: 16,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 22),
              decoration: const BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [_red, _pink]),
              ),
              child: Column(children: [
                _ResultBadge(icon: Icons.close_rounded, color: _red),
                const SizedBox(height: 14),
                Text(tr('Check-in failed'),
                    textAlign: TextAlign.center, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: Colors.white)),
                const SizedBox(height: 4),
                Text(tr('Your attendance was not recorded.'),
                    textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: .9))),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: _red.withValues(alpha: isDark ? .14 : .06),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: _red.withValues(alpha: .3)),
                  ),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Icon(Icons.error_outline_rounded, color: _red, size: 20),
                    const SizedBox(width: 10),
                    Expanded(child: Text(tr(message), style: TextStyle(fontSize: 13, height: 1.45, fontWeight: FontWeight.w600, color: ink))),
                  ]),
                ),
                const SizedBox(height: 18),
                if (onRetry != null) ...[
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [_red, _pink]),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [BoxShadow(color: _red.withValues(alpha: isDark ? .25 : .3), blurRadius: 16, offset: const Offset(0, 6))],
                    ),
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        minimumSize: const Size.fromHeight(52),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        onRetry();
                      },
                      icon: const Icon(Icons.refresh_rounded),
                      label: Text(tr('Try Again'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                TextButton(
                  style: TextButton.styleFrom(minimumSize: const Size.fromHeight(46), foregroundColor: isDark ? Colors.white70 : const Color(0xFF475569)),
                  onPressed: () => Navigator.pop(ctx),
                  child: Text(tr('Close'), style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
              ]),
            ),
          ]),
        ),
      );
    },
  );
}

/// The result icon: it pops in with a burst of sparks, then three soft waves breathe out and it settles. One run of
/// about 2.6 s, so the dialog comes to rest; with reduced motion the finished badge shows straight away.
class _ResultBadge extends StatefulWidget {
  final IconData icon;
  final Color color;
  const _ResultBadge({required this.icon, required this.color});

  @override
  State<_ResultBadge> createState() => _ResultBadgeState();
}

class _ResultBadgeState extends State<_ResultBadge> with SingleTickerProviderStateMixin {
  late final AnimationController _run;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _run = AnimationController(vsync: this, duration: const Duration(milliseconds: 2600));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (MediaQuery.disableAnimationsOf(context)) {
      _run.value = 1;
    } else {
      _run.forward();
    }
  }

  @override
  void dispose() {
    _run.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 140,
      height: 96,
      child: CustomPaint(
        painter: _BurstPainter(_run),
        child: Center(
          child: AnimatedBuilder(
            animation: _run,
            builder: (context, child) {
              // Pop in (overshoot) in the first quarter, then a gentle breath that fades out with the waves.
              final pop = Curves.easeOutBack.transform((_run.value / .25).clamp(0.0, 1.0));
              final breath = 1 + .045 * math.sin(_run.value * math.pi * 6) * (1 - _run.value);
              return Transform.scale(scale: (.35 + .65 * pop) * breath, child: child);
            },
            child: Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: .2),
                border: Border.all(color: Colors.white.withValues(alpha: .55), width: 2),
              ),
              child: Center(
                child: Container(
                  width: 54,
                  height: 54,
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
                  child: Icon(widget.icon, color: widget.color, size: 34),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BurstPainter extends CustomPainter {
  final Animation<double> run;
  _BurstPainter(this.run) : super(repaint: run);

  @override
  void paint(Canvas canvas, Size size) {
    final t = run.value;
    final c = size.center(Offset.zero);
    // Sparks: twelve dots fly out and fade in the first ~0.8 s.
    final burst = (t / .3).clamp(0.0, 1.0);
    if (burst > 0 && burst < 1) {
      final travel = Curves.easeOutCubic.transform(burst);
      for (var i = 0; i < 12; i++) {
        final angle = i * math.pi / 6 + (i.isEven ? 0 : .18);
        final reach = 40 + (i.isEven ? 24 : 17) * travel;
        final dot = c + Offset(math.cos(angle), math.sin(angle)) * reach;
        canvas.drawCircle(dot, (i.isEven ? 3.6 : 2.6) * (1 - burst), Paint()..color = Colors.white.withValues(alpha: (1 - burst) * .95));
      }
    }
    // Waves: three rings breathe out from the badge, one after another, and fade.
    for (var k = 0; k < 3; k++) {
      final start = .14 + k * .22;
      final w = ((t - start) / .42).clamp(0.0, 1.0);
      if (w <= 0 || w >= 1) continue;
      final eased = Curves.easeOut.transform(w);
      canvas.drawCircle(
        c,
        38 + 24 * eased,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.2 * (1 - w) + .6
          ..color = Colors.white.withValues(alpha: .55 * (1 - w)),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _BurstPainter oldDelegate) => oldDelegate.run != run;
}
