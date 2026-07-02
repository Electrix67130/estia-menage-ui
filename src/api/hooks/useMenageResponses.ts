import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type MenageResponseStatus = 'present' | 'absent';

export interface MenageResponse {
  id: string;
  menage_id: string;
  user_id: string;
  status: MenageResponseStatus;
  responded_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface MyUpcomingMenage {
  id: string;
  logement_id: string;
  logement_name: string | null;
  logement_color: string | null;
  logement_address: string | null;
  logement_city: string | null;
  date_prevue: string;
  horaire_prevu: string | null;
  horaire_fin_prevu: string | null;
  duree_estimee_min: number | null;
  status: 'a_venir' | 'en_cours' | 'termine' | 'valide' | 'annule';
  /** Type de prestation : ménage (défaut), check-in ou check-out. */
  prestation_type: 'menage' | 'check_in' | 'check_out';
  /** Calculé côté API : jour passé + aucun pointage + statut a_venir. */
  needs_attention?: boolean;
  my_response: MenageResponseStatus | null;
  is_assigned: boolean;
  assigned_to_someone: boolean;
  referent_first_name: string | null;
  referent_last_name: string | null;
  done_by_me: boolean;
}

export function useMenageResponses(menageId: string | undefined) {
  return useQuery({
    queryKey: ['menage-responses', menageId],
    queryFn: () =>
      apiFetch<{ data: MenageResponse[] }>(`/menages/${menageId}/responses`).then((r) => r.data),
    enabled: !!menageId,
    staleTime: 30_000,
  });
}

export function useSetMenageResponse(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: MenageResponseStatus) =>
      apiFetch(`/menages/${menageId}/responses`, { method: 'POST', body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menage-responses', menageId] });
      qc.invalidateQueries({ queryKey: ['my-upcoming-menages'] });
    },
  });
}

/**
 * Admin only : flip le vote d'un prestataire (présent ↔ absent).
 * Le backend valide que l'appelant est bien admin de l'org du ménage.
 */
export function useOverrideMenageResponse(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: MenageResponseStatus }) =>
      apiFetch(`/menages/${menageId}/responses`, {
        method: 'POST',
        body: { status, user_id: userId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menage-responses', menageId] });
      qc.invalidateQueries({ queryKey: ['my-upcoming-menages'] });
    },
  });
}

export function useMyUpcomingMenages(params?: {
  from?: string;
  to?: string;
  mode?: 'upcoming' | 'history';
}) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.mode) qs.set('mode', params.mode);
  const query = qs.toString();
  return useQuery({
    queryKey: [
      'my-upcoming-menages',
      params?.from ?? null,
      params?.to ?? null,
      params?.mode ?? 'upcoming',
    ],
    queryFn: () =>
      apiFetch<{ data: MyUpcomingMenage[] }>(
        `/prestataires/me/menages${query ? `?${query}` : ''}`,
      ).then((r) => r.data),
    staleTime: 30_000,
  });
}

/**
 * Mutation optimiste utilisée dans la liste "Mes prochains ménages" :
 * met à jour `my_response` localement avant la confirmation serveur pour que
 * le tap "Présent/Absent" soit instantané.
 */
export function useRespondToMenageOptimistic(params?: { from?: string; to?: string }) {
  const qc = useQueryClient();
  const queryKey = ['my-upcoming-menages', params?.from ?? null, params?.to ?? null];
  return useMutation({
    mutationFn: ({ menageId, status }: { menageId: string; status: MenageResponseStatus }) =>
      apiFetch(`/menages/${menageId}/responses`, { method: 'POST', body: { status } }),
    onMutate: async ({ menageId, status }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<MyUpcomingMenage[]>(queryKey);
      if (previous) {
        qc.setQueryData<MyUpcomingMenage[]>(
          queryKey,
          previous.map((m) => (m.id === menageId ? { ...m, my_response: status } : m)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['menage-responses', vars.menageId] });
    },
  });
}
