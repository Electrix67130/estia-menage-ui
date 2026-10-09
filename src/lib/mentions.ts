/**
 * Mentions « @Prénom Nom » dans les discussions d'une prestation.
 *
 * Le texte garde le nom en clair ; les ids des personnes visées partent à côté
 * (`mentioned_user_ids`), retrouvés dans le texte au moment de l'envoi — une
 * mention effacée à la main n'est donc pas notifiée.
 */

export interface MentionCandidate {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
}

export interface MentionRef {
  user_id: string;
  first_name: string;
  last_name: string;
}

export interface MentionSegment {
  text: string;
  mention: boolean;
}

const MAX_QUERY = 30;
const MAX_SUGGESTIONS = 6;

export function mentionName(u: { first_name: string; last_name: string }): string {
  return `${u.first_name} ${u.last_name}`.trim();
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Mention en cours de frappe juste avant le curseur : « Merci @jul| » → { start: 6, query: 'jul' }. */
export function activeMentionQuery(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const m = before.match(new RegExp(`(^|\\s)@([^\\s@]{0,${MAX_QUERY}})$`));
  if (!m) return null;
  return { start: cursor - m[2].length - 1, query: m[2] };
}

/** Prénom, nom ou nom complet commençant par la saisie, sans tenir compte des accents. */
export function filterMentionCandidates<T extends MentionCandidate>(candidates: T[], query: string): T[] {
  const q = normalize(query);
  return candidates
    .filter((c) => {
      if (!q) return true;
      const full = normalize(mentionName(c));
      return full.startsWith(q) || normalize(c.last_name).startsWith(q) || full.includes(` ${q}`);
    })
    .slice(0, MAX_SUGGESTIONS);
}

/** Remplace « @jul » par « @Julie Martin » et renvoie le nouveau texte et la position du curseur. */
export function insertMention(
  text: string,
  start: number,
  cursor: number,
  user: MentionCandidate,
): { text: string; cursor: number } {
  const inserted = `@${mentionName(user)} `;
  const after = text.slice(cursor).replace(/^\s+/, '');
  return { text: text.slice(0, start) + inserted + after, cursor: start + inserted.length };
}

/** Personnes dont « @Prénom Nom » figure dans le texte. */
export function mentionedIdsInText(text: string, candidates: MentionCandidate[]): string[] {
  return candidates.filter((c) => text.includes(`@${mentionName(c)}`)).map((c) => c.id);
}

/** Découpe un message pour surligner ses mentions (les noms les plus longs d'abord). */
export function splitMentions(content: string, mentions: MentionRef[] | undefined): MentionSegment[] {
  const names = [...new Set((mentions ?? []).map((m) => `@${mentionName(m)}`))].sort((a, b) => b.length - a.length);
  if (names.length === 0) return [{ text: content, mention: false }];
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = content.split(new RegExp(`(${escaped.join('|')})`, 'g'));
  return parts.filter((p) => p !== '').map((p) => ({ text: p, mention: names.includes(p) }));
}
