import { afterEach, describe, expect, it } from '@jest/globals';
import { monthYearLabel, weekdayShortLabels } from './calendarLabels';
import { setCurrentLocale } from '@/i18n/runtime';

afterEach(() => setCurrentLocale('fr'));

describe('Libellés de grille calendrier', () => {
  it('7 en-têtes courts, lundi en premier, sans point final, capitalisés', () => {
    expect(weekdayShortLabels()).toEqual(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']);
  });

  it('suivent la langue courante', () => {
    setCurrentLocale('en');
    expect(weekdayShortLabels()).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    setCurrentLocale('de');
    expect(weekdayShortLabels()[0]).toBe('Mo');
  });

  it('mois + année capitalisés pour l’en-tête', () => {
    expect(monthYearLabel(2026, 0)).toBe('Janvier 2026');
    expect(monthYearLabel(2026, 9)).toBe('Octobre 2026');
    setCurrentLocale('en');
    expect(monthYearLabel(2026, 9)).toBe('October 2026');
  });
});
