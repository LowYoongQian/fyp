// Import the single master language file from workspace root
import languagesData from '../../../languages.json';

export interface LanguageItem {
  code: string;
  name: string;
  native: string;
  country: string;
  countryCode: string;
  flag: string;
  rtl?: boolean;
}

export const getSupportedLanguages = (): LanguageItem[] => {
  return languagesData.supportedLanguages as LanguageItem[];
};

export const getLanguageByCode = (code: string): LanguageItem => {
  const list = getSupportedLanguages();
  return list.find(l => l.code === code) || list[0];
};

/**
 * Get translation string for student, staff, admin, or common keys.
 * Usage: t('student.portalTitle', 'ms') -> "Portal Pelajar"
 */
export const t = (keyPath: string, langCode: string = 'en'): string => {
  const translations = languagesData.translations as Record<string, any>;
  const activeDict = translations[langCode] || translations['en'];

  const keys = keyPath.split('.');
  let current: any = activeDict;

  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      // Fallback to English
      let fallback: any = translations['en'];
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
