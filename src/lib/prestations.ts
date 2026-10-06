/**
 * Fenêtre du chip « Passées » (liste des prestations) : les non clôturées des N
 * derniers jours. Au-delà, une prestation jamais validée / jamais pointée est
 * « oubliée » : elle sort de la liste de travail et vit dans l'Historique
 * (`stale_before` côté API), étiquetée « Non traitée ». Pas de clôture
 * automatique : c'est l'admin qui valide ou annule, à l'unité ou en lot.
 */
import { getIntlLocale, translate } from '@/i18n/runtime';

export const PAST_WINDOW_DAYS = 30;

/** Date locale au format YYYY-MM-DD (pas `toISOString`, qui bascule en UTC le soir). */
export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

/** Section d'une liste groupée par jour (Planning). */
export interface DaySection<T> {
  key: string;
  /** « Aujourd'hui », « Demain », ou le jour en toutes lettres (« jeu. 2 oct. »). */
  title: string;
  /** Date en clair quand le titre est relatif (Aujourd'hui / Demain). */
  subtitle?: string;
  isToday: boolean;
  data: T[];
}

function dayLabel(iso: string): string {
  const s = new Intl.DateTimeFormat(getIntlLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(`${iso}T12:00:00`),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Regroupe des éléments datés (`date_prevue`) par jour, du plus proche au plus
 * lointain, avec des titres relatifs pour aujourd'hui et demain (langue courante
 * de l'app — l'appelant mémorise avec `locale` en dépendance). Les éléments
 * antérieurs à `todayYmd` sont ignorés : le passé a sa propre vue.
 */
export function groupByDay<T extends { date_prevue: string; horaire_prevu?: string | null }>(
  items: T[],
  todayYmd: string,
): DaySection<T>[] {
  const tomorrow = ymdLocal(addDays(new Date(`${todayYmd}T12:00:00`), 1));
  const byDay = new Map<string, T[]>();
  for (const it of items) {
    const d = it.date_prevue.slice(0, 10);
    if (d < todayYmd) continue;
    const arr = byDay.get(d) ?? [];
    arr.push(it);
    byDay.set(d, arr);
  }
  return Array.from(byDay.keys())
    .sort()
    .map((d) => {
      const data = (byDay.get(d) ?? [])
        .slice()
        .sort((a, b) => (a.horaire_prevu ?? '99').localeCompare(b.horaire_prevu ?? '99'));
      if (d === todayYmd) return { key: d, title: translate('common.today'), subtitle: dayLabel(d), isToday: true, data };
      if (d === tomorrow) return { key: d, title: translate('common.tomorrow'), subtitle: dayLabel(d), isToday: false, data };
      return { key: d, title: dayLabel(d), isToday: false, data };
    });
}
