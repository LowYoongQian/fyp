import '../i18n/tr.dart';
import 'package:flutter/material.dart';

/// Blue, cyan, white, purple and dark purple blended across "Smart Attendance System", so each word has its own colour.
/// On the white light-theme background a white stretch would vanish, so there white appears only as the shine that crosses the words.
const _wordmarkLight = [Color(0xFF2563EB), Color(0xFF06B6D4), Color(0xFF8B5CF6), Color(0xFF5B21B6)];
const _wordmarkLightStops = [.05, .38, .7, .98];
const _wordmarkDark = [Color(0xFF3B82F6), Color(0xFF22D3EE), Color(0xFFFFFFFF), Color(0xFFA78BFA), Color(0xFF7C3AED)];
const _wordmarkDarkStops = [.04, .3, .5, .72, .98];

/// One opening sequence per launch; the application initializes underneath it. It ends by itself (a tap anywhere ends it sooner).
class StartupIntro extends StatefulWidget {
  final Widget child;
  const StartupIntro({super.key, required this.child});
  @override
  State<StartupIntro> createState() => _StartupIntroState();
}

class _StartupIntroState extends State<StartupIntro>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animation =
      AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 1900),
      )..addStatusListener((status) {
        if (status == AnimationStatus.completed) _finish();
      });
  bool _done = false;
  void _finish() {
    if (!mounted || _done) return;
    _animation.stop();
    setState(() => _done = true);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_done) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _finish());
    } else if (!_animation.isAnimating) {
      _animation.forward();
    }
  }

  @override
  void dispose() {
    _animation.dispose();
    super.dispose();
  }

  Animation<double> _phase(double from, double to, Curve curve) =>
      _animation.drive(CurveTween(curve: Interval(from, to, curve: curve)));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final accent = dark ? _wordmarkDark : _wordmarkLight;
    final stops = dark ? _wordmarkDarkStops : _wordmarkLightStops;
    // Emblem in (0-35 %), words rise in (22-58 %), everything lifts and fades out (80-100 %).
    final emblemIn = _phase(0, .35, Curves.easeOutBack);
    final wordsIn = _phase(.22, .58, Curves.easeOutCubic);
    final leave = _phase(.8, 1, Curves.easeInOut);
    final shine = _phase(.4, .85, Curves.easeInOut);   // a white glint sweeping across the words once
    return Stack(
      children: [
        ExcludeSemantics(
          excluding: !_done,
          child: IgnorePointer(ignoring: !_done, child: widget.child),
        ),
        if (!_done)
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _finish,
              child: FadeTransition(
                opacity: ReverseAnimation(leave),
                child: Material(
                  color: dark ? const Color(0xFF181818) : Colors.white,
                  child: AnimatedBuilder(
                    animation: _animation,
                    builder: (context, _) {
                      final emblem = emblemIn.value;
                      final words = wordsIn.value;
                      return Transform.scale(
                        scale: 1 + .06 * leave.value,
                        child: SafeArea(
                          child: Center(
                            child: SingleChildScrollView(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Opacity(
                                    opacity: emblem.clamp(0.0, 1.0),
                                    child: Transform.scale(
                                      scale: .65 + .35 * emblem,
                                      child: Container(
                                        width: 200,
                                        height: 200,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          boxShadow: [
                                            BoxShadow(
                                              color: dark ? Colors.white.withValues(alpha: .07) : accent[0].withValues(alpha: .14),   // a neutral glow on the dark grey, never a navy halo
                                              blurRadius: 48,
                                              spreadRadius: 4,
                                              offset: const Offset(0, 10),
                                            ),
                                          ],
                                        ),
                                        child: Image.asset(
                                          'assets/images/sas_mark.png',
                                          fit: BoxFit.contain,
                                          excludeFromSemantics: true,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 28),
                                  Opacity(
                                    opacity: words,
                                    child: Transform.translate(
                                      offset: Offset(0, 18 * (1 - words)),
                                      child: Column(
                                        children: [
                                          FittedBox(
                                            fit: BoxFit.scaleDown,
                                            // The shine is painted over the coloured words, so it sits outside the gradient.
                                            child: _Shine(
                                              progress: shine.value,
                                              child: ShaderMask(
                                                blendMode: BlendMode.srcIn,
                                                shaderCallback: (bounds) => LinearGradient(
                                                  colors: accent,
                                                  stops: stops,
                                                ).createShader(bounds),
                                                child: Text(
                                                  tr('Smart Attendance System'),
                                                  maxLines: 1,
                                                  style: theme.textTheme.headlineMedium?.copyWith(
                                                    fontWeight: FontWeight.w800,
                                                    color: Colors.white,
                                                    letterSpacing: .2 + .6 * words,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(height: 10),
                                          Text(
                                            tr('Your classes. Your attendance.'),
                                            textAlign: TextAlign.center,
                                            style: theme.textTheme.bodyLarge?.copyWith(
                                              letterSpacing: 1,
                                              color: dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B),
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
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Paints a narrow white band across its child's own glyphs (srcATop keeps it inside the letters), moving left to right as [progress] goes 0 to 1.
class _Shine extends StatelessWidget {
  final double progress;
  final Widget child;
  const _Shine({required this.progress, required this.child});

  @override
  Widget build(BuildContext context) {
    if (progress <= 0 || progress >= 1) return child;
    final centre = -.3 + 1.6 * progress;
    return ShaderMask(
      blendMode: BlendMode.srcATop,
      shaderCallback: (bounds) => LinearGradient(
        colors: const [Color(0x00FFFFFF), Color(0xF2FFFFFF), Color(0x00FFFFFF)],
        stops: [(centre - .12).clamp(0, 1), centre.clamp(0, 1), (centre + .12).clamp(0, 1)],
      ).createShader(bounds),
      child: child,
    );
  }
}
