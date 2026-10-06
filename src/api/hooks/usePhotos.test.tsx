import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createPhotoRequest, useDeletePhoto, useLogementPhotos, usePhotos } from './usePhotos';
import { apiFetch } from '@/api/client';
import { makeQueryClient } from '@/test-utils/render';

jest.mock('@/api/client', () => ({ apiFetch: jest.fn(async () => ({ data: [], meta: {} })) }));

const api = apiFetch as jest.MockedFunction<typeof apiFetch>;

function wrapperWith(qc = makeQueryClient()) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { wrapper: Wrapper, qc };
}

beforeEach(() => {
  api.mockClear();
  api.mockResolvedValue({ data: [], meta: {} });
});

describe('usePhotos — photos d’une prestation', () => {
  it('inactif sans id ; sinon GET /photos?menage_id=…&limit=100', async () => {
    const off = renderHook(() => usePhotos(undefined), wrapperWith());
    expect(off.result.current.fetchStatus).toBe('idle');
    const on = renderHook(() => usePhotos('m1'), wrapperWith());
    await waitFor(() => expect(on.result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith('/photos?menage_id=m1&limit=100');
  });
});

describe('useLogementPhotos — photos de référence du logement', () => {
  it('par logement, et optionnellement par pièce', async () => {
    const a = renderHook(() => useLogementPhotos('l1'), wrapperWith());
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith('/photos?logement_id=l1&limit=100');

    const b = renderHook(() => useLogementPhotos('l1', 'room-2'), wrapperWith());
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith('/photos?logement_id=l1&logement_room_id=room-2&limit=100');
  });

  it('inactif sans logement', () => {
    const { result } = renderHook(() => useLogementPhotos(undefined), wrapperWith());
    expect(result.current.fetchStatus).toBe('idle');
    expect(api).not.toHaveBeenCalled();
  });
});

describe('ajout multiple — une création par photo, sans refetch intermédiaire', () => {
  it('createPhotoRequest POST /photos et ne touche pas au cache', async () => {
    api.mockResolvedValue({ id: 'p1' });
    const res = await createPhotoRequest({ menage_id: 'm1', url: 'https://cdn/p.jpg', taken_at: '2026-10-05T10:00:00.000Z' });
    expect(api).toHaveBeenCalledWith('/photos', { method: 'POST', body: { menage_id: 'm1', url: 'https://cdn/p.jpg', taken_at: '2026-10-05T10:00:00.000Z' } });
    expect(res).toEqual({ id: 'p1' });
  });

  it('useDeletePhoto DELETE /photos/:id puis invalide toutes les galeries', async () => {
    const { wrapper, qc } = wrapperWith();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    api.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeletePhoto(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('p1');
    });
    expect(api).toHaveBeenCalledWith('/photos/p1', { method: 'DELETE' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['photos'] });
  });
});
