import { describe, expect, it, jest } from '@jest/globals';
import { stripLeadingZeros, withoutLeadingZeros } from './numberInput';

describe('champs numériques — zéros de tête', () => {
  it('taper derrière le 0 par défaut remplace le zéro', () => {
    expect(stripLeadingZeros('05')).toBe('5');
    expect(stripLeadingZeros('007')).toBe('7');
    expect(stripLeadingZeros('010')).toBe('10');
  });

  it('un zéro seul, un décimal et un champ vide restent tels quels', () => {
    expect(stripLeadingZeros('0')).toBe('0');
    expect(stripLeadingZeros('0,5')).toBe('0,5');
    expect(stripLeadingZeros('0.5')).toBe('0.5');
    expect(stripLeadingZeros('')).toBe('');
  });

  it('enveloppe le setter du champ', () => {
    const set = jest.fn();
    withoutLeadingZeros(set)('05');
    expect(set).toHaveBeenCalledWith('5');
  });
});
