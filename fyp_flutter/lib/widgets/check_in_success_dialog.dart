// ignore_for_file: deprecated_member_use
// The check-in result: a full-screen page with one header (Done or Close) and one surface holding the status, the heading and
// the class details. It can also be shown on its own (the public site's demo capture renders it with sample data).
import '../i18n/tr.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// Result colours: green recorded, amber waiting on this phone, blue already done, red not recorded.
const _green = Color(0xFF16A34A);
const _red = Color(0xFFDC2626);
const _blue = Color(0xFF2563EB);
const _sky = Color(0xFF0EA5E9);
const _amber = Color(0xFFD97706);

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
    useSafeArea: false, // the page's own header and bottom inset handle the status bar and gesture bar
    builder: (ctx) => _successDialog(ctx, courseCode: courseCode, courseName: courseName, timeSlot: timeSlot, room: room,
        classGroup: classGroup, lecturerName: lecturerName, lecturerRole: lecturerRole, wifiVerified: wifiVerified,
        livenessPassed: livenessPassed),
  );
}

/// Only shown after the server confirmed the check-in.
Widget _successDialog(
  BuildContext ctx, {
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
  final isDark = Theme.of(ctx).brightness == Brightness.dark;
  return _resultPage(
    ctx,
    tone: _green,
    icon: Icons.task_alt_rounded,
    title: 'Attendance recorded',
    message: 'Your check-in has been successfully recorded.',
    close: 'Done',
    details: [
      ..._classDetails(isDark, courseCode: courseCode, courseName: courseName, timeSlot: timeSlot, room: room,
          classGroup: classGroup, lecturerName: lecturerName, lecturerRole: lecturerRole),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: _check(isDark, Icons.wifi_rounded, wifiVerified ? 'Wi-Fi verified' : 'Wi-Fi not verified', wifiVerified)),
        const SizedBox(width: 10),
        Expanded(child: _check(isDark, Icons.face_retouching_natural_rounded, livenessPassed ? 'Liveness passed' : 'Liveness alert', livenessPassed)),
      ]),
    ],
  );
}

/// The class under the heading, every row on the same icon column: code and name, then time, room and lecturer when known.
List<Widget> _classDetails(
  bool isDark, {
  required String courseCode,
  required String courseName,
  String timeSlot = '',
  String room = '',
  String classGroup = '',
  String lecturerName = '',
  String lecturerRole = '',
}) {
  final now = DateTime.now();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  final date = '${tr(days[now.weekday - 1])}, ${dayMonth(now, year: true)}';
  final place = [if (room.isNotEmpty) room, if (classGroup.isNotEmpty) tr(classGroup)].join(' · ');
  return [
    _buildDetailRow(isDark: isDark, icon: Icons.school_outlined, title: courseCode, value: courseName),
    const SizedBox(height: 12),
    _buildDetailRow(isDark: isDark, icon: Icons.schedule_rounded, title: 'Date & Time', value: timeSlot.isEmpty ? date : '$timeSlot\n$date'),
    if (place.isNotEmpty) ...[
      const SizedBox(height: 12),
      _buildDetailRow(isDark: isDark, icon: Icons.room_outlined, title: 'Room', value: place),
    ],
    if (lecturerName.isNotEmpty) ...[
      const SizedBox(height: 12),
      _buildDetailRow(isDark: isDark, icon: Icons.person_outline_rounded, title: 'Lecturer / Instructor',
          value: lecturerRole.isEmpty ? lecturerName : '$lecturerName (${tr(lecturerRole)})'),
    ],
  ];
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
  required String title,
  required String value,
}) {
  final muted = isDark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(color: muted.withValues(alpha: isDark ? .18 : .1), borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, size: 17, color: muted),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(tr(title), style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: muted)),
            const SizedBox(height: 2),
            Text(
              tr(value),
              style: TextStyle(fontSize: 14, height: 1.35, fontWeight: FontWeight.w700, color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B)),
            ),
          ],
        ),
      ),
    ],
  );
}

/// The check-in was not recorded: the reason, and Try again (scan again) when [onRetry] is given.
void showCheckInFailedDialog(BuildContext context, {required String message, VoidCallback? onRetry}) {
  showDialog(
    context: context,
    barrierDismissible: false,
    useSafeArea: false,
    builder: (ctx) => _failedDialog(ctx, message: message, onRetry: onRetry),
  );
}

Widget _failedDialog(BuildContext ctx, {required String message, VoidCallback? onRetry}) {
  final isDark = Theme.of(ctx).brightness == Brightness.dark;
  return _resultPage(
    ctx,
    tone: _red,
    icon: Icons.error_outline_rounded,
    title: 'Check-in failed',
    message: 'Your attendance was not recorded.',
    details: [
      Text(tr(message),
          style: TextStyle(fontSize: 13.5, height: 1.45, fontWeight: FontWeight.w600, color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF334155))),
    ],
    action: onRetry == null
        ? null
        : FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: _red,
              foregroundColor: Colors.white,
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
  );
}

/// Every result is one full-screen page: a single header with its Done or Close, then one surface with a plain status icon,
/// the heading and the details. Nothing of the dashboard shows around it, and closing returns to it.
Widget _resultPage(
  BuildContext ctx, {
  required Color tone,
  required IconData icon,
  required String title,
  required String message,
  String close = 'Close',
  List<Widget> details = const [],
  Widget? action,
}) {
  final isDark = Theme.of(ctx).brightness == Brightness.dark;
  final ink = isDark ? Colors.white : const Color(0xFF0F172A);
  final muted = isDark ? const Color(0xFFA0A0A0) : const Color(0xFF475569);
  final line = isDark ? const Color(0xFF333333) : const Color(0xFFE2E8F0);
  return Dialog.fullscreen(
    backgroundColor: isDark ? const Color(0xFF181818) : const Color(0xFFF8FAFC),
    child: Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: isDark ? const Color(0xFF181818) : Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: Border(bottom: BorderSide(color: line)),
        title: Text(tr('Attendance'), style: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold, color: ink)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton(
              style: TextButton.styleFrom(
                foregroundColor: isDark ? const Color(0xFF93C5FD) : _blue,
                minimumSize: const Size(64, 48),
              ),
              onPressed: () => Navigator.pop(ctx),
              child: Text(tr(close), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
            ),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
              children: [
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF222222) : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: line),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Semantics(
                      liveRegion: true,
                      container: true,
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(color: tone.withValues(alpha: isDark ? .2 : .1), shape: BoxShape.circle),
                          child: Icon(icon, color: tone, size: 24),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(tr(title), style: TextStyle(fontSize: 20, height: 1.25, fontWeight: FontWeight.w800, color: ink)),
                            const SizedBox(height: 4),
                            Text(tr(message), style: TextStyle(fontSize: 13, height: 1.45, color: muted)),
                          ]),
                        ),
                      ]),
                    ),
                    if (details.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Divider(height: 1, color: line),
                      const SizedBox(height: 16),
                      ...details,
                    ],
                  ]),
                ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: action == null
          ? null
          : SafeArea(minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16), child: action),
    ),
  );
}

/// The check-in dialog that opens the moment the scan ends. It says the server is recording the check-in, then turns into
/// the result in place (recorded, not recorded, waiting to sync, already checked in), so the student always knows
/// whether it went through. The waiting state cannot be dismissed: the request always ends (it has a timeout).
class CheckInProgress {
  CheckInProgress._(this._host, this._courseCode, this._courseName);
  final BuildContext _host;
  final String _courseCode, _courseName;
  final _stage = ValueNotifier<WidgetBuilder?>(null); // null while waiting for the server
  BuildContext? _dialog;
  bool _open = true;
  bool _dismissWhenBuilt = false;

  void _show(WidgetBuilder result) {
    if (_open) {
      _stage.value = result;
    } else if (_host.mounted) {
      // Closed some other way before the answer came: the result still shows.
      showDialog(context: _host, barrierDismissible: false, useSafeArea: false, builder: result);
    }
  }

  void succeed({
    required String courseCode,
    required String courseName,
    required String timeSlot,
    required String room,
    required String classGroup,
    required String lecturerName,
    required String lecturerRole,
    required bool wifiVerified,
    required bool livenessPassed,
  }) => _show((ctx) => _successDialog(ctx, courseCode: courseCode, courseName: courseName, timeSlot: timeSlot, room: room,
      classGroup: classGroup, lecturerName: lecturerName, lecturerRole: lecturerRole, wifiVerified: wifiVerified,
      livenessPassed: livenessPassed));

  void fail(String message, {VoidCallback? onRetry}) => _show((ctx) => _failedDialog(ctx, message: message, onRetry: onRetry));

  /// Kept on the phone because the server could not be reached: not recorded yet, not refused either.
  void savedOnPhone({String timeSlot = '', String room = '', String classGroup = ''}) => _show((ctx) => _resultPage(ctx,
      tone: _amber,
      icon: Icons.cloud_upload_outlined,
      title: 'Waiting to sync',
      message: 'Saved on this phone, not confirmed. Reconnect with the app open; after class, lecturer review is required.',
      details: _classDetails(Theme.of(ctx).brightness == Brightness.dark,
          courseCode: _courseCode, courseName: _courseName, timeSlot: timeSlot, room: room, classGroup: classGroup)));

  void alreadyCheckedIn() => _show((ctx) => _resultPage(ctx,
      tone: _blue,
      icon: Icons.event_available_rounded,
      title: 'Already checked in',
      message: "You're already checked in for this class.",
      details: _classDetails(Theme.of(ctx).brightness == Brightness.dark, courseCode: _courseCode, courseName: _courseName)));

  /// Closes it if it is still waiting (the student signed out or switched account before the answer).
  void dismissIfWaiting() {
    if (!_open || _stage.value != null) return;
    final dialog = _dialog;
    if (dialog == null) {
      _dismissWhenBuilt = true;
      return;
    }
    if (!dialog.mounted) return;
    final route = ModalRoute.of(dialog);
    if (route == null) return;
    route.isCurrent ? Navigator.of(dialog).pop() : Navigator.of(dialog).removeRoute(route);
  }
}

CheckInProgress showCheckInProgressDialog(BuildContext context, {required String courseCode, required String courseName}) {
  final progress = CheckInProgress._(context, courseCode, courseName);
  showDialog<void>(
    context: context,
    barrierDismissible: false,
    useSafeArea: false, // the results fill the screen and pad the status bar themselves
    builder: (ctx) {
      progress._dialog = ctx;
      if (progress._dismissWhenBuilt) {
        progress._dismissWhenBuilt = false;
        WidgetsBinding.instance.addPostFrameCallback((_) => progress.dismissIfWaiting());
      }
      return ValueListenableBuilder<WidgetBuilder?>(
        valueListenable: progress._stage,
        builder: (ctx, result, _) => PopScope(
          canPop: result != null,
          child: AnimatedSwitcher(
            duration: MediaQuery.disableAnimationsOf(ctx) ? Duration.zero : const Duration(milliseconds: 260),
            switchInCurve: Curves.easeOutCubic,
            child: KeyedSubtree(
              key: ValueKey(result),
              child: result == null ? SafeArea(child: _pendingDialog(ctx, courseCode: courseCode, courseName: courseName)) : result(ctx),
            ),
          ),
        ),
      );
    },
  ).whenComplete(() => progress._open = false);
  return progress;
}

Widget _pendingDialog(BuildContext ctx, {required String courseCode, required String courseName}) {
  final isDark = Theme.of(ctx).brightness == Brightness.dark;
  final still = MediaQuery.disableAnimationsOf(ctx);
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
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [_blue, _sky]),
          ),
          child: Column(children: [
            Container(
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
                  padding: const EdgeInsets.all(14),
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
                  // With reduced motion a still hourglass says the same as the turning ring.
                  child: still
                      ? const Icon(Icons.hourglass_top_rounded, color: _blue, size: 26)
                      : const CircularProgressIndicator(strokeWidth: 3, color: _blue),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Semantics(
              liveRegion: true,
              child: Text(tr('Recording your attendance…'),
                  textAlign: TextAlign.center, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: Colors.white)),
            ),
            const SizedBox(height: 4),
            Text(tr('Checking your face and campus network with the server. Keep the app open.'),
                textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: .9))),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2D2D2D) : const Color(0xFFF5F9FF),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: isDark ? const Color(0xFF333333) : const Color(0xFFE2E8F0)),
            ),
            child: Row(children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(gradient: const LinearGradient(colors: [_blue, _sky]), borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.school_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(courseCode,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: .4, color: isDark ? const Color(0xFF93C5FD) : _blue)),
                  const SizedBox(height: 1),
                  Text(courseName,
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: isDark ? Colors.white : const Color(0xFF0F172A))),
                ]),
              ),
            ]),
          ),
        ),
      ]),
    ),
  );
}
