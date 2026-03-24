"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Preferences } from '@capacitor/preferences';
import ukDict from '../locales/uk.json';

export type Language = 'uk' | 'en' | 'ru' | 'de';
export type TranslationKey = keyof typeof ukDict;

interface TranslationContextType {
  language: Language;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  changeLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

const PREF_KEY = 'app_language';

// Helper to determine plural form correctly for supported languages
function getPluralForm(count: number, language: Language): 'one' | 'few' | 'many' | 'other' {
  if (language === 'uk' || language === 'ru') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'few';
    if (mod10 === 0 || [5, 6, 7, 8, 9].includes(mod10) || [11, 12, 13, 14].includes(mod100)) return 'many';
    return 'other';
  }
  // English and German
  return count === 1 ? 'one' : 'other';
}

const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'uk'; // Fallback for any SSR
  
  try {
    // 1. Synchronously read from localStorage to entirely prevent initial flicker
    const stored = localStorage.getItem(PREF_KEY) as Language;
    if (stored && ['uk', 'en', 'ru', 'de'].includes(stored)) return stored;

    // 2. Fallback to device language matching
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith('uk')) return 'uk';
    if (nav.startsWith('ru')) return 'ru';
    if (nav.startsWith('de')) return 'de';
    // Defaults to English for unsupported device languages, but wait, 
    // maybe we want 'uk' as the absolute default for the choir app if we prefer it.
    // Given the app is Ukrainian-first, let's default to 'uk' unless English is explicitly detected
    if (nav.startsWith('en')) return 'en';
    return 'uk'; 
  } catch (e) {
    return 'uk';
  }
};

export const TranslationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Determine language synchronously to avoid visual flicker
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  
  // Store loaded dictionaries. 'uk' is always loaded synchronously from bundle.
  const [dictionaries, setDictionaries] = useState<Record<Language, Record<string, string>>>({
    uk: ukDict,
    en: {},
    ru: {},
    de: {}
  });
  const [isLoading, setIsLoading] = useState(false);

  // Lazy load specific UI language json files exactly when needed
  const loadDictionary = useCallback(async (lang: Language) => {
    if (lang === 'uk' || Object.keys(dictionaries[lang]).length > 0) return;
    
    setIsLoading(true);
    try {
      let dict;
      switch (lang) {
        case 'en': dict = (await import('../locales/en.json')).default; break;
        case 'ru': dict = (await import('../locales/ru.json')).default; break;
        case 'de': dict = (await import('../locales/de.json')).default; break;
      }
      setDictionaries(prev => ({ ...prev, [lang]: dict }));
    } catch (e) {
      console.error(`[i18n] Failed to load translation chunk for ${lang}`, e);
    } finally {
      setIsLoading(false);
    }
  }, [dictionaries]);

  useEffect(() => {
    // If starting on a non-uk language, we need to load its dictionary now
    loadDictionary(language);

    // Sync from Capacitor Preferences (which is async)
    Preferences.get({ key: PREF_KEY }).then(({ value }) => {
      if (value && ['uk', 'en', 'ru', 'de'].includes(value) && value !== language) {
        setLanguage(value as Language);
        localStorage.setItem(PREF_KEY, value);
        loadDictionary(value as Language);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeLanguage = useCallback(async (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(PREF_KEY, lang);
    await Preferences.set({ key: PREF_KEY, value: lang });
    await loadDictionary(lang);
  }, [loadDictionary]);

  const t = useCallback((key: TranslationKey, variables?: Record<string, string | number>): string => {
    const dict = dictionaries[language] || {};
    let translation: string | undefined;

    // 1. Pluralization support
    if (variables && typeof variables.count === 'number') {
      const form = getPluralForm(variables.count, language);
      translation = dict[`${key}_${form}`] || dict[`${key}_other`] || dict[key as string];
      
      // Fallback to UK for pluralized keys if missing
      if (!translation && language !== 'uk') {
        translation = ukDict[`${key}_${form}` as keyof typeof ukDict] || ukDict[`${key}_other` as keyof typeof ukDict] || ukDict[key];
      }
    }

    // 2. Standard lookup
    if (!translation) {
      translation = dict[key as string];
    }
    
    // 3. Fallback to UK standard lookup for missing translations
    if (!translation && language !== 'uk') {
      translation = ukDict[key];
    }

    // 4. Ultimate fallback to raw key if totally missing
    if (!translation) {
      if (variables && variables.defaultValue !== undefined) {
        return String(variables.defaultValue);
      }
      return `[${key}]`;
    }

    // 5. Replace variables dynamically
    if (variables) {
      return Object.keys(variables).reduce((str, varKey) => {
        const regex = new RegExp(`{{${varKey}}}`, 'g');
        return str.replace(regex, String(variables[varKey]));
      }, translation);
    }

    return translation;
  }, [language, dictionaries]);

  const value = useMemo(() => ({ language, t, changeLanguage, isLoading }), [language, t, changeLanguage, isLoading]);

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
