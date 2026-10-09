import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

/** Catégories de notifications, une par type d'événement. */
export interface NotificationCategories {
  assignment: boolean;
  available: boolean;
  reminders: boolean;
  reschedule: boolean;
  presence: boolean;
  pointage: boolean;
  validation: boolean;
  comments: boolean;
  mentions: boolean;
  consumables: boolean;
  invitations: boolean;
  reports: boolean;
}

export type NotificationPreferenceKey = keyof NotificationCategories;
export type LogementNotificationLevel = 'all' | 'important' | 'none';

/**
 * Réglages façon Buildr : l'interrupteur général, les catégories (à plat), et
 * les logements dont le réglage n'est pas « tout ».
 */
export type NotificationPreferences = NotificationCategories & {
  push_enabled: boolean;
  logements: { logement_id: string; logement_name: string; level: Exclude<LogementNotificationLevel, 'all'> }[];
};

type PreferenceUpdate = { key: NotificationPreferenceKey; enabled: boolean } | { push_enabled: boolean };

const QUERY_KEY = ['notification-preferences'] as const;

export function useNotificationPreferences() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<NotificationPreferences>('/notification-preferences'),
  });
}

export function useUpdateNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PreferenceUpdate) =>
      apiFetch<PreferenceUpdate>('/notification-preferences', { method: 'PATCH', body }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const previous = qc.getQueryData<NotificationPreferences>(QUERY_KEY);
      if (previous) {
        qc.setQueryData<NotificationPreferences>(
          QUERY_KEY,
          'push_enabled' in body ? { ...previous, push_enabled: body.push_enabled } : { ...previous, [body.key]: body.enabled },
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData<NotificationPreferences>(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useLogementNotificationLevel(logementId: string | undefined) {
  return useQuery({
    queryKey: ['notification-preferences', 'logement', logementId],
    queryFn: () =>
      apiFetch<{ logement_id: string; level: LogementNotificationLevel }>(
        `/notification-preferences/logements/${logementId}`,
      ),
    enabled: !!logementId,
  });
}

/** Tout, l'important, ou rien — pour un logement. Rafraîchit le réglage et la liste. */
export function useSetLogementNotificationLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ logementId, level }: { logementId: string; level: LogementNotificationLevel }) =>
      apiFetch(`/notification-preferences/logements/${logementId}`, { method: 'PUT', body: { level } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
