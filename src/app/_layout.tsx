import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { DialogProvider } from '@/contexts/DialogContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { initOnlineManager } from '@/lib/network';
import { initPointageQueue } from '@/lib/pointageQueue';
import { persister, PERSIST_BUSTER } from '@/lib/persist';
import OfflineBanner from '@/components/OfflineBanner';

SplashScreen.preventAutoHideAsync();

// Détection réseau (JS pur) → pause/reprise auto des requêtes React Query.
initOnlineManager();

// Afficher les notifications même quand l'app est au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      // Rétention 24 h : les requêtes doivent survivre en cache assez longtemps
      // pour être persistées sur disque et rechargées hors ligne.
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
    },
    mutations: {
      // Lecture seule offline : une action tentée hors ligne échoue tout de
      // suite (au lieu d'être mise en file et rejouée au retour du réseau).
      networkMode: 'always',
    },
  },
});

// File d'attente des pointages hors ligne : traitée au retour du réseau.
initPointageQueue(queryClient);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const splashHiddenRef = useRef(false);

  // WS realtime — actif des qu'authentifie. Sur close 4001 (session-replaced),
  // on declenche le logout immediatement.
  useRealtimeSync({
    enabled: isAuthenticated,
    onSessionReplaced: () => {
      logout();
    },
  });

  // Notifications push : enregistrement du token une fois authentifié.
  usePushRegistration(isAuthenticated);

  // Au tap sur une notification → ouvrir le ménage concerné.
  useEffect(() => {
    const goToMenage = (response: Notifications.NotificationResponse | null) => {
      const menageId = response?.notification.request.content.data?.menage_id;
      if (typeof menageId === 'string') {
        router.push(`/menage/${menageId}`);
      }
    };
    // App lancée depuis une notification (cold start).
    Notifications.getLastNotificationResponseAsync().then(goToMenage);
    // App déjà ouverte / en arrière-plan.
    const sub = Notifications.addNotificationResponseReceivedListener(goToMenage);
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }

    // Hide une seule fois — sinon expo-splash-screen renvoie une erreur sur les
    // appels suivants ("No native splash screen registered for given view controller").
    if (!splashHiddenRef.current) {
      splashHiddenRef.current = true;
      SplashScreen.hideAsync().catch(() => {
        // Si le splash a deja ete ferme par le systeme, on ignore.
      });
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24, // 24 h : au-delà, cache considéré périmé
          buster: PERSIST_BUSTER,
          dehydrateOptions: {
            // Ne persister que les requêtes réussies (jamais d'erreurs/loading).
            shouldDehydrateQuery: (query) => query.state.status === 'success',
          },
        }}
      >
        <I18nProvider>
          <ThemeProvider>
            <DialogProvider>
              <AuthProvider>
              <AuthGuard>
              <StatusBar style="auto" />
              <OfflineBanner>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="+not-found" />
                </Stack>
              </OfflineBanner>
              </AuthGuard>
              </AuthProvider>
            </DialogProvider>
          </ThemeProvider>
        </I18nProvider>
      </PersistQueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
