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
const originalAttributes = new WeakMap<Element, Map<string, string>>();

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

const getTextReplacementMap = (): Map<string, string> => {
  if (activeLanguage === 'en') return new Map();
  const english = flattenTranslations(activeTranslationsDict.en || FALLBACK_TRANSLATIONS.en);
  const selected = flattenTranslations(activeTranslationsDict[activeLanguage] || {});
  const replacements = new Map<string, string>();
  for (const [key, source] of Object.entries(english)) {
    const translated = selected[key];
    if (translated && translated !== source) replacements.set(source, translated);
  }
  return replacements;
};

const translateValue = (value: string, replacements: Map<string, string>): string => {
  const source = value.trim();
  const translated = replacements.get(source);
  return translated ? value.replace(source, translated) : value;
};

/**
 * Applies the catalogue to rendered labels as well as JSX labels that opt in
 * through `t()`. Keeping the original English text lets a user switch language
 * repeatedly without needing a page reload.
 */
export const applyPageTranslations = (): void => {
  if (typeof document === 'undefined') return;
  const replacements = getTextReplacementMap();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node as Text);

  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE'].includes(parent.tagName)) continue;
    const source = originalText.get(textNode) ?? textNode.nodeValue ?? '';
    originalText.set(textNode, source);
    const translated = translateValue(source, replacements);
    if (textNode.nodeValue !== translated) textNode.nodeValue = translated;
  }

  for (const element of document.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]')) {
    let attributes = originalAttributes.get(element);
    if (!attributes) {
      attributes = new Map();
      originalAttributes.set(element, attributes);
    }
    for (const attribute of ['placeholder', 'title', 'aria-label']) {
      const current = element.getAttribute(attribute);
      if (current === null) continue;
      const source = attributes.get(attribute) ?? current;
      attributes.set(attribute, source);
      const translated = translateValue(source, replacements);
      if (current !== translated) element.setAttribute(attribute, translated);
    }
  }
};

const schedulePageTranslation = () => {
  if (pendingPageTranslation) return;
  pendingPageTranslation = true;
  queueMicrotask(() => {
    pendingPageTranslation = false;
    applyPageTranslations();
  });
};

export const setActiveLanguage = (languageCode?: string): void => {
  const normalizedCode = languageCode === 'zh_CN' || languageCode === 'zh_TW' ? 'zh' : languageCode;
  const language = getLanguageByCode(normalizedCode || 'en');
  activeLanguage = language.code;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = activeLanguage;
    document.documentElement.dir = language.rtl ? 'rtl' : 'ltr';
    applyPageTranslations();
    if (!pageObserver && document.body) {
      pageObserver = new MutationObserver(schedulePageTranslation);
      pageObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
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
