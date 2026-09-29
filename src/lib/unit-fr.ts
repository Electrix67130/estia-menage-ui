/**
 * Accord en nombre d'une unité de consommable saisie librement par l'admin
 * (« rouleaux », « flacon », « L », « kg »…) : « 1 rouleau » / « 3 rouleaux »,
 * « 0 flacon », « 2 L ». L'unité stockée peut être au singulier ou au pluriel,
 * on la ramène d'abord au singulier puis on accorde selon la quantité.
 *
 * Règles volontairement simples (unités de ménage courantes), pas une grammaire
 * complète : les abréviations (≤ 2 lettres ou sans minuscule) et les libellés à
 * plusieurs mots sont laissés tels quels.
 */

function isInvariable(unit: string): boolean {
  return unit.length <= 2 || !/[a-zà-ÿ]/.test(unit) || /\s/.test(unit);
}

/** Ramène une unité au singulier (« rouleaux » → « rouleau », « bocaux » → « bocal »). */
export function singularizeUnitFr(unit: string): string {
  const u = unit.trim();
  if (!u || isInvariable(u)) return u;
  if (/eaux$/i.test(u) || /[yo]aux$/i.test(u)) return u.slice(0, -1); // rouleaux, tuyaux, noyaux
  if (/aux$/i.test(u)) return `${u.slice(0, -3)}al`; // bocaux → bocal
  if (/eux$/i.test(u)) return u.slice(0, -1); // cheveux, jeux
  if (/[^s]s$/i.test(u)) return u.slice(0, -1); // sachets, capsules, boîtes
  return u;
}

/** Met une unité au pluriel (« rouleau » → « rouleaux », « sachet » → « sachets »). */
export function pluralizeUnitFr(unit: string): string {
  const u = singularizeUnitFr(unit);
  if (!u || isInvariable(u)) return u;
  if (/[sxz]$/i.test(u)) return u;
  if (/(eau|au|eu)$/i.test(u)) return `${u}x`;
  if (/al$/i.test(u)) return `${u.slice(0, -2)}aux`;
  return `${u}s`;
}

/** Accorde l'unité à une quantité : singulier pour 0 et 1, pluriel au-delà. */
export function unitForQty(qty: number, unit: string): string {
  return Math.abs(qty) > 1 ? pluralizeUnitFr(unit) : singularizeUnitFr(unit);
}

/** « 3 rouleaux », « 1 rouleau », « 2 L » ; sans unité → « 3 ». */
export function formatQtyUnit(qty: number, unit: string | null | undefined): string {
  const u = unit?.trim();
  if (!u) return String(qty);
  return `${qty} ${unitForQty(qty, u)}`;
}
