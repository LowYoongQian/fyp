import '../i18n/tr.dart';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'day_cycle_preview.dart';

/// The banner under the Theme Mode buttons showing what the chosen mode looks like: a bright day scene for Light,
/// a night scene for Dark, half and half for System (saying which the phone uses now), and the live sky for Day/Night.
class ThemeModePreview extends StatelessWidget {
  final String mode;
  const ThemeModePreview({super.key, required this.mode});

  @override
  Widget build(BuildContext context) {
    if (mode == 'cycle') return const DayCyclePreview();
    final phoneDark = MediaQuery.platformBrightnessOf(context) == Brightness.dark;
    final (title, line, badge, badgeIcon) = switch (mode) {
      'dark' => ('Dark', 'Soft dark greys, easy on the eyes', 'Always dark', Icons.dark_mode_rounded),
      'system' => ('System', 'Follows your phone\'s look', phoneDark ? 'Phone is dark now' : 'Phone is light now', Icons.smartphone_rounded),
      _ => ('Light', 'Bright, clean screens all day', 'Always light', Icons.light_mode_rounded),
    };
    // The words sit on the left (light for System), the badge at the right (dark for System).
    final lightText = mode != 'dark';
    final lightBadge = mode == 'light';
    final text = Theme.of(context).textTheme;
    final ink = lightText ? const Color(0xFF0F172A) : Colors.white;
    final shadow = lightText ? const <Shadow>[] : const [Shadow(color: Color(0x66000000), blurRadius: 6)];
    return Semantics(
      label: tr('{title} theme preview: {line}. {badge}.', {'title': title, 'line': line, 'badge': badge}),
      excludeSemantics: true,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          height: 96,
          width: double.infinity,
          child: Stack(children: [
            Positioned.fill(child: CustomPaint(painter: _Scene(mode))),
            Positioned(
              left: 14,
              top: 12,
              right: 120,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(title), style: text.titleSmall?.copyWith(color: ink, fontWeight: FontWeight.w800, shadows: shadow)),
                Text(tr(line),
                    maxLines: 2,
                    style: text.labelSmall?.copyWith(color: ink.withValues(alpha: .85), height: 1.3, shadows: shadow)),
              ]),
            ),
            Positioned(
              right: 10,
              bottom: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: lightBadge ? Colors.white.withValues(alpha: .75) : Colors.black.withValues(alpha: .28),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: lightBadge ? const Color(0xFFBFDBFE) : Colors.white.withValues(alpha: .25)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(badgeIcon, size: 13, color: lightBadge ? const Color(0xFF2563EB) : Colors.white),
                  const SizedBox(width: 5),
                  Text(tr(badge), style: text.labelSmall?.copyWith(color: lightBadge ? const Color(0xFF1E3A8A) : Colors.white, fontWeight: FontWeight.w700)),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// The scene behind the banner, drawn in the app's own colours: a day sky with a sun and a cloud, the dark greys with
/// a moon and stars, or both split on a diagonal for System. Each shows a small app card at the right.
class _Scene extends CustomPainter {
  final String mode;
  _Scene(this.mode);

  void _day(Canvas canvas, Size size, Offset sun) {
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()
      ..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFBFDBFE), Color(0xFFEAF4FF), Color(0xFFF8FAFC)])
          .createShader(rect));
    canvas.drawCircle(sun, 34, Paint()..shader = const RadialGradient(colors: [Color(0x66FDE68A), Color(0x00FDE68A)]).createShader(Rect.fromCircle(center: sun, radius: 34)));
    canvas.drawCircle(sun, 11, Paint()..shader = const RadialGradient(colors: [Color(0xFFFFFBEB), Color(0xFFFDE68A), Color(0xFFFBBF24)], stops: [0, .7, 1]).createShader(Rect.fromCircle(center: sun, radius: 11)));
    final cloud = Paint()..color = Colors.white.withValues(alpha: .85);
    for (final (dx, dy, r) in const [(-30.0, 8.0, 8.0), (-20.0, 2.0, 10.0), (-9.0, 7.0, 8.0)]) {
      canvas.drawCircle(sun + Offset(dx, dy), r, cloud);   // a small cloud drifting past the sun's lower left
    }
    _hills(canvas, size, const Color(0xFFBBF7D0));
  }

  void _night(Canvas canvas, Size size, Offset moon) {
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()
      ..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF121212), Color(0xFF181818), Color(0xFF222222)])
          .createShader(rect));
    final random = math.Random(11);
    for (var i = 0; i < 30; i++) {
      canvas.drawCircle(Offset(random.nextDouble() * size.width, random.nextDouble() * size.height * .7), .5 + random.nextDouble(),
          Paint()..color = Colors.white.withValues(alpha: .3 + random.nextDouble() * .5));
    }
    canvas.drawCircle(moon, 30, Paint()..shader = const RadialGradient(colors: [Color(0x22FFFFFF), Color(0x00FFFFFF)]).createShader(Rect.fromCircle(center: moon, radius: 30)));
    canvas.saveLayer(Rect.fromCircle(center: moon, radius: 12), Paint());
    canvas.drawCircle(moon, 10, Paint()..color = const Color(0xFFF5F5F4));
    canvas.drawCircle(moon + const Offset(4.5, -3), 8.5, Paint()..blendMode = BlendMode.dstOut);
    canvas.restore();
    _hills(canvas, size, const Color(0xFF2B2B2B));
  }

  void _hills(Canvas canvas, Size size, Color color) {
    final path = Path()..moveTo(0, size.height);
    for (double x = 0; x <= size.width + 4; x += 4) {
      path.lineTo(x, size.height * .86 + math.sin(x / size.width * math.pi * 2 + .8) * 5);
    }
    path
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
  }

  /// A small app card in the theme's colours, at the right.
  void _card(Canvas canvas, Rect area, bool dark) {
    final card = RRect.fromRectAndRadius(area, const Radius.circular(9));
    canvas.drawRRect(card.shift(const Offset(0, 2)), Paint()..color = Colors.black.withValues(alpha: .08));
    canvas.drawRRect(card, Paint()..color = dark ? const Color(0xFF2D2D2D) : Colors.white);
    final line = dark ? const Color(0xFF60A5FA) : const Color(0xFF2563EB);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(area.left + 9, area.top + 9, area.width * .55, 5), const Radius.circular(3)),
        Paint()..color = line.withValues(alpha: .8));
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(area.left + 9, area.top + 19, area.width * .35, 5), const Radius.circular(3)),
        Paint()..color = line.withValues(alpha: .4));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final cardRect = Rect.fromLTWH(size.width - 104, 12, 92, 34);
    if (mode == 'system') {
      // Light on the left, dark on the right, split on a slant.
      final split = Path()
        ..moveTo(size.width * .58, 0)
        ..lineTo(size.width, 0)
        ..lineTo(size.width, size.height)
        ..lineTo(size.width * .42, size.height)
        ..close();
      canvas.save();
      canvas.clipPath(Path()..addRect(Offset.zero & size)..addPath(split, Offset.zero)..fillType = PathFillType.evenOdd);
      _day(canvas, size, Offset(size.width * .3, size.height * .72));
      canvas.restore();
      canvas.save();
      canvas.clipPath(split);
      _night(canvas, size, Offset(size.width - 122, size.height * .32));
      _card(canvas, cardRect, true);
      canvas.restore();
      return;
    }
    final dark = mode == 'dark';
    // Sun or moon low in the middle: clear of the words at the left, the card at the top right and the badge.
    final body = Offset(size.width - 150, size.height * .7);
    dark ? _night(canvas, size, body) : _day(canvas, size, body);
    _card(canvas, cardRect, dark);
  }

  @override
  bool shouldRepaint(covariant _Scene old) => old.mode != mode;
}
