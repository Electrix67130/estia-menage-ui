import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface MenagePrestataire {
  id: string;
  menage_id: string;
  user_id: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  avatar_thumbnail_url: string | null;
  /** Premier dans la liste (par created_at) — réplique de menage.prestataire_user_id */
  is_primary: boolean;
}

export function useMenagePrestataires(menageId: string | undefined) {
  return useQuery({
    queryKey: ['menage-prestataires', menageId],
    queryFn: () =>
      apiFetch<{ data: MenagePrestataire[] }>(`/menages/${menageId}/prestataires`).then(
        (r) => r.data,
      ),
    enabled: !!menageId,
    staleTime: 30_000,
  });
}

export function useSetMenagePrestataires(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prestataire_user_ids: string[]) =>
      apiFetch<{ data: MenagePrestataire[] }>(`/menages/${menageId}/prestataires`, {
        method: 'PUT',
        body: { prestataire_user_ids },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menage-prestataires', menageId] });
      qc.invalidateQueries({ queryKey: ['menages'] });
      qc.invalidateQueries({ queryKey: ['calendar-menages'] });
    },
  });
}

/** Désigne un prestataire déjà affecté comme référent (`is_primary`). */
export function useSetMenageReferent(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ data: MenagePrestataire[] }>(
        `/menages/${menageId}/prestataires/${userId}/primary`,
        { method: 'PUT' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menage-prestataires', menageId] });
      qc.invalidateQueries({ queryKey: ['menages'] });
      qc.invalidateQueries({ queryKey: ['calendar-menages'] });
    },
  });
}
