import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  findCachedMenage,
  useArrival,
  useEligiblePrestataires,
  useMenages,
  useRestoreMenage,
} from './useMenages';
import { apiFetch } from '@/api/client';
import { makeMenage, makeQueryClient } from '@/test-utils/render';

jest.mock('@/api/client', () => ({ apiFetch: jest.fn(async () => ({ data: [], meta: {} })) }));

const api = apiFetch as jest.MockedFunction<typeof apiFetch>;

function wrapperWith(qc = makeQueryClient()) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { wrapper: Wrapper, qc };
}

/** Paramètres de requête de l'URL passée à apiFetch. */
function lastQuery(): URLSearchParams {
  const url = api.mock.calls.at(-1)?.[0] ?? '';
  return new URL(`http://x${url}`).searchParams;
}

beforeEach(() => {
  api.mockClear();
  api.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
});

describe('useMenages — construction de la query string', () => {
  it('sans paramètre : GET /menages', async () => {
    const { result } = renderHook(() => useMenages(), wrapperWith());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith('/menages');
  });

  it('historique presta : closed + stale_before + assigned=me + bornes du mois', async () => {
    const { result } = renderHook(
      () => useMenages({ closed: true, stale_before: '2026-09-05', from: '2026-10-01', to: '2026-10-31', limit: 200, assigned: 'me' }),
      wrapperWith(),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const q = lastQuery();
    expect(q.get('closed')).toBe('true');
    expect(q.get('stale_before')).toBe('2026-09-05');
    expect(q.get('assigned')).toBe('me');
    expect(q.get('from')).toBe('2026-10-01');
    expect(q.get('to')).toBe('2026-10-31');
    expect(q.get('limit')).toBe('200');
  });

  it('filtre admin « Qui est dispo ? » : availability', async () => {
    const { result } = renderHook(() => useMenages({ availability: 'no_response', type: 'check_in' }), wrapperWith());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const q = lastQuery();
    expect(q.get('availability')).toBe('no_response');
    expect(q.get('type')).toBe('check_in');
  });

  it('les booléens false sont envoyés explicitement (worklist active = closed=false)', async () => {
    const { result } = renderHook(() => useMenages({ closed: false, validated: false }), wrapperWith());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const q = lastQuery();
    expect(q.get('closed')).toBe('false');
    expect(q.get('validated')).toBe('false');
  });

  it('pagination, tri, statut, prestataire, logement, manager', async () => {
    const { result } = renderHook(
      () =>
        useMenages({
          page: 2,
          limit: 50,
          status: 'termine',
          prestataire_user_id: 'u1',
          logement_id: 'l1',
          manager: 'me',
          orderBy: 'date_prevue',
          order: 'desc',
        }),
      wrapperWith(),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Object.fromEntries(lastQuery())).toEqual({
      page: '2',
      limit: '50',
      status: 'termine',
      prestataire_user_id: 'u1',
      logement_id: 'l1',
      manager: 'me',
      orderBy: 'date_prevue',
      order: 'desc',
    });
  });

  it('unassigned=true est transmis à l’API', async () => {
    const { result } = renderHook(() => useMenages({ unassigned: true }), wrapperWith());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastQuery().get('unassigned')).toBe('true');
  });
});

describe('findCachedMenage — repli hors ligne de la fiche', () => {
  it('retrouve un ménage dans n’importe quelle liste déjà chargée', () => {
    const qc = makeQueryClient();
    const target = makeMenage({ id: 'm9', logement_name: 'Cache Hit' });
    qc.setQueryData(['menages', 'list', { closed: false }], { data: [makeMenage({ id: 'm1' }), target], meta: {} });
    qc.setQueryData(['menages', 'list', { closed: true }], { data: [], meta: {} });
    expect(findCachedMenage(qc, 'm9')?.logement_name).toBe('Cache Hit');
    expect(findCachedMenage(qc, 'absent')).toBeUndefined();
    expect(findCachedMenage(qc, undefined)).toBeUndefined();
  });
});

describe('useEligiblePrestataires', () => {
  it('inactif sans id, sinon GET …/eligible-prestataires et renvoie `data`', async () => {
    const off = renderHook(() => useEligiblePrestataires(undefined), wrapperWith());
    expect(off.result.current.fetchStatus).toBe('idle');
    expect(api).not.toHaveBeenCalled();

    api.mockResolvedValue({ data: [{ id: 'u1' }] });
    const on = renderHook(() => useEligiblePrestataires('m1'), wrapperWith());
    await waitFor(() => expect(on.result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith('/menages/m1/eligible-prestataires');
    expect(on.result.current.data).toEqual([{ id: 'u1' }]);
  });
});

describe('mutations', () => {
  it('« Remettre » → POST /menages/:id/restore puis invalide les ménages', async () => {
    const { wrapper, qc } = wrapperWith();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    api.mockResolvedValue({ restored: true });
    const { result } = renderHook(() => useRestoreMenage(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('m7');
    });
    expect(api).toHaveBeenCalledWith('/menages/m7/restore', { method: 'POST' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['menages'] });
  });

  it('pointage d’arrivée : POST /menages/:id/arrival avec l’heure réelle (arrived_at) et la déclaration', async () => {
    api.mockResolvedValue(makeMenage({ status: 'en_cours' }));
    const { result } = renderHook(() => useArrival(), wrapperWith());
    await act(async () => {
      await result.current.mutateAsync({
        id: 'm1',
        photo_url: 'https://cdn/p.jpg',
        lat: 43.7,
        lng: 7.26,
        arrived_at: '2026-10-05T08:02:00.000Z',
        traveler_rating: 4,
        has_degradation: false,
      });
    });
    expect(api).toHaveBeenCalledWith('/menages/m1/arrival', {
      method: 'POST',
      body: {
        photo_url: 'https://cdn/p.jpg',
        lat: 43.7,
        lng: 7.26,
        arrived_at: '2026-10-05T08:02:00.000Z',
        traveler_rating: 4,
        has_degradation: false,
      },
    });
  });
});
