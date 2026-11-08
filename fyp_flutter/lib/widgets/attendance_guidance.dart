import '../i18n/tr.dart';
import 'package:flutter/material.dart';

/// One short sentence that tells the student what to do next. It never treats a saved (offline) attempt as attendance:
/// only the "Attendance recorded" state confirms it.
class AttendanceGuidance extends StatelessWidget {
  final bool recorded, open, faceRegistered;
  const AttendanceGuidance({
    super.key,
    required this.recorded,
    required this.open,
    required this.faceRegistered,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final (IconData icon, Color tone, String title, String sentence) = recorded
        ? (Icons.verified_rounded, const Color(0xFF10B981), 'Attendance recorded', 'You are checked in for this class.')
        : !faceRegistered
        ? (Icons.face_retouching_natural_rounded, const Color(0xFFF59E0B), 'Face profile needed', 'Register your face first, then you can check in.')
        : open
        ? (Icons.wifi_rounded, const Color(0xFF2563EB), 'Check-in is open', 'Join campus Wi-Fi and scan your face; only “Attendance recorded” confirms it.')
        : (Icons.lock_clock_rounded, const Color(0xFF64748B), 'Check-in not open yet', 'Your lecturer opens check-in during class, so tap Check in then.');
    return Semantics(
      container: true,
      label: '$title. $sentence',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: tone.withValues(alpha: dark ? .14 : .07),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: tone.withValues(alpha: dark ? .3 : .18)),
        ),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(color: tone.withValues(alpha: dark ? .22 : .12), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 18, color: tone),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr(title), style: theme.textTheme.bodyMedium?.copyWith(fontSize: 12.5, fontWeight: FontWeight.w800, color: dark ? Colors.white : const Color(0xFF0F172A))),
                  const SizedBox(height: 2),
                  Text(tr(sentence), style: theme.textTheme.bodySmall?.copyWith(fontSize: 11.5, height: 1.35, color: dark ? const Color(0xFFA0A0A0) : const Color(0xFF475569))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
