import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { initOnlineManager } from './network';
import { probeApi } from '@/api/client';

jest.mock('@/api/client', () => ({ probeApi: jest.fn(async () => true) }));

const probe = probeApi as jest.MockedFunction<typeof probeApi>;

/** Laisse les promesses de la sonde se résoudre (micro-tâches uniquement). */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('Détection réseau 100 % JS → onlineManager', () => {
  let appStateHandler: ((s: AppStateStatus) => void) | null = null;
  const remove = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    probe.mockReset();
    remove.mockReset();
    appStateHandler = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      appStateHandler = handler as (s: AppStateStatus) => void;
      return { remove };
    });
  });

  afterEach(() => {
    // Rebranche un écouteur neutre et remet l'app « en ligne » pour les autres tests.
    onlineManager.setEventListener(() => () => undefined);
    onlineManager.setOnline(true);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('sonde l’API immédiatement et passe hors ligne si elle est injoignable', async () => {
    probe.mockResolvedValue(false);
    initOnlineManager();
    await flush();
    expect(probe).toHaveBeenCalledTimes(1);
    expect(onlineManager.isOnline()).toBe(false);
  });

  it('re-sonde au retour au premier plan et repasse en ligne', async () => {
    probe.mockResolvedValueOnce(false);
    initOnlineManager();
    await flush();
    expect(onlineManager.isOnline()).toBe(false);

    probe.mockResolvedValue(true);
    appStateHandler?.('active');
    await flush();
    expect(probe).toHaveBeenCalledTimes(2);
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('ignore les passages en arrière-plan', async () => {
    probe.mockResolvedValue(true);
    initOnlineManager();
    await flush();
    appStateHandler?.('background');
    appStateHandler?.('inactive');
    await flush();
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('filet de sécurité : une sonde toutes les 20 s', async () => {
    probe.mockResolvedValue(true);
    initOnlineManager();
    await flush();
    jest.advanceTimersByTime(20_000);
    await flush();
    jest.advanceTimersByTime(20_000);
    await flush();
    expect(probe).toHaveBeenCalledTimes(3);
  });

  it('le nettoyage coupe l’écouteur AppState et l’intervalle', async () => {
    probe.mockResolvedValue(true);
    initOnlineManager();
    await flush();
    // Remplacer l'écouteur déclenche le cleanup du précédent.
    onlineManager.setEventListener(() => () => undefined);
    expect(remove).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(probe).toHaveBeenCalledTimes(1);
  });
});
