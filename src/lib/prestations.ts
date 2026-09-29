/**
 * Fenêtre du chip « Passées » (liste des prestations) : les non clôturées des N
 * derniers jours. Au-delà, une prestation jamais validée / jamais pointée est
 * « oubliée » : elle sort de la liste de travail et vit dans l'Historique
 * (`stale_before` côté API), étiquetée « Non traitée ». Pas de clôture
 * automatique : c'est l'admin qui valide ou annule, à l'unité ou en lot.
 */
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
