import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'phrases.dart';

/// The app language for [tr]. MainApp sets it from Settings and then rebuilds the whole screen tree, so text
/// translated with [tr] anywhere (widgets, helpers, dialogs) switches at once without restarting the app.
class AppLanguage {
  static String _code = 'en';
  static String get code => _code;
  static set code(String value) => _code = phraseBooks.containsKey(value) || value == 'en' ? value : 'en';

  /// Marks every element below [context] to build again, so text already on screen is translated in place.
  static void rebuildAll(BuildContext context) {
    void mark(Element element) {
      element.markNeedsBuild();
      element.visitChildren(mark);
    }

    (context as Element).visitChildren(mark);
  }
}

/// Translates app text written in English into the chosen language.
///
/// [text] is the English phrase exactly as it appears in the app; changing parts are written as `{name}` and given
/// in [args] (`tr('{n} classes', {'n': 3})`). Anything that is not one of the app's own phrases (names, course
/// codes, server messages, numbers) comes back unchanged, so it is safe to pass any display text through here.
String tr(Object? text, [Map<String, Object?>? args]) {
  if (text == null) return '';
  final english = text is String ? text : text.toString();
  var result = english;
  if (AppLanguage.code != 'en') {
    final book = phraseBooks[AppLanguage.code];
    final found = book?[english] ?? book?[english.trim()];
    if (found != null) {
      result = found;
    } else if (kDebugMode && args != null) {
      debugPrint('No ${AppLanguage.code} translation for "$english"');
    }
  }
  if (args != null) {
    args.forEach((key, value) => result = result.replaceAll('{$key}', '${value ?? ''}'));
  }
  return result;
}

const _shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/// A day and month in the app language's own order: "7 Nov" (English and most), "11月7日" (Chinese, Japanese),
/// "11월 7일" (Korean). With [year]: "7 Nov 2026", "2026年11月7日", "2026년 11월 7일".
String dayMonth(DateTime date, {bool year = false}) {
  final d = date.day, m = date.month, y = date.year;
  switch (AppLanguage.code) {
    case 'zh':
    case 'ja':
      return year ? '$y年$m月$d日' : '$m月$d日';
    case 'ko':
      return year ? '$y년 $m월 $d일' : '$m월 $d일';
    default:
      final month = tr(_shortMonths[m - 1]);
      return year ? '$d $month $y' : '$d $month';
  }
}

/// A span of days, e.g. "2–8 Nov" / "27 Oct – 2 Nov" in English, "11月2日 – 11月8日" in Chinese.
String dayRange(DateTime a, DateTime b) {
  final cjk = const {'zh', 'ja', 'ko'}.contains(AppLanguage.code);
  if (!cjk && a.month == b.month) return '${a.day}–${dayMonth(b)}';
  return '${dayMonth(a)} – ${dayMonth(b)}';
}
