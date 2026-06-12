import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiFetch } from '@/api/client';

/**
 * Enregistrement des notifications push (Expo) côté appareil.
 *
 * Flux : demande de permission → récupération du token Expo → envoi à l'API
 * (`POST /device-tokens`). Tout est try/catch : sur simulateur / web, ou si
 * l'utilisateur refuse, on échoue silencieusement sans casser l'app.
 */

let cachedToken: string | null = null;

export async function registerPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    cachedToken = token;

    await apiFetch('/device-tokens', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
    return token;
  } catch (err) {
    console.warn('[push] registration failed', err);
    return null;
  }
}

export async function unregisterPushToken(): Promise<void> {
  if (!cachedToken) return;
  try {
    await apiFetch('/device-tokens', { method: 'DELETE', body: { token: cachedToken } });
  } catch {
    // ignore — le logout doit aboutir quoi qu'il arrive
  }
  cachedToken = null;
}

/** Enregistre le token push une fois l'utilisateur authentifié. */
export function usePushRegistration(enabled: boolean): void {
  const doneRef = useRef(false);
  useEffect(() => {
    if (!enabled) {
      doneRef.current = false;
      return;
    }
    if (doneRef.current) return;
    doneRef.current = true;
    registerPushToken();
  }, [enabled]);
}
