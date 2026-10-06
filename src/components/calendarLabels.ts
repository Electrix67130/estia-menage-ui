import { useMemo } from 'react';
import { getIntlLocale } from '@/i18n/runtime';
import type { Locale } from '@/i18n/translations';

/**
 * Libellés de grille calendrier (pickers de date) dans la langue courante.
 * Semaine qui commence le lundi, comme les grilles de l'app.
 */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « Lun », « Mon », « Mo »… — en-têtes courts des 7 colonnes, lundi en premier. */
export function weekdayShortLabels(): string[] {
  const fmt = new Intl.DateTimeFormat(getIntlLocale(), { weekday: 'short' });
  // Le 1er janvier 2024 est un lundi.
  return Array.from({ length: 7 }, (_, i) =>
    capitalize(fmt.format(new Date(2024, 0, 1 + i)).replace(/\.$/, '')),
  );
}

/** Version mémorisée, rafraîchie quand la langue change. */
export function useWeekdayShortLabels(locale: Locale): string[] {
  // `locale` ne sert qu'à invalider le memo : le formateur lit la locale courante.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => weekdayShortLabels(), [locale]);
}

/** « Janvier 2026 », « January 2026 »… pour l'en-tête d'un mois affiché. */
export function monthYearLabel(year: number, monthIndex: number): string {
  return capitalize(
    new Intl.DateTimeFormat(getIntlLocale(), { month: 'long', year: 'numeric' }).format(new Date(year, monthIndex, 1)),
  );
}
