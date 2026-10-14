/**
 * Demande de note sur les stores (build 1.0.1).
 *
 * On passe par le panneau **natif** (`expo-store-review` : SKStoreReviewController
 * sur iOS, In-App Review sur Android) et jamais par une popup maison : Apple
 * impose son API pour solliciter une note, et Google interdit de filtrer les
 * mécontents avant de les envoyer vers le store. Le système décide seul
 * d'afficher ou non le panneau (au plus 3 fois par an et par personne sur iOS) :
 * l'appeler ne garantit rien, mais ne harcèle personne.
 *
 * Quand : juste après une réussite, jamais au lancement ni après une erreur —
 * le 5e départ pointé d'un prestataire, la 10e validation d'un admin. Et pas
 * avant une semaine d'usage, pas plus d'une fois tous les 90 jours de notre côté.
 *
 * Le module est **natif** : chargé paresseusement comme `expo-haptics` (voir
 * `haptics.ts`), pour qu'un bundle qui tournerait sur un binaire sans lui ne
 * plante pas — il se tait, simplement.
 */
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';

/** Ce qu'on vient de réussir. */
export type ReviewSuccess = 'departure' | 'validation';

/** Nombre de réussites d'un même type avant de demander une note. */
export const REVIEW_THRESHOLDS: Record<ReviewSuccess, number> = { departure: 5, validation: 10 };
const DAY_MS = 24 * 60 * 60 * 1000;
/** Ancienneté minimale : on ne sollicite pas quelqu'un qui découvre l'app. */
export const MIN_USAGE_MS = 7 * DAY_MS;
/** Écart minimal entre deux demandes de notre part (Apple plafonne en plus à 3 par an). */
export const MIN_INTERVAL_MS = 90 * DAY_MS;
/** Laisse le temps à l'écran de confirmer la réussite avant le panneau. */
const PROMPT_DELAY_MS = 1500;

const STORAGE_KEY = 'store-review-state-v1';
const APP_STORE_ID = '6779764563';
const ANDROID_PACKAGE = 'fr.estiacleanconnect.app';
const ANDROID_PUBLISHED = false;

export interface ReviewState {
  firstSeenAt: number;
  lastAskedAt: number | null;
  counts: Record<ReviewSuccess, number>;
}

export function initialReviewState(now: number): ReviewState {
  return { firstSeenAt: now, lastAskedAt: null, counts: { departure: 0, validation: 0 } };
}

/**
 * Compte une réussite et dit s'il faut demander une note maintenant. Pure :
 * l'état est rangé par l'appelant. Une fois la demande faite, les compteurs
 * repartent de zéro — la prochaine viendra après autant de nouvelles réussites,
 * et au moins 90 jours plus tard.
 */
export function registerSuccess(
  state: ReviewState,
  kind: ReviewSuccess,
  now: number,
): { state: ReviewState; ask: boolean } {
  const counts = { ...state.counts, [kind]: state.counts[kind] + 1 };
  const ask =
    counts[kind] >= REVIEW_THRESHOLDS[kind] &&
    now - state.firstSeenAt >= MIN_USAGE_MS &&
    (state.lastAskedAt === null || now - state.lastAskedAt >= MIN_INTERVAL_MS);
  if (!ask) return { state: { ...state, counts }, ask: false };
  return { state: { ...state, lastAskedAt: now, counts: { departure: 0, validation: 0 } }, ask: true };
}

type ModuleStoreReview = typeof import('expo-store-review');

// `undefined` = pas encore tenté · `null` = absent de ce binaire.
let charge: ModuleStoreReview | null | undefined;

function obtenir(): ModuleStoreReview | null {
  if (charge !== undefined) return charge;
  try {
    // require() et non import() : la résolution doit se faire ici, dans le try.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    charge = require('expo-store-review') as ModuleStoreReview;
  } catch {
    charge = null;
  }
  return charge;
}

async function readState(now: number): Promise<ReviewState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ReviewState;
  } catch {
    /* stockage illisible : on repart de zéro */
  }
  const fresh = initialReviewState(now);
  await writeState(fresh);
  return fresh;
}

async function writeState(state: ReviewState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* sans conséquence : au pire on redemandera un peu plus tôt */
  }
}

/** Démarre le compteur d'ancienneté au premier lancement d'une version qui le connaît. */
export async function markFirstSeen(): Promise<void> {
  await readState(Date.now());
}

/**
 * À appeler après une réussite (départ pointé, prestation validée). Ne fait
 * rien hors ligne, sur le web, ni si le système n'a pas de panneau à offrir.
 */
export async function recordSuccess(kind: ReviewSuccess): Promise<void> {
  if (Platform.OS === 'web' || !onlineManager.isOnline()) return;
  const now = Date.now();
  const { state, ask } = registerSuccess(await readState(now), kind, now);
  if (!ask) {
    await writeState(state);
    return;
  }
  const module = obtenir();
  if (!module) return;
  try {
    if (!(await module.isAvailableAsync())) return;
    await writeState(state);
    setTimeout(() => {
      module.requestReview().catch(() => {});
    }, PROMPT_DELAY_MS);
  } catch {
    /* le panneau n'est pas disponible : on retentera aux prochaines réussites */
  }
}

/**
 * Lien permanent « Noter l'app » (Profil) : ouvre directement le formulaire
 * d'avis du store. Ici c'est la personne qui choisit, on peut l'offrir sans limite.
 */
export function storeReviewUrl(): string | null {
  if (Platform.OS === 'ios') return `itms-apps://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
  // Android : l'app n'est pas encore publiée sur le Play Store, le lien
  // mènerait nulle part. À activer à la publication.
  if (Platform.OS === 'android' && ANDROID_PUBLISHED) return `market://details?id=${ANDROID_PACKAGE}`;
  return null;
}

export async function openStoreReviewPage(): Promise<void> {
  const url = storeReviewUrl();
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    /* store absent (simulateur) : rien à faire */
  }
}
