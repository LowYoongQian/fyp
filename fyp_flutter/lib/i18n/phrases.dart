import 'phrases/ms.dart';
import 'phrases/zh.dart';
import 'phrases/ta.dart';
import 'phrases/ja.dart';
import 'phrases/ko.dart';
import 'phrases/es.dart';
import 'phrases/fr.dart';
import 'phrases/de.dart';
import 'phrases/ar.dart';

/// Every language the app's own text is translated into, keyed by language code; English is the source.
const Map<String, Map<String, String>> phraseBooks = {
  'ms': msPhrases,
  'zh': zhPhrases,
  'ta': taPhrases,
  'ja': jaPhrases,
  'ko': koPhrases,
  'es': esPhrases,
  'fr': frPhrases,
  'de': dePhrases,
  'ar': arPhrases,
};
