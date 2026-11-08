import '../i18n/tr.dart';
import 'package:flutter/material.dart';

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
  String? _error;
  Future<void> _refresh() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final rows = await widget.onRefresh();
      if (mounted) setState(() => _rows = rows);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not refresh. Reconnect and try again.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final locale = MaterialLocalizations.of(context);
    return FractionallySizedBox(
      heightFactor: .8,
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Semantics(
                          header: true,
                          child: Text(
                            tr('Saved attendance'),
                            style: theme.textTheme.titleLarge,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: tr('Close saved attendance'),
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                  Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                      tr('Saved attempts are not proof of attendance. Keep the app open while reconnecting; attempts after class may need lecturer review.'),
                    ),
                  ),
                  if (_rows.isEmpty) Text(tr('No saved attempts.')),
                  for (final row in _rows) ...[
                    Builder(
                      builder: (context) {
                        final date = DateTime.tryParse(
                          '${row['queued_at']}',
                        )?.toLocal();
                        final label =
                            row['class_label']?.toString().trim() ?? '';
                        final confirmed = [
                          'synced',
                          'excused',
                        ].contains(row['status']);
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            confirmed ? Icons.task_alt : Icons.schedule,
                            color: theme.colorScheme.primary,
                          ),
                          title: Text(
                            tr(label.isEmpty ? 'Saved class attempt' : label),
                          ),
                          subtitle: Text(
                            tr('{v}\n{v2}', {'v': offlineStatus(row['status']), 'v2': date == null ? 'Time unavailable' : '${locale.formatMediumDate(date)} · ${locale.formatTimeOfDay(TimeOfDay.fromDateTime(date))} (local time)'}),
                          ),
                        );
                      },
                    ),
                    const Divider(height: 24),
                  ],
                  if (_error != null)
                    Text(
                      tr(_error!),
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _busy ? null : _refresh,
                  icon: const Icon(Icons.refresh),
                  label: Text(
                    tr(_busy ? 'Refreshing…' : 'Retry pending / refresh'),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
