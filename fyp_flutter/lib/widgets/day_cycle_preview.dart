import '../i18n/tr.dart';
import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../services/day_cycle.dart';

/// A small live window onto the Day/Night sky (shown in Settings while that mode is chosen): the sky colour, sun or
/// moon and stars right now, the part of the day, and when the theme turns next.
class DayCyclePreview extends StatefulWidget {
  /// Fixed hour for tests and previews; null follows the campus clock.
  final double? hour;
  const DayCyclePreview({super.key, this.hour});

  @override
  State<DayCyclePreview> createState() => _DayCyclePreviewState();
}

class _DayCyclePreviewState extends State<DayCyclePreview> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    if (widget.hour == null) _tick = Timer.periodic(const Duration(seconds: 30), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hour = widget.hour ?? campusHour();
    final look = skyAt(hour);
    final turn = nextThemeTurn(hour);
    final text = Theme.of(context).textTheme;
    const shadow = [Shadow(color: Color(0x66000000), blurRadius: 6)];
    final next = look.isDark ? tr('Light theme from {time}', {'time': clockOf(turn)}) : tr('Dark theme from {time}', {'time': clockOf(turn)});
    return Semantics(
      label: tr('Day and night sky now: {v}, {v2}. {next}.', {'v': partOfDay(hour), 'v2': clockOf(hour), 'next': next}),
      excludeSemantics: true,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          height: 96,
          width: double.infinity,
          child: Stack(children: [
            Positioned.fill(child: CustomPaint(painter: MiniSkyPainter(look))),
            Positioned(
              left: 14,
              top: 12,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(partOfDay(hour)),
                    style: text.titleSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800, shadows: shadow)),
                Text(tr('Campus time {v}', {'v': clockOf(hour)}),
                    style: text.labelSmall?.copyWith(color: Colors.white.withValues(alpha: .9), shadows: shadow)),
              ]),
            ),
            Positioned(
              right: 10,
              bottom: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: .28),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withValues(alpha: .25)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(look.isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded, size: 13, color: Colors.white),
                  const SizedBox(width: 5),
                  Text(tr(next), style: text.labelSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// The live sky by itself (no text), for small thumbnails such as the Theme Mode option.
class MiniSkyPainter extends CustomPainter {
  final SkyLook look;
  MiniSkyPainter(this.look);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()
      ..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [look.top, look.mid, look.bottom], stops: const [0, .5, 1])
          .createShader(rect));
    canvas.drawRect(rect, Paint()
      ..shader = RadialGradient(center: Alignment.bottomCenter, radius: 1.1, colors: [look.glow, look.glow.withValues(alpha: 0)]).createShader(rect));
    if (look.stars > .01) {
      final random = math.Random(7);
      for (var i = 0; i < 34; i++) {
        canvas.drawCircle(Offset(random.nextDouble() * size.width, random.nextDouble() * size.height * .7), .5 + random.nextDouble(),
            Paint()..color = Colors.white.withValues(alpha: look.stars * (.35 + random.nextDouble() * .5)));
      }
    }
    // Sun and moon on their arcs (stretched to this strip), fading in and out at the horizon like the full sky.
    Offset at(Arc arc) => Offset(size.width * arc.x, size.height * (.95 - arc.elevation * .7));
    if (look.sunOpacity > .01) {
      final c = at(look.sun);
      canvas.drawCircle(c, 30, Paint()..shader = RadialGradient(colors: [const Color(0xFFFDE68A).withValues(alpha: .45 * look.sunOpacity), const Color(0x00FDE68A)]).createShader(Rect.fromCircle(center: c, radius: 30)));
      canvas.drawCircle(c, 10, Paint()..color = Color.lerp(const Color(0xFFFFE5C2), const Color(0xFFFFFBEB), look.sun.elevation)!.withValues(alpha: look.sunOpacity));
    }
    if (look.moonOpacity > .01) {
      final c = at(look.moon);
      canvas.saveLayer(Rect.fromCircle(center: c, radius: 12), Paint()..color = Colors.white.withValues(alpha: look.moonOpacity));
      canvas.drawCircle(c, 9, Paint()..color = const Color(0xFFF5F5F4));
      canvas.drawCircle(c + const Offset(4, -3), 8, Paint()..blendMode = BlendMode.dstOut);
      canvas.restore();
    }
    // Low hills, lit by the sky's light.
    final hill = Color.lerp(const Color(0xFF0F2A22), Color.lerp(const Color(0xFF1FA766), look.tint, .25)!, look.bright)!;
    final path = Path()..moveTo(0, size.height);
    for (double x = 0; x <= size.width + 4; x += 4) {
      path.lineTo(x, size.height * .86 + math.sin(x / size.width * math.pi * 2 + .8) * 5);
    }
    path
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = hill.withValues(alpha: .85));
  }

  @override
  bool shouldRepaint(covariant MiniSkyPainter old) => old.look.hour != look.hour;
}
