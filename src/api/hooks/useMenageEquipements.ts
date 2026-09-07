import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

/** Équipement du logement demandé « à préparer » pour une prestation. */
export interface MenageEquipement {
  id: string;
  menage_id: string;
  logement_equipement_id: string;
  quantity: number;
  notes: string | null;
  done_at: string | null;
  done_by: string | null;
  label: string;
  category: string | null;
  room_name: string | null;
  done_by_first_name: string | null;
  done_by_last_name: string | null;
}

export function useMenageEquipements(menageId: string | undefined) {
  return useQuery({
    queryKey: ['menage-equipements', menageId],
    queryFn: () => apiFetch<MenageEquipement[]>(`/menages/${menageId}/equipements`),
    enabled: !!menageId,
  });
}

/** Remplace la liste à préparer (admin). Les lignes conservées gardent leur état « préparé ». */
export function useSetMenageEquipements(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { logement_equipement_id: string; quantity?: number }[]) =>
      apiFetch<MenageEquipement[]>(`/menages/${menageId}/equipements`, {
        method: 'PUT',
        body: { items },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menage-equipements', menageId] }),
  });
}

/** Coche / décoche « préparé » (presta affecté ou admin). */
export function useToggleMenageEquipement(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ equipementId, done }: { equipementId: string; done: boolean }) =>
      apiFetch<MenageEquipement>(`/menages/${menageId}/equipements/${equipementId}`, {
        method: 'PATCH',
        body: { done },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menage-equipements', menageId] }),
  });
}
