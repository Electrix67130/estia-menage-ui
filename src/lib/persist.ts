import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

/** Clé unique du cache React Query persisté sur disque. */
export const PERSIST_KEY = 'ESTIA_RQ_CACHE';

/**
 * À incrémenter pour purger le cache persisté après un changement de forme des
 * données (breaking change de schéma qui rendrait l'ancien cache incompatible).
 */
export const PERSIST_BUSTER = 'v1';

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
  throttleTime: 1000,
});

/** Supprime le cache persisté (à appeler au logout pour ne rien laisser fuiter). */
export async function clearPersistedCache(): Promise<void> {
  await AsyncStorage.removeItem(PERSIST_KEY);
}
