import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface ConsommableLine {
  logement_consommable_id: string;
  label: string;
  unit: string | null;
  seuil_alerte: number;
  position: number;
  qty: number | null; // quantité relevée pour ce ménage (null si pas encore saisie)
  needs_restock: boolean;
}

/** Consommables du logement + quantité relevée pour CE ménage. */
export function useMenageConsommables(menageId: string | undefined) {
  return useQuery({
    queryKey: ['menage-consommables', menageId],
    queryFn: () => apiFetch<ConsommableLine[]>(`/menages/${menageId}/consommables`),
    enabled: !!menageId,
  });
}

/** Relevé au pointage de fin : envoie la quantité restante de chaque consommable. */
export function useSetMenageConsommables(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { logement_consommable_id: string; qty: number }[]) =>
      apiFetch<{ data: ConsommableLine[] }>(`/menages/${menageId}/consommables`, {
        method: 'PUT',
        body: { items },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menage-consommables', menageId] });
      qc.invalidateQueries({ queryKey: ['menages'] });
    },
  });
}
