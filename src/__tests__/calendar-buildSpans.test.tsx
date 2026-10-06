import { describe, expect, it, jest } from '@jest/globals';
// Hors de src/app : expo-router prend tout fichier de ce dossier pour une route
// et embarquerait Testing Library dans le bundle de production.
import { buildSpans } from '@/app/(tabs)/calendar';
import { makeMenage } from '@/test-utils/render';

// L'écran importe des hooks/API ; seule la fonction pure `buildSpans` est testée ici.
jest.mock('@/api/hooks/useMenages', () => ({ useMenages: jest.fn() }));
jest.mock('@/api/hooks/useLogementMembers', () => ({ useAllUsers: jest.fn() }));
jest.mock('@/api/hooks/useLogements', () => ({ useLogements: jest.fn() }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));

const uid = 'airbnb-RES-42';

describe('Calendrier « Vue séjours » — regroupement d’une réservation', () => {
  const checkIn = makeMenage({ id: 'ci', prestation_type: 'check_in', external_event_uid: uid, date_prevue: '2026-10-03', logement_color: '#123456' });
  const menage = makeMenage({ id: 'me', prestation_type: 'menage', external_event_uid: uid, date_prevue: '2026-10-07', stay_nights: 4, logement_color: '#123456' });
  const checkOut = makeMenage({ id: 'co', prestation_type: 'check_out', external_event_uid: uid, date_prevue: '2026-10-07', logement_color: '#123456' });

  it('ménage + check-in + check-out d’un même external_event_uid = une barre du check-in au check-out', () => {
    const spans = buildSpans([menage, checkOut, checkIn]);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      key: 'me',
      startIso: '2026-10-03',
      endIso: '2026-10-07',
      isStay: true,
      kind: 'stay',
      hasCheckIn: true,
      color: '#123456',
      needsAttention: false,
    });
  });

  it('tap ciblé : jour d’arrivée → check-in, départ → check-out, milieu → ménage', () => {
    const [span] = buildSpans([menage, checkOut, checkIn]);
    expect(span.startId).toBe('ci');
    expect(span.endId).toBe('co');
    expect(span.midId).toBe('me');
  });

  it('sans check-in, l’arrivée = date_prevue − stay_nights ; sans check-out, le départ = le ménage', () => {
    const [span] = buildSpans([menage]);
    expect(span.startIso).toBe('2026-10-03');
    expect(span.endIso).toBe('2026-10-07');
    expect(span.isStay).toBe(true);
    expect(span.hasCheckIn).toBe(false);
    expect(span.startId).toBe('me');
    expect(span.endId).toBe('me');
  });

  it('remonte « Non pointé » dès qu’une des prestations du séjour est en retard', () => {
    const [span] = buildSpans([menage, { ...checkIn, needs_attention: true }]);
    expect(span.needsAttention).toBe(true);
  });
});

describe('Calendrier « Vue séjours » — prestations manuelles (sans uid)', () => {
  it('un ménage manuel = événement d’un jour de type « menage »', () => {
    const [span] = buildSpans([makeMenage({ id: 'x', date_prevue: '2026-10-10', logement_color: null })]);
    expect(span).toMatchObject({ key: 'x', startIso: '2026-10-10', endIso: '2026-10-10', isStay: false, kind: 'menage', hasCheckIn: false, startId: 'x', endId: 'x', midId: 'x' });
  });

  it('un check-in manuel garde son type (demi-journée après-midi) ; un check-out aussi', () => {
    const spans = buildSpans([
      makeMenage({ id: 'ci', prestation_type: 'check_in', date_prevue: '2026-10-10' }),
      makeMenage({ id: 'co', prestation_type: 'check_out', date_prevue: '2026-10-10' }),
    ]);
    expect(spans.map((s) => [s.key, s.kind, s.hasCheckIn])).toEqual([
      ['ci', 'check_in', true],
      ['co', 'check_out', false],
    ]);
  });

  it('sans couleur de logement, repli sur la couleur du statut', () => {
    const [span] = buildSpans([makeMenage({ id: 'x', logement_color: null, status: 'valide' })]);
    expect(span.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('trie les barres par date de début puis de fin', () => {
    const spans = buildSpans([
      makeMenage({ id: 'late', date_prevue: '2026-10-20' }),
      makeMenage({ id: 'early-long', date_prevue: '2026-10-05', stay_nights: 3 }),
      makeMenage({ id: 'early', date_prevue: '2026-10-02' }),
    ]);
    expect(spans.map((s) => s.key)).toEqual(['early', 'early-long', 'late']);
  });
});
