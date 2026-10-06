import { getIntlLocale, translate } from '@/i18n/runtime';

/**
 * Format de date centralisé (mobile). Identique à la version dashboard.
 * Les helpers gardent leur nom historique (`…Fr`) mais suivent la **langue
 * courante de l'app** (`@/i18n/runtime`) : les exemples ci-dessous sont en français.
 *
 * Variants :
 * - `short`        : 15/05/2026
 * - `long`         : 15 mai 2026
 * - `weekday`      : jeudi 15 mai 2026
 * - `weekdayShort` : lun. 15 mai
 * - `dayShort`     : 15 mai
 * - `month`        : mai 2026
 * - `datetime`     : 15/05/2026 14:30
 * - `dayShortTime` : 15 mai à 14:30
 * - `time`         : 14:30
 */
export type DateVariant =
  | 'short'
  | 'long'
  | 'weekday'
  | 'weekdayShort'
  | 'dayShort'
  | 'month'
  | 'datetime'
  | 'dayShortTime'
  | 'time';

const FORMATTERS: Record<DateVariant, Intl.DateTimeFormatOptions> = {
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  weekday: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  weekdayShort: { weekday: 'short', day: '2-digit', month: 'short' },
  dayShort: { day: 'numeric', month: 'short' },
  month: { month: 'long', year: 'numeric' },
  datetime: {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
  dayShortTime: {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  },
  time: { hour: '2-digit', minute: '2-digit' },
};

export function formatDateFr(
  value: string | Date | null | undefined,
  variant: DateVariant = 'short',
): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(getIntlLocale(), FORMATTERS[variant]).format(d);
}

/**
 * Convertit une durée en minutes en label humain :
 *   45 → "45min" / 60 → "1h" / 90 → "1h30" / 120 → "2h" / 0 → "—"
 */
export function formatDurationMin(min: number | null | undefined): string {
  if (min === null || min === undefined || min <= 0) return '—';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function formatCurrencyFr(
  amount: number | string | null | undefined,
  currency = 'EUR',
): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(getIntlLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

/**
 * Date relative courte (langue courante), pour un horodatage récent :
 *   « à l'instant » / « il y a 5 min » / « il y a 2 h » / « il y a 3 j »,
 * puis la date (« 15 mai ») au-delà d'une semaine. Chaîne vide si invalide.
 */
export function formatRelativeFr(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (diffMin < 1) return translate('relative.justNow');
  if (diffMin < 60) return translate('relative.minutesAgo', { count: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return translate('relative.hoursAgo', { count: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return translate('relative.daysAgo', { count: diffD });
  return formatDateFr(d, 'dayShort');
}
