import '../i18n/tr.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

String offlineStatus(Object? status) => switch (status) {
  'synced' => 'Attendance recorded',
  'excused' => 'Approved leave recorded',
  'needs_review' => 'Waiting for lecturer review — attendance not confirmed',
  'approved' => 'Request approved — refresh attendance',
  'rejected' => 'Request declined — contact your lecturer',
  'cancelled' => 'Request cancelled — contact your lecturer',
  'failed' =>
    'Needs attention — try a fresh check-in if the class is open, or contact your lecturer',
  'legacy' => 'Older saved attempt — contact your lecturer to check attendance',
  _ => 'Waiting to sync — attendance not confirmed',
};

/// The icon and colour of a saved attempt's state: green recorded, blue with the lecturer, red needs the student, grey
/// old, amber still waiting to reach the server.
({IconData icon, Color color}) offlineStatusLook(Object? status) => switch (status) {
  'synced' || 'excused' || 'approved' => (icon: Icons.task_alt_rounded, color: const Color(0xFF16A34A)),
  'needs_review' => (icon: Icons.hourglass_top_rounded, color: const Color(0xFF2563EB)),
  'rejected' || 'cancelled' || 'failed' => (icon: Icons.error_outline_rounded, color: const Color(0xFFDC2626)),
  'legacy' => (icon: Icons.history_rounded, color: const Color(0xFF64748B)),
  _ => (icon: Icons.cloud_upload_outlined, color: const Color(0xFFD97706)),
};

/// Settled attempts need nothing more from the phone or the student, so they do not keep the dashboard's saved-attendance bar up.
const offlineSettled = {'synced', 'excused', 'approved'};
bool offlineWaiting(Map<String, Object?> row) => !offlineSettled.contains(row['status']);

class OfflineQueueSheet extends StatefulWidget {
  final List<Map<String, Object?>> rows;
  final Future<List<Map<String, Object?>>> Function() onRefresh;
  const OfflineQueueSheet({
    super.key,
    required this.rows,
    required this.onRefresh,
  });
  @override
  State<OfflineQueueSheet> createState() => _OfflineQueueSheetState();
}

class _OfflineQueueSheetState extends State<OfflineQueueSheet> {
  late List<Map<String, Object?>> _rows = widget.rows;
  bool _busy = false;
  ({String text, bool ok})? _outcome; // what the last Retry did, so the button never seems to do nothing
  Future<void> _refresh() async {
    if (_busy) return;
    final toSend = _rows.any((row) => ['pending', 'needs_review'].contains(row['status']));
    setState(() {
      _busy = true;
      _outcome = null;
    });
    try {
      // At least a moment of spinner, so a quick answer is still seen to happen.
      final answers = await Future.wait<Object?>([widget.onRefresh(), Future<void>.delayed(const Duration(milliseconds: 600))]);
      final rows = answers.first as List<Map<String, Object?>>;
      if (mounted) {
        setState(() {
          _rows = rows;
          _outcome = !toSend
              ? (text: 'Nothing waiting to send.', ok: true)
              : rows.any((row) => row['status'] == 'pending')
              ? (text: 'Not sent: the server could not be reached. Reconnect and try again.', ok: false)
              : (text: 'Sent. Each attempt below shows its result.', ok: true);
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _outcome = (text: 'Could not refresh. Reconnect and try again.', ok: false));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final locale = MaterialLocalizations.of(context);
    final ink = dark ? Colors.white : const Color(0xFF0F172A);
    final muted = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    final card = dark ? const Color(0xFF2A2A2A) : Colors.white;
    const blue = Color(0xFF2563EB);
    final waiting = _rows.where(offlineWaiting).length;
    final line = dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0);
    // A full page with one header: Back returns to the dashboard tab it was opened from.
    return Scaffold(
      backgroundColor: dark ? const Color(0xFF181818) : const Color(0xFFF8FAFC),
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: dark ? const Color(0xFF181818) : Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: Border(bottom: BorderSide(color: line)),
        leading: IconButton(
          tooltip: tr('Close saved attendance'),
          onPressed: () => Navigator.maybePop(context),
          icon: Icon(Icons.arrow_back_rounded, color: ink),
        ),
        titleSpacing: 0,
        title: Text(tr('Saved attendance'), style: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold, color: ink)),
        actions: [
          if (waiting > 0)
            Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFD97706).withValues(alpha: dark ? .22 : .12),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(tr('{count} waiting', {'count': waiting}),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
            ),
        ],
      ),
      body: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: blue.withValues(alpha: dark ? .16 : .07),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: blue.withValues(alpha: .25)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.info_outline_rounded, size: 18, color: blue),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            tr('Saved attempts are not proof of attendance. Keep the app open while reconnecting; attempts after class may need lecturer review.'),
                            style: TextStyle(fontSize: 12.5, height: 1.4, color: ink),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (_rows.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 28),
                      child: Column(
                        children: [
                          Icon(Icons.cloud_done_rounded, size: 44, color: muted.withValues(alpha: .7)),
                          const SizedBox(height: 10),
                          Text(tr('No saved attempts.'),
                              textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, color: muted)),
                        ],
                      ),
                    ),
                  for (final row in _rows)
                    Builder(
                      builder: (context) {
                        final date = DateTime.tryParse('${row['queued_at']}')?.toLocal();
                        final label = row['class_label']?.toString().trim() ?? '';
                        final look = offlineStatusLook(row['status']);
                        final when = date == null
                            ? tr('Time unavailable')
                            : '${locale.formatMediumDate(date)} · ${locale.formatTimeOfDay(TimeOfDay.fromDateTime(date))} (${tr('local time')})';
                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: card,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: look.color.withValues(alpha: .35)),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(
                                  color: look.color.withValues(alpha: dark ? .2 : .1),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(look.icon, size: 18, color: look.color),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      tr(label.isEmpty ? 'Saved class attempt' : label),
                                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: ink),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      tr(offlineStatus(row['status'])),
                                      style: TextStyle(fontSize: 12.5, height: 1.35, fontWeight: FontWeight.w600, color: look.color),
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Padding(
                                          padding: const EdgeInsets.only(top: 1),
                                          child: Icon(Icons.schedule_rounded, size: 13, color: muted),
                                        ),
                                        const SizedBox(width: 5),
                                        Expanded(child: Text(when, style: TextStyle(fontSize: 11.5, color: muted))),
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
              ),
            ),
            SafeArea(
              top: false,
              minimum: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                // Above the button, so the answer to Retry is always on screen however long the list is.
                if (_outcome case final outcome?)
                  Builder(builder: (context) {
                    final tone = outcome.ok ? const Color(0xFF16A34A) : const Color(0xFFDC2626);
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: tone.withValues(alpha: dark ? .16 : .07),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: tone.withValues(alpha: .3)),
                      ),
                      child: Row(children: [
                        Icon(outcome.ok ? Icons.check_circle_outline_rounded : Icons.wifi_off_rounded, size: 18, color: tone),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Semantics(
                            liveRegion: true,
                            child: Text(tr(outcome.text),
                                style: TextStyle(fontSize: 12.5, height: 1.35, fontWeight: FontWeight.w600, color: dark ? Colors.white : const Color(0xFF0F172A))),
                          ),
                        ),
                      ]),
                    );
                  }),
                FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: blue,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: blue.withValues(alpha: .6),   // still blue while refreshing, so the spinner shows
                  disabledForegroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                onPressed: _busy ? null : _refresh,
                icon: _busy
                    ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                    : const Icon(Icons.refresh_rounded),
                label: Text(
                  tr(_busy ? 'Refreshing…' : 'Retry pending / refresh'),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}
