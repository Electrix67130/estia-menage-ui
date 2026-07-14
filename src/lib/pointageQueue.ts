import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';

/**
 * File d'attente hors ligne pour les pointages (arrivée / départ).
 *
 * Un pointage fait sans réseau est capturé localement (photo + GPS + **heure
 * réelle**), la photo est copiée dans un dossier durable, puis l'entrée est
 * persistée sur AsyncStorage. Au retour du réseau (`onlineManager`), le
 * processeur uploade la/les photo(s) et POST le pointage en envoyant l'heure
 * capturée (`arrived_at` / `departed_at`) — l'API l'enregistre telle quelle.
 *
 * 100 % JS (AsyncStorage + expo-file-system) → livrable en OTA.
 */

const STORAGE_KEY = 'pointage-queue-v1';
const QUEUE_DIR = `${FileSystem.documentDirectory}pointage-queue/`;
const MAX_ATTEMPTS = 5;

export type PointageKind = 'arrival' | 'departure';

export interface QueuedPointage {
  id: string;
  menageId: string;
  kind: PointageKind;
  /** check-in/check-out : pas de photo/GPS obligatoire. */
  isCheck: boolean;
  /** Heure réelle du pointage (ISO), capturée à l'appui. */
  at: string;
  /** Chemin durable de la photo de preuve (null pour un check sans photo). */
  photoLocalUri: string | null;
  lat: number | null;
  lng: number | null;
  travelerRating?: number;
  hasDegradation?: boolean;
  degradationNote?: string;
  /** Chemins durables des photos de dégradation (arrivée). */
  degradationLocalUris?: string[];
  attempts: number;
  status: 'pending' | 'error';
  createdAt: string;
}

interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Référence vide stable (useSyncExternalStore exige un snapshot mémoïsé). */
const EMPTY: QueuedPointage[] = [];

let queue: QueuedPointage[] | null = null;
let queryClient: QueryClient | null = null;
let processing = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(QUEUE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true });
  }
}

async function load(): Promise<QueuedPointage[]> {
  if (queue) return queue;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    queue = raw ? (JSON.parse(raw) as QueuedPointage[]) : [];
  } catch {
    queue = [];
  }
  return queue;
}

async function persist(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue ?? []));
}

/** Optimise puis copie une image capturée dans le dossier durable. */
async function persistPhoto(photo: CapturedPhoto): Promise<string> {
  await ensureDir();
  const optimized = await optimizeImage(photo.uri, photo.width, photo.height);
  const dest = `${QUEUE_DIR}${newId()}.jpg`;
  await FileSystem.copyAsync({ from: optimized.uri, to: dest });
  return dest;
}

async function deleteLocalFiles(entry: QueuedPointage): Promise<void> {
  const uris = [entry.photoLocalUri, ...(entry.degradationLocalUris ?? [])].filter(
    (u): u is string => !!u,
  );
  await Promise.all(
    uris.map((u) => FileSystem.deleteAsync(u, { idempotent: true }).catch(() => undefined)),
  );
}

export interface EnqueueInput {
  menageId: string;
  kind: PointageKind;
  isCheck: boolean;
  at: string;
  lat: number | null;
  lng: number | null;
  photo?: CapturedPhoto | null;
  declaration?: {
    travelerRating?: number;
    hasDegradation?: boolean;
    note?: string;
    degradationPhotos?: CapturedPhoto[];
  };
}

/**
 * Met un pointage en file d'attente (copie durable des photos incluse) puis
 * tente de le traiter immédiatement (utile si le réseau est en fait revenu).
 */
export async function enqueuePointage(input: EnqueueInput): Promise<void> {
  const list = await load();
  const photoLocalUri = input.photo ? await persistPhoto(input.photo) : null;
  const degradationLocalUris = input.declaration?.degradationPhotos?.length
    ? await Promise.all(input.declaration.degradationPhotos.map((p) => persistPhoto(p)))
    : undefined;

  const entry: QueuedPointage = {
    id: newId(),
    menageId: input.menageId,
    kind: input.kind,
    isCheck: input.isCheck,
    at: input.at,
    photoLocalUri,
    lat: input.lat,
    lng: input.lng,
    travelerRating: input.declaration?.travelerRating,
    hasDegradation: input.declaration?.hasDegradation,
    degradationNote: input.declaration?.note,
    degradationLocalUris,
    attempts: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  // Nouvelle référence de tableau à chaque mutation → useSyncExternalStore
  // détecte le changement et re-rend les abonnés.
  queue = [...list, entry];
  await persist();
  emit();
  void processQueue();
}

/** Pointage en attente/erreur pour un ménage (undefined si aucun). */
export function getPendingForMenage(menageId: string): QueuedPointage | undefined {
  return (queue ?? []).find((e) => e.menageId === menageId);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Snapshot stable pour useSyncExternalStore. */
export function getSnapshot(): QueuedPointage[] {
  return queue ?? EMPTY;
}

/** Réactif : le pointage en file d'attente pour ce ménage (ou null). */
export function usePendingPointage(menageId: string | undefined): QueuedPointage | null {
  const all = useSyncExternalStore(subscribe, getSnapshot);
  if (!menageId) return null;
  return all.find((e) => e.menageId === menageId) ?? null;
}

async function sendEntry(e: QueuedPointage): Promise<void> {
  let photoUrl: string | undefined;
  if (e.photoLocalUri) {
    const up = await uploadFile(e.photoLocalUri, `pointage-${e.id}.jpg`, 'image/jpeg');
    photoUrl = up.url;
  }

  const geo = {
    ...(photoUrl ? { photo_url: photoUrl } : {}),
    ...(e.lat != null ? { lat: e.lat } : {}),
    ...(e.lng != null ? { lng: e.lng } : {}),
  };

  if (e.kind === 'arrival') {
    let degradationPhotos:
      | { url: string; thumbnail_url?: string; file_size?: number; mime_type?: string }[]
      | undefined;
    if (e.hasDegradation && e.degradationLocalUris?.length) {
      degradationPhotos = [];
      for (const uri of e.degradationLocalUris) {
        const up = await uploadFile(uri, `degradation-${e.id}.jpg`, 'image/jpeg');
        degradationPhotos.push({
          url: up.url,
          thumbnail_url: up.thumbnail_url ?? undefined,
          file_size: up.file_size,
          mime_type: up.mime_type,
        });
      }
    }
    await apiFetch(`/menages/${e.menageId}/arrival`, {
      method: 'POST',
      body: {
        ...geo,
        arrived_at: e.at,
        ...(e.travelerRating != null ? { traveler_rating: e.travelerRating } : {}),
        ...(e.hasDegradation != null ? { has_degradation: e.hasDegradation } : {}),
        ...(e.degradationNote ? { degradation_note: e.degradationNote } : {}),
        ...(degradationPhotos ? { degradation_photos: degradationPhotos } : {}),
      },
    });
  } else {
    await apiFetch(`/menages/${e.menageId}/departure`, {
      method: 'POST',
      body: { ...geo, departed_at: e.at },
    });
  }
}

/**
 * Traite la file : uploade + POST chaque pointage en attente, dans l'ordre.
 * Ne fait rien hors ligne. Idempotent (un seul passage concurrent).
 */
export async function processQueue(): Promise<void> {
  if (processing || !onlineManager.isOnline()) return;
  processing = true;
  try {
    const list = await load();
    for (const entry of list.filter((e) => e.status === 'pending')) {
      if (!onlineManager.isOnline()) break;
      try {
        await sendEntry(entry);
        await deleteLocalFiles(entry);
        queue = (queue ?? []).filter((e) => e.id !== entry.id);
        await persist();
        emit();
        queryClient?.invalidateQueries({ queryKey: ['menages'] });
      } catch {
        const attempts = entry.attempts + 1;
        const updated: QueuedPointage = {
          ...entry,
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'error' : 'pending',
        };
        // Nouvelle référence (objet + tableau) pour rafraîchir les abonnés.
        queue = (queue ?? []).map((e) => (e.id === entry.id ? updated : e));
        await persist();
        emit();
        // On passe au suivant ; on retentera au prochain déclenchement.
      }
    }
  } finally {
    processing = false;
  }
}

/**
 * À appeler une fois au démarrage de l'app (racine). Charge la file, branche le
 * traitement sur le retour du réseau, et tente un premier passage.
 */
export function initPointageQueue(qc: QueryClient): void {
  queryClient = qc;
  void load().then(() => {
    emit();
    void processQueue();
  });
  onlineManager.subscribe((online) => {
    if (online) void processQueue();
  });
}
