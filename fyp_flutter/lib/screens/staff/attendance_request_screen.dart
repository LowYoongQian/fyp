import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

import '../../i18n/tr.dart';
import '../../widgets/brand_refresh.dart';
import '../../widgets/notice_filter_sheet.dart';
import '../../widgets/shimmer_loading.dart';
import '../system/notification_filters.dart';

/// What a staff notification is about, for the category chips.
enum StaffNoticeGroup { all, unread, classes, requests, notices }

extension StaffNoticeGroupLabel on StaffNoticeGroup {
  String get label => switch (this) {
    StaffNoticeGroup.all => 'All',
    StaffNoticeGroup.unread => 'Unread',
    StaffNoticeGroup.classes => 'Classes',
    StaffNoticeGroup.requests => 'Requests',
    StaffNoticeGroup.notices => 'Notices',
  };
}

const _requestKinds = {'attendance_request', 'request_decision'};
const _noticeKinds = {'course_announcement', 'general_announcement'};

/// The kinds of notification staff receive, sorted into the chips. Class covers reminders, classes needing review
/// or overdue, timetable changes, cancellations and replacements; anything new or unknown still shows under All.
bool inStaffGroup(Map<String, dynamic> notice, StaffNoticeGroup group) {
  final kind = notice['kind']?.toString() ?? '';
  return switch (group) {
    StaffNoticeGroup.all => true,
    StaffNoticeGroup.unread => notice['is_read'] != true,
    StaffNoticeGroup.classes => isClassNotice(notice),
    StaffNoticeGroup.requests => _requestKinds.contains(kind),
    StaffNoticeGroup.notices => _noticeKinds.contains(kind),
  };
}

/// Staff notification center: class alerts and notices (by category and date/time), and student attendance
/// requests to approve or reject.
class AttendanceRequestScreen extends StatefulWidget {
  final String authToken;
  final String apiBaseUrl;

  const AttendanceRequestScreen({
    super.key,
    required this.authToken,
    required this.apiBaseUrl,
  });

  @override
  State<AttendanceRequestScreen> createState() =>
      _AttendanceRequestScreenState();
}

class _AttendanceRequestScreenState extends State<AttendanceRequestScreen> {
  static const _blue = Color(0xFF2563EB);
  bool _loading = true;
  String _category = 'notifications';
  String _filter = 'pending';
  StaffNoticeGroup _group = StaffNoticeGroup.all;
  NoticeTimeFilter _time = const NoticeTimeFilter();
  List<dynamic> _requests = [];
  List<dynamic> _notifications = [];

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${widget.authToken}',
    'Cache-Control': 'no-store',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final responses = await Future.wait([
        http.get(
          Uri.parse(
            '${widget.apiBaseUrl}/lecturers/me/attendance-requests?status=$_filter',
          ),
          headers: _headers,
        ),
        http.get(
          Uri.parse('${widget.apiBaseUrl}/notifications'),
          headers: _headers,
        ),
      ]);
      if (!mounted) return;
      setState(() {
        _requests = responses[0].statusCode == 200
            ? jsonDecode(responses[0].body)
            : [];
        _notifications = responses[1].statusCode == 200
            ? jsonDecode(responses[1].body)
            : [];
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _notices => [
    for (final n in _notifications) Map<String, dynamic>.from(n as Map),
  ];
  int get _unreadCount =>
      _notifications.where((item) => item['is_read'] != true).length;
  int get _unreadClassAlerts =>
      _notices.where((n) => n['is_read'] != true && isClassNotice(n)).length;
  int get _pendingRequests =>
      _requests.where((item) => item['status'] == 'pending').length;

  Color _statusColor(String status) => status == 'approved'
      ? const Color(0xFF10B981)
      : status == 'rejected'
      ? const Color(0xFFEF4444)
      : const Color(0xFFF59E0B);

  String _formatTime(dynamic raw) {
    final value = DateTime.tryParse(raw?.toString() ?? '')?.toLocal();
    if (value == null) return '';
    final difference = DateTime.now().difference(value);
    if (difference.inMinutes < 1) return tr('Just now');
    final n = difference.inMinutes < 60 ? difference.inMinutes : difference.inHours;
    if (difference.inMinutes < 60) return tr('{n}m ago', {'n': n});
    if (difference.inHours < 24) return tr('{n}h ago', {'n': n});
    if (difference.inDays < 7) return tr('{n}d ago', {'n': difference.inDays});
    return dayMonth(value, year: true);
  }

  /// Tag, icon and colour for one notification kind.
  (String, IconData, Color) _look(String kind) => switch (kind) {
    'class_reminder' => ('REMINDER', Icons.alarm_rounded, _blue),
    'class_needs_attention' => (
      'Needs review',
      Icons.pending_actions_rounded,
      const Color(0xFFD97706),
    ),
    'class_attention_escalated' => (
      'OVERDUE',
      Icons.priority_high_rounded,
      const Color(0xFFDC2626),
    ),
    'timetable_change' || 'replacement_class' => (
      'TIMETABLE',
      Icons.edit_calendar_rounded,
      const Color(0xFF0EA5E9),
    ),
    'class_cancelled' => (
      'Cancelled',
      Icons.event_busy_rounded,
      const Color(0xFFDC2626),
    ),
    'attendance_request' => (
      'REQUEST',
      Icons.assignment_rounded,
      const Color(0xFF8B5CF6),
    ),
    'request_decision' => (
      'DECISION',
      Icons.fact_check_rounded,
      const Color(0xFF8B5CF6),
    ),
    'course_announcement' || 'general_announcement' => (
      'Notice',
      Icons.campaign_rounded,
      const Color(0xFF10B981),
    ),
    _ => ('UPDATE', Icons.notifications_active_rounded, _blue),
  };

  bool get _dark => Theme.of(context).brightness == Brightness.dark;
  Color get _surface => _dark ? const Color(0xFF222222) : Colors.white;
  Color get _line => _dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0);
  Color get _ink => _dark ? Colors.white : const Color(0xFF0F172A);
  Color get _muted => _dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);

  Future<void> _review(Map<String, dynamic> item, String decision) async {
    final note = TextEditingController();
    final approve = decision == 'approved';
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: _surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          0,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr(approve ? 'Approve request' : 'Reject request'),
              style: GoogleFonts.spaceGrotesk(
                fontSize: 21,
                fontWeight: FontWeight.w800,
                color: _ink,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${item['student_name'] ?? ''} · ${item['course_code'] ?? ''}',
              style: GoogleFonts.inter(color: _muted),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: note,
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: tr('Note to student (optional)'),
                prefixIcon: const Icon(Icons.notes_rounded),
                filled: true,
                fillColor: _dark
                    ? const Color(0xFF2D2D2D)
                    : const Color(0xFFF8FAFC),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: () => Navigator.pop(context, true),
              icon: Icon(
                approve ? Icons.check_circle_rounded : Icons.cancel_rounded,
              ),
              style: FilledButton.styleFrom(
                backgroundColor: approve
                    ? const Color(0xFF059669)
                    : const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              label: Text(tr(approve ? 'Approve' : 'Reject')),
            ),
          ],
        ),
      ),
    );
    if (confirmed == true) {
      final response = await http.patch(
        Uri.parse(
          '${widget.apiBaseUrl}/lecturers/me/attendance-requests/${item['id']}',
        ),
        headers: _headers,
        body: jsonEncode({'status': decision, 'note': note.text.trim()}),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              tr(
                response.statusCode == 200
                    ? 'Request updated.'
                    : 'Could not update request.',
              ),
            ),
          ),
        );
      }
      await _load();
    }
    note.dispose();
  }

  Future<void> _markNotificationRead(Object? id) async {
    final response = await http.patch(
      Uri.parse('${widget.apiBaseUrl}/notifications/$id/read'),
      headers: _headers,
    );
    if (!mounted) return;
    if (response.statusCode == 200) {
      await _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('Could not mark notification as read.'))),
      );
    }
  }

  /// One request for all unread notices; servers without the bulk route get one request per notice.
  Future<void> _markAllRead() async {
    final ids = [
      for (final n in _notices)
        if (n['is_read'] != true) '${n['id']}',
    ];
    if (ids.isEmpty) return;
    final bulk = await http.patch(
      Uri.parse('${widget.apiBaseUrl}/notifications/read'),
      headers: _headers,
      body: jsonEncode({'ids': ids}),
    );
    if (bulk.statusCode != 200) {
      await Future.wait(
        ids.map(
          (id) => http.patch(
            Uri.parse('${widget.apiBaseUrl}/notifications/$id/read'),
            headers: _headers,
          ),
        ),
      );
    }
    await _load();
  }

  Future<void> _openTimeFilter() async {
    final applied = await showNoticeFilterSheet(context, _time);
    if (applied != null && mounted) setState(() => _time = applied);
  }

  // ------------------------------------------------------------------ pieces

  Widget _stat(int value, String label, IconData icon, Color color) => Expanded(
    child: Semantics(
      label: '$value ${tr(label)}',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _line),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: _dark ? .12 : .035),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: _dark ? .18 : .1),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(icon, size: 15, color: color),
                ),
                const SizedBox(width: 8),
                Text(
                  '$value',
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    color: _ink,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              tr(label),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _muted,
              ),
            ),
          ],
        ),
      ),
    ),
  );

  Widget _tabs() {
    Widget tab(String value, String label, IconData icon, int count) {
      final selected = _category == value;
      return Expanded(
        child: Semantics(
          button: true,
          selected: selected,
          child: InkWell(
            borderRadius: BorderRadius.circular(13),
            onTap: () => setState(() => _category = value),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(vertical: 11),
              decoration: BoxDecoration(
                color: selected
                    ? (_dark ? const Color(0xFF333333) : Colors.white)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(13),
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: .06),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 17, color: selected ? _blue : _muted),
                  const SizedBox(width: 7),
                  Flexible(
                    child: Text(
                      tr(label),
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: selected ? _ink : _muted,
                      ),
                    ),
                  ),
                  if (count > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: _blue,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        count > 99 ? '99+' : '$count',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: _dark ? const Color(0xFF1E1E1E) : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(17),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          tab(
            'notifications',
            'Notifications',
            Icons.notifications_rounded,
            _unreadCount,
          ),
          tab(
            'requests',
            'Requests',
            Icons.assignment_rounded,
            _pendingRequests,
          ),
        ],
      ),
    );
  }

  Widget _chip(
    String label,
    int? count,
    bool on,
    VoidCallback onTap, {
    IconData? icon,
  }) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: Semantics(
      button: true,
      selected: on,
      child: Material(
        color: on ? _blue : _surface,
        shape: StadiumBorder(side: BorderSide(color: on ? _blue : _line)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 15, color: on ? Colors.white : _muted),
                  const SizedBox(width: 5),
                ],
                Text(
                  tr(label),
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: on ? Colors.white : _ink,
                  ),
                ),
                if (count != null) ...[
                  const SizedBox(width: 6),
                  Text(
                    '$count',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: on ? Colors.white70 : _muted,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );

  Widget _heading(String text) => Padding(
    padding: const EdgeInsets.fromLTRB(2, 6, 2, 8),
    child: Text(
      tr(text).toUpperCase(),
      style: GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: .8,
        color: _muted,
      ),
    ),
  );

  Widget _notificationCard(Map<String, dynamic> item) {
    final unread = item['is_read'] != true;
    final (tag, icon, color) = _look(item['kind']?.toString() ?? '');
    final at = noticeTime(item);
    final stamp = _formatTime(item['created_at']);
    final clock = at == null
        ? ''
        : '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';
    final card = Material(
      color: unread
          ? (_dark ? const Color(0xFF262A30) : const Color(0xFFF5F9FF))
          : _surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: unread ? _blue.withValues(alpha: .35) : _line),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: unread ? () => _markNotificationRead(item['id']) : null,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, color: unread ? color : Colors.transparent),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 14, 14, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: _dark ? .2 : .1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(icon, color: color, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: color.withValues(
                                      alpha: _dark ? .2 : .1,
                                    ),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    tr(tag),
                                    style: GoogleFonts.inter(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: .3,
                                      color: _dark
                                          ? Color.lerp(color, Colors.white, .35)
                                          : color,
                                    ),
                                  ),
                                ),
                                const Spacer(),
                                if (stamp.isNotEmpty)
                                  Text(
                                    clock.isEmpty ? stamp : '$stamp · $clock',
                                    style: GoogleFonts.inter(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: _muted,
                                    ),
                                  ),
                                if (unread) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      color: _blue,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              tr(item['title'] ?? 'Update'),
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: unread
                                    ? FontWeight.w800
                                    : FontWeight.w600,
                                color: _ink,
                              ),
                            ),
                            if ('${item['body'] ?? ''}'.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                tr(item['body']),
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(
                                  fontSize: 12.5,
                                  height: 1.4,
                                  color: _muted,
                                ),
                              ),
                            ],
                            if (unread) ...[
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.touch_app_rounded,
                                    size: 14,
                                    color: _blue,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      tr('Tap to mark as read'),
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: _blue,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      // Swipe an unread notice to the left to mark it read; it stays in the list.
      child: !unread
          ? card
          : Dismissible(
              key: ValueKey('notice-${item['id']}'),
              direction: DismissDirection.endToStart,
              confirmDismiss: (_) async {
                await _markNotificationRead(item['id']);
                return false;
              },
              background: Container(
                alignment: AlignmentDirectional.centerEnd,
                padding: const EdgeInsets.symmetric(horizontal: 22),
                decoration: BoxDecoration(
                  color: _blue,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.done_all_rounded, color: Colors.white),
                    const SizedBox(width: 6),
                    Text(
                      tr('Mark as read'),
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              child: card,
            ),
    );
  }

  Widget _requestCard(dynamic raw) {
    final item = Map<String, dynamic>.from(raw as Map);
    final status = item['status'].toString();
    final color = _statusColor(status);
    final name = '${item['student_name'] ?? ''}'.trim();
    final stamp = _formatTime(item['created_at']);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _line),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: _dark ? .12 : .035),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 21,
                backgroundColor: _blue.withValues(alpha: _dark ? .2 : .1),
                foregroundColor: _blue,
                child: Text(
                  name.isEmpty ? '?' : name[0].toUpperCase(),
                  style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name.isEmpty ? tr('Student') : name,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: _ink,
                      ),
                    ),
                    Text(
                      '${item['student_code'] ?? ''} · ${item['course_code'] ?? ''}',
                      style: GoogleFonts.inter(fontSize: 11.5, color: _muted),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  tr(status[0].toUpperCase() + status.substring(1)),
                  style: GoogleFonts.inter(
                    color: color,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(
                    0xFF8B5CF6,
                  ).withValues(alpha: _dark ? .2 : .1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  tr('${item['request_type'] ?? 'REQUEST'}'.replaceAll('_', ' ').toUpperCase()),
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .4,
                    color: const Color(0xFF8B5CF6),
                  ),
                ),
              ),
              const Spacer(),
              if (stamp.isNotEmpty)
                Text(
                  stamp,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _muted,
                  ),
                ),
            ],
          ),
          if ('${item['reason'] ?? ''}'.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _dark
                    ? const Color(0xFF2D2D2D)
                    : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '${item['reason']}',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  height: 1.4,
                  color: _ink,
                ),
              ),
            ),
          ],
          if (status == 'pending') ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _review(item, 'rejected'),
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: Text(tr('Reject')),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFDC2626),
                      side: BorderSide(
                        color: const Color(0xFFDC2626).withValues(alpha: .45),
                      ),
                      minimumSize: const Size.fromHeight(44),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _review(item, 'approved'),
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: Text(tr('Approve')),
                    style: FilledButton.styleFrom(
                      backgroundColor: _blue,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(44),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _empty({
    required IconData icon,
    required Color color,
    required String title,
    required String line,
    Widget? action,
  }) => Container(
    margin: const EdgeInsets.only(top: 24),
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
    decoration: BoxDecoration(
      color: _surface,
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: _line),
    ),
    child: Column(
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            color: color.withValues(alpha: _dark ? .18 : .1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 30, color: color),
        ),
        const SizedBox(height: 12),
        Text(
          tr(title),
          textAlign: TextAlign.center,
          style: GoogleFonts.spaceGrotesk(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: _ink,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          tr(line),
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(fontSize: 13, color: _muted),
        ),
        ?action,
      ],
    ),
  );

  List<Widget> _notificationList() {
    final now = DateTime.now();
    final all = _notices;
    final shown = [
      for (final n in all)
        if (inStaffGroup(n, _group) && _time.matches(noticeTime(n))) n,
    ];
    return [
      SizedBox(
        height: 40,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            for (final group in StaffNoticeGroup.values)
              _chip(
                group.label,
                all.where((n) => inStaffGroup(n, group)).length,
                _group == group,
                () => setState(() => _group = group),
              ),
          ],
        ),
      ),
      if (_time.isActive) ...[
        const SizedBox(height: 10),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: InputChip(
            avatar: const Icon(Icons.tune_rounded, size: 16, color: _blue),
            label: Text(
              noticeFilterSummary(_time),
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _ink,
              ),
            ),
            onPressed: _openTimeFilter,
            onDeleted: () => setState(() => _time = const NoticeTimeFilter()),
            deleteButtonTooltipMessage: tr('Clear filter'),
            backgroundColor: _surface,
            side: BorderSide(color: _blue.withValues(alpha: .4)),
            shape: const StadiumBorder(),
          ),
        ),
      ],
      const SizedBox(height: 8),
      if (all.isEmpty)
        _empty(
          icon: Icons.notifications_none_rounded,
          color: _blue,
          title: 'No notifications yet',
          line: 'Class reminders and updates will appear here.',
        )
      else if (shown.isEmpty)
        _empty(
          icon: Icons.filter_alt_off_rounded,
          color: _muted,
          title: 'Nothing matches',
          line: 'Try another category or clear the date and time filter.',
          action: Padding(
            padding: const EdgeInsets.only(top: 12),
            child: TextButton(
              onPressed: () => setState(() {
                _group = StaffNoticeGroup.all;
                _time = const NoticeTimeFilter();
              }),
              child: Text(tr('Show all notifications')),
            ),
          ),
        )
      else
        for (var i = 0; i < shown.length; i++) ...[
          if (i == 0 ||
              dayHeading(noticeTime(shown[i]), now) !=
                  dayHeading(noticeTime(shown[i - 1]), now))
            _heading(dayHeading(noticeTime(shown[i]), now)),
          _notificationCard(shown[i]),
        ],
    ];
  }

  List<Widget> _requestList() => [
    SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _chip(
            'Pending',
            _pendingRequests,
            _filter == 'pending',
            () {
              setState(() => _filter = 'pending');
              _load();
            },
            icon: Icons.schedule_rounded,
          ),
          _chip(
            'All requests',
            _filter == 'all' ? _requests.length : null,
            _filter == 'all',
            () {
              setState(() => _filter = 'all');
              _load();
            },
            icon: Icons.list_alt_rounded,
          ),
        ],
      ),
    ),
    const SizedBox(height: 12),
    if (_requests.isEmpty)
      _empty(
        icon: Icons.task_alt_rounded,
        color: const Color(0xFF10B981),
        title: _filter == 'pending'
            ? 'No pending requests'
            : 'No attendance records',
        line: 'Everything is up to date.',
      )
    else
      ..._requests.map(_requestCard),
  ];

  Widget _skeleton() => ShimmerLoading(
    isLoading: true,
    child: Column(
      children: List.generate(
        3,
        (_) => Container(
          height: 120,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: _dark ? const Color(0xFF2D2D2D) : Colors.grey.shade300,
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final background = _dark
        ? const Color(0xFF181818)
        : const Color(0xFFF6F9FE);
    final onNotifications = _category == 'notifications';
    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        backgroundColor: background,
        surfaceTintColor: Colors.transparent,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr('Notification Center'),
              style: GoogleFonts.spaceGrotesk(
                fontWeight: FontWeight.w800,
                color: _ink,
              ),
            ),
            Text(
              _unreadCount == 0
                  ? tr('You are up to date')
                  : tr('{unreadCount} unread', {'unreadCount': _unreadCount}),
              style: GoogleFonts.inter(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: _unreadCount == 0 ? _muted : _blue,
              ),
            ),
          ],
        ),
        actions: [
          if (onNotifications && _unreadCount > 0)
            IconButton(
              tooltip: tr('Mark all read'),
              onPressed: _markAllRead,
              icon: const Icon(Icons.done_all_rounded),
            ),
          if (onNotifications)
            IconButton(
              tooltip: tr('Filter by date and time'),
              onPressed: _openTimeFilter,
              icon: Badge(
                isLabelVisible: _time.isActive,
                backgroundColor: _blue,
                child: const Icon(Icons.tune_rounded),
              ),
            ),
          const SizedBox(width: 4),
        ],
      ),
      body: BrandRefresh(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
          children: [
            Row(
              children: [
                _stat(
                  _unreadCount,
                  'Unread',
                  Icons.mark_email_unread_rounded,
                  _blue,
                ),
                const SizedBox(width: 8),
                _stat(
                  _unreadClassAlerts,
                  'Class alerts',
                  Icons.alarm_rounded,
                  const Color(0xFFD97706),
                ),
                const SizedBox(width: 8),
                _stat(
                  _pendingRequests,
                  'Pending requests',
                  Icons.assignment_rounded,
                  const Color(0xFF8B5CF6),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _tabs(),
            const SizedBox(height: 14),
            if (_loading && _notifications.isEmpty && _requests.isEmpty)
              _skeleton()
            else if (onNotifications)
              ..._notificationList()
            else
              ..._requestList(),
          ],
        ),
      ),
    );
  }
}
