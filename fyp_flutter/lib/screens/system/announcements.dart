import '../../i18n/tr.dart';
import 'dart:convert';
import 'package:flutter/material.dart';


/// "7 Nov 2026" (and ", 15:44" with [withTime]) in the phone's time; empty when the date is missing or broken.
String announcementDate(Object? iso, {bool withTime = false}) {
  final at = DateTime.tryParse(iso?.toString() ?? '')?.toLocal();
  if (at == null) return '';
  final day = dayMonth(at, year: true);
  return withTime ? '$day, ${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}' : day;
}

final Map<String, ImageProvider?> _images = {};

/// The announcement's picture, decoded once per announcement so scrolling and rebuilds stay smooth.
ImageProvider? announcementImage(Map<String, dynamic> notice) {
  final raw = notice['image_base64']?.toString() ?? '';
  if (raw.isEmpty) return null;
  return _images.putIfAbsent('${notice['id']}:${raw.length}', () {
    try {
      return MemoryImage(base64Decode(raw.split(',').last));
    } on FormatException {
      return null;
    }
  });
}

/// Who it is for, shown as the small tag: faculty, else publisher, else "Campus".
String announcementTag(Map<String, dynamic> notice) {
  for (final key in ['faculty', 'department', 'publisher']) {
    final value = notice[key]?.toString().trim() ?? '';
    if (value.isNotEmpty) return value;
  }
  return 'Campus';
}

/// Number of pages for [count] items, at least one so an empty list still has "page 1 of 1".
int pageCount(int count, int size) => count <= 0 ? 1 : (count + size - 1) ~/ size;

void openAnnouncement(BuildContext context, Map<String, dynamic> notice) =>
    Navigator.push(context, MaterialPageRoute(builder: (_) => AnnouncementDetailScreen(notice: notice)));

Color _surface(bool dark) => dark ? const Color(0xFF222222) : Colors.white;
Color _line(bool dark) => dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0);
Color _muted(bool dark) => dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
Color _text(bool dark) => dark ? Colors.white : const Color(0xFF0F172A);
const _accent = Color(0xFF2563EB);

/// One announcement in a list: picture (or an icon), tag, date, title and a two-line preview; tap opens it.
class AnnouncementCard extends StatelessWidget {
  final Map<String, dynamic> notice;
  const AnnouncementCard({super.key, required this.notice});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final image = announcementImage(notice);
    final date = announcementDate(notice['created_at']);
    final urgent = '${notice['priority'] ?? ''}'.toLowerCase() == 'high';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: _surface(dark),
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => openAnnouncement(context, notice),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: _line(dark)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (image != null)
                AspectRatio(
                  aspectRatio: 16 / 7,
                  child: Image(image: image, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink()),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 10, 14),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (image == null) ...[
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: _accent.withValues(alpha: dark ? 0.2 : 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.campaign_outlined, size: 20, color: _accent),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                        _Tag(announcementTag(notice), color: _accent),
                        if (urgent) const _Tag('Important', color: Color(0xFFDC2626)),
                        if (date.isNotEmpty)
                          Text(tr(date), style: text.labelSmall?.copyWith(color: _muted(dark), fontWeight: FontWeight.w600)),
                      ]),
                      const SizedBox(height: 6),
                      Text('${notice['title'] ?? 'Announcement'}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: _text(dark), height: 1.25)),
                      if ('${notice['content'] ?? ''}'.trim().isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(tr('${notice['content']}'.trim()),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: text.bodySmall?.copyWith(color: _muted(dark), height: 1.35)),
                      ],
                    ]),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(left: 4, top: 8),
                    child: Icon(Icons.chevron_right_rounded, color: _muted(dark)),
                  ),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final Color color;
  const _Tag(this.label, {required this.color});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: dark ? 0.2 : 0.1), borderRadius: BorderRadius.circular(20)),
      child: Text(tr(label),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: dark ? Color.lerp(color, Colors.white, 0.35) : color,
              )),
    );
  }
}

/// Every announcement, five per page, newest first as the server sends them.
class AnnouncementsScreen extends StatefulWidget {
  final List<Map<String, dynamic>> announcements;
  static const pageSize = 5;
  const AnnouncementsScreen({super.key, required this.announcements});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  int _page = 0;
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _go(int page) {
    setState(() => _page = page);
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final all = widget.announcements;
    const size = AnnouncementsScreen.pageSize;
    final pages = pageCount(all.length, size);
    final page = _page.clamp(0, pages - 1);
    final shown = all.skip(page * size).take(size).toList();
    return Scaffold(
      backgroundColor: dark ? const Color(0xFF181818) : const Color(0xFFF6F9FE),
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr('Announcements'), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          Text(tr('{allCount} in total', {'allCount': all.length}), style: text.labelSmall?.copyWith(color: _muted(dark))),
        ]),
        backgroundColor: dark ? const Color(0xFF181818) : const Color(0xFFF6F9FE),
        surfaceTintColor: Colors.transparent,
      ),
      body: all.isEmpty
          ? Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.campaign_outlined, size: 36, color: _muted(dark)),
                const SizedBox(height: 8),
                Text(tr('No announcements at this time'), style: text.bodyMedium?.copyWith(color: _muted(dark))),
              ]),
            )
          : ListView(
              controller: _scroll,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                for (final notice in shown) AnnouncementCard(notice: notice),
                if (pages > 1) ...[
                  const SizedBox(height: 4),
                  Text(tr('{v}–{v2} of {allCount}', {'v': page * size + 1, 'v2': page * size + shown.length, 'allCount': all.length}),
                      textAlign: TextAlign.center, style: text.labelSmall?.copyWith(color: _muted(dark))),
                  const SizedBox(height: 8),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    IconButton(
                      tooltip: tr('Previous page'),
                      onPressed: page > 0 ? () => _go(page - 1) : null,
                      icon: const Icon(Icons.chevron_left_rounded),
                    ),
                    for (var i = 0; i < pages; i++)
                      if (pages <= 5 || (i - page).abs() <= 1 || i == 0 || i == pages - 1)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: Semantics(
                            button: true,
                            selected: i == page,
                            label: tr('Page {v}', {'v': i + 1}),
                            excludeSemantics: true,
                            child: InkWell(
                              onTap: i == page ? null : () => _go(i),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                width: 36,
                                height: 36,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: i == page ? _accent : _surface(dark),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: i == page ? _accent : _line(dark)),
                                ),
                                child: Text('${i + 1}',
                                    style: text.labelLarge?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: i == page ? Colors.white : _text(dark),
                                    )),
                              ),
                            ),
                          ),
                        )
                      else if ((i - page).abs() == 2)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: Text('…', style: text.labelLarge?.copyWith(color: _muted(dark))),
                        ),
                    IconButton(
                      tooltip: tr('Next page'),
                      onPressed: page < pages - 1 ? () => _go(page + 1) : null,
                      icon: const Icon(Icons.chevron_right_rounded),
                    ),
                  ]),
                ],
              ],
            ),
    );
  }
}

/// One announcement in full: picture, tags, title, date and time, publisher and the whole text.
class AnnouncementDetailScreen extends StatefulWidget {
  final Map<String, dynamic> notice;
  const AnnouncementDetailScreen({super.key, required this.notice});

  @override
  State<AnnouncementDetailScreen> createState() => _AnnouncementDetailScreenState();
}

class _AnnouncementDetailScreenState extends State<AnnouncementDetailScreen> {
  static const _pictureHeight = 300.0;
  final _scroll = ScrollController();
  bool _folded = false;

  @override
  void initState() {
    super.initState();
    // The bar is white-on-picture while the picture shows, and the page's own colours once it has folded away.
    _scroll.addListener(() {
      final folded = _scroll.offset > _pictureHeight - kToolbarHeight - 48;
      if (folded != _folded) setState(() => _folded = folded);
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final notice = widget.notice;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final image = announcementImage(notice);
    final date = announcementDate(notice['created_at'], withTime: true);
    final publisher = notice['publisher']?.toString().trim() ?? '';
    final department = notice['department']?.toString().trim() ?? '';
    final faculty = notice['faculty']?.toString().trim() ?? '';
    final urgent = '${notice['priority'] ?? ''}'.toLowerCase() == 'high';
    final content = '${notice['content'] ?? ''}'.trim();
    Widget info(IconData icon, String label, String value) => Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Row(children: [
            Icon(icon, size: 16, color: _muted(dark)),
            const SizedBox(width: 8),
            Text('$label  ', style: text.bodySmall?.copyWith(color: _muted(dark))),
            Expanded(child: Text(tr(value), style: text.bodySmall?.copyWith(color: _text(dark), fontWeight: FontWeight.w600))),
          ]),
        );
    final page = dark ? const Color(0xFF181818) : Colors.white;
    final body = Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: 6, runSpacing: 6, children: [
          _Tag(announcementTag(notice), color: _accent),
          if (urgent) const _Tag('Important', color: Color(0xFFDC2626)),
        ]),
        const SizedBox(height: 12),
        SelectableText('${notice['title'] ?? 'Announcement'}',
            style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: _text(dark), height: 1.2)),
        const SizedBox(height: 6),
        if (date.isNotEmpty) info(Icons.schedule_rounded, 'Posted', date),
        if (publisher.isNotEmpty) info(Icons.person_outline_rounded, 'By', publisher),
        if (faculty.isNotEmpty) info(Icons.account_balance_outlined, 'Faculty', faculty),
        if (department.isNotEmpty) info(Icons.apartment_outlined, 'Department', department),
        const SizedBox(height: 18),
        Divider(height: 1, color: _line(dark)),
        const SizedBox(height: 18),
        SelectableText(tr(content.isEmpty ? 'No further details.' : content),
            style: text.bodyLarge?.copyWith(color: _text(dark), height: 1.6)),
      ]),
    );
    // The whole page is the announcement: the picture runs edge to edge under the bar and folds into it on scroll.
    return Scaffold(
      backgroundColor: page,
      body: CustomScrollView(controller: _scroll, slivers: [
        SliverAppBar(
          pinned: true,
          stretch: image != null,
          expandedHeight: image != null ? _pictureHeight : null,
          backgroundColor: page,
          surfaceTintColor: Colors.transparent,
          foregroundColor: image != null && !_folded ? Colors.white : _text(dark),
          title: image == null || _folded ? Text(tr('Announcement'), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: _text(dark))) : null,
          flexibleSpace: image == null
              ? null
              : FlexibleSpaceBar(
                  stretchModes: const [StretchMode.zoomBackground],
                  background: Stack(fit: StackFit.expand, children: [
                    Image(image: image, fit: BoxFit.cover, errorBuilder: (_, _, _) => ColoredBox(color: _line(dark))),
                    // A soft shade at the top so the back arrow reads on any picture.
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0x8C000000), Color(0x00000000)],
                          stops: [0, .4],
                        ),
                      ),
                    ),
                  ]),
                ),
        ),
        SliverToBoxAdapter(child: body),
      ]),
    );
  }
}
