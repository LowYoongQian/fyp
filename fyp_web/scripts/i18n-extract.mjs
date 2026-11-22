// Lists every piece of English UI text in src (JSX text, text attributes, human-readable string literals and template strings)
// into src/i18n/phrases/source.json, and reports which phrases each language file still lacks.
// Run: node scripts/i18n-extract.mjs            (writes source.json and prints coverage)
//      node scripts/i18n-extract.mjs --missing ms  (prints the phrases Malay still lacks, one per line)
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const SRC = path.join(ROOT, 'src');
const PHRASES = path.join(SRC, 'i18n', 'phrases');
const LANGUAGES = ['ms', 'zh', 'ta', 'ja', 'ko', 'ar', 'fr', 'de', 'es', 'hi'];
// Attributes that never hold words a person reads.
const TECHNICAL_ATTRS = /^(className|class|id|key|type|name|href|src|to|role|d|fill|stroke|viewBox|xmlns|htmlFor|method|target|rel|autoComplete|inputMode|pattern|accept|form|value|defaultValue|variant|size|tone|mode|kind|status|icon|color|align|side|path|dir|lang|loading|decoding|referrerPolicy|sandbox|allow|dateTime|data-.*|aria-(controls|labelledby|describedby|live|haspopup|current|owns|activedescendant|hidden|expanded|selected|pressed|checked|busy|modal|orientation|sort|autocomplete))$/;
const SKIP_CALLS = /^(console\.\w+|.*\.(getItem|setItem|removeItem|querySelector|querySelectorAll|closest|matches|addEventListener|removeEventListener|getAttribute|setAttribute|hasAttribute|removeAttribute|startsWith|endsWith|includes|split|join|replace|replaceAll|padStart|toLocaleString|toLocaleDateString|toLocaleTimeString|get|post|put|patch|delete|request|fetch|test|match|search|indexOf)|require|import|fetch|matchMedia|RegExp|new RegExp|Intl\.\w+)$/;

const words = text => text.replace(/\s+/g, ' ').trim();
// JSX text keeps entities as written; the page shows the characters.
const ENTITIES = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', ge: '≥', le: '≤', nbsp: ' ', middot: '·', rarr: '→', larr: '←', hellip: '…', mdash: '—', ndash: '–' };
const decodeEntities = text => text.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (entity, name) =>
  name[0] === '#' ? String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))) : ENTITIES[name] ?? entity);
// A class list is made only of utility tokens ("flex items-center gap-2"); a phrase with a hyphenated word ("Signed-in devices") is not.
const UTILITY_WORDS = /^(flex|grid|block|hidden|inline|absolute|relative|fixed|sticky|static|truncate|uppercase|lowercase|capitalize|italic|underline|shrink|grow|transition|transform|filter|group|peer|container|antialiased|rounded|border|shadow|ring|outline|visible|invisible|isolate|contents|table|resize|blur|grayscale|invert|sepia)$/;
const looksLikeClasses = text => {
  const tokens = text.split(' ');
  return tokens.length > 0 && tokens.every(token => UTILITY_WORDS.test(token) || /^!?-?[a-z][a-z0-9]*([-:/[]|$)/.test(token) && /[-:/[\]]/.test(token));
};
export function isHuman(raw) {
  const text = words(raw);
  if (text.length < 2 || !/[A-Za-z]/.test(text)) return false;
  if (/^(https?:|www\.|mailto:|data:|\/|\.\/|\.\.\/|#[0-9a-f]{3,8}$)/i.test(text)) return false;
  if (/[{}=<>`\\]|=>|\$\{/.test(text)) return false;
  if (/^[a-z-]+\s*:\s*[^;]+;/.test(text)) return false;   // CSS declarations ("color: red; …")
  if (looksLikeClasses(text)) return false;
  if (/\b(rgba?|hsla?|linear-gradient|radial-gradient|conic-gradient|var|url|translate[XYZ3d]*|rotate|scale|cubic-bezier|calc|drop-shadow|blur|steps)\(/i.test(text)) return false;
  if (/^[MmLlCcQqZzHhVvSsAaTt\d\s.,-]+$/.test(text)) return false;   // SVG path data
  if (/^(\d+(\.\d+)?(px|rem|em|ms|s|%|deg|vh|vw)?\s*)+$/.test(text)) return false;   // CSS lengths and timings
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(text)) return false;
  if (/^[a-z0-9_.\-/:@+]+$/.test(text)) return false;          // identifiers, keys, paths, kebab-case, single lowercase words
  if (/^[A-Z0-9_]+$/.test(text) && !/^[A-Z]{2,}$/.test(text)) return false;   // CONSTANT_NAMES (keep short acronyms like "IP")
  if (/^[a-z]+[A-Z]\w*$/.test(text)) return false;              // camelCase identifiers
  if (/^\w+(\.\w+)+$/.test(text)) return false;                 // dotted keys such as admin.studentsManager
  if (/^[\d\s:./,-]+(am|pm|AM|PM)?$/.test(text)) return false;  // times and dates
  return /^[A-Z0-9"'(‘“¿¡•·–—]/.test(text) || /\s/.test(text);
}

function calleeName(node) {
  let call = node.parent;
  while (call && (ts.isParenthesizedExpression(call) || ts.isConditionalExpression(call) || ts.isBinaryExpression(call) || ts.isArrayLiteralExpression(call))) call = call.parent;
  if (!call || !(ts.isCallExpression(call) || ts.isNewExpression(call))) return '';
  return call.expression.getText().replace(/\s+/g, '');
}

function collect(file, found) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const add = text => { const clean = words(text); if (isHuman(clean)) found.add(clean); };
  const visit = node => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node)) {
      // JSX text is always on screen, so a lone lowercase word between values ("Showing 1 to 3 of 3") counts here.
      const text = words(decodeEntities(node.getText()));
      if (/^[a-z]{2,}[.,:;]?$/.test(text)) found.add(text); else add(text);
      return;
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText();
      if (TECHNICAL_ATTRS.test(name)) return;
    }
    if (ts.isPropertyAssignment(node) && /^(className|key|id|type|value|path|href|icon|kind|tone|status|code|countryCode|flag|role|method|url|endpoint|storageKey|queryKey)$/.test(node.name.getText())) {
      return;   // technical object fields; their label/description siblings are still visited
    }
    if (ts.isElementAccessExpression(node)) return;
    if (ts.isCaseClause(node)) { node.statements.forEach(visit); return; }
    if (ts.isBinaryExpression(node) && /^(===|!==|==|!=)$/.test(node.operatorToken.getText())) return;
    if (ts.isTypeNode(node) || ts.isLiteralTypeNode(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (ts.isPropertyAssignment(node.parent) && node.parent.name === node) return;   // object keys
      if (SKIP_CALLS.test(calleeName(node))) return;
      add(node.text);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      if (SKIP_CALLS.test(calleeName(node))) return;
      let pattern = node.head.text, index = 0;
      for (const span of node.templateSpans) { pattern += `{${index++}}` + span.literal.text; ts.forEachChild(span.expression, visit); }
      const statics = pattern.replace(/\{\d+\}/g, ' ');
      if (isHuman(statics) && !looksLikeClasses(statics) && /[A-Za-z]{2,}/.test(statics)) found.add(words(pattern));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'phrases' ? [] : files(full);
    return /\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

const found = new Set();
for (const file of files(SRC)) collect(file, found);
// Words that only reach the screen through data the code builds (a filter value shown as its own label), listed by hand.
const extraPath = path.join(PHRASES, 'extra.json');
if (fs.existsSync(extraPath)) for (const phrase of JSON.parse(fs.readFileSync(extraPath, 'utf8'))) found.add(phrase);
// Strings that look like words but are never shown (CSS values, key names), listed once in ignore.json.
const ignorePath = path.join(PHRASES, 'ignore.json');
const ignored = new Set(fs.existsSync(ignorePath) ? JSON.parse(fs.readFileSync(ignorePath, 'utf8')) : []);
const sorted = [...found].filter(phrase => !ignored.has(phrase)).sort((a, b) => a.localeCompare(b, 'en'));
fs.mkdirSync(PHRASES, { recursive: true });
const args = process.argv.slice(2);
if (args[0] === '--missing') {
  const book = fs.existsSync(path.join(PHRASES, `${args[1]}.json`)) ? JSON.parse(fs.readFileSync(path.join(PHRASES, `${args[1]}.json`), 'utf8')) : {};
  for (const phrase of sorted) if (!(phrase in book)) console.log(phrase);
} else {
  fs.writeFileSync(path.join(PHRASES, 'source.json'), JSON.stringify(sorted, null, 1) + '\n');
  console.log(`${sorted.length} phrases`);
  for (const code of LANGUAGES) {
    const file = path.join(PHRASES, `${code}.json`);
    const book = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    const done = sorted.filter(phrase => phrase in book).length;
    console.log(`${code}: ${done}/${sorted.length} (${Math.round(100 * done / sorted.length)}%)`);
  }
}
