import 'dart:math' as math;
import 'package:flutter/painting.dart';
import 'package:flutter/foundation.dart';

/// The Day/Night theme mode: the same sky clock as the web sign-in page (fyp_web/src/pages/security/loginLighting.ts),
/// ported value for value, so the phone and the web brighten, warm, fade to night and switch theme at the same minutes.
/// Everything is a pure function of the campus hour (Asia/Kuala_Lumpur, UTC+8, no daylight saving).

/// True while the Day/Night mode is chosen; the background listens to it.
final ValueNotifier<bool> dayCycleOn = ValueNotifier(false);

/// Pins the campus hour for tests and screenshots; null follows the real clock.
@visibleForTesting
double? debugCampusHour;

/// The campus wall-clock hour as a fraction, 0 to 24.
double campusHour([DateTime? now]) {
  if (now == null && debugCampusHour != null) return debugCampusHour!;
  final campus = (now ?? DateTime.now()).toUtc().add(const Duration(hours: 8));
  return campus.hour + campus.minute / 60 + campus.second / 3600 + campus.millisecond / 3600000;
}

double _clamp(double v, [double lo = 0, double hi = 1]) => math.min(hi, math.max(lo, v));
double _lerp(double a, double b, double t) => a + (b - a) * t;

double _along(List<List<double>> curve, double hour) {
  if (hour <= curve.first[0]) return curve.first[1];
  for (var i = 1; i < curve.length; i++) {
    if (hour <= curve[i][0]) {
      final h0 = curve[i - 1][0], v0 = curve[i - 1][1], h1 = curve[i][0], v1 = curve[i][1];
      return _lerp(v0, v1, (hour - h0) / (h1 - h0));
    }
  }
  return curve.last[1];
}

const _sunUp = 5.25, _sunDown = 19.5;
const _sun = [[4.9, 0.0], [5.5, 1.0], [19.0, 1.0], [19.7, 0.0]];
const _moon = [[0.0, 1.0], [4.4, 1.0], [5.3, 0.0], [19.5, 0.0], [20.3, 1.0], [24.0, 1.0]];
const _starCurve = [[0.0, 1.0], [4.2, 1.0], [4.8, .85], [5.25, .5], [5.75, .12], [6.3, 0.0], [19.1, 0.0], [19.3, .3], [19.8, .62], [20.4, .9], [21.2, 1.0], [24.0, 1.0]];
const _cloudCurve = [[4.4, 0.0], [5.4, .9], [6.4, 1.0], [11.75, 1.0], [12.0, 0.0], [12.5, 0.0], [12.75, 1.0], [19.3, 1.0], [19.9, .5], [20.6, 0.0]];

class _Key {
  final double h, glowAlpha, bright;
  final int top, mid, bot, glow, tint;
  const _Key(this.h, this.top, this.mid, this.bot, this.glow, this.glowAlpha, this.bright, this.tint);
}

// Same keyframes as the web: hour, sky top / middle / horizon, horizon glow and its strength, ground brightness and light tint.
const _keys = [
  _Key(0, 0xFF030712, 0xFF0B0F29, 0xFF111827, 0xFF38BDF8, .10, .26, 0xFF9BB2FF),
  _Key(4.2, 0xFF050719, 0xFF0E1133, 0xFF161B3D, 0xFF60A5FA, .14, .26, 0xFF9BB2FF),
  _Key(4.8, 0xFF0B1440, 0xFF1B2766, 0xFF3A4A8F, 0xFF818CF8, .26, .34, 0xFFA9B8F2),
  _Key(5.25, 0xFF1F2A6B, 0xFF5B5AA6, 0xFFC79BC6, 0xFFF4ACC4, .40, .52, 0xFFE8B7D4),
  _Key(5.75, 0xFF3F62AE, 0xFFA9A6D8, 0xFFFFC9A3, 0xFFFFBE8C, .55, .78, 0xFFFFC59A),
  _Key(6.6, 0xFF2F86D0, 0xFF7DBEEA, 0xFFFCDDBF, 0xFFFFE2AA, .55, .93, 0xFFFFE2BE),
  _Key(9.5, 0xFF0284C7, 0xFF38BDF8, 0xFFBAE6FD, 0xFFFEF08A, .45, 1, 0xFFFFF6E0),
  _Key(12, 0xFF0369A1, 0xFF0284C7, 0xFF7DD3FC, 0xFFFFFFFF, .55, 1, 0xFFFFFFFF),
  _Key(16.5, 0xFF0284C7, 0xFF38BDF8, 0xFFFDD6A8, 0xFFFFC88C, .45, .96, 0xFFFFF0D6),
  _Key(17.8, 0xFF2F7FCB, 0xFF8DB4E6, 0xFFFFCFA6, 0xFFFFBE8C, .55, .82, 0xFFFFD2A8),
  _Key(18.7, 0xFF4A5FB0, 0xFFA08FCF, 0xFFFFB694, 0xFFFFAA82, .60, .62, 0xFFFFBE98),
  _Key(19.35, 0xFF3B3F96, 0xFF7C69B6, 0xFFE6A5BA, 0xFFECA0BE, .45, .42, 0xFFF2B0C4),
  _Key(19.85, 0xFF1C2768, 0xFF343F8F, 0xFF6C69AD, 0xFF818CF8, .30, .30, 0xFFB5B8F0),
  _Key(20.5, 0xFF0D1443, 0xFF1A2260, 0xFF333C80, 0xFF6366F1, .22, .27, 0xFF9FB2F8),
  _Key(21.3, 0xFF090D2A, 0xFF161B40, 0xFF202656, 0xFF6366F1, .18, .26, 0xFF9BB2FF),
  _Key(24, 0xFF030712, 0xFF0B0F29, 0xFF111827, 0xFF38BDF8, .10, .26, 0xFF9BB2FF),
];

double _luma(Color c) => .299 * c.r + .587 * c.g + .114 * c.b;

/// Where a sun or moon is on its arc: x and y as fractions of the screen, and elevation 0 (horizon) to 1 (top).
typedef Arc = ({double x, double y, double elevation});

// On the phone the content fills the middle, so both travel a wide, shallow arc across the top band of the sky.
Arc _arc(double progress) {
  final lift = math.sin(progress * math.pi);
  return (x: .08 + progress * .84, y: .2 - lift * .13, elevation: lift);
}

class SkyLook {
  final double hour, stars, clouds, sunOpacity, moonOpacity, bright, darkness;
  final Color top, mid, bottom, glow, tint;
  final Arc sun, moon;
  const SkyLook({
    required this.hour, required this.top, required this.mid, required this.bottom, required this.glow, required this.tint,
    required this.stars, required this.clouds, required this.sun, required this.sunOpacity, required this.moon,
    required this.moonOpacity, required this.bright, required this.darkness,
  });

  /// The app uses its dark theme once the sky is darker than half way (the same rule the web uses).
  bool get isDark => darkness > .5;
}

/// The sky at one campus hour.
SkyLook skyAt(double hourInput) {
  final hour = _clamp(hourInput, 0, 24);
  var i = 1;
  while (i < _keys.length - 1 && hour > _keys[i].h) {
    i++;
  }
  final a = _keys[i - 1], b = _keys[i], t = _clamp((hour - a.h) / (b.h - a.h));
  Color mix(int p, int q) => Color.lerp(Color(p), Color(q), t)!;
  final top = mix(a.top, b.top), mid = mix(a.mid, b.mid), bot = mix(a.bot, b.bot);
  final sunProgress = _clamp((hour - _sunUp) / (_sunDown - _sunUp));
  final moonProgress = _clamp((hour >= _sunDown ? hour - _sunDown : hour + 24 - _sunDown) / (24 - _sunDown + _sunUp));
  return SkyLook(
    hour: hour,
    top: top,
    mid: mid,
    bottom: bot,
    glow: mix(a.glow, b.glow).withValues(alpha: _lerp(a.glowAlpha, b.glowAlpha, t)),
    tint: mix(a.tint, b.tint),
    bright: _lerp(a.bright, b.bright, t),
    stars: _along(_starCurve, hour),
    clouds: _along(_cloudCurve, hour),
    sun: _arc(sunProgress),
    sunOpacity: _along(_sun, hour),
    moon: _arc(moonProgress),
    moonOpacity: _along(_moon, hour),
    darkness: _clamp(1 - (.3 * _luma(top) + .4 * _luma(mid) + .3 * _luma(bot) - .07) / .38),
  );
}

/// The campus hour at which the theme next turns (light to dark, or back), found minute by minute over the coming day.
double nextThemeTurn(double hour) {
  final dark = skyAt(hour).isDark;
  for (var minute = 1; minute <= 24 * 60; minute++) {
    final next = (hour + minute / 60) % 24;
    if (skyAt(next).isDark != dark) return next;
  }
  return hour;
}

/// The part of the day for a campus hour, named as on the web sign-in page.
String partOfDay(double hour) {
  if (hour >= 4.9833 && hour < 7.9833) return 'Early morning';
  if (hour >= 7.9833 && hour < 11.9833) return 'Morning';
  if (hour >= 11.9833 && hour < 12.4833) return 'Noon';
  if (hour >= 12.4833 && hour < 16.9833) return 'Afternoon';
  if (hour >= 16.9833 && hour < 19.9833) return 'Evening';
  if (hour >= 19.9833 && hour < 23.9833) return 'Night';
  return 'Late night';
}

String clockOf(double hour) {
  final minutes = (hour * 60).floor() % (24 * 60);
  return '${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';
}
