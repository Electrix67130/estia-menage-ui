import { describe, expect, it } from '@jest/globals';
import { toggleLocally } from './useComments';

describe('toggleLocally — réaction optimiste', () => {
  it('ajoute ma réaction quand l’emoji est absent', () => {
    expect(toggleLocally(undefined, '👍')).toEqual([{ emoji: '👍', count: 1, mine: true }]);
  });

  it('retire la pastille quand j’étais le seul', () => {
    expect(toggleLocally([{ emoji: '👍', count: 1, mine: true }], '👍')).toEqual([]);
  });

  it('décrémente sans retirer quand d’autres ont réagi', () => {
    expect(toggleLocally([{ emoji: '❤️', count: 3, mine: true }], '❤️')).toEqual([{ emoji: '❤️', count: 2, mine: false }]);
  });

  it('me joint à la réaction des autres', () => {
    expect(toggleLocally([{ emoji: '🔥', count: 2, mine: false }], '🔥')).toEqual([{ emoji: '🔥', count: 3, mine: true }]);
  });
});
