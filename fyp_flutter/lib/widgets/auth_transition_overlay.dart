import 'dart:async';
import '../i18n/tr.dart';
import 'package:flutter/material.dart';

/// pending: waiting for the server. done: it answered; the tick shows, then the cover fades away.
/// local (sign-out only): the server could not confirm, so the cover says so and waits for Continue.
enum AuthCover { pending, done, local }

/// The full-screen cover while this device signs in or out, as on the web: the logo, "Signing in…" with a sliding
/// bar until the server answers, then a tick ("Signed in" / "Signed out") and a soft fade onto the next screen.
/// Every animation is finite except the bar and glow, which run only while waiting; reduced motion shows still frames.
/// If it is still waiting after [limit], it stops the bar, says so, and offers Back to sign in ([onCancel]).
class AuthTransitionOverlay extends StatefulWidget {
  final bool signingIn;
  final AuthCover state;
  final VoidCallback onDone;
  final VoidCallback? onCancel;
  final Duration limit;
  const AuthTransitionOverlay({
    super.key,
    required this.signingIn,
    required this.state,
    required this.onDone,
    this.onCancel,
    this.limit = const Duration(seconds: 10),
  });

  @override
  State<AuthTransitionOverlay> createState() => _AuthTransitionOverlayState();
}

class _AuthTransitionOverlayState extends State<AuthTransitionOverlay> with TickerProviderStateMixin {
  // Fade in (180 ms, like the web).
  late final AnimationController _fade = AnimationController(vsync: this, duration: const Duration(milliseconds: 180));
  // Leaving, on the animation clock: the tick is held for 520 ms, then the cover fades out with a slight zoom (420 ms).
  late final AnimationController _leaveRun = AnimationController(vsync: this, duration: const Duration(milliseconds: 940));
  static const _hold = Interval(520 / 940, 1, curve: Curves.easeInOutCubic);
  // The sliding bar and the breathing glow while waiting.
  late final AnimationController _wait = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));
  bool _still = false;
  Timer? _watchdog;
  bool _slow = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _still = MediaQuery.disableAnimationsOf(context);
    if (_fade.status == AnimationStatus.dismissed) {
      _still ? _fade.value = 1 : _fade.forward();
    }
    _syncWatchdog();
    _syncWait();
  }

  @override
  void didUpdateWidget(AuthTransitionOverlay old) {
    super.didUpdateWidget(old);
    _syncWatchdog();
    _syncWait();
    if (widget.state == AuthCover.done && old.state != AuthCover.done) _leave();
  }

  /// Runs only while waiting: a new wait starts a fresh limit; an answer cancels it.
  void _syncWatchdog() {
    if (widget.state == AuthCover.pending && widget.onCancel != null) {
      _watchdog ??= Timer(widget.limit, () {
        if (!mounted) return;
        setState(() => _slow = true);
        _syncWait();
      });
    } else {
      _watchdog?.cancel();
      _watchdog = null;
      _slow = false;
    }
  }

  void _syncWait() {
    if (widget.state == AuthCover.pending && !_still && !_slow) {
      if (!_wait.isAnimating) _wait.repeat();
    } else {
      _wait.stop();
    }
  }

  Future<void> _leave() async {
    _fade.value = 1;
    // With reduced motion: the tick for a moment, then the cover is simply gone.
    if (_still) _leaveRun.duration = const Duration(milliseconds: 250);
    await _leaveRun.forward();
    if (mounted) widget.onDone();
  }

  @override
  void dispose() {
    _watchdog?.cancel();
    _fade.dispose();
    _leaveRun.dispose();
    _wait.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final pending = widget.state == AuthCover.pending;
    final local = widget.state == AuthCover.local;
    final slow = pending && _slow;
    final title = slow
        ? 'Taking longer than expected'
        : pending
        ? (widget.signingIn ? 'Signing in…' : 'Signing out…')
        : widget.signingIn
        ? 'Signed in'
        : local
        ? 'Signed out on this device'
        : 'Signed out';
    final ink = dark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A);
    return AnimatedBuilder(
      animation: Listenable.merge([_fade, _leaveRun]),
      builder: (context, child) {
        final out = _still ? (_leaveRun.value >= 1 ? 1.0 : 0.0) : _hold.transform(_leaveRun.value);
        // Leaving: a slight zoom as it fades, like the web cover.
        return Opacity(
          opacity: (_fade.value * (1 - out)).clamp(0.0, 1.0),
          child: Transform.scale(scale: 1 + .03 * out, child: child),
        );
      },
      child: Material(
        color: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: dark ? const [Color(0xFF0F172A), Color(0xFF0B1220)] : const [Colors.white, Color(0xFFEEF4FF)],
            ),
          ),
          alignment: Alignment.center,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // A soft blue glow behind the logo that breathes while waiting.
              AnimatedBuilder(
                animation: _wait,
                builder: (context, _) {
                  final breath = pending && !_still ? (1 - (2 * _wait.value - 1).abs()) : 0.0;
                  return Container(
                    width: 300 + 24 * breath,
                    height: 300 + 24 * breath,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          const Color(0xFF3B82F6).withValues(alpha: .16 + .06 * breath),
                          const Color(0x003B82F6),
                        ],
                        stops: const [0, .65],
                      ),
                    ),
                  );
                },
              ),
              Semantics(
                liveRegion: true,
                label: tr(title),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 300),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Image.asset('assets/images/sas_mark.png', height: 88, fit: BoxFit.contain),
                        const SizedBox(height: 18),
                        AnimatedSwitcher(
                          duration: Duration(milliseconds: _still ? 0 : 240),
                          transitionBuilder: (child, animation) => FadeTransition(
                            opacity: animation,
                            child: ScaleTransition(
                              scale: Tween(begin: .92, end: 1.0).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutBack)),
                              child: child,
                            ),
                          ),
                          child: Row(
                            key: ValueKey(title),
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (slow) ...[const Icon(Icons.schedule_rounded, color: Color(0xFFF59E0B), size: 22), const SizedBox(width: 6)],
                              if (!pending) ...[const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 22), const SizedBox(width: 6)],
                              Flexible(
                                child: Text(
                                  tr(title),
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: ink, letterSpacing: -.2),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (local || slow) ...[
                          Text(
                            tr(slow
                                ? (widget.signingIn
                                      ? 'Signing in has not finished after 10 seconds. Go back and try again; what you typed is kept.'
                                      : 'Signing out has not finished after 10 seconds. Go back and you will be signed out on this device.')
                                : 'The server could not confirm it, so this session will end on its own when it expires.'),
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12.5, height: 1.4, color: dark ? const Color(0xFFCBD5E1) : const Color(0xFF475569)),
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                              autofocus: true,
                              onPressed: slow ? widget.onCancel : widget.onDone,
                              icon: Icon(slow ? Icons.arrow_back_rounded : Icons.login_rounded, size: 18),
                              label: Text(tr(slow ? 'Back to sign in' : 'Continue'), style: const TextStyle(fontWeight: FontWeight.w700)),
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFF2563EB),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              ),
                            ),
                          ),
                        ] else
                          _SweepBar(animation: _wait, still: _still || !pending),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The web's thin progress line: a short blue segment sweeping across a pale track; full and calm when done or still.
class _SweepBar extends StatelessWidget {
  final Animation<double> animation;
  final bool still;
  const _SweepBar({required this.animation, required this.still});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: SizedBox(
        width: 144,
        height: 4,
        child: ColoredBox(
          color: const Color(0x242563EB),
          child: AnimatedBuilder(
            animation: animation,
            builder: (context, _) {
              if (still) return Container(color: const Color(0xFF2563EB).withValues(alpha: .5));
              // ease-in-out sweep, 35% wide, from fully off the left edge to fully off the right: with a child 0.35 of the track, the
              // child clears the track at |x| > 1.35 / 0.65 = 2.08, so ±2.1 (±1.6 left part of it showing at the end, as if it stopped).
              final t = Curves.easeInOut.transform(animation.value);
              return FractionallySizedBox(
                widthFactor: .35,
                alignment: Alignment(-2.1 + 4.2 * t, 0),
                child: Container(
                  decoration: BoxDecoration(color: const Color(0xFF2563EB), borderRadius: BorderRadius.circular(99)),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
