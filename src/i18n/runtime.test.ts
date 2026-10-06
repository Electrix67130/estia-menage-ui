import { afterEach, describe, expect, it } from '@jest/globals';
import {
  INTL_LOCALES,
  getCurrentLocale,
  getIntlLocale,
  isLocale,
  setCurrentLocale,
  translate,
  translatePlural,
} from './runtime';
import type { TranslationKeys } from './translations';

afterEach(() => setCurrentLocale('fr'));

describe('Locale courante hors React', () => {
  it('français par défaut, modifiable, avec le tag Intl correspondant', () => {
    expect(getCurrentLocale()).toBe('fr');
    expect(getIntlLocale()).toBe('fr-FR');
    setCurrentLocale('pl');
    expect(getCurrentLocale()).toBe('pl');
    expect(getIntlLocale()).toBe(INTL_LOCALES.pl);
  });

  it('isLocale ne reconnaît que les 8 langues de l’app', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('tr')).toBe(true);
    expect(isLocale('jp')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe('translate', () => {
  it('lit la langue courante, ou la langue passée explicitement', () => {
    expect(translate('common.save')).toBe('Enregistrer');
    expect(translate('common.save', undefined, 'en')).toBe('Save');
    setCurrentLocale('en');
    expect(translate('common.save')).toBe('Save');
  });

  it('interpole toutes les occurrences de {var}', () => {
    expect(translate('relative.minutesAgo', { count: 5 })).toBe('il y a 5 min');
    expect(translate('assign.assignOne', { name: 'Marie' })).toBe('Affecter Marie');
  });

  it('renvoie la clé brute si elle n’existe nulle part', () => {
    expect(translate('nope.inconnue' as TranslationKeys)).toBe('nope.inconnue');
  });
});

describe('translatePlural', () => {
  it('_one pour 1, _other sinon (0 compris), avec {count} interpolé', () => {
    expect(translatePlural('dispo.availableCount', 1)).toBe('1 dispo');
    expect(translatePlural('dispo.availableCount', 2)).toBe('2 dispos');
    expect(translatePlural('dispo.availableCount', 0)).toBe('0 dispos');
  });

  it('accepte des variables supplémentaires', () => {
    expect(translatePlural('planning.doneCount', 3, { done: 1 })).toBe('1 / 3 terminées');
    expect(translatePlural('planning.doneCount', 1, { done: 0 })).toBe('0 / 1 terminée');
  });
});
