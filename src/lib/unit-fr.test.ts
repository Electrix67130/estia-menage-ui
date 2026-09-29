import { describe, expect, it } from '@jest/globals';
import { formatQtyUnit, pluralizeUnitFr, singularizeUnitFr } from './unit-fr';

describe('formatQtyUnit', () => {
  it('accorde une unité saisie au pluriel', () => {
    expect(formatQtyUnit(1, 'rouleaux')).toBe('1 rouleau');
    expect(formatQtyUnit(0, 'rouleaux')).toBe('0 rouleau');
    expect(formatQtyUnit(3, 'rouleaux')).toBe('3 rouleaux');
  });

  it('accorde une unité saisie au singulier', () => {
    expect(formatQtyUnit(1, 'flacon')).toBe('1 flacon');
    expect(formatQtyUnit(4, 'flacon')).toBe('4 flacons');
    expect(formatQtyUnit(2, 'boîte')).toBe('2 boîtes');
  });

  it('gère les pluriels en -x', () => {
    expect(formatQtyUnit(2, 'rouleau')).toBe('2 rouleaux');
    expect(formatQtyUnit(2, 'tuyau')).toBe('2 tuyaux');
    expect(formatQtyUnit(1, 'bocaux')).toBe('1 bocal');
    expect(formatQtyUnit(3, 'bocal')).toBe('3 bocaux');
  });

  it('laisse les abréviations et libellés composés invariables', () => {
    expect(formatQtyUnit(2, 'L')).toBe('2 L');
    expect(formatQtyUnit(3, 'kg')).toBe('3 kg');
    expect(formatQtyUnit(3, 'sacs poubelle')).toBe('3 sacs poubelle');
  });

  it('sans unité, renvoie la quantité seule', () => {
    expect(formatQtyUnit(3, null)).toBe('3');
    expect(formatQtyUnit(3, '  ')).toBe('3');
  });
});

describe('singularize / pluralize', () => {
  it('sont idempotents', () => {
    expect(singularizeUnitFr('rouleau')).toBe('rouleau');
    expect(pluralizeUnitFr('rouleaux')).toBe('rouleaux');
    expect(pluralizeUnitFr('dosettes')).toBe('dosettes');
  });
});
