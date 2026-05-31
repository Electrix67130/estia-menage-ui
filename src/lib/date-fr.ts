/**
 * Format de date français centralisé (mobile). Identique à la version dashboard.
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
  return new Intl.DateTimeFormat('fr-FR', FORMATTERS[variant]).format(d);
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
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}
