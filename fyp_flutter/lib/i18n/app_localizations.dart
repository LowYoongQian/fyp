import 'package:flutter/widgets.dart';

/// Lightweight runtime localisation backed by the same languages.json served
/// to the web client. It avoids a separate, drifting Flutter translation file.
class AppLocalizations extends InheritedWidget {
  final String languageCode;
  final Map<String, dynamic> translations;

  const AppLocalizations({
    super.key,
    required this.languageCode,
    required this.translations,
    required super.child,
  });

  static AppLocalizations of(BuildContext context) {
    final localizations = context.dependOnInheritedWidgetOfExactType<AppLocalizations>();
    assert(localizations != null, 'AppLocalizations is missing from the widget tree.');
    return localizations!;
  }

  String tr(String keyPath) {
    final selected = _lookup(translations[languageCode], keyPath);
    final english = _lookup(translations['en'], keyPath);
    return selected ?? english ?? keyPath;
  }

  String? _lookup(dynamic dictionary, String keyPath) {
    dynamic current = dictionary;
    for (final key in keyPath.split('.')) {
      if (current is Map<String, dynamic>) {
        current = current[key];
      } else if (current is Map) {
        current = current[key];
      } else {
        return null;
      }
    }
    return current is String ? current : null;
  }

  @override
  bool updateShouldNotify(AppLocalizations oldWidget) =>
      languageCode != oldWidget.languageCode || translations != oldWidget.translations;
}
