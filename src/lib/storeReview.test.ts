import { describe, expect, it } from '@jest/globals';
import {
  initialReviewState,
  MIN_INTERVAL_MS,
  MIN_USAGE_MS,
  registerSuccess,
  REVIEW_THRESHOLDS,
  type ReviewState,
  type ReviewSuccess,
} from './storeReview';

const DEBUT = Date.UTC(2026, 9, 1);
const JOUR = 24 * 60 * 60 * 1000;

/** Enchaîne `n` réussites du même type et rend la dernière décision. */
function reussir(state: ReviewState, kind: ReviewSuccess, n: number, now: number) {
  let courant = state;
  let ask = false;
  for (let i = 0; i < n; i++) ({ state: courant, ask } = registerSuccess(courant, kind, now));
  return { state: courant, ask };
}

describe('demande de note — quand demander', () => {
  it('au 5e départ pointé, une fois la première semaine passée', () => {
    const plusTard = DEBUT + MIN_USAGE_MS;
    expect(reussir(initialReviewState(DEBUT), 'departure', REVIEW_THRESHOLDS.departure - 1, plusTard).ask).toBe(false);
    expect(reussir(initialReviewState(DEBUT), 'departure', REVIEW_THRESHOLDS.departure, plusTard).ask).toBe(true);
  });

  it('pas pendant la première semaine, même après beaucoup de réussites', () => {
    expect(reussir(initialReviewState(DEBUT), 'validation', 30, DEBUT + 6 * JOUR).ask).toBe(false);
  });

  it('les compteurs sont séparés : 5 validations ne suffisent pas à un admin', () => {
    const plusTard = DEBUT + MIN_USAGE_MS;
    expect(reussir(initialReviewState(DEBUT), 'validation', 5, plusTard).ask).toBe(false);
    expect(reussir(initialReviewState(DEBUT), 'validation', REVIEW_THRESHOLDS.validation, plusTard).ask).toBe(true);
  });

  it('après une demande, rien avant 90 jours, puis à nouveau après autant de réussites', () => {
    const premiere = DEBUT + MIN_USAGE_MS;
    const { state } = reussir(initialReviewState(DEBUT), 'departure', 5, premiere);
    expect(state).toMatchObject({ lastAskedAt: premiere, counts: { departure: 0, validation: 0 } });

    expect(reussir(state, 'departure', 20, premiere + MIN_INTERVAL_MS - JOUR).ask).toBe(false);
    expect(reussir(state, 'departure', 5, premiere + MIN_INTERVAL_MS).ask).toBe(true);
  });
});
