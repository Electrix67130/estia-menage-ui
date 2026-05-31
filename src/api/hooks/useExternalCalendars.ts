import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type ExternalCalendarProvider = 'airbnb' | 'booking' | 'vrbo' | 'ical';

export interface ExternalCalendar {
  id: string;
  logement_id: string;
  provider: ExternalCalendarProvider;
  label: string | null;
  url: string;
  enabled: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  fetched_events: number;
  created_menages: number;
  updated_menages: number;
  cancelled_menages: number;
  error?: string;
  calendar: ExternalCalendar;
}

export function useExternalCalendars(logementId: string | undefined) {
  return useQuery({
    queryKey: ['external-calendars', logementId],
    queryFn: () =>
      apiFetch<{ data: ExternalCalendar[] }>(
        `/logement-external-calendars?logement_id=${logementId}`,
      ).then((r) => r.data),
    enabled: !!logementId,
    staleTime: 30_000,
  });
}

export interface CreateExternalCalendarInput {
  logement_id: string;
  provider?: ExternalCalendarProvider;
  label?: string;
  url: string;
}

export function useCreateExternalCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateExternalCalendarInput) =>
      apiFetch<ExternalCalendar>('/logement-external-calendars', { method: 'POST', body }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['external-calendars', vars.logement_id] });
    },
  });
}

export function useDeleteExternalCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/logement-external-calendars/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['external-calendars'] });
    },
  });
}

export function useSyncExternalCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SyncResult>(`/logement-external-calendars/${id}/sync`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['external-calendars'] });
      // Le sync crée/met à jour des ménages → on rafraîchit la liste.
      qc.invalidateQueries({ queryKey: ['menages'] });
    },
  });
}
