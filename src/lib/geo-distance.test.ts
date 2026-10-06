import { describe, expect, it } from '@jest/globals';
import { POINTAGE_DISTANCE_WARN_M, formatDistance, haversineMeters } from './geo-distance';

describe('Distance GPS du pointage', () => {
  it('0 m entre deux points identiques', () => {
    expect(haversineMeters(43.7, 7.26, 43.7, 7.26)).toBe(0);
  });

  it('Paris → Nice ≈ 686 km', () => {
    const d = haversineMeters(48.8566, 2.3522, 43.7102, 7.262);
    expect(d).toBeGreaterThan(680_000);
    expect(d).toBeLessThan(692_000);
  });

  it('≈ 111 m par millième de degré de latitude', () => {
    const d = haversineMeters(43.7, 7.26, 43.701, 7.26);
    expect(d).toBeGreaterThanOrEqual(110);
    expect(d).toBeLessThanOrEqual(112);
  });

  it('formatDistance : mètres sous 1 km, sinon km à une décimale', () => {
    expect(formatDistance(120)).toBe('120 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1400)).toBe('1.4 km');
  });

  it('le seuil d’alerte « presta pas sur place » est 200 m', () => {
    expect(POINTAGE_DISTANCE_WARN_M).toBe(200);
  });
});
