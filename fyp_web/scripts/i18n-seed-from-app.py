"""Seed the web phrase books with translations the mobile app already has for the same English text.

Reads fyp_flutter/lib/i18n/phrases/<code>.dart (single-quoted Dart map entries) and adds every phrase that also appears in the
web's source.json to src/i18n/phrases/<code>.json, never overwriting a web translation. Prints how many were added.
"""
import json
import pathlib
import re
import sys

WEB = pathlib.Path(__file__).resolve().parents[1]
APP = WEB.parent / 'fyp_flutter' / 'lib' / 'i18n' / 'phrases'
PHRASES = WEB / 'src' / 'i18n' / 'phrases'
ENTRY = re.compile(r"'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'", re.S)
ESCAPES = {'n': '\n', 't': '\t'}


def unescape(text: str) -> str:
    return re.sub(r'\\(.)', lambda match: ESCAPES.get(match.group(1), match.group(1)), text)


def app_book(code: str) -> dict:
    path = APP / f'{code}.dart'
    if not path.exists():
        return {}
    return {unescape(english): unescape(local) for english, local in ENTRY.findall(path.read_text(encoding='utf-8'))}


def main(dry: bool) -> None:
    source = json.loads((PHRASES / 'source.json').read_text(encoding='utf-8'))
    for code in ['ms', 'zh', 'ta', 'ja', 'ko', 'ar', 'fr', 'de', 'es', 'hi']:
        target = PHRASES / f'{code}.json'
        web = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {}
        app = app_book(code)
        added = {phrase: app[phrase] for phrase in source if phrase in app and phrase not in web}
        print(f'{code}: app book {len(app)}, adds {len(added)}')
        if not dry and added:
            web.update(added)
            target.write_text(json.dumps(dict(sorted(web.items())), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main('--dry' in sys.argv)
