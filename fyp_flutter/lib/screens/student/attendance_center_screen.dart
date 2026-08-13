import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

import '../../widgets/glass_card.dart';
import '../../widgets/shimmer_loading.dart';

class AttendanceCenterScreen extends StatefulWidget {
  final String authToken;
  final String apiBaseUrl;

  const AttendanceCenterScreen({
    super.key,
    required this.authToken,
    required this.apiBaseUrl,
  });

  @override
  State<AttendanceCenterScreen> createState() => _AttendanceCenterScreenState();
}

class _AttendanceCenterScreenState extends State<AttendanceCenterScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _overview = {};
  List<dynamic> _requests = [];
  List<dynamic> _notifications = [];
  List<dynamic> _history = [];

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

  Future<http.Response> _get(String path) => http
      .get(Uri.parse('${widget.apiBaseUrl}$path'), headers: _headers)
      .timeout(const Duration(seconds: 15));

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final responses = await Future.wait([
        _get('/students/me/attendance-overview'),
        _get('/students/me/attendance-requests'),
        _get('/notifications'),
        _get('/students/me/attendance-sessions'),
      ]);
      if (responses.any((r) => r.statusCode != 200)) {
        throw Exception('Some attendance details could not be loaded.');
      }
      if (!mounted) return;
      setState(() {
        _overview = Map<String, dynamic>.from(jsonDecode(responses[0].body));
        _requests = jsonDecode(responses[1].body) as List<dynamic>;
        _notifications = jsonDecode(responses[2].body) as List<dynamic>;
        _history = jsonDecode(responses[3].body) as List<dynamic>;
      });
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Could not load attendance tools. Pull down to try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Color _riskColor(String value) => switch (value) {
    'high' => const Color(0xFFEF4444),
    'warning' => const Color(0xFFF59E0B),
    _ => const Color(0xFF10B981),
  };

  Widget _loadingCards() => ShimmerLoading(
    isLoading: true,
    child: Column(
      children: List.generate(
        3,
        (_) => Container(
          height: 118,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
          ),
        ),
      ),
    ),
  );

  Widget _overviewTab() {
    final readiness = Map<String, dynamic>.from(_overview['readiness'] ?? {});
    final next = readiness['next_class'] is Map
        ? Map<String, dynamic>.from(readiness['next_class'])
        : null;
    final checks = (readiness['checks'] as List<dynamic>? ?? []);
    final targets = (_overview['targets'] as List<dynamic>? ?? []);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1D4ED8), Color(0xFF3B82F6)],
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF2563EB).withValues(alpha: .24),
                blurRadius: 22,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.fact_check_rounded, color: Colors.white),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      readiness['title'] ?? 'Attendance readiness',
                      style: GoogleFonts.spaceGrotesk(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
              if (next != null) ...[
                const SizedBox(height: 12),
                Text(
                  '${next['course_code']} · ${next['role']}',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${next['day']}, ${next['start']}–${next['end']}  •  ${next['room']}',
                  style: GoogleFonts.inter(
                    color: Colors.white.withValues(alpha: .85),
                    fontSize: 12,
                  ),
                ),
              ],
              if (checks.isNotEmpty) ...[
                const SizedBox(height: 16),
                ...checks.map((raw) {
                  final check = Map<String, dynamic>.from(raw as Map);
                  final ready = check['ready'] == true;
                  return Padding(
                    padding: const EdgeInsets.only(top: 7),
                    child: Row(
                      children: [
                        Icon(
                          ready ? Icons.check_circle : Icons.info_rounded,
                          color: ready
                              ? const Color(0xFFA7F3D0)
                              : const Color(0xFFFDE68A),
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${check['label']}: ${check['detail']}',
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ],
          ),
        ),
        const SizedBox(height: 22),
        Text(
          'Attendance targets',
          style: GoogleFonts.spaceGrotesk(
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'See what you need before attendance becomes a problem.',
          style: GoogleFonts.inter(
            color: const Color(0xFF64748B),
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 12),
        if (targets.isEmpty)
          _empty('No course targets yet.')
        else
          ...targets.map((raw) {
            final item = Map<String, dynamic>.from(raw as Map);
            final rate = (item['current_rate'] as num?)?.toDouble() ?? 0;
            final color = _riskColor(item['risk'] ?? 'safe');
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: GlassCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['course_code'] ?? '',
                                style: GoogleFonts.inter(
                                  color: const Color(0xFF2563EB),
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                item['course_name'] ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          '${rate.toStringAsFixed(1)}%',
                          style: GoogleFonts.spaceGrotesk(
                            color: color,
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: LinearProgressIndicator(
                        value: (rate / 100).clamp(0, 1),
                        minHeight: 8,
                        backgroundColor: color.withValues(alpha: .12),
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 9),
                    Text(
                      item['message'] ?? '',
                      style: GoogleFonts.inter(
                        color: color,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _requestsTab() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      FilledButton.icon(
        onPressed: _openRequestForm,
        icon: const Icon(Icons.add_rounded),
        label: const Text('New leave or correction request'),
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          backgroundColor: const Color(0xFF2563EB),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
          ),
        ),
      ),
      const SizedBox(height: 16),
      if (_requests.isEmpty)
        _empty('No requests yet.')
      else
        ..._requests.map((raw) {
          final item = Map<String, dynamic>.from(raw as Map);
          final status = item['status'].toString();
          final color = status == 'approved'
              ? const Color(0xFF10B981)
              : status == 'rejected'
              ? const Color(0xFFEF4444)
              : const Color(0xFFF59E0B);
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: GlassCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${item['course_code']} · ${item['request_type']}',
                          style: GoogleFonts.inter(fontWeight: FontWeight.w800),
                        ),
                      ),
                      _pill(status, color),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item['reason'] ?? '',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: const Color(0xFF475569),
                    ),
                  ),
                  if ((item['reviewer_note'] ?? '').toString().isNotEmpty) ...[
                    const Divider(height: 22),
                    Text(
                      'Staff note: ${item['reviewer_note']}',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (status == 'pending')
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => _cancelRequest(item['id']),
                        child: const Text('Cancel request'),
                      ),
                    ),
                ],
              ),
            ),
          );
        }),
    ],
  );

  Widget _notificationsTab() => RefreshIndicator(
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: _notifications.isEmpty
          ? [_empty('You are all caught up.')]
          : _notifications.map((raw) {
              final item = Map<String, dynamic>.from(raw as Map);
              final unread = item['is_read'] != true;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: InkWell(
                  borderRadius: BorderRadius.circular(18),
                  onTap: unread ? () => _markRead(item['id']) : null,
                  child: GlassCard(
                    padding: const EdgeInsets.all(15),
                    color: unread ? const Color(0xFFEFF6FF) : null,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: const Color(0xFFDBEAFE),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            item['kind'] == 'timetable_change'
                                ? Icons.edit_calendar_rounded
                                : Icons.notifications_active_rounded,
                            color: const Color(0xFF2563EB),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['title'] ?? '',
                                style: GoogleFonts.inter(
                                  fontWeight: unread
                                      ? FontWeight.w800
                                      : FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                item['body'] ?? '',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: const Color(0xFF64748B),
                                  height: 1.35,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (unread)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Color(0xFF2563EB),
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
    ),
  );

  Widget _empty(String text) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 42),
    child: Center(
      child: Column(
        children: [
          const Icon(Icons.inbox_outlined, size: 38, color: Color(0xFFCBD5E1)),
          const SizedBox(height: 10),
          Text(text, style: GoogleFonts.inter(color: const Color(0xFF64748B))),
        ],
      ),
    ),
  );

  Widget _pill(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      text.toUpperCase(),
      style: GoogleFonts.inter(
        color: color,
        fontSize: 9,
        fontWeight: FontWeight.w800,
      ),
    ),
  );

  Future<void> _openRequestForm() async {
    final targets = (_overview['targets'] as List<dynamic>? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    if (targets.isEmpty) return;
    String courseId = targets.first['course_id'];
    String type = 'leave';
    String? sessionId;
    final reason = TextEditingController();
    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) {
          final sessions = _history
              .where((item) => item['course_id'] == courseId)
              .toList();
          return Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              20,
              20,
              20 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: SingleChildScrollView(
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
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'New attendance request',
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Tell your lecturer what happened.',
                    style: GoogleFonts.inter(
                      color: const Color(0xFF64748B),
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    initialValue: courseId,
                    decoration: _input('Course', Icons.book_outlined),
                    items: targets
                        .map(
                          (c) => DropdownMenuItem(
                            value: c['course_id'] as String,
                            child: Text(c['course_code']),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setSheetState(() {
                      courseId = v!;
                      sessionId = null;
                    }),
                  ),
                  const SizedBox(height: 12),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'leave',
                        label: Text('Leave'),
                        icon: Icon(Icons.event_busy_outlined),
                      ),
                      ButtonSegment(
                        value: 'correction',
                        label: Text('Correction'),
                        icon: Icon(Icons.fact_check_outlined),
                      ),
                    ],
                    selected: {type},
                    onSelectionChanged: (v) =>
                        setSheetState(() => type = v.first),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: sessionId,
                    decoration: _input(
                      'Class session',
                      Icons.calendar_today_outlined,
                    ),
                    items: sessions
                        .map(
                          (s) => DropdownMenuItem(
                            value: s['session_id'] as String?,
                            child: Text(
                              '${s['course_code']} · ${s['status']} · ${s['opened_at'] ?? 'Session'}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setSheetState(() => sessionId = v),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: reason,
                    minLines: 3,
                    maxLines: 5,
                    decoration: _input(
                      'Reason (at least 10 characters)',
                      Icons.notes_rounded,
                    ),
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: () async {
                      if (reason.text.trim().length < 10 || sessionId == null) {
                        return;
                      }
                      final response = await http.post(
                        Uri.parse(
                          '${widget.apiBaseUrl}/students/me/attendance-requests',
                        ),
                        headers: _headers,
                        body: jsonEncode({
                          'course_id': courseId,
                          'session_id': sessionId,
                          'request_type': type,
                          'reason': reason.text.trim(),
                        }),
                      );
                      if (!sheetContext.mounted) return;
                      if (response.statusCode == 201) {
                        Navigator.pop(sheetContext, true);
                      } else {
                        ScaffoldMessenger.of(sheetContext).showSnackBar(
                          SnackBar(content: Text(_detail(response.body))),
                        );
                      }
                    },
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(50),
                      backgroundColor: const Color(0xFF2563EB),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text('Send request'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
    reason.dispose();
    if (submitted == true) await _load();
  }

  InputDecoration _input(String label, IconData icon) => InputDecoration(
    labelText: label,
    prefixIcon: Icon(icon, size: 20),
    filled: true,
    fillColor: Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF1E293B)
        : const Color(0xFFF8FAFC),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
    ),
  );

  String _detail(String body) {
    try {
      return jsonDecode(body)['detail']?.toString() ?? 'Request failed.';
    } catch (_) {
      return 'Request failed.';
    }
  }

  Future<void> _cancelRequest(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel this request?'),
        content: const Text('Your lecturer will no longer review it.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep request'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cancel request'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    await http.patch(
      Uri.parse(
        '${widget.apiBaseUrl}/students/me/attendance-requests/$id/cancel',
      ),
      headers: _headers,
    );
    await _load();
  }

  Future<void> _markRead(String id) async {
    await http.patch(
      Uri.parse('${widget.apiBaseUrl}/notifications/$id/read'),
      headers: _headers,
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Attendance Center',
              style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w800),
            ),
            Text(
              'Be ready. Stay on target.',
              style: GoogleFonts.inter(
                fontSize: 11,
                color: const Color(0xFF64748B),
              ),
            ),
          ],
        ),
        bottom: const TabBar(
          tabs: [
            Tab(text: 'Readiness'),
            Tab(text: 'Requests'),
            Tab(text: 'Updates'),
          ],
        ),
      ),
      body: _loading
          ? Padding(padding: const EdgeInsets.all(16), child: _loadingCards())
          : _error != null
          ? RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                children: [
                  SizedBox(height: MediaQuery.sizeOf(context).height * .3),
                  _empty(_error!),
                ],
              ),
            )
          : TabBarView(
              children: [_overviewTab(), _requestsTab(), _notificationsTab()],
            ),
    ),
  );
}
