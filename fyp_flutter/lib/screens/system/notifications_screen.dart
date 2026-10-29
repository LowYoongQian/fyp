import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

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
      const SnackBar(content: Text('Could not refresh notifications.')),
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
        const SnackBar(content: Text('Could not mark notification as read.')),
      );
    }
  }

  String _formatTime(dynamic raw) {
    final value = DateTime.tryParse(raw?.toString() ?? '')?.toLocal();
    if (value == null) return '';
    final difference = DateTime.now().difference(value);
    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inMinutes < 60) return '${difference.inMinutes}m ago';
    if (difference.inHours < 24) return '${difference.inHours}h ago';
    if (difference.inDays < 7) return '${difference.inDays}d ago';
    return '${value.day}/${value.month}/${value.year}';
  }

  IconData _iconFor(String kind) => switch (kind) {
    'timetable_change' => Icons.edit_calendar_rounded,
    'class_reminder' => Icons.alarm_rounded,
    'request_decision' => Icons.fact_check_rounded,
    _ => Icons.notifications_active_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final background = dark
        ? const Color(0xFF0F172A)
        : const Color(0xFFF6F9FE);
    final surface = dark ? const Color(0xFF1E293B) : Colors.white;
    final primaryText = dark ? Colors.white : const Color(0xFF0F172A);
    final secondaryText = dark
        ? const Color(0xFFCBD5E1)
        : const Color(0xFF64748B);

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
          title: Text(
            'Notifications',
            style: GoogleFonts.spaceGrotesk(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: primaryText,
            ),
          ),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(1),
            child: Divider(height: 1, color: dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
          ),
        ),
        body: RefreshIndicator(
          color: const Color(0xFF2563EB),
          onRefresh: () => _refresh(reportFailure: true),
          child: _notifications.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  children: [
                    SizedBox(height: MediaQuery.sizeOf(context).height * 0.25),
                    const Icon(Icons.notifications_none_rounded, size: 48, color: Color(0xFF94A3B8)),
                    const SizedBox(height: 14),
                    Text(
                      'No notifications yet',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.spaceGrotesk(fontSize: 17, fontWeight: FontWeight.w800, color: primaryText),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Class reminders and attendance updates will appear here.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(fontSize: 12, height: 1.45, color: secondaryText),
                    ),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: _notifications.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final item = _notifications[index];
                    final unread = item['is_read'] != true;
                    final kind = item['kind']?.toString() ?? '';
                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: unread ? () => _markRead(index) : null,
                        borderRadius: BorderRadius.circular(18),
                        child: Ink(
                          padding: const EdgeInsets.all(15),
                          decoration: BoxDecoration(
                            color: unread
                                ? const Color(0xFF2563EB).withValues(alpha: dark ? 0.13 : 0.06)
                                : surface,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: unread
                                  ? (dark ? const Color(0xFF1D4ED8) : const Color(0xFFBFDBFE))
                                  : (dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(13),
                                ),
                                child: Icon(_iconFor(kind), size: 20, color: const Color(0xFF2563EB)),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            '${item['title'] ?? 'Attendance update'}',
                                            style: GoogleFonts.inter(fontSize: 13, fontWeight: unread ? FontWeight.w800 : FontWeight.w600, color: primaryText),
                                          ),
                                        ),
                                        if (_formatTime(item['created_at']).isNotEmpty)
                                          Text(_formatTime(item['created_at']), style: GoogleFonts.inter(fontSize: 9.5, color: const Color(0xFF94A3B8))),
                                      ],
                                    ),
                                    const SizedBox(height: 5),
                                    Text('${item['body'] ?? ''}', style: GoogleFonts.inter(fontSize: 11.5, height: 1.4, color: secondaryText)),
                                    if (unread) ...[
                                      const SizedBox(height: 8),
                                      Text('Tap to mark as read', style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.w700, color: const Color(0xFF2563EB))),
                                    ],
                                  ],
                                ),
                              ),
                              if (unread) ...[
                                const SizedBox(width: 8),
                                Container(width: 7, height: 7, decoration: const BoxDecoration(color: Color(0xFF2563EB), shape: BoxShape.circle)),
                              ],
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
