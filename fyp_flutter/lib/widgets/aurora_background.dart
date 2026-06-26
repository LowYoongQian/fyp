// ignore_for_file: deprecated_member_use
import 'dart:math' as math;
import 'package:flutter/material.dart';

// -----------------------------------------------------------------
// BACKGROUND WIDGET: Animated Shifting Gradient & Dynamic Ocean Waves
// -----------------------------------------------------------------
class AuroraBackground extends StatefulWidget {
  const AuroraBackground({super.key});

  @override
  State<AuroraBackground> createState() => _AuroraBackgroundState();
}

class Star {
  final int index;
  final double baseSize;
  final double duration;
  final double phase;
  final bool isBright;

  const Star({
    required this.index,
    required this.baseSize,
    required this.duration,
    required this.phase,
    this.isBright = false,
  });
}

class _AuroraBackgroundState extends State<AuroraBackground>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  List<Star>? _stars;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 15),
    )..repeat();
    _generateStars();
  }

  void _generateStars() {
    final rand = math.Random(101); // Seeded for consistency across builds/restarts
    final List<Star> list = [];

    // Generate 60 regular stars
    for (int i = 0; i < 60; i++) {
      list.add(Star(
        index: i,
        baseSize: 0.7 + rand.nextDouble() * 1.0, // sizes between 0.7 and 1.7 logical pixels
        duration: 4.0 + rand.nextDouble() * 4.0, // duration cycle of 4 to 8 seconds
        phase: rand.nextDouble() * 20.0,
        isBright: false,
      ));
    }

    // Generate 2 bright, big stars with a duration of exactly 10 seconds
    for (int i = 60; i < 62; i++) {
      list.add(Star(
        index: i,
        baseSize: 2.8 + rand.nextDouble() * 0.8, // sizes between 2.8 and 3.6 logical pixels
        duration: 10.0, // exactly 10 seconds duration
        phase: rand.nextDouble() * 20.0,
        isBright: true,
      ));
    }

    _stars = list;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final val = _controller.value;

          Color bgColor1;
          Color bgColor2;

          if (isDarkMode) {
            // Dark charcoal/near-black theme palette as requested
            bgColor1 = const Color(0xFF121212);
            bgColor2 = const Color(0xFF1E1E1E);
          } else {
            if (val < 0.25) {
              double t = val / 0.25;
              bgColor1 = Color.lerp(const Color(0xFFEFF6FF), const Color(0xFFECFDF5), t)!;
              bgColor2 = Color.lerp(const Color(0xFFFDF2F8), const Color(0xFFF5F3FF), t)!;
            } else if (val < 0.5) {
              double t = (val - 0.25) / 0.25;
              bgColor1 = Color.lerp(const Color(0xFFECFDF5), const Color(0xFFFDF2F8), t)!;
              bgColor2 = Color.lerp(const Color(0xFFF5F3FF), const Color(0xFFEFF6FF), t)!;
            } else if (val < 0.75) {
              double t = (val - 0.5) / 0.25;
              bgColor1 = Color.lerp(const Color(0xFFFDF2F8), const Color(0xFFF5F3FF), t)!;
              bgColor2 = Color.lerp(const Color(0xFFEFF6FF), const Color(0xFFECFDF5), t)!;
            } else {
              double t = (val - 0.75) / 0.25;
              bgColor1 = Color.lerp(const Color(0xFFF5F3FF), const Color(0xFFEFF6FF), t)!;
              bgColor2 = Color.lerp(const Color(0xFFECFDF5), const Color(0xFFFDF2F8), t)!;
            }
          }

          return Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [bgColor1, bgColor2],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
              if (isDarkMode && _stars != null)
                Positioned.fill(
                  child: CustomPaint(
                    painter: StarPainter(stars: _stars!, animationValue: val),
                  ),
                ),
              Positioned.fill(
                child: CustomPaint(
                  painter: WavePainter(animationValue: val, isDarkMode: isDarkMode),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// -----------------------------------------------------------------
// CUSTOM PAINTER: Smooth Layered Ocean Waves
// -----------------------------------------------------------------
class WavePainter extends CustomPainter {
  final double animationValue;
  final bool isDarkMode;

  WavePainter({required this.animationValue, required this.isDarkMode});

  @override
  void paint(Canvas canvas, Size size) {
    // 1. Back Wave (Navy/Blue - deeper depth)
    _drawWave(
      canvas,
      size,
      baseHeight: size.height * 0.76,
      frequency: 0.005,
      amplitude: 24.0,
      phase: animationValue * 2 * math.pi,
      gradient: LinearGradient(
        colors: isDarkMode
            ? [
                const Color(0xFF1E1E1E).withValues(alpha: 0.15),
                const Color(0xFF121212).withValues(alpha: 0.08),
              ]
            : [
                const Color(0xFF1E3A8A).withValues(alpha: 0.08),
                const Color(0xFF3B82F6).withValues(alpha: 0.04),
              ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    );

    // 2. Middle Wave (Blue/Sky - medium depth)
    _drawWave(
      canvas,
      size,
      baseHeight: size.height * 0.82,
      frequency: 0.008,
      amplitude: 30.0,
      phase: -animationValue * 2 * math.pi * 1.2,
      gradient: LinearGradient(
        colors: isDarkMode
            ? [
                const Color(0xFF2E2E2E).withValues(alpha: 0.1),
                const Color(0xFF1E1E1E).withValues(alpha: 0.05),
              ]
            : [
                const Color(0xFF0284C7).withValues(alpha: 0.12),
                const Color(0xFF0EA5E9).withValues(alpha: 0.06),
              ],
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
      ),
    );

    // 3. Front Wave (Teal/Cyan - surface flow)
    _drawWave(
      canvas,
      size,
      baseHeight: size.height * 0.87,
      frequency: 0.006,
      amplitude: 18.0,
      phase: animationValue * 2 * math.pi * 0.8,
      gradient: LinearGradient(
        colors: isDarkMode
            ? [
                const Color(0xFF334155).withValues(alpha: 0.15),
                const Color(0xFF1E293B).withValues(alpha: 0.08),
              ]
            : [
                const Color(0xFF0D9488).withValues(alpha: 0.15),
                const Color(0xFF14B8A6).withValues(alpha: 0.08),
              ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    );
  }

  void _drawWave(
    Canvas canvas,
    Size size, {
    required double baseHeight,
    required double frequency,
    required double amplitude,
    required double phase,
    required Gradient gradient,
  }) {
    final paint = Paint()
      ..shader = gradient.createShader(Rect.fromLTWH(0, baseHeight - amplitude, size.width, size.height - baseHeight + amplitude))
      ..style = PaintingStyle.fill;

    final path = Path();
    path.moveTo(0, size.height);
    path.lineTo(0, baseHeight);

    // Step across the screen width to draw wave vertices
    for (double x = 0; x <= size.width; x += 8.0) {
      final y = baseHeight + math.sin(x * frequency + phase) * amplitude;
      path.lineTo(x, y);
    }

    path.lineTo(size.width, size.height);
    path.close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant WavePainter oldDelegate) {
    return oldDelegate.animationValue != animationValue || oldDelegate.isDarkMode != isDarkMode;
  }
}

// -----------------------------------------------------------------
// CUSTOM PAINTER: Smooth Twinkling Stars
// -----------------------------------------------------------------
class StarPainter extends CustomPainter {
  final List<Star> stars;
  final double animationValue;

  StarPainter({required this.stars, required this.animationValue});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    
    // Get continuous system time in seconds for non-resetting transitions
    final double time = DateTime.now().millisecondsSinceEpoch / 1000.0;

    for (final star in stars) {
      final totalTime = time + star.phase;
      final int cycle = totalTime ~/ star.duration;
      final double cycleProgress = (totalTime % star.duration) / star.duration;

      // Seed a random generator unique to this star and this cycle
      final int seed = (star.index * 12345 + cycle) & 0x7FFFFFFF;
      final rand = math.Random(seed);

      final double x = rand.nextDouble();
      final double y = rand.nextDouble() * 0.78; // upper 78% of the screen (sky area)

      // Opacity peaks in the middle of the cycle and is exactly 0.0 at cycle boundaries
      final double opacityMultiplier = math.sin(cycleProgress * math.pi);
      
      final double maxOpacity = star.isBright ? 0.90 : 0.45;
      final double minOpacity = star.isBright ? 0.20 : 0.08;
      final double opacity = minOpacity + (maxOpacity - minOpacity) * opacityMultiplier;

      final double dx = x * size.width;
      final double dy = y * size.height;
      final offset = Offset(dx, dy);

      if (star.isBright) {
        // Draw a soft ambient glow behind the bright star
        final glowPaint = Paint()
          ..color = Colors.white.withValues(alpha: opacity * 0.25)
          ..style = PaintingStyle.fill;
        canvas.drawCircle(offset, star.baseSize * 2.5, glowPaint);

        // Draw the core bright star
        paint.color = Colors.white.withValues(alpha: opacity);
        canvas.drawCircle(offset, star.baseSize, paint);

        // Draw a subtle, premium sparkle cross-hair
        final linePaint = Paint()
          ..color = Colors.white.withValues(alpha: opacity * 0.45)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.8;
        
        final double armLength = star.baseSize * 2.2;
        canvas.drawLine(Offset(dx - armLength, dy), Offset(dx + armLength, dy), linePaint);
        canvas.drawLine(Offset(dx, dy - armLength), Offset(dx, dy + armLength), linePaint);
      } else {
        // Draw standard star
        paint.color = Colors.white.withValues(alpha: opacity);
        canvas.drawCircle(offset, star.baseSize, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant StarPainter oldDelegate) {
    return true; // Re-paint on every frame for smooth continuous twinkle animations
  }
}
