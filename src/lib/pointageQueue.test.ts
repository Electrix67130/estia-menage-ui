import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import {
  enqueuePointage,
  getPendingForMenage,
  getSnapshot,
  initPointageQueue,
  processQueue,
  usePendingPointage,
  type EnqueueInput,
} from './pointageQueue';
import { apiFetch } from '@/api/client';
import { uploadFile } from '@/api/upload';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));
jest.mock('@/api/client', () => ({ apiFetch: jest.fn(async () => ({})) }));
jest.mock('@/api/upload', () => ({ uploadFile: jest.fn() }));
jest.mock('@/utils/optimizeImage', () => ({
  optimizeImage: jest.fn(async (uri: string) => ({ uri: `${uri}.opt.jpg`, width: 800, height: 600, mimeType: 'image/jpeg' })),
}));

const STORAGE_KEY = 'pointage-queue-v1';
const api = apiFetch as jest.MockedFunction<typeof apiFetch>;
const upload = uploadFile as jest.MockedFunction<typeof uploadFile>;
const fs = FileSystem as jest.Mocked<typeof FileSystem>;

/** Laisse toute la chaîne de promesses (storage → upload → POST → persist) se dérouler. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

const photo = { uri: 'file:///cache/shot.jpg', width: 3000, height: 2000 };
const AT = '2026-10-05T07:58:12.000Z';

function arrivalInput(menageId: string): EnqueueInput {
  return {
    menageId,
    kind: 'arrival',
    isCheck: false,
    at: AT,
    lat: 43.7,
    lng: 7.26,
    photo,
    declaration: {
      travelerRating: 4,
      hasDegradation: true,
      note: 'Verre cassé',
      degradationPhotos: [{ uri: 'file:///cache/deg.jpg', width: 100, height: 100 }],
    },
  };
}

beforeEach(() => {
  api.mockReset().mockResolvedValue({});
  upload.mockReset().mockImplementation(async (uri: string) => ({
    url: `https://cdn/${uri.split('/').pop()}`,
    thumbnail_url: null,
    original_name: uri.split('/').pop() ?? 'photo.jpg',
    file_size: 123,
    mime_type: 'image/jpeg',
  }));
  fs.copyAsync.mockClear();
  fs.deleteAsync.mockClear();
  fs.makeDirectoryAsync.mockClear();
  onlineManager.setOnline(true);
});

afterEach(() => onlineManager.setOnline(true));

describe('File d’attente hors ligne des pointages', () => {
  it('hors ligne : capture locale puis, au retour du réseau, upload + POST arrival avec l’heure RÉELLE', async () => {
    const qc = new QueryClient();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    initPointageQueue(qc);
    onlineManager.setOnline(false);

    await enqueuePointage(arrivalInput('m1'));
    await settle();

    // — Hors ligne : rien ne part, tout est capturé localement et persisté.
    expect(api).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith('file:///docs/pointage-queue/', { intermediates: true });
    // Photo de preuve ET photo de dégradation : optimisées puis copiées dans le dossier durable.
    expect(fs.copyAsync).toHaveBeenCalledTimes(2);
    expect(fs.copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/shot.jpg.opt.jpg',
      to: expect.stringMatching(/^file:\/\/\/docs\/pointage-queue\/.+\.jpg$/),
    });
    const entry = getPendingForMenage('m1');
    expect(entry).toMatchObject({ menageId: 'm1', kind: 'arrival', at: AT, status: 'pending', attempts: 0, travelerRating: 4, hasDegradation: true });
    expect(entry?.photoLocalUri).toMatch(/^file:\/\/\/docs\/pointage-queue\//);
    expect(entry?.degradationLocalUris).toHaveLength(1);
    const persisted = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as { menageId: string }[];
    expect(persisted.map((e) => e.menageId)).toContain('m1');

    // — Retour du réseau : rejeu automatique.
    onlineManager.setOnline(true);
    await settle();

    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledWith(entry?.photoLocalUri, `pointage-${entry?.id}.jpg`, 'image/jpeg');
    expect(api).toHaveBeenCalledTimes(1);
    const [url, options] = api.mock.calls[0] as [string, { method: string; body: Record<string, unknown> }];
    expect(url).toBe('/menages/m1/arrival');
    expect(options.method).toBe('POST');
    expect(options.body).toMatchObject({
      arrived_at: AT, // l'heure capturée à l'appui, pas l'heure de synchro
      lat: 43.7,
      lng: 7.26,
      traveler_rating: 4,
      has_degradation: true,
      degradation_note: 'Verre cassé',
    });
    expect(options.body.photo_url).toMatch(/^https:\/\/cdn\//);
    expect(options.body.degradation_photos).toEqual([
      expect.objectContaining({ url: expect.stringMatching(/^https:\/\/cdn\//), file_size: 123, mime_type: 'image/jpeg' }),
    ]);

    expect(getPendingForMenage('m1')).toBeUndefined();
    expect(fs.deleteAsync).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['menages'] });
    const after = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as { menageId: string }[];
    expect(after.map((e) => e.menageId)).not.toContain('m1');
  });

  it('départ d’un check-in/out : ni photo ni upload, POST departure avec departed_at', async () => {
    await enqueuePointage({ menageId: 'm2', kind: 'departure', isCheck: true, at: AT, lat: null, lng: null });
    await settle();

    expect(upload).not.toHaveBeenCalled();
    expect(api).toHaveBeenCalledWith('/menages/m2/departure', { method: 'POST', body: { departed_at: AT } });
    expect(getPendingForMenage('m2')).toBeUndefined();
  });

  it('échec d’envoi : l’entrée reste en attente et compte ses tentatives, puis passe en erreur après 5 échecs', async () => {
    api.mockRejectedValue(new Error('500'));

    await enqueuePointage({ menageId: 'm3', kind: 'departure', isCheck: true, at: AT, lat: null, lng: null });
    await settle();
    expect(getPendingForMenage('m3')).toMatchObject({ status: 'pending', attempts: 1 });

    for (let i = 0; i < 4; i++) await processQueue();
    expect(getPendingForMenage('m3')).toMatchObject({ status: 'error', attempts: 5 });

    // En erreur : plus jamais retentée.
    api.mockClear();
    await processQueue();
    expect(api).not.toHaveBeenCalled();
  });

  it('au redémarrage de l’app, la file persistée est rechargée et rejouée', async () => {
    const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as unknown[];
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        ...stored,
        { id: 'old-1', menageId: 'm4', kind: 'departure', isCheck: true, at: AT, photoLocalUri: null, lat: null, lng: null, attempts: 0, status: 'pending', createdAt: AT },
      ]),
    );

    // Nouvelle instance du module = nouveau démarrage (file mémoire vide).
    let fresh!: typeof import('./pointageQueue');
    jest.isolateModules(() => {
      fresh = jest.requireActual<typeof import('./pointageQueue')>('./pointageQueue');
    });
    fresh.initPointageQueue(new QueryClient());
    await settle();

    expect(api).toHaveBeenCalledWith('/menages/m4/departure', { method: 'POST', body: { departed_at: AT } });
    expect(fresh.getSnapshot().find((e) => e.menageId === 'm4')).toBeUndefined();
  });

  it('usePendingPointage (réactif) : l’entrée en attente du ménage, puis null une fois envoyée', async () => {
    onlineManager.setOnline(false);
    const { result } = renderHook(() => usePendingPointage('m5'));
    expect(result.current).toBeNull();

    await act(async () => {
      await enqueuePointage({ menageId: 'm5', kind: 'departure', isCheck: true, at: AT, lat: null, lng: null });
    });
    expect(result.current).toMatchObject({ menageId: 'm5', status: 'pending', at: AT });
    expect(getSnapshot()).toContain(result.current);

    await act(async () => {
      onlineManager.setOnline(true);
      await processQueue();
      await settle();
    });
    expect(result.current).toBeNull();
    expect(renderHook(() => usePendingPointage(undefined)).result.current).toBeNull();
  });
});
