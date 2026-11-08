import '../i18n/tr.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Only notices addressed to the student's own programme or courses; general campus news stays on the Home tab.
List<Map<String, dynamic>> programmeAndCourseNotices(List<Map<String, dynamic>> all) =>
    all.where((notice) => const {'programme', 'course'}.contains(notice['target_scope']?.toString().toLowerCase())).toList();

String _noticeDate(dynamic raw) {
  final value = DateTime.tryParse(raw?.toString() ?? '')?.toLocal();
  if (value == null) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${value.day} ${months[value.month - 1]} ${value.year}';
}

/// The student dashboard's notice section: a heading with a count, then one card per programme or course notice.
class CourseNoticesSection extends StatelessWidget {
  final List<Map<String, dynamic>> announcements;
  const CourseNoticesSection({super.key, required this.announcements});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final notices = programmeAndCourseNotices(announcements);
    final primary = dark ? Colors.white : const Color(0xFF0F172A);
    final secondary = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(tr('Programme & Course Notices'), style: GoogleFonts.spaceGrotesk(fontSize: 14, fontWeight: FontWeight.bold, color: primary)),
            ),
            if (notices.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFF2563EB).withValues(alpha: dark ? .2 : .1), borderRadius: BorderRadius.circular(20)),
                child: Text('${notices.length}', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF2563EB))),
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (notices.isEmpty)
          _Panel(
            dark: dark,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
              child: Column(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(color: const Color(0xFF8B5CF6).withValues(alpha: dark ? .2 : .1), shape: BoxShape.circle),
                    child: const Icon(Icons.campaign_outlined, color: Color(0xFF8B5CF6), size: 21),
                  ),
                  const SizedBox(height: 8),
                  Text(tr('No programme or course notices yet.'), textAlign: TextAlign.center,
                      style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.w700, color: primary)),
                  const SizedBox(height: 2),
                  Text(tr('General campus news is on the Home tab.'), textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 11, color: secondary)),
                ],
              ),
            ),
          )
        else
          for (final notice in notices) Padding(padding: const EdgeInsets.only(bottom: 10), child: _NoticeCard(notice: notice, dark: dark)),
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  final bool dark;
  final Widget child;
  const _Panel({required this.dark, required this.child});

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: dark ? const Color(0xFF222222) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: dark ? .2 : .04), blurRadius: 14, offset: const Offset(0, 6))],
        ),
        child: child,
      );
}

/// One notice: coloured by kind (course blue, programme purple), its course or programme code, the date, and the message (tap to read it all).
class _NoticeCard extends StatefulWidget {
  final Map<String, dynamic> notice;
  final bool dark;
  const _NoticeCard({required this.notice, required this.dark});

  @override
  State<_NoticeCard> createState() => _NoticeCardState();
}

class _NoticeCardState extends State<_NoticeCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final notice = widget.notice, dark = widget.dark;
    final course = notice['target_scope']?.toString().toLowerCase() == 'course';
    final tone = course ? const Color(0xFF2563EB) : const Color(0xFF8B5CF6);
    final code = (course ? notice['target_course_code'] : notice['target_programme_code'])?.toString() ?? '';
    final group = notice['target_group']?.toString();
    final tag = [course ? 'Course' : 'Programme', if (code.isNotEmpty) code, if (course && group != null && group.isNotEmpty && group.toLowerCase() != 'all') group].join(' · ');
    final content = notice['content']?.toString() ?? '';
    final date = _noticeDate(notice['created_at']);
    final secondary = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    return _Panel(
      dark: dark,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: content.length > 140 ? () => setState(() => _open = !_open) : null,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 4,
                  margin: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(color: tone, borderRadius: const BorderRadius.horizontal(right: Radius.circular(4))),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 14, 14, 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(color: tone.withValues(alpha: dark ? .2 : .1), borderRadius: BorderRadius.circular(11)),
                              child: Icon(course ? Icons.menu_book_rounded : Icons.school_rounded, size: 18, color: tone),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(tr(notice['title']?.toString() ?? 'Notice'), maxLines: 2, overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.spaceGrotesk(fontSize: 13.5, fontWeight: FontWeight.bold, color: dark ? Colors.white : const Color(0xFF0F172A))),
                                  const SizedBox(height: 3),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 4,
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                        decoration: BoxDecoration(color: tone.withValues(alpha: dark ? .2 : .1), borderRadius: BorderRadius.circular(8)),
                                        child: Text(tr(tag), style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.w800, color: tone)),
                                      ),
                                      if (date.isNotEmpty) Text(tr(date), style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: secondary)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (content.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          AnimatedSize(
                            duration: const Duration(milliseconds: 200),
                            alignment: Alignment.topCenter,
                            child: Text(tr(content), maxLines: _open ? null : 3, overflow: _open ? null : TextOverflow.ellipsis,
                                style: GoogleFonts.inter(fontSize: 11.5, height: 1.45, color: secondary)),
                          ),
                          if (content.length > 140)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(tr(_open ? 'Show less' : 'Read more'), style: GoogleFonts.inter(fontSize: 10.5, fontWeight: FontWeight.w800, color: tone)),
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
