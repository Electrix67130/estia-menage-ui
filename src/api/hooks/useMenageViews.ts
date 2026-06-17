import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type MenageTab =
  | 'comments'
  | 'comments_steps'
  | 'photos'
  | 'documents'
  | 'emergencies'
  | 'emergencies_claim';

export interface UnreadCounts {
  comments: number;
  comments_steps: number;
  photos: number;
  documents: number;
  emergencies: number;
  emergencies_claim: number;
  unread_step_ids: string[];
  unread_emergency_ids: string[];
  /** Dernière consultation de l'onglet commentaires — null si jamais consulté. */
  comments_last_viewed_at: string | null;
}

export interface UnreadSummary {
  by_menage: Record<string, number>;
  by_organization: Record<string, number>;
}

/** Totaux de non-lus par ménage (alimente les pastilles des listes). */
export function useUnreadSummary(enabled: boolean = true) {
  return useQuery({
    queryKey: ['menage-views', 'unread-summary'],
    queryFn: () => apiFetch<UnreadSummary>('/menage-views/unread-summary'),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Compteurs détaillés d'un ménage (dont le seuil de lecture des commentaires). */
export function useUnreadCounts(menageId?: string) {
  return useQuery({
    queryKey: ['menage-views', 'unread', menageId],
    queryFn: () => apiFetch<UnreadCounts>(`/menage-views/unread?menage_id=${menageId}`),
    enabled: !!menageId,
    staleTime: 30_000,
  });
}

/** Marque un onglet d'un ménage comme lu (avance `last_viewed_at`). */
export function useMarkTabViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ menage_id, tab }: { menage_id: string; tab: MenageTab }) =>
      apiFetch<void>('/menage-views', { method: 'POST', body: { menage_id, tab } }),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['menage-views', 'unread', vars.menage_id] });
      qc.invalidateQueries({ queryKey: ['menage-views', 'unread-summary'] });
    },
  });
}
