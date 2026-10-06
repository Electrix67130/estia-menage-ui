import { afterEach, describe, expect, it } from '@jest/globals';
import { PAST_WINDOW_DAYS, addDays, groupByDay, ymdLocal } from './prestations';
import { setCurrentLocale, translate } from '@/i18n/runtime';

afterEach(() => setCurrentLocale('fr'));

describe('ymdLocal / addDays', () => {
  it('formate en YYYY-MM-DD en heure locale (pas de bascule UTC le soir)', () => {
    expect(ymdLocal(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05');
    expect(ymdLocal(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('addDays franchit les fins de mois et d’année sans muter la date d’origine', () => {
    const d = new Date(2026, 11, 31);
    const next = addDays(d, 1);
    expect(ymdLocal(next)).toBe('2027-01-01');
    expect(ymdLocal(d)).toBe('2026-12-31');
    expect(ymdLocal(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28');
  });
});

describe('fenêtre des prestations passées', () => {
  it('vaut 30 jours (au-delà → Historique « Non traitées »)', () => {
    expect(PAST_WINDOW_DAYS).toBe(30);
  });
});

describe('groupByDay — Planning groupé par jour', () => {
  const today = '2026-10-05';
  const items = [
    { id: 'c', date_prevue: '2026-10-07', horaire_prevu: '14:00:00' },
    { id: 'a', date_prevue: '2026-10-05', horaire_prevu: '11:00:00' },
    { id: 'b', date_prevue: '2026-10-05', horaire_prevu: '09:30:00' },
    { id: 'z', date_prevue: '2026-10-05', horaire_prevu: null },
    { id: 'd', date_prevue: '2026-10-06T00:00:00.000Z', horaire_prevu: '08:00:00' },
    { id: 'old', date_prevue: '2026-10-04', horaire_prevu: '10:00:00' },
  ];

  it('titre « Aujourd’hui » puis « Demain », puis le jour en toutes lettres, du plus proche au plus lointain', () => {
    const sections = groupByDay(items, today);
    expect(sections.map((s) => s.key)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect(sections[0].title).toBe(translate('common.today'));
    expect(sections[0].isToday).toBe(true);
    expect(sections[1].title).toBe(translate('common.tomorrow'));
    expect(sections[1].isToday).toBe(false);
    // Le 7 octobre 2026 est un mercredi : « Mer. 7 oct. » (capitalisé).
    expect(sections[2].title).toMatch(/^Mer\. 7 oct\.$/);
    expect(sections[2].subtitle).toBeUndefined();
  });

  it('les sections relatives portent la date en clair en sous-titre', () => {
    const [todaySection, tomorrowSection] = groupByDay(items, today);
    expect(todaySection.subtitle).toMatch(/^Lun\. 5 oct\.$/);
    expect(tomorrowSection.subtitle).toMatch(/^Mar\. 6 oct\.$/);
  });

  it('trie chaque jour par heure, les prestations sans heure en dernier', () => {
    const [todaySection] = groupByDay(items, today);
    expect(todaySection.data.map((m) => m.id)).toEqual(['b', 'a', 'z']);
  });

  it('ignore le passé (il a sa propre vue) et accepte une date_prevue ISO complète', () => {
    const sections = groupByDay(items, today);
    expect(sections.flatMap((s) => s.data.map((m) => m.id))).not.toContain('old');
    expect(sections[1].data.map((m) => m.id)).toEqual(['d']);
  });

  it('renvoie un tableau vide sans élément', () => {
    expect(groupByDay([], today)).toEqual([]);
  });

  it('traduit les titres dans la langue courante', () => {
    setCurrentLocale('en');
    const sections = groupByDay(items, today);
    expect(sections[0].title).toBe(translate('common.today', undefined, 'en'));
    expect(sections[2].title).toMatch(/^Wed 7 Oct$/);
  });
});
