import { apiService } from '../services/api';

export interface LanguageItem {
  code: string;
  name: string;
  native: string;
  country: string;
  countryCode: string;
  flag: string;
  rtl?: boolean;
}

// Fallback Language Metadata
const FALLBACK_LANGUAGES: LanguageItem[] = [
  { code: 'en', name: 'English (US)', native: 'English', country: 'United States', countryCode: 'US', flag: '🇺🇸', rtl: false },
  { code: 'ms', name: 'Bahasa Malaysia', native: 'Bahasa Melayu', country: 'Malaysia', countryCode: 'MY', flag: '🇲🇾', rtl: false },
  { code: 'zh', name: '中文 (Simplified)', native: '简体中文', country: 'China', countryCode: 'CN', flag: '🇨🇳', rtl: false },
  { code: 'ta', name: 'தமிழ் (Tamil)', native: 'தமிழ்', country: 'India / Malaysia', countryCode: 'IN', flag: '🇮🇳', rtl: false },
  { code: 'ja', name: '日本語 (Japanese)', native: '日本語', country: 'Japan', countryCode: 'JP', flag: '🇯🇵', rtl: false },
  { code: 'ko', name: '한국어 (Korean)', native: '한국어', country: 'South Korea', countryCode: 'KR', flag: '🇰🇷', rtl: false },
  { code: 'ar', name: 'العربية (Arabic)', native: 'العربية', country: 'Saudi Arabia', countryCode: 'SA', flag: '🇸🇦', rtl: true },
  { code: 'fr', name: 'Français (French)', native: 'Français', country: 'France', countryCode: 'FR', flag: '🇫🇷', rtl: false },
  { code: 'de', name: 'Deutsch (German)', native: 'Deutsch', country: 'Germany', countryCode: 'DE', flag: '🇩🇪', rtl: false },
  { code: 'es', name: 'Español (Spanish)', native: 'Español', country: 'Spain', countryCode: 'ES', flag: '🇪🇸', rtl: false },
  { code: 'hi', name: 'हिन्दी (Hindi)', native: 'हिन्दी', country: 'India', countryCode: 'IN', flag: '🇮🇳', rtl: false }
];

// Fallback Basic Translations
const FALLBACK_TRANSLATIONS: Record<string, any> = {
  en: {
    common: { dashboard: 'Dashboard', timetable: 'Timetable', attendance: 'Attendance', settings: 'Settings', logout: 'Sign Out' },
    student: { portalTitle: 'Student Portal', welcome: 'Welcome back', enrolledCourses: 'Enrolled Courses', attendanceRate: 'Attendance Rate' },
    staff: { portalTitle: 'Staff Portal' },
    admin: { portalTitle: 'Admin Portal' }
  },
  ms: {
    common: { dashboard: 'Papan Pemuka', timetable: 'Jadual Waktu', attendance: 'Kehadiran', settings: 'Tetapan', logout: 'Log Keluar' },
    student: { portalTitle: 'Portal Pelajar', welcome: 'Selamat kembali', enrolledCourses: 'Kursus Berdaftar', attendanceRate: 'Kadar Kehadiran' },
    staff: { portalTitle: 'Portal Staf' },
    admin: { portalTitle: 'Portal Pentadbir' }
  },
  zh: {
    common: { dashboard: '仪表板', timetable: '课程表', attendance: '考勤记录', settings: '系统设置', logout: '退出登录' },
    student: { portalTitle: '学生门户', welcome: '欢迎回来', enrolledCourses: '已注册课程', attendanceRate: '出勤率' },
    staff: { portalTitle: '教职工门户' },
    admin: { portalTitle: '管理员门户' }
  }
};

// In-Memory dynamic language store
let activeLanguagesList: LanguageItem[] = FALLBACK_LANGUAGES;
let activeTranslationsDict: Record<string, any> = FALLBACK_TRANSLATIONS;
let activeLanguage = 'en';
const languageListeners = new Set<() => void>();
let pageObserver: MutationObserver | null = null;
let pendingPageTranslation = false;
const originalText = new WeakMap<Text, string>();
const renderedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const appliedAttributes = new WeakMap<Element, Map<string, string>>();

// Try loading from local storage cache initially
try {
  const cachedLangs = localStorage.getItem('cached_system_languages');
  if (cachedLangs) {
    const parsed = JSON.parse(cachedLangs);
    if (parsed.supportedLanguages && Array.isArray(parsed.supportedLanguages)) {
      activeLanguagesList = parsed.supportedLanguages;
    }
    if (parsed.translations && typeof parsed.translations === 'object') {
      activeTranslationsDict = parsed.translations;
    }
  }
} catch (e) {
  console.error("Failed to parse cached languages", e);
}

/**
 * Dynamically fetch latest languages.json from Backend API /api/v1/system/languages
 */
export const fetchSystemLanguages = async (): Promise<void> => {
  try {
    const data = await apiService.fetchSystemLanguages();
    if (data && data.supportedLanguages && Array.isArray(data.supportedLanguages)) {
      activeLanguagesList = data.supportedLanguages;
      activeTranslationsDict = data.translations || FALLBACK_TRANSLATIONS;
      replacementCache = null;
      localStorage.setItem('cached_system_languages', JSON.stringify(data));
      applyPageTranslations();
    }
  } catch (err) {
    console.warn("Could not fetch remote system languages from backend, using local cache/fallback:", err);
  }
};

// Auto-trigger background fetch on module load
fetchSystemLanguages();

export const getSupportedLanguages = (): LanguageItem[] => {
  return activeLanguagesList.length > 0 ? activeLanguagesList : FALLBACK_LANGUAGES;
};

export const getLanguageByCode = (code: string): LanguageItem => {
  const list = getSupportedLanguages();
  return list.find(l => l.code === code) || list[0];
};

export const getActiveLanguage = (): string => activeLanguage;

export const subscribeToLanguage = (listener: () => void): (() => void) => {
  languageListeners.add(listener);
  return () => languageListeners.delete(listener);
};

const flattenTranslations = (dictionary: Record<string, any>, prefix = ''): Record<string, string> => {
  const flattened: Record<string, string> = {};
  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      flattened[path] = value;
    } else if (value && typeof value === 'object') {
      Object.assign(flattened, flattenTranslations(value, path));
    }
  }
  return flattened;
};

// Phrase books: the English UI text itself -> its translation, one JSON file per language (src/i18n/phrases/<code>.json, kept complete with
// scripts/i18n-extract.mjs). A phrase with {0}, {1}… stands for text built with values ("Found {0} matching sessions").
const phraseLoaders = import.meta.glob<Record<string, string>>('./phrases/[a-z][a-z].json', { import: 'default' });
const phraseBooks: Record<string, Record<string, string>> = {};
type PhrasePattern = { regex: RegExp; template: string; slots: number[] };
type Replacements = { language: string; exact: Map<string, string>; patterns: PhrasePattern[]; memo: Map<string, string> };
let replacementCache: Replacements | null = null;

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildReplacements = (): Replacements => {
  const exact = new Map<string, string>();
  const patterns: PhrasePattern[] = [];
  if (activeLanguage !== 'en') {
    for (const [source, translated] of Object.entries(phraseBooks[activeLanguage] || {})) {
      if (!translated || translated === source) continue;
      if (!/\{\d+\}/.test(source)) { exact.set(source, translated); continue; }
      const slots: number[] = [];
      const body = source.split(/(\{\d+\})/).map(part => {
        const slot = part.match(/^\{(\d+)\}$/);
        if (!slot) return escapeRegex(part);
        slots.push(Number(slot[1]));
        return '(.+?)';
      }).join('');
      patterns.push({ regex: new RegExp(`^${body}$`, 's'), template: translated, slots });
    }
    // The keyed catalogue from languages.json (used through t()) also translates its English wording where it appears as plain text.
    const english = flattenTranslations(activeTranslationsDict.en || FALLBACK_TRANSLATIONS.en);
    const selected = flattenTranslations(activeTranslationsDict[activeLanguage] || {});
    for (const [key, source] of Object.entries(english)) {
      const translated = selected[key];
      if (translated && translated !== source) exact.set(source, translated);
    }
    patterns.sort((a, b) => b.regex.source.length - a.regex.source.length);   // the most specific wording wins
  }
  return { language: activeLanguage, exact, patterns, memo: new Map() };
};

const replacements = (): Replacements =>
  replacementCache?.language === activeLanguage ? replacementCache : (replacementCache = buildReplacements());

/** The text in the active language: a known phrase or pattern is replaced; names, codes, numbers and server data stay as they are. */
export const translateText = (value: string): string => {
  if (activeLanguage === 'en') return value;
  const source = value.replace(/\s+/g, ' ').trim();
  if (!source || !/\p{L}/u.test(source)) return value;
  const table = replacements();
  let translated = table.exact.get(source) ?? table.memo.get(source);
  if (translated === undefined) {
    translated = source;
    for (const pattern of table.patterns) {
      const match = pattern.regex.exec(source);
      if (!match) continue;
      translated = pattern.template.replace(/\{(\d+)\}/g, (slot, number) => {
        const index = pattern.slots.indexOf(Number(number));
        return index >= 0 ? translateText(match[index + 1]) : slot;
      });
      break;
    }
    if (table.memo.size > 5000) table.memo.clear();
    table.memo.set(source, translated);
  }
  return translated === source ? value : value.replace(value.trim(), translated);
};

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);
const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];

const translateTextNode = (textNode: Text) => {
  const parent = textNode.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest('[data-no-translate]')) return;
  const current = textNode.nodeValue ?? '';
  // React may reuse a text node for new data (file names, status, counts).
  // Only restore an old source when the node still contains our translation.
  const source = current === renderedText.get(textNode) ? originalText.get(textNode) ?? current : current;
  originalText.set(textNode, source);
  const translated = translateText(source);
  renderedText.set(textNode, translated);
  if (textNode.nodeValue !== translated) textNode.nodeValue = translated;
};

const translateAttributes = (element: Element) => {
  if (element.closest('[data-no-translate]')) return;
  let attributes = originalAttributes.get(element);
  let lastAppliedAttributes = appliedAttributes.get(element);
  if (!attributes) { attributes = new Map(); originalAttributes.set(element, attributes); }
  if (!lastAppliedAttributes) { lastAppliedAttributes = new Map(); appliedAttributes.set(element, lastAppliedAttributes); }
  for (const attribute of ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    const lastApplied = lastAppliedAttributes.get(attribute);
    if (!attributes.has(attribute) || (lastApplied !== undefined && current !== lastApplied)) attributes.set(attribute, current);
    const source = attributes.get(attribute) ?? current;
    const translated = translateText(source);
    if (current !== translated) element.setAttribute(attribute, translated);
    lastAppliedAttributes.set(attribute, translated);
  }
};

const translateTree = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) { translateTextNode(root as Text); return; }
  if (!(root instanceof Element)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) translateTextNode(node as Text);
  translateAttributes(root);
  root.querySelectorAll(ATTRIBUTES.map(name => `[${name}]`).join(',')).forEach(translateAttributes);
};

/**
 * Applies the active language to everything on the page (text and the placeholder, title, aria-label and alt attributes).
 * Keeping the original English text lets a user switch language repeatedly without needing a page reload.
 */
export const applyPageTranslations = (): void => {
  if (typeof document === 'undefined' || !document.body) return;
  translateTree(document.body);
};

// Only what changed is translated again: new nodes, edited text and edited attributes, batched once per microtask.
const changedTrees = new Set<Node>(), changedTexts = new Set<Text>(), changedAttributes = new Set<Element>();
const onPageMutations = (records: MutationRecord[]) => {
  for (const record of records) {
    if (record.type === 'childList') record.addedNodes.forEach(node => changedTrees.add(node));
    else if (record.type === 'characterData') changedTexts.add(record.target as Text);
    else if (record.target instanceof Element) changedAttributes.add(record.target);
  }
  if (pendingPageTranslation) return;
  pendingPageTranslation = true;
  queueMicrotask(() => {
    pendingPageTranslation = false;
    const trees = [...changedTrees], texts = [...changedTexts], elements = [...changedAttributes];
    changedTrees.clear(); changedTexts.clear(); changedAttributes.clear();
    trees.forEach(node => { if (node.isConnected) translateTree(node); });
    texts.forEach(node => { if (node.isConnected) translateTextNode(node); });
    elements.forEach(element => { if (element.isConnected) translateAttributes(element); });
  });
};

export const setActiveLanguage = (languageCode?: string): void => {
  const normalizedCode = languageCode === 'zh_CN' || languageCode === 'zh_TW' ? 'zh' : languageCode;
  const language = getLanguageByCode(normalizedCode || 'en');
  activeLanguage = language.code;
  replacementCache = null;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = activeLanguage;
    document.documentElement.dir = language.rtl ? 'rtl' : 'ltr';
    applyPageTranslations();
    if (!pageObserver && document.body) {
      pageObserver = new MutationObserver(onPageMutations);
      pageObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
    }
    // Each language's phrase book is its own file, loaded the first time that language is chosen.
    const code = activeLanguage, load = phraseLoaders[`./phrases/${code}.json`];
    if (code !== 'en' && !phraseBooks[code] && load) {
      load().then(book => {
        phraseBooks[code] = book;
        if (activeLanguage === code) { replacementCache = null; applyPageTranslations(); languageListeners.forEach(listener => listener()); }
      }).catch(error => console.warn(`The ${code} phrase book could not be loaded`, error));
    }
  }
  languageListeners.forEach(listener => listener());
};

/**
 * Get translation string dynamically
 * Usage: t('student.portalTitle', 'ms') -> "Portal Pelajar"
 */
export const t = (keyPath: string, langCode: string = activeLanguage): string => {
  const activeDict = activeTranslationsDict[langCode] || activeTranslationsDict['en'] || FALLBACK_TRANSLATIONS['en'];

  const keys = keyPath.split('.');
  let current: any = activeDict;

  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      let fallback: any = (activeTranslationsDict['en'] || FALLBACK_TRANSLATIONS['en']);
      for (const fk of keys) {
        if (fallback && typeof fallback === 'object' && fk in fallback) {
          fallback = fallback[fk];
        } else {
          return keyPath;
        }
      }
      return typeof fallback === 'string' ? fallback : keyPath;
    }
  }

  return typeof current === 'string' ? current : keyPath;
};
