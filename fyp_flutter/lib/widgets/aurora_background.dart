import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../services/day_cycle.dart';

/// The app's backdrop: a day sky in the light theme (sun, drifting clouds) and a night sky in the dark theme
/// (moon, twinkling and sparkling stars, two constellations, a few planets, shooting stars), both over low hills with a few trees.
/// The dark sky uses the web dark theme's greys, never navy. Reduced motion keeps one still picture (no shooting stars).
/// In the Day/Night mode the sky instead follows the campus clock like the web sign-in sky: its colour, the sun and moon
/// on their arcs, stars, clouds and the light on the hills all change continuously (softened so text stays readable).
class AuroraBackground extends StatefulWidget {
  const AuroraBackground({super.key});

  @override
  State<AuroraBackground> createState() => _AuroraBackgroundState();
}

class _AuroraBackgroundState extends State<AuroraBackground>
    with SingleTickerProviderStateMixin {
  // Only drives repaints; the painters read the clock themselves so the sky never jumps when the controller loops.
  late final AnimationController _ticker = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 30),
  );
  // Moves the Day/Night sky and hills on with the clock even when motion is reduced (the ticker is stopped then).
  final ValueNotifier<int> _clockTick = ValueNotifier(0);
  Timer? _clock;
  bool _animate = true;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 30), (_) {
      if (dayCycleOn.value) _clockTick.value++;
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _animate = !MediaQuery.disableAnimationsOf(context);
    if (!_animate) {
      _ticker.stop();
    } else if (!_ticker.isAnimating) {
      _ticker.repeat();
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    _clock?.cancel();
    _clockTick.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return ValueListenableBuilder<bool>(
      valueListenable: dayCycleOn,
      builder: (context, cycle, _) => RepaintBoundary(
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (!cycle)
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: dark
                        ? const [
                            Color(0xFF121212),
                            Color(0xFF181818),
                            Color(0xFF1F1F1F),
                          ]
                        : const [
                            Color(0xFFD6E9FF),
                            Color(0xFFEAF4FF),
                            Color(0xFFF8FAFC),
                          ],
                    stops: const [0, .5, 1],
                  ),
                ),
              ),
            CustomPaint(
              painter: SkyPainter(
                dark: dark,
                animate: _animate,
                cycle: cycle,
                repaint: Listenable.merge([_ticker, _clockTick]),
              ),
            ),
            RepaintBoundary(
              child: CustomPaint(
                painter: LandPainter(
                  dark: dark,
                  cycle: cycle,
                  repaint: _clockTick,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

double _now() => DateTime.now().millisecondsSinceEpoch / 1000.0;

class _Star {
  final Offset at; // fraction of the screen
  final double size, speed, phase;
  final bool sparkle;
  final Color color;
  const _Star(
    this.at,
    this.size,
    this.speed,
    this.phase,
    this.sparkle,
    this.color,
  );
}

/// Constellation figures in screen fractions: points, then the lines joining them (by index).
const _dipper = [
  Offset(.07, .17),
  Offset(.15, .155),
  Offset(.22, .17),
  Offset(.28, .2),
  Offset(.30, .26),
  Offset(.39, .265),
  Offset(.40, .205),
];
const _dipperLines = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 3],
];
const _cassiopeia = [
  Offset(.58, .33),
  Offset(.64, .38),
  Offset(.70, .345),
  Offset(.76, .39),
  Offset(.82, .34),
];
const _cassiopeiaLines = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
];

final List<_Star> _stars = () {
  final random = math.Random(2026);
  const tints = [Colors.white, Color(0xFFFFF4E0), Color(0xFFE8F1FF)];
  return [
    for (var i = 0; i < 110; i++)
      _Star(
        Offset(random.nextDouble(), random.nextDouble() * .7),
        .45 + random.nextDouble() * 1.05,
        .6 + random.nextDouble() * 1.6,
        random.nextDouble() * math.pi * 2,
        i % 14 == 0,
        tints[i % 3],
      ),
  ];
}();

class SkyPainter extends CustomPainter {
  final bool dark, animate, cycle;
  SkyPainter({
    required this.dark,
    required this.animate,
    this.cycle = false,
    super.repaint,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final t = animate ? _now() : 0.0;
    if (cycle) {
      _cycle(canvas, size, t);
    } else if (dark) {
      _night(canvas, size, t);
      _moon(canvas, Offset(size.width * .83, size.height * .1));
    } else {
      _day(canvas, size, t);
    }
  }

  /// Draws [draw] at [opacity]: directly when fully shown, through a layer while fading, not at all when gone.
  void _faded(Canvas canvas, Size size, double opacity, VoidCallback draw) {
    if (opacity <= .01) return;
    if (opacity >= .99) return draw();
    canvas.saveLayer(
      Offset.zero & size,
      Paint()..color = Colors.white.withValues(alpha: opacity),
    );
    draw();
    canvas.restore();
  }

  // ---------------------------------------------------------------- day / night cycle
  void _cycle(Canvas canvas, Size size, double t) {
    final look = skyAt(campusHour());
    // The web's sky colours, washed toward the page colour of the current theme so headings on the sky stay readable.
    final wash = dark ? const Color(0xFF141414) : const Color(0xFFF4F8FF);
    final amount = dark ? .78 : .52;   // night stays close to the app's dark greys
    Color soft(Color c) => Color.lerp(c, wash, amount)!;
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [soft(look.top), soft(look.mid), soft(look.bottom)],
          stops: const [0, .45, 1],
        ).createShader(rect),
    );
    // The glow low on the horizon at dawn and dusk.
    final glowRect = Rect.fromLTWH(
      0,
      size.height * .45,
      size.width,
      size.height * .55,
    );
    canvas.drawRect(
      glowRect,
      Paint()
        ..shader = RadialGradient(
          center: Alignment.bottomCenter,
          radius: 1.2,
          colors: [
            look.glow.withValues(alpha: look.glow.a * (1 - amount * .5)),
            look.glow.withValues(alpha: 0),
          ],
        ).createShader(glowRect),
    );

    _faded(
      canvas,
      size,
      look.stars * (dark ? 1 : .7),
      () => _night(canvas, size, look.stars > .6 ? t : 0),
    );
    Offset at(Arc arc) => Offset(size.width * arc.x, size.height * arc.y);
    _faded(canvas, size, look.moonOpacity, () => _moon(canvas, at(look.moon)));
    _faded(
      canvas,
      size,
      look.sunOpacity,
      () => _sun(canvas, at(look.sun), t, look.sun.elevation),
    );
    _faded(
      canvas,
      size,
      look.clouds * (dark ? .35 : 1),
      () => _clouds(canvas, size, t),
    );
  }

  void _sun(Canvas canvas, Offset sun, double t, double elevation) {
    // Pale gold high up, soft peach near the horizon, as on the web.
    final warmth = (1.15 - elevation * 1.9).clamp(0.0, 1.0);
    final core = Color.lerp(
      const Color(0xFFFFFDF2),
      const Color(0xFFFFE5C2),
      warmth,
    )!;
    final mid = Color.lerp(
      const Color(0xFFFDE68A),
      const Color(0xFFFFBE84),
      warmth,
    )!;
    final edge = Color.lerp(
      const Color(0xFFFBBF24),
      const Color(0xFFFF9B62),
      warmth,
    )!;
    canvas.drawCircle(
      sun,
      110,
      Paint()
        ..shader = RadialGradient(
          colors: [mid.withValues(alpha: .3), mid.withValues(alpha: 0)],
        ).createShader(Rect.fromCircle(center: sun, radius: 110)),
    );
    final rays = Paint()
      ..color = edge.withValues(alpha: .14)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 12; i++) {
      final angle = i * math.pi / 6 + t * .05;
      final direction = Offset(math.cos(angle), math.sin(angle));
      canvas.drawLine(
        sun + direction * 26,
        sun + direction * (i.isEven ? 42 : 35),
        rays,
      );
    }
    canvas.drawCircle(
      sun,
      18,
      Paint()
        ..shader = RadialGradient(
          colors: [core, mid, edge],
          stops: const [0, .7, 1],
        ).createShader(Rect.fromCircle(center: sun, radius: 18)),
    );
  }

  // ---------------------------------------------------------------- day
  void _day(Canvas canvas, Size size, double t) {
    // Tucked into the top corner, small and soft, so it never sits behind the header's buttons as a bright disc.
    final sun = Offset(size.width * .93, size.height * .028);
    canvas.drawCircle(
      sun,
      130,
      Paint()
        ..shader = const RadialGradient(
          colors: [Color(0x40FDE68A), Color(0x00FDE68A)],
        ).createShader(Rect.fromCircle(center: sun, radius: 130)),
    );
    // Soft rays turning very slowly.
    final rays = Paint()
      ..color = const Color(0xFFFCD34D).withValues(alpha: .12)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 12; i++) {
      final angle = i * math.pi / 6 + t * .05;
      final direction = Offset(math.cos(angle), math.sin(angle));
      canvas.drawLine(
        sun + direction * 28,
        sun + direction * (i.isEven ? 46 : 38),
        rays,
      );
    }
    canvas.drawCircle(
      sun,
      20,
      Paint()
        ..shader = const RadialGradient(
          colors: [Color(0xFFFFFBEB), Color(0xFFFDE68A), Color(0xFFFBBF24)],
          stops: [0, .7, 1],
        ).createShader(Rect.fromCircle(center: sun, radius: 20)),
    );

    _clouds(canvas, size, t);
  }

  void _clouds(Canvas canvas, Size size, double t) {
    // A few soft clouds drift at different speeds and wrap around. (No birds: beside headings their strokes read as stray marks.)
    for (final (y, scale, speed, offset) in const [
      (.06, .8, 5.0, .1),
      (.17, .6, 3.4, .6),
      (.27, .5, 2.4, .3),
    ]) {
      final span = size.width + 220 * scale;
      final x = (offset * span + t * speed) % span - 110 * scale;
      _cloud(canvas, Offset(x, size.height * y), scale);
    }
  }

  void _cloud(Canvas canvas, Offset at, double scale) {
    final bounds = Rect.fromCenter(
      center: at,
      width: 220 * scale,
      height: 110 * scale,
    );
    canvas.saveLayer(
      bounds,
      Paint()..color = Colors.white.withValues(alpha: .62),
    );
    final shade = Paint()..color = const Color(0xFFCBD5E1);
    final puff = Paint()..color = Colors.white;
    for (final (dx, dy, r) in const [
      (-50.0, 8.0, 24.0),
      (-18.0, -6.0, 32.0),
      (22.0, -2.0, 28.0),
      (52.0, 10.0, 20.0),
    ]) {
      canvas.drawCircle(at + Offset(dx, dy + 5) * scale, r * scale, shade);
    }
    for (final (dx, dy, r) in const [
      (-50.0, 8.0, 24.0),
      (-18.0, -6.0, 32.0),
      (22.0, -2.0, 28.0),
      (52.0, 10.0, 20.0),
    ]) {
      canvas.drawCircle(at + Offset(dx, dy) * scale, r * scale, puff);
    }
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: at + Offset(0, 16) * scale,
          width: 150 * scale,
          height: 26 * scale,
        ),
        Radius.circular(13 * scale),
      ),
      puff,
    );
    canvas.restore();
  }

  // ---------------------------------------------------------------- night
  void _night(Canvas canvas, Size size, double t) {
    // A faint milky way across the sky.
    canvas.save();
    canvas.translate(size.width / 2, size.height * .3);
    canvas.rotate(-.5);
    final band = Rect.fromCenter(
      center: Offset.zero,
      width: size.longestSide * 1.6,
      height: 150,
    );
    canvas.drawRect(
      band,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0x00FFFFFF), Color(0x0FFFFFFF), Color(0x00FFFFFF)],
        ).createShader(band),
    );
    canvas.restore();

    // Stars: each twinkles at its own pace; a few are larger, four-pointed sparkles.
    final paint = Paint();
    for (final star in _stars) {
      final at = Offset(star.at.dx * size.width, star.at.dy * size.height);
      final glow = .5 + .5 * math.sin(t * star.speed + star.phase);
      final alpha =
          (star.sparkle ? .55 : .25) + (star.sparkle ? .4 : .45) * glow;
      paint.color = star.color.withValues(alpha: alpha);
      if (star.sparkle) {
        _sparkle(canvas, at, 2.2 + 1.6 * glow, alpha, star.color);
      } else {
        canvas.drawCircle(at, star.size, paint);
      }
    }

    // Constellations: thin, softly pulsing lines between brighter stars.
    for (final (points, lines) in [
      (_dipper, _dipperLines),
      (_cassiopeia, _cassiopeiaLines),
    ]) {
      final pulse = .14 + .06 * math.sin(t * .8);
      final line = Paint()
        ..color = const Color(0xFFDBEAFE).withValues(alpha: pulse)
        ..strokeWidth = .8;
      Offset p(int i) =>
          Offset(points[i].dx * size.width, points[i].dy * size.height);
      for (final pair in lines) {
        canvas.drawLine(p(pair[0]), p(pair[1]), line);
      }
      for (var i = 0; i < points.length; i++) {
        canvas.drawCircle(
          p(i),
          3.2,
          Paint()..color = Colors.white.withValues(alpha: .1),
        );
        canvas.drawCircle(
          p(i),
          1.5,
          Paint()..color = Colors.white.withValues(alpha: .85),
        );
      }
    }

    // A few planets, floating very slightly.
    final bob = math.sin(t * .5) * 2;
    _planet(
      canvas,
      Offset(size.width * .12, size.height * .46 + bob),
      9,
      const Color(0xFFDDD6FE),
      const Color(0xFF7C3AED),
      ring: true,
    );
    _planet(
      canvas,
      Offset(size.width * .9, size.height * .5 - bob),
      5.5,
      const Color(0xFFBFDBFE),
      const Color(0xFF2563EB),
    );
    _planet(
      canvas,
      Offset(size.width * .52, size.height * .24 + bob * .5),
      3.5,
      const Color(0xFFFECACA),
      const Color(0xFFDC2626),
    );

    // Shooting stars: two independent schedules; each streak lasts a second of its 7 or 11 second cycle.
    if (animate) {
      for (final (period, seed) in const [(7.0, 11), (11.0, 29)]) {
        final cycle = (t / period).floor();
        final progress = (t % period) / 1.0;
        if (progress > 1) continue;
        final random = math.Random(cycle * 97 + seed);
        final start = Offset(
          size.width * (.15 + random.nextDouble() * .7),
          size.height * (.04 + random.nextDouble() * .3),
        );
        final left = random.nextBool();
        final direction = Offset(left ? -1 : 1, .55) / Offset(1, .55).distance;
        final length = 90 + random.nextDouble() * 60;
        final head =
            start +
            direction * (length * 1.6 * Curves.easeOut.transform(progress));
        final tail =
            head -
            direction * length * math.sin(progress * math.pi).clamp(.15, 1.0);
        final fade = 1 - progress;
        canvas.drawLine(
          tail,
          head,
          Paint()
            ..shader = LinearGradient(
              colors: [
                Colors.white.withValues(alpha: 0),
                Colors.white.withValues(alpha: .9 * fade),
              ],
            ).createShader(Rect.fromPoints(tail, head))
            ..strokeWidth = 1.6
            ..strokeCap = StrokeCap.round,
        );
        canvas.drawCircle(
          head,
          1.8,
          Paint()..color = Colors.white.withValues(alpha: fade),
        );
      }
    }
  }

  void _sparkle(
    Canvas canvas,
    Offset at,
    double arm,
    double alpha,
    Color color,
  ) {
    canvas.drawCircle(
      at,
      arm * 1.6,
      Paint()..color = color.withValues(alpha: alpha * .12),
    );
    final path = Path()
      ..moveTo(at.dx, at.dy - arm * 2)
      ..quadraticBezierTo(at.dx, at.dy, at.dx + arm * 2, at.dy)
      ..quadraticBezierTo(at.dx, at.dy, at.dx, at.dy + arm * 2)
      ..quadraticBezierTo(at.dx, at.dy, at.dx - arm * 2, at.dy)
      ..quadraticBezierTo(at.dx, at.dy, at.dx, at.dy - arm * 2)
      ..close();
    canvas.drawPath(path, Paint()..color = color.withValues(alpha: alpha));
  }

  void _moon(Canvas canvas, Offset at) {
    canvas.drawCircle(
      at,
      90,
      Paint()
        ..shader = const RadialGradient(
          colors: [Color(0x26FFFFFF), Color(0x00FFFFFF)],
        ).createShader(Rect.fromCircle(center: at, radius: 90)),
    );
    final disc = Rect.fromCircle(center: at, radius: 22);
    canvas.saveLayer(disc.inflate(2), Paint());
    canvas.drawCircle(
      at,
      22,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(-.4, -.3),
          colors: [Color(0xFFFFFDF5), Color(0xFFE7E5E4)],
        ).createShader(disc),
    );
    canvas.drawCircle(
      at + const Offset(9, -6),
      19,
      Paint()..blendMode = BlendMode.dstOut,
    ); // the crescent's shadow side
    canvas.restore();
  }

  void _planet(
    Canvas canvas,
    Offset at,
    double radius,
    Color light,
    Color deep, {
    bool ring = false,
  }) {
    final ringRect = Rect.fromCenter(
      center: at,
      width: radius * 4.2,
      height: radius * 1.2,
    );
    final ringPaint = Paint()
      ..color = light.withValues(alpha: .55)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.3;
    canvas.save();
    canvas.translate(at.dx, at.dy);
    canvas.rotate(-.35);
    canvas.translate(-at.dx, -at.dy);
    if (ring) {
      // the back half, behind the planet
      canvas.drawArc(ringRect, math.pi, math.pi, false, ringPaint);
    }
    canvas.drawCircle(
      at,
      radius * 2.4,
      Paint()..color = deep.withValues(alpha: .1),
    );
    final body = Rect.fromCircle(center: at, radius: radius);
    canvas.drawCircle(
      at,
      radius,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-.45, -.45),
          colors: [light, deep],
        ).createShader(body),
    );
    if (ring) {
      // the front half, across it
      canvas.drawArc(ringRect, 0, math.pi, false, ringPaint);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant SkyPainter old) =>
      old.dark != dark || old.animate != animate || old.cycle != cycle;
}

/// Low hills along the bottom with a few trees at the sides (the middle stays clear behind the content). Never moves, so painted once.
class LandPainter extends CustomPainter {
  final bool dark, cycle;
  LandPainter({required this.dark, this.cycle = false, super.repaint});

  /// The day or night colour; in the Day/Night mode a blend of both by how dark the sky is, so the hills dim with the light.
  late double _night;
  Color _pick(Color day, Color night) => Color.lerp(day, night, _night)!;

  double _backRidge(Size size, double x) =>
      size.height * .8 +
      math.sin(x / size.width * math.pi * 2 + .6) * size.height * .022;
  double _frontRidge(Size size, double x) =>
      size.height * .865 +
      math.sin(x / size.width * math.pi * 1.6 + 2.2) * size.height * .028;

  Path _hill(Size size, double Function(Size, double) ridge) {
    final path = Path()..moveTo(0, size.height);
    for (double x = 0; x <= size.width + 6; x += 6) {
      path.lineTo(x, ridge(size, x));
    }
    return path
      ..lineTo(size.width, size.height)
      ..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    _night = cycle
        // the ground loses its colour a little ahead of the sky, so the hills are dark by the time the theme turns
        ? math.min(1.0, skyAt(campusHour()).darkness * 1.6) : (dark ? 1 : 0);
    final back = _hill(size, _backRidge), front = _hill(size, _frontRidge);
    final top = size.height * .76;
    canvas.drawPath(
      back,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            _pick(const Color(0xB3BBF7D0), const Color(0xFF262626)),
            _pick(const Color(0x80DCFCE7), const Color(0xFF1E1E1E)),
          ],
        ).createShader(Rect.fromLTRB(0, top, size.width, size.height)),
    );
    // Trees stand on the back ridge, at the sides only.
    for (final (fx, pine, scale) in const [
      (.06, true, 1.0),
      (.13, false, .85),
      (.87, false, 1.0),
      (.94, true, .8),
    ]) {
      final x = size.width * fx;
      _tree(canvas, Offset(x, _backRidge(size, x) + 2), pine, scale);
    }
    canvas.drawPath(
      front,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            _pick(const Color(0x9986EFAC), const Color(0xFF2B2B2B)),
            _pick(const Color(0x66BBF7D0), const Color(0xFF202020)),
          ],
        ).createShader(Rect.fromLTRB(0, top, size.width, size.height)),
    );
    // A soft line of light along the front ridge.
    final rim = Path()..moveTo(0, _frontRidge(size, 0));
    for (double x = 0; x <= size.width + 6; x += 6) {
      rim.lineTo(x, _frontRidge(size, x));
    }
    canvas.drawPath(
      rim,
      Paint()
        ..color = _pick(const Color(0xB3F0FDF4), const Color(0x0FFFFFFF))
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );
  }

  void _tree(Canvas canvas, Offset foot, bool pine, double scale) {
    final leaf = _pick(const Color(0xCC16A34A), const Color(0xFF151515));
    final leafDeep = _pick(const Color(0xCC15803D), const Color(0xFF111111));
    final trunk = _pick(const Color(0xB392400E), const Color(0xFF141414));
    final h = 44 * scale;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(
          foot.dx - 2 * scale,
          foot.dy - h * .38,
          4 * scale,
          h * .38,
        ),
        const Radius.circular(1.5),
      ),
      Paint()..color = trunk,
    );
    if (pine) {
      for (var layer = 0; layer < 3; layer++) {
        final base = foot.dy - h * (.3 + layer * .2),
            width = (22 - layer * 5) * scale;
        canvas.drawPath(
          Path()
            ..moveTo(foot.dx - width / 2, base)
            ..lineTo(foot.dx, base - h * .38)
            ..lineTo(foot.dx + width / 2, base)
            ..close(),
          Paint()..color = layer.isEven ? leafDeep : leaf,
        );
      }
    } else {
      for (final (dx, dy, r, deep) in const [
        (-6.0, -.55, 9.0, true),
        (6.0, -.58, 9.5, true),
        (0.0, -.75, 11.0, false),
        (-3.0, -.6, 7.0, false),
      ]) {
        canvas.drawCircle(
          Offset(foot.dx + dx * scale, foot.dy + h * dy),
          r * scale,
          Paint()..color = deep ? leafDeep : leaf,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant LandPainter old) =>
      old.dark != dark || old.cycle != cycle;
}
