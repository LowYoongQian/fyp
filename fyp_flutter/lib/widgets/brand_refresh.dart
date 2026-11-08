import '../i18n/tr.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// The app's pull-to-refresh, in place of the stock spinner (modelled on the colab project's HygienePullToRefresh).
/// Pulling down reveals the app logo, which fills with the brand colours from top to bottom as the pull grows; a light
/// tap of haptics marks the point where letting go refreshes; while refreshing the logo breathes with a colour wave,
/// then everything springs back. Only a finger drag on the page's own vertical list pulls (not a fling into the top or
/// a sideways list inside it). Reduced motion keeps the logo still. Same use as RefreshIndicator: onRefresh and child.
class BrandRefresh extends StatefulWidget {
  final Future<void> Function() onRefresh;
  final Widget child;
  final double triggerDistance;
  final double headerHeight;
  const BrandRefresh({super.key, required this.onRefresh, required this.child, this.triggerDistance = 96, this.headerHeight = 90});

  @override
  State<BrandRefresh> createState() => _BrandRefreshState();
}

enum _Phase { idle, pulling, armed, refreshing, done }

class _BrandRefreshState extends State<BrandRefresh> with TickerProviderStateMixin {
  double _pull = 0;
  _Phase _phase = _Phase.idle;
  // Created up front, not lazily: a lazy one would first be created in dispose() of a page that was never pulled.
  late final AnimationController _settle;
  late final AnimationController _wave;
  Animation<double>? _settleTo;

  bool get _busy => _phase == _Phase.refreshing || _phase == _Phase.done;
  double get _max => widget.triggerDistance * 1.6;

  @override
  void initState() {
    super.initState();
    _settle = AnimationController(vsync: this);
    _wave = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));
  }

  @override
  void dispose() {
    _settle.dispose();
    _wave.dispose();
    super.dispose();
  }

  void _setPull(double value) {
    final pull = value.clamp(0.0, _max);
    final phase = pull <= 0 ? _Phase.idle : (pull >= widget.triggerDistance ? _Phase.armed : _Phase.pulling);
    if (phase == _Phase.armed && _phase != _Phase.armed) HapticFeedback.mediumImpact();
    setState(() {
      _pull = pull;
      _phase = phase;
    });
  }

  bool _onScroll(ScrollNotification n) {
    if (_busy || n.depth != 0 || n.metrics.axis != Axis.vertical) return false;
    if (n is OverscrollNotification && n.overscroll < 0 && n.dragDetails != null) {
      _settle.stop();
      _setPull(_pull - n.overscroll * .55);   // resistance: the logo comes down a little slower than the finger
    } else if (n is ScrollUpdateNotification && _pull > 0 && (n.scrollDelta ?? 0) > 0) {
      _setPull(_pull - n.scrollDelta!);   // pushing back up closes the pull first
    } else if (n is ScrollEndNotification && _pull > 0) {
      _release();
    }
    return false;
  }

  void _release() {
    if (_phase == _Phase.armed) {
      unawaited(_refresh());
    } else {
      _animateTo(0, const Duration(milliseconds: 300));
    }
  }

  Future<void> _animateTo(double target, Duration duration) {
    _settle.duration = duration;
    _settleTo = Tween(begin: _pull, end: target).animate(CurvedAnimation(parent: _settle, curve: Curves.easeOutCubic));
    void step() {
      if (mounted) setState(() => _pull = _settleTo!.value);
    }
    _settle.addListener(step);
    return _settle.forward(from: 0).whenComplete(() => _settle.removeListener(step));
  }

  Future<void> _refresh() async {
    setState(() => _phase = _Phase.refreshing);
    if (!MediaQuery.disableAnimationsOf(context)) _wave.repeat();
    await _animateTo(widget.headerHeight, const Duration(milliseconds: 260));
    try {
      await widget.onRefresh();
    } catch (_) {
      // The page reports its own load errors; the pull just closes.
    }
    if (!mounted) return;
    _wave.stop();
    setState(() => _phase = _Phase.done);
    await _animateTo(0, const Duration(milliseconds: 420));
    if (mounted) setState(() => _phase = _Phase.idle);
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final progress = (_pull / widget.triggerDistance).clamp(0.0, 1.0);
    final label = switch (_phase) {
      _Phase.armed => 'Release to refresh',
      _Phase.refreshing => 'Refreshing…',
      _Phase.done => 'Up to date',
      _ => 'Pull to refresh',
    };
    return NotificationListener<ScrollNotification>(
      onNotification: _onScroll,
      child: Stack(
        children: [
          if (_pull > .5)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: _pull,
              child: ClipRect(
                child: OverflowBox(
                  minHeight: 0,
                  maxHeight: widget.headerHeight,
                  child: Opacity(
                    opacity: (progress * 1.25).clamp(0.0, 1.0),
                    child: Semantics(
                      liveRegion: true,
                      label: label,
                      excludeSemantics: true,
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Transform.scale(scale: .75 + .25 * progress, child: _logo(progress, dark)),
                        const SizedBox(height: 4),
                        Text(tr(label),
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B),
                                )),
                      ]),
                    ),
                  ),
                ),
              ),
            ),
          Transform.translate(
            offset: Offset(0, _pull),
            // Clamping inside: the page's own bounce would move the content a second time under the pull.
            child: ScrollConfiguration(
              behavior: ScrollConfiguration.of(context).copyWith(physics: const ClampingScrollPhysics(), overscroll: false),
              child: widget.child,
            ),
          ),
        ],
      ),
    );
  }

  Widget _logo(double progress, bool dark) {
    const size = 62.0;   // the emblem has wide empty margins in its picture, so it is drawn larger than it looks
    Widget mark({Color? tint}) => Image.asset(
          'assets/images/sas_mark.png',
          width: size,
          height: size,
          fit: BoxFit.contain,
          color: tint,
          colorBlendMode: tint == null ? null : BlendMode.srcIn,
          errorBuilder: (_, _, _) => Icon(Icons.school_rounded, size: size * .8, color: tint ?? const Color(0xFF2563EB)),
        );
    final filling = _phase == _Phase.refreshing || _phase == _Phase.done ? 1.0 : progress;
    return AnimatedBuilder(
      animation: _wave,
      builder: (context, _) {
        final wave = _wave.value;
        final breathe = _wave.isAnimating ? 1 + .05 * (1 - (2 * wave - 1).abs()) : 1.0;
        return Transform.scale(
          scale: breathe,
          child: SizedBox(
            width: size,
            height: size,
            child: Stack(alignment: Alignment.center, children: [
              if (filling >= .95)
                Container(
                  decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: [
                    BoxShadow(color: const Color(0xFF2563EB).withValues(alpha: dark ? .3 : .2), blurRadius: 16, spreadRadius: 2),
                  ]),
                ),
              // The outline first, then the full-colour logo filling in from the top as the pull grows.
              mark(tint: (dark ? Colors.white : const Color(0xFF2563EB)).withValues(alpha: .16 + .14 * progress)),
              ClipRect(
                clipper: _TopFill(filling),
                // While refreshing, a soft band of light sweeps down across the emblem (its own colours stay visible).
                child: _wave.isAnimating
                    ? ShaderMask(
                        blendMode: BlendMode.srcATop,
                        shaderCallback: (bounds) => LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Colors.white.withValues(alpha: 0), const Color(0xFFBFDBFE).withValues(alpha: .75), Colors.white.withValues(alpha: 0)],
                          stops: [for (final d in [-.18, 0.0, .18]) (wave * 1.4 - .2 + d).clamp(0.0, 1.0)],
                        ).createShader(bounds),
                        child: mark(),
                      )
                    : mark(),
              ),
            ]),
          ),
        );
      },
    );
  }
}

class _TopFill extends CustomClipper<Rect> {
  final double fraction;
  _TopFill(this.fraction);

  @override
  Rect getClip(Size size) => Rect.fromLTWH(0, 0, size.width, size.height * fraction.clamp(0.0, 1.0));

  @override
  bool shouldReclip(_TopFill old) => old.fraction != fraction;
}
