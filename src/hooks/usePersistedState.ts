import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * `useState` + persistance AsyncStorage.
 *
 * Charge la valeur depuis le storage au mount ; sauve chaque modification.
 * Le state initial démarre toujours sur `defaultValue` (synchrone), puis la
 * valeur persistée prend le relai dès qu'elle est lue (cycle ms-court).
 *
 * Usage :
 * ```tsx
 * const [filter, setFilter] = usePersistedState('menages.filter.status', 'all');
 * ```
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const hydratedRef = useRef(false);

  // Hydratation initiale.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active || raw == null) return;
        try {
          setValue(JSON.parse(raw) as T);
        } catch {
          // Valeur corrompue → on garde le defaultValue.
        }
      })
      .finally(() => {
        hydratedRef.current = true;
      });
    return () => {
      active = false;
    };
  }, [key]);

  // Persistance des updates (skip le premier render pré-hydratation).
  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {
      // Silencieux : si le storage écrit pas, on continue en mémoire.
    });
  }, [key, value]);

  const reset = useCallback(() => setValue(defaultValue), [defaultValue]);

  return [value, setValue, reset] as const;
}
