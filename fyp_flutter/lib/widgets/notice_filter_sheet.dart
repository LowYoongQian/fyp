import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../i18n/tr.dart';
import '../screens/system/notification_filters.dart';

String _clock(TimeOfDay time) =>
    '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

String _rangeLabel(DateTimeRange range) {
  final start = dayHeading(range.start, DateTime(1900)),
      end = dayHeading(range.end, DateTime(1900));
  return start == end ? start : '$start – $end';
}

/// A short description of an active filter, for the removable chip above the list.
String noticeFilterSummary(NoticeTimeFilter filter) => [
  if (filter.days != null) _rangeLabel(filter.days!),
  if (filter.from != null || filter.to != null)
    '${filter.from == null ? '00:00' : _clock(filter.from!)} – ${filter.to == null ? '23:59' : _clock(filter.to!)}',
].join(' · ');

/// The date and time filter used by the student and staff notification screens: quick presets, a day range,
/// a time-of-day window, Clear and Apply. Returns the new filter, or null when dismissed.
Future<NoticeTimeFilter?> showNoticeFilterSheet(
  BuildContext context,
  NoticeTimeFilter current,
) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  var draft = current;
  return showModalBottomSheet<NoticeTimeFilter>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    backgroundColor: dark ? const Color(0xFF222222) : Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
    ),
    builder: (sheet) => StatefulBuilder(
      builder: (sheet, setSheet) {
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        final primary = dark ? Colors.white : const Color(0xFF0F172A);
        final secondary = dark
            ? const Color(0xFFA0A0A0)
            : const Color(0xFF64748B);
        final presets = {
          'Today': DateTimeRange(start: today, end: today),
          'Last 7 days': DateTimeRange(
            start: today.subtract(const Duration(days: 6)),
            end: today,
          ),
          'This month': DateTimeRange(
            start: DateTime(now.year, now.month),
            end: today,
          ),
        };
        // Early in a month two presets can cover the same days; only the first of them shows as chosen.
        final chosen = presets.entries
            .where(
              (entry) =>
                  draft.days?.start == entry.value.start &&
                  draft.days?.end == entry.value.end,
            )
            .firstOrNull
            ?.key;
        Widget preset(String label, DateTimeRange range) {
          final on = chosen == label;
          return ChoiceChip(
            label: Text(tr(label)),
            selected: on,
            showCheckmark: false,
            onSelected: (_) => setSheet(
              () => draft = NoticeTimeFilter(
                days: on ? null : range,
                from: draft.from,
                to: draft.to,
              ),
            ),
            selectedColor: const Color(0xFF2563EB),
            labelStyle: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: on ? Colors.white : primary,
            ),
            backgroundColor: dark
                ? const Color(0xFF2D2D2D)
                : const Color(0xFFF1F5F9),
            side: BorderSide.none,
            shape: const StadiumBorder(),
          );
        }

        Widget picker({
          required IconData icon,
          required String label,
          required String value,
          required VoidCallback onTap,
          VoidCallback? onClear,
        }) => Material(
          color: dark ? const Color(0xFF2D2D2D) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
              child: Row(
                children: [
                  Icon(icon, size: 19, color: const Color(0xFF2563EB)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tr(label),
                          style: GoogleFonts.inter(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: secondary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          tr(value),
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (onClear != null)
                    IconButton(
                      onPressed: onClear,
                      tooltip: tr('Clear'),
                      icon: Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: secondary,
                      ),
                    ),
                ],
              ),
            ),
          ),
        );

        Widget timePicker(bool start) {
          final value = start ? draft.from : draft.to;
          return picker(
            icon: start ? Icons.schedule_rounded : Icons.update_rounded,
            label: start ? 'From time' : 'Until time',
            value: value == null ? (start ? '00:00' : '23:59') : _clock(value),
            onTap: () async {
              final picked = await showTimePicker(
                context: sheet,
                initialTime:
                    value ??
                    (start
                        ? const TimeOfDay(hour: 8, minute: 0)
                        : const TimeOfDay(hour: 18, minute: 0)),
              );
              if (picked != null) {
                setSheet(
                  () => draft = NoticeTimeFilter(
                    days: draft.days,
                    from: start ? picked : draft.from,
                    to: start ? draft.to : picked,
                  ),
                );
              }
            },
            onClear: value == null
                ? null
                : () => setSheet(
                    () => draft = NoticeTimeFilter(
                      days: draft.days,
                      from: start ? null : draft.from,
                      to: start ? draft.to : null,
                    ),
                  ),
          );
        }

        return Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            4,
            20,
            16 + MediaQuery.viewInsetsOf(sheet).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                tr('Filter by date & time'),
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: primary,
                ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final entry in presets.entries)
                    preset(entry.key, entry.value),
                ],
              ),
              const SizedBox(height: 14),
              picker(
                icon: Icons.date_range_rounded,
                label: tr('Dates'),
                value: draft.days == null
                    ? 'Any date'
                    : _rangeLabel(draft.days!),
                onTap: () async {
                  final range = await showDateRangePicker(
                    context: sheet,
                    firstDate: DateTime(now.year - 2),
                    lastDate: today,
                    initialDateRange: draft.days,
                    helpText: tr('Notifications between'),
                  );
                  if (range != null) {
                    setSheet(
                      () => draft = NoticeTimeFilter(
                        days: range,
                        from: draft.from,
                        to: draft.to,
                      ),
                    );
                  }
                },
                onClear: draft.days == null
                    ? null
                    : () => setSheet(
                        () => draft = NoticeTimeFilter(
                          from: draft.from,
                          to: draft.to,
                        ),
                      ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: timePicker(true)),
                  const SizedBox(width: 10),
                  Expanded(child: timePicker(false)),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () =>
                          Navigator.pop(sheet, const NoticeTimeFilter()),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(tr('Clear')),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: () => Navigator.pop(sheet, draft),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(tr('Apply')),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    ),
  );
}
