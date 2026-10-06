import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  useMenageResponses,
  useMyUpcomingMenages,
  useRelanceMenage,
  useRespondToMenageOptimistic,
  useSetMenageResponse,
} from './useMenageResponses';
import { apiFetch } from '@/api/client';
import { makeQueryClient } from '@/test-utils/render';

jest.mock('@/api/client', () => ({ apiFetch: jest.fn(async () => ({ data: [] })) }));

const api = apiFetch as jest.MockedFunction<typeof apiFetch>;

function wrapperWith(qc = makeQueryClient()) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { wrapper: Wrapper, qc };
}

beforeEach(() => {
  api.mockClear();
  api.mockResolvedValue({ data: [] });
});

describe('useMenageResponses — votes Présent/Absent d’une prestation', () => {
  it('inactif sans id ; sinon GET /menages/:id/responses et renvoie `data`', async () => {
    const off = renderHook(() => useMenageResponses(undefined), wrapperWith());
    expect(off.result.current.fetchStatus).toBe('idle');

    api.mockResolvedValue({ data: [{ id: 'r1', status: 'present' }] });
    const on = renderHook(() => useMenageResponses('m1'), wrapperWith());
    await waitFor(() => expect(on.result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith('/menages/m1/responses');
    expect(on.result.current.data).toEqual([{ id: 'r1', status: 'present' }]);
  });

  it('useSetMenageResponse poste le statut puis invalide les votes et « mes prestations »', async () => {
    const { wrapper, qc } = wrapperWith();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSetMenageResponse('m1'), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('absent');
    });
    expect(api).toHaveBeenCalledWith('/menages/m1/responses', { method: 'POST', body: { status: 'absent' } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['menage-responses', 'm1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['my-upcoming-menages'] });
  });
});

describe('useRelanceMenage — push aux membres sans vote (admin)', () => {
  it('POST /menages/:id/relance, renvoie le nombre d’envois et rafraîchit les éligibles', async () => {
    const { wrapper, qc } = wrapperWith();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    api.mockResolvedValue({ sent: 3 });
    const { result } = renderHook(() => useRelanceMenage(), { wrapper });
    let res: { sent: number } | undefined;
    await act(async () => {
      res = await result.current.mutateAsync('m1');
    });
    expect(api).toHaveBeenCalledWith('/menages/m1/relance', { method: 'POST' });
    expect(res).toEqual({ sent: 3 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['menage-eligible-prestataires', 'm1'] });
  });
});

describe('useMyUpcomingMenages — mes prestations (presta)', () => {
  it('mode upcoming par défaut ; from/to/mode passés en query string', async () => {
    const a = renderHook(() => useMyUpcomingMenages({ mode: 'upcoming' }), wrapperWith());
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith('/prestataires/me/menages?mode=upcoming');

    const b = renderHook(() => useMyUpcomingMenages({ from: '2026-09-01', to: '2026-09-30', mode: 'history' }), wrapperWith());
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith('/prestataires/me/menages?from=2026-09-01&to=2026-09-30&mode=history');

    const c = renderHook(() => useMyUpcomingMenages(), wrapperWith());
    await waitFor(() => expect(c.result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith('/prestataires/me/menages');
  });
});

describe('useRespondToMenageOptimistic — vote instantané dans la liste', () => {
  it('poste la réponse puis invalide la liste et les votes de la prestation', async () => {
    const { wrapper, qc } = wrapperWith();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRespondToMenageOptimistic(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ menageId: 'm1', status: 'present' });
    });
    expect(api).toHaveBeenCalledWith('/menages/m1/responses', { method: 'POST', body: { status: 'present' } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['my-upcoming-menages', null, null] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['menage-responses', 'm1'] });
  });

  it('met à jour my_response dans le cache de la liste avant la réponse serveur', async () => {
    const { wrapper, qc } = wrapperWith();
    // La liste est rangée sous la clé à 4 éléments de `useMyUpcomingMenages`
    // (avec `mode`) : le hook optimiste doit la retrouver quand même. `gcTime`
    // vaut 0 dans le client de test → on fixe une rétention pour cette entrée.
    const key = ['my-upcoming-menages', null, null, 'upcoming'];
    qc.setQueryDefaults(key, { gcTime: 60_000 });
    qc.setQueryData(key, [
      { id: 'm1', my_response: null },
      { id: 'm2', my_response: null },
    ]);
    let release: () => void = () => {};
    // Réponse serveur retenue tant que `release()` n'est pas appelé : on observe le cache entre-temps.
    const pending = new Promise<Record<string, never>>((resolve) => { release = () => resolve({}); });
    api.mockImplementationOnce((() => pending) as unknown as typeof apiFetch);

    const { result } = renderHook(() => useRespondToMenageOptimistic(), { wrapper });
    act(() => {
      result.current.mutate({ menageId: 'm1', status: 'present' });
    });
    await waitFor(() =>
      expect(qc.getQueryData(key)).toEqual([
        { id: 'm1', my_response: 'present' },
        { id: 'm2', my_response: null },
      ]),
    );
    expect(api).toHaveBeenCalledWith('/menages/m1/responses', { method: 'POST', body: { status: 'present' } });
    await act(async () => {
      release();
    });
  });

  it('restaure la liste si le serveur refuse le vote', async () => {
    const { wrapper, qc } = wrapperWith();
    const key = ['my-upcoming-menages', null, null, 'upcoming'];
    qc.setQueryDefaults(key, { gcTime: 60_000 });
    qc.setQueryData(key, [{ id: 'm1', my_response: 'absent' }]);
    api.mockRejectedValueOnce(new Error('400'));

    const { result } = renderHook(() => useRespondToMenageOptimistic(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ menageId: 'm1', status: 'present' }).catch(() => undefined);
    });
    expect(qc.getQueryData(key)).toEqual([{ id: 'm1', my_response: 'absent' }]);
  });
});
