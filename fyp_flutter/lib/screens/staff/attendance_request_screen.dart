import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

import '../../widgets/shimmer_loading.dart';

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
  bool _loading = true;
  String _category = 'notifications';
  String _filter = 'pending';
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

  Color _statusColor(String status) => status == 'approved'
      ? const Color(0xFF10B981)
      : status == 'rejected'
      ? const Color(0xFFEF4444)
      : const Color(0xFFF59E0B);

  int get _unreadCount =>
      _notifications.where((item) => item['is_read'] != true).length;

  String _formatTime(dynamic raw) {
    final value = DateTime.tryParse(raw?.toString() ?? '')?.toLocal();
    if (value == null) return '';
    final now = DateTime.now();
    final difference = now.difference(value);
    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inMinutes < 60) return '${difference.inMinutes}m ago';
    if (difference.inHours < 24) return '${difference.inHours}h ago';
    if (difference.inDays < 7) return '${difference.inDays}d ago';
    return '${value.day}/${value.month}/${value.year}';
  }

  String _kindLabel(String kind) => switch (kind) {
    'timetable_change' => 'TIMETABLE',
    'attendance_request' => 'REQUEST',
    'class_reminder' => 'REMINDER',
    'request_decision' => 'DECISION',
    _ => 'UPDATE',
  };

  Future<void> _review(Map<String, dynamic> item, String decision) async {
    final note = TextEditingController();
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              '${decision == 'approved' ? 'Approve' : 'Reject'} request?',
              style: GoogleFonts.spaceGrotesk(
                fontSize: 21,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${item['student_name']} · ${item['course_code']}',
              style: GoogleFonts.inter(color: const Color(0xFF64748B)),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: note,
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: 'Note to student (optional)',
                prefixIcon: const Icon(Icons.notes_rounded),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(
                backgroundColor: decision == 'approved'
                    ? const Color(0xFF059669)
                    : const Color(0xFFDC2626),
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(
                decision == 'approved' ? 'Approve request' : 'Reject request',
              ),
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
              response.statusCode == 200
                  ? 'Request updated.'
                  : 'Could not update request.',
            ),
          ),
        );
      }
      await _load();
    }
    note.dispose();
  }

  Widget _requestCard(dynamic raw) {
    final item = Map<String, dynamic>.from(raw as Map);
    final status = item['status'].toString();
    final color = _statusColor(status);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Theme.of(context).dividerColor.withValues(alpha: .45),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .035),
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
                backgroundColor: const Color(0xFFFFE4E6),
                foregroundColor: const Color(0xFF9F1239),
                child: Text(
                  (item['student_name'] ?? '?').toString()[0].toUpperCase(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['student_name'] ?? 'Student',
                      style: GoogleFonts.inter(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      '${item['student_code']} · ${item['course_code']}',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: GoogleFonts.inter(
                    color: color,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            '${item['request_type']}'.toUpperCase(),
            style: GoogleFonts.inter(
              fontSize: 10,
              color: const Color(0xFF800000),
              fontWeight: FontWeight.w800,
              letterSpacing: .6,
            ),
          ),
          if (_formatTime(item['created_at']).isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              _formatTime(item['created_at']),
              style: GoogleFonts.inter(
                fontSize: 10,
                color: const Color(0xFF94A3B8),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 5),
          Text(
            item['reason'] ?? '',
            style: GoogleFonts.inter(fontSize: 13, height: 1.4),
          ),
          if (status == 'pending') ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _review(item, 'rejected'),
                    child: const Text('Reject'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () => _review(item, 'approved'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF800000),
                    ),
                    child: const Text('Approve'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _markNotificationRead(String id) async {
    final response = await http.patch(
      Uri.parse('${widget.apiBaseUrl}/notifications/$id/read'),
      headers: _headers,
    );
    if (response.statusCode == 200) await _load();
  }

  Future<void> _markAllRead() async {
    final unread = _notifications.where((item) => item['is_read'] != true);
    await Future.wait(
      unread.map(
        (item) => http.patch(
          Uri.parse('${widget.apiBaseUrl}/notifications/${item['id']}/read'),
          headers: _headers,
        ),
      ),
    );
    await _load();
  }

  Widget _notificationCard(dynamic raw) {
    final item = Map<String, dynamic>.from(raw as Map);
    final unread = item['is_read'] != true;
    final kind = item['kind']?.toString() ?? '';
    final timestamp = _formatTime(item['created_at']);
    final icon = kind == 'timetable_change'
        ? Icons.edit_calendar_rounded
        : kind == 'attendance_request'
        ? Icons.assignment_rounded
        : Icons.notifications_active_rounded;
    return InkWell(
      onTap: unread ? () => _markNotificationRead(item['id']) : null,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        margin: const EdgeInsets.only(bottom: 11),
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: unread
              ? (Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xFF3F1D20)
                    : const Color(0xFFFFF7ED))
              : Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: unread
                ? const Color(0xFFFDBA74)
                : Theme.of(context).dividerColor.withValues(alpha: .45),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: unread ? .045 : .025),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: const Color(0xFFFFE4E6),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(icon, color: const Color(0xFF800000), size: 21),
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
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF800000).withValues(alpha: .09),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _kindLabel(kind),
                          style: GoogleFonts.inter(
                            fontSize: 8,
                            fontWeight: FontWeight.w800,
                            letterSpacing: .5,
                            color: const Color(0xFF800000),
                          ),
                        ),
                      ),
                      if (timestamp.isNotEmpty) ...[
                        const Spacer(),
                        Text(
                          timestamp,
                          style: GoogleFonts.inter(
                            fontSize: 9.5,
                            color: const Color(0xFF94A3B8),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 7),
                  Text(
                    item['title'] ?? 'Update',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: unread ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item['body'] ?? '',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      height: 1.35,
                      color: Theme.of(context).brightness == Brightness.dark
                          ? const Color(0xFFCBD5E1)
                          : const Color(0xFF64748B),
                    ),
                  ),
                  if (unread) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Tap to mark as read',
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFFB45309),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (unread)
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFFEF4444),
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState({required bool notifications}) {
    return Container(
      margin: const EdgeInsets.only(top: 50),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Theme.of(context).dividerColor.withValues(alpha: .4),
        ),
      ),
      child: Column(
        children: [
          Icon(
            notifications
                ? Icons.notifications_none_rounded
                : Icons.task_alt_rounded,
            color: notifications
                ? const Color(0xFF94A3B8)
                : const Color(0xFF10B981),
            size: 48,
          ),
          const SizedBox(height: 12),
          Text(
            notifications ? 'No notifications yet' : 'No $_filter requests',
            style: GoogleFonts.spaceGrotesk(
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            notifications
                ? 'Class reminders and updates will appear here.'
                : 'Everything is up to date.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(color: const Color(0xFF64748B)),
          ),
        ],
      ),
    );
  }

  Widget _summaryCard() {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: dark
              ? [const Color(0xFF450A0A), const Color(0xFF7F1D1D)]
              : [const Color(0xFF700000), const Color(0xFFA50000)],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF800000).withValues(alpha: .2),
            blurRadius: 22,
            offset: const Offset(0, 9),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .14),
              borderRadius: BorderRadius.circular(15),
            ),
            child: const Icon(
              Icons.notifications_active_rounded,
              color: Colors.white,
              size: 25,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _unreadCount == 0
                      ? 'You are up to date'
                      : '$_unreadCount unread update${_unreadCount == 1 ? '' : 's'}',
                  style: GoogleFonts.spaceGrotesk(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Class alerts and student requests in one place',
                  style: GoogleFonts.inter(
                    color: Colors.white.withValues(alpha: .78),
                    fontSize: 10.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded, color: Colors.white),
            style: IconButton.styleFrom(
              backgroundColor: Colors.white.withValues(alpha: .12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _categorySelector() {
    Widget button(String value, String label, IconData icon, int count) {
      final selected = _category == value;
      return Expanded(
        child: InkWell(
          borderRadius: BorderRadius.circular(13),
          onTap: () => setState(() => _category = value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: selected ? const Color(0xFF800000) : Colors.transparent,
              borderRadius: BorderRadius.circular(13),
              boxShadow: selected
                  ? [
                      BoxShadow(
                        color: const Color(0xFF800000).withValues(alpha: .18),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 18,
                  color: selected ? Colors.white : const Color(0xFF64748B),
                ),
                const SizedBox(width: 7),
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : const Color(0xFF475569),
                  ),
                ),
                if (count > 0) ...[
                  const SizedBox(width: 7),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: selected
                          ? Colors.white.withValues(alpha: .2)
                          : const Color(0xFFFFE4E6),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      count > 99 ? '99+' : '$count',
                      style: GoogleFonts.inter(
                        fontSize: 8.5,
                        fontWeight: FontWeight.w800,
                        color: selected
                            ? Colors.white
                            : const Color(0xFF800000),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF1E293B)
            : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(17),
        border: Border.all(
          color: Theme.of(context).dividerColor.withValues(alpha: .35),
        ),
      ),
      child: Row(
        children: [
          button(
            'notifications',
            'Notifications',
            Icons.notifications_rounded,
            _unreadCount,
          ),
          button(
            'requests',
            'Requests',
            Icons.assignment_rounded,
            _requests.length,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF0F172A)
        : const Color(0xFFF8FAFC),
    appBar: AppBar(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Notification Center',
            style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w800),
          ),
          Text(
            'Alerts, reminders and attendance requests',
            style: GoogleFonts.inter(
              fontSize: 10,
              color: const Color(0xFF64748B),
            ),
          ),
        ],
      ),
    ),
    body: RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          _summaryCard(),
          const SizedBox(height: 16),
          _categorySelector(),
          const SizedBox(height: 16),
          if (_loading)
            ShimmerLoading(
              isLoading: true,
              child: Column(
                children: List.generate(
                  3,
                  (_) => Container(
                    height: 150,
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                ),
              ),
            )
          else if (_category == 'notifications') ...[
            if (_notifications.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 11),
                child: Row(
                  children: [
                    Text(
                      'Latest updates',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Spacer(),
                    if (_unreadCount > 0)
                      TextButton.icon(
                        onPressed: _markAllRead,
                        icon: const Icon(Icons.done_all_rounded, size: 16),
                        label: const Text('Mark all read'),
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFF800000),
                          textStyle: GoogleFonts.inter(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            if (_notifications.isEmpty)
              _emptyState(notifications: true)
            else
              ..._notifications.map(_notificationCard),
          ] else ...[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: Text(
                    'Attendance requests',
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                ChoiceChip(
                  avatar: _filter == 'pending'
                      ? const Icon(Icons.schedule_rounded, size: 15)
                      : null,
                  label: const Text('Pending'),
                  selected: _filter == 'pending',
                  selectedColor: const Color(0xFFFFE4E6),
                  labelStyle: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: _filter == 'pending'
                        ? const Color(0xFF800000)
                        : const Color(0xFF64748B),
                  ),
                  onSelected: (_) {
                    setState(() => _filter = 'pending');
                    _load();
                  },
                ),
                ChoiceChip(
                  label: const Text('All requests'),
                  selected: _filter == 'all',
                  selectedColor: const Color(0xFFFFE4E6),
                  labelStyle: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: _filter == 'all'
                        ? const Color(0xFF800000)
                        : const Color(0xFF64748B),
                  ),
                  onSelected: (_) {
                    setState(() => _filter = 'all');
                    _load();
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_requests.isEmpty)
              _emptyState(notifications: false)
            else
              ..._requests.map(_requestCard),
          ],
        ],
      ),
    ),
  );
}
