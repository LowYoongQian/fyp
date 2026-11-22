"""Merge numbered translations into a phrase book.

Usage: python scripts/i18n-merge.py <code> <snapshot.txt> <batch.txt>
  snapshot.txt: the English phrases, one per line, as printed by `node scripts/i18n-extract.mjs --missing <code>`
  batch.txt:    lines "<number><TAB><translation>"; a translation of "=" marks the phrase as not UI text (added to ignore.json)
A translation may drop {n} slots (a language without plurals) but may not invent ones the English does not have.
"""
import json
import pathlib
import re
import sys

PHRASES = pathlib.Path(__file__).resolve().parents[1] / 'src' / 'i18n' / 'phrases'


def main(code: str, snapshot: str, batch: str) -> None:
    english = pathlib.Path(snapshot).read_text(encoding='utf-8').splitlines()
    book_path, ignore_path = PHRASES / f'{code}.json', PHRASES / 'ignore.json'
    book = json.loads(book_path.read_text(encoding='utf-8')) if book_path.exists() else {}
    ignore = set(json.loads(ignore_path.read_text(encoding='utf-8'))) if ignore_path.exists() else set()
    added = ignored = 0
    for line in pathlib.Path(batch).read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        number, _, translation = line.partition('\t')
        source = english[int(number) - 1]
        translation = translation.strip()
        if translation == '=':
            ignore.add(source); ignored += 1
            continue
        extra = set(re.findall(r'\{\d+\}', translation)) - set(re.findall(r'\{\d+\}', source))
        if extra or not translation:
            raise SystemExit(f'line {number}: "{source}" -> "{translation}" has unknown slots {extra} or is empty')
        book[source] = translation; added += 1
    book_path.write_text(json.dumps(dict(sorted(book.items())), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    ignore_path.write_text(json.dumps(sorted(ignore), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{code}: +{added} translations, +{ignored} ignored, book now {len(book)}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
