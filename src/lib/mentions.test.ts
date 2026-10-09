import { describe, expect, it } from '@jest/globals';
import {
  activeMentionQuery,
  filterMentionCandidates,
  insertMention,
  mentionedIdsInText,
  splitMentions,
} from './mentions';

const julie = { id: 'u1', first_name: 'Julie', last_name: 'Martin' };
const eloise = { id: 'u2', first_name: 'Éloïse', last_name: 'Dupont' };
const jules = { id: 'u3', first_name: 'Jules', last_name: 'Bernard' };

describe('Mentions — saisie', () => {
  it('repère la mention en cours de frappe avant le curseur', () => {
    expect(activeMentionQuery('Merci @jul', 10)).toEqual({ start: 6, query: 'jul' });
    expect(activeMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
  });

  it('ignore un @ collé à un mot (adresse e-mail) ou déjà suivi d’une espace', () => {
    expect(activeMentionQuery('contact@estia', 13)).toBeNull();
    expect(activeMentionQuery('@Julie Martin ', 14)).toBeNull();
  });

  it('filtre sur le prénom, le nom ou le nom complet, sans accents', () => {
    expect(filterMentionCandidates([julie, eloise, jules], 'jul').map((c) => c.id)).toEqual(['u1', 'u3']);
    expect(filterMentionCandidates([julie, eloise, jules], 'elo').map((c) => c.id)).toEqual(['u2']);
    expect(filterMentionCandidates([julie, eloise, jules], 'dup').map((c) => c.id)).toEqual(['u2']);
    expect(filterMentionCandidates([julie, eloise, jules], '')).toHaveLength(3);
  });

  it('insère le nom complet suivi d’une espace et place le curseur après', () => {
    expect(insertMention('Merci @jul pour tout', 6, 10, julie)).toEqual({
      text: 'Merci @Julie Martin pour tout',
      cursor: 20,
    });
  });

  it('retrouve dans le texte les personnes mentionnées (une mention effacée ne compte plus)', () => {
    expect(mentionedIdsInText('@Julie Martin et @Éloïse Dupont', [julie, eloise, jules])).toEqual(['u1', 'u2']);
    expect(mentionedIdsInText('Julie Martin sans arobase', [julie])).toEqual([]);
  });
});

describe('Mentions — affichage', () => {
  it('surligne les mentions connues, pas le reste du texte', () => {
    const segments = splitMentions('Merci @Julie Martin, vu avec @Inconnu', [
      { user_id: 'u1', first_name: 'Julie', last_name: 'Martin' },
    ]);
    expect(segments).toEqual([
      { text: 'Merci ', mention: false },
      { text: '@Julie Martin', mention: true },
      { text: ', vu avec @Inconnu', mention: false },
    ]);
  });

  it('sans mention, le message reste d’un seul tenant', () => {
    expect(splitMentions('Rien à signaler', [])).toEqual([{ text: 'Rien à signaler', mention: false }]);
  });
});
