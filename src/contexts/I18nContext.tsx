import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Locale, TranslationKeys } from '@/i18n/translations';
import { isLocale, setCurrentLocale, translate, translatePlural } from '@/i18n/runtime';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKeys, vars?: Record<string, string | number>) => string;
  /**
   * Pluriel : `tp('planning.done', 3)` lit `planning.done_one` / `planning.done_other`
   * et interpole `{count}` (+ `vars` éventuels).
   */
  tp: (base: string, count: number, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = 'app_locale';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');

  // Posée pendant le rendu (idempotent) pour que les helpers hors React
  // (`formatDateFr`…) appelés par les enfants voient déjà la bonne langue.
  setCurrentLocale(locale);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (isLocale(stored)) {
        setLocaleState(stored);
      }
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setCurrentLocale(next);
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKeys, vars?: Record<string, string | number>) => translate(key, vars, locale),
    [locale],
  );

  const tp = useCallback(
    (base: string, count: number, vars?: Record<string, string | number>) =>
      translatePlural(base, count, vars, locale),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t, tp }), [locale, setLocale, t, tp]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
