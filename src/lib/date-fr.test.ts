import { afterEach, describe, expect, it } from '@jest/globals';
import { formatCurrencyFr, formatDateFr, formatDurationMin, formatRelativeFr, type DateVariant } from './date-fr';
import { setCurrentLocale, translate } from '@/i18n/runtime';

/** Les espaces insécables (fines ou non) d'Intl sont normalisées pour comparer. */
const norm = (s: string) => s.replace(/[  ]/g, ' ');

afterEach(() => setCurrentLocale('fr'));

describe('formatDateFr — variantes en français', () => {
  const d = new Date(2026, 4, 15, 14, 30); // vendredi 15 mai 2026, 14:30 (heure locale)

  it.each<[DateVariant, string]>([
    ['short', '15/05/2026'],
    ['long', '15 mai 2026'],
    ['weekday', 'vendredi 15 mai 2026'],
    ['weekdayShort', 'ven. 15 mai'],
    ['dayShort', '15 mai'],
    ['month', 'mai 2026'],
    ['time', '14:30'],
  ])('%s → %s', (variant, expected) => {
    expect(norm(formatDateFr(d, variant))).toBe(expected);
  });

  it('datetime et dayShortTime contiennent la date et l’heure', () => {
    expect(norm(formatDateFr(d, 'datetime'))).toMatch(/^15\/05\/2026 14:30$/);
    expect(norm(formatDateFr(d, 'dayShortTime'))).toMatch(/^15 mai.*14:30$/);
  });

  it('accepte une chaîne YYYY-MM-DD (date seule) et par défaut la variante short', () => {
    expect(formatDateFr('2026-05-15')).toBe('15/05/2026');
  });

  it('renvoie une chaîne vide pour une valeur absente ou invalide', () => {
    expect(formatDateFr(null)).toBe('');
    expect(formatDateFr(undefined)).toBe('');
    expect(formatDateFr('pas-une-date')).toBe('');
  });

  it('suit la langue courante de l’app (anglais → en-GB)', () => {
    setCurrentLocale('en');
    expect(formatDateFr(d, 'long')).toBe('15 May 2026');
    expect(formatDateFr(d, 'weekday')).toBe('Friday, 15 May 2026');
  });
});

describe('formatDurationMin', () => {
  it.each([
    [45, '45min'],
    [60, '1h'],
    [90, '1h30'],
    [120, '2h'],
    [125, '2h05'],
  ])('%i min → %s', (min, expected) => {
    expect(formatDurationMin(min)).toBe(expected);
  });

  it('tiret pour 0, négatif, null ou undefined', () => {
    expect(formatDurationMin(0)).toBe('—');
    expect(formatDurationMin(-5)).toBe('—');
    expect(formatDurationMin(null)).toBe('—');
    expect(formatDurationMin(undefined)).toBe('—');
  });
});

describe('formatCurrencyFr', () => {
  it('formate en euros à la française, deux décimales', () => {
    expect(norm(formatCurrencyFr(1234.5))).toBe('1 234,50 €');
    expect(norm(formatCurrencyFr(60))).toBe('60,00 €');
  });

  it('accepte une chaîne numérique (montants renvoyés par l’API en string)', () => {
    expect(norm(formatCurrencyFr('42.1'))).toBe('42,10 €');
  });

  it('tiret pour vide, null, undefined ou non numérique', () => {
    expect(formatCurrencyFr(null)).toBe('—');
    expect(formatCurrencyFr(undefined)).toBe('—');
    expect(formatCurrencyFr('')).toBe('—');
    expect(formatCurrencyFr('abc')).toBe('—');
  });

  it('suit la langue courante (anglais → symbole devant, séparateurs anglais)', () => {
    setCurrentLocale('en');
    expect(norm(formatCurrencyFr(1234.5))).toBe('€1,234.50');
  });
});

describe('formatRelativeFr — horodatage relatif', () => {
  const now = new Date(2026, 9, 5, 12, 0, 0);
  const minus = (ms: number) => new Date(now.getTime() - ms);

  it('« à l’instant » sous la minute', () => {
    expect(formatRelativeFr(minus(20_000), now)).toBe(translate('relative.justNow'));
  });

  it('minutes, heures, jours', () => {
    expect(formatRelativeFr(minus(5 * 60_000), now)).toBe('il y a 5 min');
    expect(formatRelativeFr(minus(2 * 3_600_000), now)).toBe('il y a 2 h');
    expect(formatRelativeFr(minus(3 * 86_400_000), now)).toBe('il y a 3 j');
  });

  it('au-delà d’une semaine, la date courte', () => {
    expect(norm(formatRelativeFr(minus(10 * 86_400_000), now))).toBe('25 sept.');
  });

  it('chaîne vide si invalide ou absent', () => {
    expect(formatRelativeFr(null, now)).toBe('');
    expect(formatRelativeFr('n/a', now)).toBe('');
  });

  it('traduit dans la langue courante', () => {
    setCurrentLocale('en');
    expect(formatRelativeFr(minus(5 * 60_000), now)).toBe(translate('relative.minutesAgo', { count: 5 }, 'en'));
  });
});
