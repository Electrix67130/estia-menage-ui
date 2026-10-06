import { describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERSIST_BUSTER, PERSIST_KEY, clearPersistedCache, persister } from './persist';

describe('Cache React Query persisté (offline)', () => {
  it('le buster est une version explicite à incrémenter après un breaking change', () => {
    expect(PERSIST_BUSTER).toMatch(/^v\d+$/);
  });

  it('clearPersistedCache (logout) supprime la clé du cache', async () => {
    await AsyncStorage.setItem(PERSIST_KEY, '{"clientState":{}}');
    await clearPersistedCache();
    expect(await AsyncStorage.getItem(PERSIST_KEY)).toBeNull();
  });

  it('le persister lit/écrit sous la clé dédiée', async () => {
    await persister.removeClient();
    expect(await persister.restoreClient()).toBeUndefined();
  });
});
