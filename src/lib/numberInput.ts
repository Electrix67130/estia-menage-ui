/**
 * Champs numériques (quantités, lits, prix, TVA…).
 *
 * Un champ qui affiche « 0 » par défaut laisse le curseur après le zéro : taper
 * 5 donnait « 05 ». Deux protections, posées sur chaque champ concerné :
 * - `selectTextOnFocus` : à l'entrée dans le champ, son contenu est sélectionné
 *   et la frappe le remplace (comportement natif d'iOS) ;
 * - `withoutLeadingZeros` : si l'on tape quand même derrière le zéro, il saute.
 *
 * À NE PAS poser sur un code où le zéro compte : code postal, SIRET, code
 * d'accès, téléphone.
 */

/** « 05 » → « 5 », « 007 » → « 7 » ; « 0 », « 0,5 » et « 0.5 » restent tels quels. */
export function stripLeadingZeros(text: string): string {
  return text.replace(/^0+(?=\d)/, '');
}

/** Enveloppe un `onChangeText` pour qu'il reçoive le texte sans zéros de tête. */
export function withoutLeadingZeros(handler: (text: string) => void): (text: string) => void {
  return (text) => handler(stripLeadingZeros(text));
}
