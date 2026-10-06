import { describe, expect, it } from '@jest/globals';
import { LOCALES, TRANSLATIONS, type Locale } from './translations';

/**
 * Parité des 8 dictionnaires : mêmes clés, aucune valeur vide, mêmes
 * placeholders `{var}`, et pas de français recopié tel quel dans une autre
 * langue (sauf noms propres / cognats courts : « Email », « Admin », « WC »…).
 */
const LOCALE_CODES = LOCALES.map((l) => l.code);
const OTHER_LOCALES = LOCALE_CODES.filter((l): l is Exclude<Locale, 'fr'> => l !== 'fr');
const frKeys = Object.keys(TRANSLATIONS.fr).sort();

/** Valeurs qui ont le droit d'être identiques au français (noms propres, codes, cognats). */
const IDENTICAL_ALLOWED = new Set<string>([
  'Airbnb',
  'Email',
  'Admin',
  'Manager',
  'SIRET',
  'WC',
  'OK',
  'Check-in',
  'Check-out',
  'iCal',
  'Wi-Fi',
  'PDF',
  'CSV',
]);

function placeholders(value: string): string {
  return (value.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort().join(',');
}

/**
 * Un cognat court (un seul mot, ≤ 14 caractères, placeholders `{var}` et
 * ponctuation retirés) peut légitimement coïncider avec le français :
 * « Email », « WC », « {count} section » en anglais…
 */
function isShortCognate(value: string): boolean {
  const bare = value.replace(/\{[a-zA-Z0-9_]+\}/g, '').replace(/[·,.:;!?()«»"']/g, '').trim();
  return bare.length <= 14 && !/\s/.test(bare);
}

describe('translations', () => {
  it('expose les 8 langues déclarées dans LOCALES', () => {
    expect(LOCALE_CODES).toEqual(['fr', 'en', 'de', 'es', 'it', 'pt', 'tr', 'pl']);
    expect(Object.keys(TRANSLATIONS).sort()).toEqual([...LOCALE_CODES].sort());
  });

  it.each(OTHER_LOCALES)('%s a exactement les mêmes clés que fr', (locale) => {
    const keys = Object.keys(TRANSLATIONS[locale]).sort();
    const missing = frKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !frKeys.includes(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it.each(LOCALE_CODES)('%s n a aucune valeur vide', (locale) => {
    const dict: Record<string, string> = TRANSLATIONS[locale];
    const empty = Object.entries(dict)
      .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it.each(OTHER_LOCALES)('%s garde les mêmes placeholders {var} que fr', (locale) => {
    const dict: Record<string, string> = TRANSLATIONS[locale];
    const fr: Record<string, string> = TRANSLATIONS.fr;
    const mismatched = frKeys.filter((k) => k in dict && placeholders(dict[k]) !== placeholders(fr[k]));
    expect(mismatched).toEqual([]);
  });

  it.each(OTHER_LOCALES)('%s ne recopie pas le français (hors noms propres / cognats courts)', (locale) => {
    const dict: Record<string, string> = TRANSLATIONS[locale];
    const fr: Record<string, string> = TRANSLATIONS.fr;
    const copied = frKeys.filter(
      (k) => k in dict && dict[k] === fr[k] && !IDENTICAL_ALLOWED.has(fr[k]) && !isShortCognate(fr[k]),
    );
    expect(copied).toEqual([]);
  });

  it('les clés plurielles vont par paire _one / _other', () => {
    const bases = new Set<string>();
    for (const k of frKeys) {
      const m = /^(.*)_(one|other)$/.exec(k);
      if (m) bases.add(m[1]);
    }
    const incomplete = [...bases].filter((b) => !frKeys.includes(`${b}_one`) || !frKeys.includes(`${b}_other`));
    expect(incomplete).toEqual([]);
  });
});
