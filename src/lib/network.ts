import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { probeApi } from '@/api/client';

/** Réactif : true si l'API est joignable, false sinon (piloté par initOnlineManager). */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

/**
 * Branche l'onlineManager de React Query sur une détection réseau 100 % JS
 * (pas de module natif → livrable en OTA).
 *
 * - Sonde l'API au démarrage, à chaque retour au premier plan (AppState) et
 *   sur un intervalle léger tant que l'app est active.
 * - Quand offline : React Query met les requêtes en pause mais **continue de
 *   servir le cache** (mémoire + persisté). Au retour du réseau, il rafraîchit
 *   tout seul (refetchOnReconnect).
 *
 * À appeler une seule fois, au chargement du module racine.
 */
export function initOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    let cancelled = false;

    const check = async () => {
      const reachable = await probeApi();
      if (!cancelled) setOnline(reachable);
    };

    // Sonde immédiate.
    check();

    // Re-sonde au retour au premier plan (cas principal : réouverture de l'app).
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    // Filet de sécurité pour détecter un retour de réseau pendant l'usage.
    // 20 s : négligeable côté batterie, et JS suspendu en arrière-plan sur iOS.
    const interval = setInterval(check, 20_000);

    return () => {
      cancelled = true;
      appStateSub.remove();
      clearInterval(interval);
    };
  });
}
