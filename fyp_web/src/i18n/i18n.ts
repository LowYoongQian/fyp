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
    student: { portalTitle: 'Student Portal', welcome: 'Welcome back', enrolledCourses: 'Enrolled Courses', attendanceRate: 'Attendance Rate' }
  },
  ms: {
    common: { dashboard: 'Papan Pemuka', timetable: 'Jadual Waktu', attendance: 'Kehadiran', settings: 'Tetapan', logout: 'Log Keluar' },
    student: { portalTitle: 'Portal Pelajar', welcome: 'Selamat kembali', enrolledCourses: 'Kursus Berdaftar', attendanceRate: 'Kadar Kehadiran' }
  },
  zh: {
    common: { dashboard: '仪表板', timetable: '课程表', attendance: '考勤记录', settings: '系统设置', logout: '退出登录' },
    student: { portalTitle: '学生门户', welcome: '欢迎回来', enrolledCourses: '已注册课程', attendanceRate: '出勤率' }
  }
};

// In-Memory dynamic language store
let activeLanguagesList: LanguageItem[] = FALLBACK_LANGUAGES;
let activeTranslationsDict: Record<string, any> = FALLBACK_TRANSLATIONS;

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

/**
 * Get translation string dynamically
 * Usage: t('student.portalTitle', 'ms') -> "Portal Pelajar"
 */
export const t = (keyPath: string, langCode: string = 'en'): string => {
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
