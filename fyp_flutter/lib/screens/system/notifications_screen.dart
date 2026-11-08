import '../../widgets/notice_filter_sheet.dart';
import '../../i18n/tr.dart';
import '../../widgets/brand_refresh.dart';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

import 'notification_filters.dart';

class NotificationsScreen extends StatefulWidget {
  final String authToken;
  final String apiBaseUrl;
  final List<Map<String, dynamic>> initialNotifications;

  const NotificationsScreen({
    super.key,
    required this.authToken,
    required this.apiBaseUrl,
    required this.initialNotifications,
  });

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late List<Map<String, dynamic>> _notifications;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (widget.authToken.isNotEmpty)
      'Authorization': 'Bearer ${widget.authToken}',
  };

  @override
  void initState() {
    super.initState();
    _notifications = widget.initialNotifications
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  Future<void> _refresh({bool reportFailure = false}) async {
    try {
      final response = await http
          .get(
            Uri.parse('${widget.apiBaseUrl}/notifications'),
            headers: _headers,
          )
          .timeout(const Duration(seconds: 12));
      if (!mounted || response.statusCode != 200) {
        if (reportFailure && mounted) _showSyncError();
        return;
      }
      final decoded = jsonDecode(response.body) as List<dynamic>;
      final updated = decoded
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      if (jsonEncode(updated) != jsonEncode(_notifications)) {
        setState(() => _notifications = updated);
      }
    } catch (_) {
      if (reportFailure && mounted) _showSyncError();
    }
  }

  void _showSyncError() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(tr('Could not refresh notifications.'))),
    );
  }

  Future<void> _markRead(int index) async {
    final item = _notifications[index];
    if (item['is_read'] == true) return;
    final id = item['id']?.toString();
    if (id == null || id.isEmpty) return;

    setState(() => _notifications[index] = {...item, 'is_read': true});
    try {
      final response = await http
          .patch(
            Uri.parse('${widget.apiBaseUrl}/notifications/$id/read'),
            headers: _headers,
          )
          .timeout(const Duration(seconds: 12));
      if (response.statusCode != 200) throw Exception('mark read failed');
    } catch (_) {
      if (!mounted) return;
      setState(() => _notifications[index] = item);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('Could not mark notification as read.'))),
      );
    }
  }

  String _formatTime(dynamic raw) {
    final value = DateTime.tryParse(raw?.toString() ?? '')?.toLocal();
    if (value == null) return '';
    final difference = DateTime.now().difference(value);
    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inMinutes < 60) return tr('{n}m ago', {'n': difference.inMinutes});
    if (difference.inHours < 24) return tr('{n}h ago', {'n': difference.inHours});
    if (difference.inDays < 7) return tr('{n}d ago', {'n': difference.inDays});
    return '${value.day}/${value.month}/${value.year}';
  }

  IconData _iconFor(String kind) => switch (kind) {
    'timetable_change' => Icons.edit_calendar_rounded,
    'class_reminder' => Icons.alarm_rounded,
    'request_decision' => Icons.fact_check_rounded,
    _ => Icons.notifications_active_outlined,
  };

  NoticeCategory _category = NoticeCategory.all;
  NoticeTimeFilter _filter = const NoticeTimeFilter();

  String _filterSummary() => noticeFilterSummary(_filter);

  Future<void> _openFilter() async {
    final applied = await showNoticeFilterSheet(context, _filter);
    if (applied != null && mounted) setState(() => _filter = applied);
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final background = dark ? const Color(0xFF181818) : const Color(0xFFF6F9FE);
    final surface = dark ? const Color(0xFF222222) : Colors.white;
    final primaryText = dark ? Colors.white : const Color(0xFF0F172A);
    final secondaryText = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    final now = DateTime.now();
    final shown = visibleNotices(_notifications, _category, _filter, now);
    final unreadCount = _notifications.where((item) => item['is_read'] != true).length;

    // The list: a heading per day, then that day's cards.
    final rows = <Widget>[];
    String? lastHeading;
    for (final index in shown) {
      final heading = dayHeading(noticeTime(_notifications[index]), now);
      if (heading != lastHeading) {
        rows.add(Padding(
          padding: EdgeInsets.fromLTRB(4, rows.isEmpty ? 0 : 10, 4, 8),
          child: Text(tr(heading.toUpperCase()), style: GoogleFonts.inter(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: .8, color: secondaryText)),
        ));
        lastHeading = heading;
      }
      rows.add(Padding(padding: const EdgeInsets.only(bottom: 10), child: _card(index, dark, surface, primaryText, secondaryText)));
    }

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) Navigator.pop(context, _notifications);
      },
      child: Scaffold(
        backgroundColor: background,
        appBar: AppBar(
          backgroundColor: surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            onPressed: () => Navigator.pop(context, _notifications),
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(tr('Notifications'), style: GoogleFonts.spaceGrotesk(fontSize: 18, fontWeight: FontWeight.w800, color: primaryText)),
              if (unreadCount > 0)
                Text(tr('{unreadCount} unread', {'unreadCount': unreadCount}), style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF2563EB))),
            ],
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: Badge(
                isLabelVisible: _filter.isActive,
                smallSize: 9,
                backgroundColor: const Color(0xFF2563EB),
                child: IconButton(
                  tooltip: tr('Filter by date and time'),
                  onPressed: _openFilter,
                  style: IconButton.styleFrom(
                    backgroundColor: _filter.isActive
                        ? const Color(0xFF2563EB).withValues(alpha: dark ? .25 : .12)
                        : (dark ? const Color(0xFF2D2D2D) : const Color(0xFFF1F5F9)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: Icon(Icons.tune_rounded, size: 20, color: _filter.isActive ? const Color(0xFF2563EB) : primaryText),
                ),
              ),
            ),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(56),
            child: Container(
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0)))),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 12),
                child: Row(
                  children: [
                    for (final category in NoticeCategory.values) ...[
                      _categoryChip(category, visibleNotices(_notifications, category, const NoticeTimeFilter(), now).length, dark, primaryText),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
        body: BrandRefresh(
          onRefresh: () => _refresh(reportFailure: true),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
            children: [
              if (_filter.isActive)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: InputChip(
                      avatar: const Icon(Icons.filter_alt_rounded, size: 16, color: Color(0xFF2563EB)),
                      label: Text(tr(_filterSummary()), style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w700, color: const Color(0xFF2563EB))),
                      backgroundColor: const Color(0xFF2563EB).withValues(alpha: dark ? .18 : .08),
                      side: BorderSide.none,
                      shape: const StadiumBorder(),
                      deleteIcon: const Icon(Icons.close_rounded, size: 16, color: Color(0xFF2563EB)),
                      deleteButtonTooltipMessage: 'Clear filter',
                      onDeleted: () => setState(() => _filter = const NoticeTimeFilter()),
                      onPressed: _openFilter,
                    ),
                  ),
                ),
              if (_notifications.isEmpty)
                _emptyState(Icons.notifications_none_rounded, 'No notifications yet', 'Class reminders and attendance updates will appear here.', primaryText, secondaryText, dark)
              else if (shown.isEmpty)
                _emptyState(
                  Icons.filter_alt_off_rounded,
                  'Nothing matches',
                  'Try another category or clear the date and time filter.',
                  primaryText,
                  secondaryText,
                  dark,
                  action: TextButton(
                    onPressed: () => setState(() {
                      _category = NoticeCategory.all;
                      _filter = const NoticeTimeFilter();
                    }),
                    child: Text(tr('Show all notifications')),
                  ),
                )
              else
                ...rows,
            ],
          ),
        ),
      ),
    );
  }

  Widget _categoryChip(NoticeCategory category, int count, bool dark, Color primaryText) {
    final on = _category == category;
    return Semantics(
      selected: on,
      button: true,
      label: '${category.label}, $count',
      excludeSemantics: true,
      child: Material(
        color: on ? const Color(0xFF2563EB) : (dark ? const Color(0xFF2D2D2D) : const Color(0xFFF1F5F9)),
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => setState(() => _category = category),
          child: Container(
            constraints: const BoxConstraints(minHeight: 38),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.center,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(tr(category.label), style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.w700, color: on ? Colors.white : primaryText)),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: on ? Colors.white.withValues(alpha: .25) : const Color(0xFF2563EB).withValues(alpha: dark ? .25 : .1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('$count', style: GoogleFonts.inter(fontSize: 10.5, fontWeight: FontWeight.w800, color: on ? Colors.white : const Color(0xFF2563EB))),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _emptyState(IconData icon, String title, String text, Color primaryText, Color secondaryText, bool dark, {Widget? action}) => Padding(
        padding: EdgeInsets.only(top: MediaQuery.sizeOf(context).height * .14),
        child: Column(children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(color: const Color(0xFF2563EB).withValues(alpha: dark ? .18 : .08), shape: BoxShape.circle),
            child: Icon(icon, size: 30, color: const Color(0xFF2563EB)),
          ),
          const SizedBox(height: 14),
          Text(tr(title), textAlign: TextAlign.center, style: GoogleFonts.spaceGrotesk(fontSize: 17, fontWeight: FontWeight.w800, color: primaryText)),
          const SizedBox(height: 6),
          Text(tr(text), textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 12, height: 1.45, color: secondaryText)),
          ?action,
        ]),
      );

  Widget _card(int index, bool dark, Color surface, Color primaryText, Color secondaryText) {
    final item = _notifications[index];
    final unread = item['is_read'] != true;
    final kind = item['kind']?.toString() ?? '';
    final classNotice = isClassNotice(item);
    final tone = classNotice ? const Color(0xFF2563EB) : const Color(0xFF8B5CF6);
    final at = noticeTime(item);
    final when = _formatTime(item['created_at']);
    final clock = at == null ? '' : '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: unread ? () => _markRead(index) : null,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: unread ? Color.alphaBlend(const Color(0xFF2563EB).withValues(alpha: dark ? .12 : .05), surface) : surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: unread ? const Color(0xFF2563EB).withValues(alpha: dark ? .45 : .28) : (dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0)),
            ),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: dark ? .18 : .035), blurRadius: 12, offset: const Offset(0, 5))],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: tone.withValues(alpha: dark ? .2 : .1), borderRadius: BorderRadius.circular(13)),
                child: Icon(_iconFor(kind), size: 20, color: tone),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text('${item['title'] ?? 'Attendance update'}',
                              style: GoogleFonts.inter(fontSize: 13, fontWeight: unread ? FontWeight.w800 : FontWeight.w600, color: primaryText)),
                        ),
                        if (when.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Text(tr(when), style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: secondaryText)),
                        ],
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text('${item['body'] ?? ''}', style: GoogleFonts.inter(fontSize: 11.5, height: 1.4, color: secondaryText)),
                    const SizedBox(height: 8),
                    Row(children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(color: tone.withValues(alpha: dark ? .2 : .1), borderRadius: BorderRadius.circular(8)),
                        child: Text(tr(classNotice ? 'Class' : 'Update'), style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.w800, color: tone)),
                      ),
                      if (clock.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Icon(Icons.schedule_rounded, size: 12, color: secondaryText),
                        const SizedBox(width: 3),
                        Text(tr(clock), style: GoogleFonts.inter(fontSize: 10, color: secondaryText)),
                      ],
                      const SizedBox(width: 8),
                      // Shrinks (with an ellipsis) rather than overflow on narrow phones or with large text.
                      Expanded(
                        child: unread
                            ? Text(tr('Tap to mark as read'), textAlign: TextAlign.end, maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.w700, color: const Color(0xFF2563EB)))
                            : const SizedBox.shrink(),
                      ),
                    ]),
                  ],
                ),
              ),
              if (unread) ...[
                const SizedBox(width: 8),
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 4),
                  decoration: const BoxDecoration(color: Color(0xFF2563EB), shape: BoxShape.circle),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
