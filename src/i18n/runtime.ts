import { LOCALES, TRANSLATIONS, type Locale, type TranslationKeys } from '@/i18n/translations';

/**
 * Locale courante accessible **hors React** (helpers de date, libs pures).
 *
 * `I18nProvider` la pose à chaque changement de langue ; les helpers comme
 * `formatDateFr` / `formatRelativeFr` la lisent sans avoir à recevoir la
 * locale en paramètre, donc sans casser leurs appelants. Les composants qui
 * mémorisent (`useMemo`) un résultat de ces helpers doivent ajouter `locale`
 * (depuis `useTranslation()`) à leurs dépendances pour se rafraîchir.
 */
let currentLocale: Locale = 'fr';

/** Tag BCP 47 passé à `Intl` pour chaque langue de l'app. */
export const INTL_LOCALES: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  tr: 'tr-TR',
  pl: 'pl-PL',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.some((l) => l.code === value);
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export function setCurrentLocale(locale: Locale): void {
  currentLocale = locale;
}

/** Locale `Intl` (ex. `fr-FR`) correspondant à la langue courante. */
export function getIntlLocale(): string {
  return INTL_LOCALES[currentLocale];
}

/**
 * Traduction sans hook, pour le code non-React. Même sémantique que `t()` du
 * contexte : fallback français puis clé brute, interpolation `{var}`.
 */
export function translate(
  key: TranslationKeys,
  vars?: Record<string, string | number>,
  locale: Locale = currentLocale,
): string {
  let value = TRANSLATIONS[locale][key] ?? TRANSLATIONS.fr[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }
  }
  return value;
}

/**
 * Pluriel simple : `<base>_one` pour 1, `<base>_other` sinon, puis interpole
 * `{count}`. Volontairement minimal (pas de règles CLDR) : les 8 langues de
 * l'app se contentent de cette distinction pour des compteurs courts.
 */
export function translatePlural(
  base: string,
  count: number,
  vars?: Record<string, string | number>,
  locale: Locale = currentLocale,
): string {
  const key = `${base}_${count === 1 ? 'one' : 'other'}` as TranslationKeys;
  return translate(key, { count, ...vars }, locale);
}
