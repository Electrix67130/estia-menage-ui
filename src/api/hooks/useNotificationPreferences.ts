import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface NotificationPreferences {
  assignment: boolean;
  available: boolean;
  reminders: boolean;
  reschedule: boolean;
  presence: boolean;
  pointage: boolean;
  validation: boolean;
  comments: boolean;
  consumables: boolean;
  invitations: boolean;
}

export type NotificationPreferenceKey = keyof NotificationPreferences;

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
    mutationFn: ({ key, enabled }: { key: NotificationPreferenceKey; enabled: boolean }) =>
      apiFetch<{ key: NotificationPreferenceKey; enabled: boolean }>('/notification-preferences', {
        method: 'PATCH',
        body: { key, enabled },
      }),
    onMutate: async ({ key, enabled }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const previous = qc.getQueryData<NotificationPreferences>(QUERY_KEY);
      if (previous) {
        qc.setQueryData<NotificationPreferences>(QUERY_KEY, { ...previous, [key]: enabled });
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
