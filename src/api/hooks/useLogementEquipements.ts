import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type EquipementCategory =
  | 'cuisine'
  | 'electromenager'
  | 'confort'
  | 'exterieur'
  | 'loisirs'
  | 'bebe'
  | 'securite'
  | 'autre';

export interface LogementEquipement {
  id: string;
  logement_id: string;
  logement_room_id: string | null;
  label: string;
  category: EquipementCategory | null;
  quantity: number;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  /** Joint côté API depuis `logement_room`. */
  room_name?: string | null;
}

export interface EquipementCatalogCategory {
  key: EquipementCategory;
  label: string;
  suggestions: string[];
}

export interface EquipementInput {
  label: string;
  category?: EquipementCategory;
  quantity?: number;
  logement_room_id?: string | null;
  notes?: string | null;
}

export function useLogementEquipements(logementId: string | undefined) {
  return useQuery({
    queryKey: ['logement-equipements', logementId],
    queryFn: () =>
      apiFetch<LogementEquipement[]>(`/logement-equipements?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

/** Catalogue de suggestions servi par l'API (même liste que sur le dashboard). */
export function useEquipementCatalog() {
  return useQuery({
    queryKey: ['logement-equipements', 'catalog'],
    queryFn: () =>
      apiFetch<{ categories: EquipementCatalogCategory[] }>('/logement-equipements/catalog'),
    staleTime: 60 * 60 * 1000, // statique
  });
}

export function useCreateEquipement(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EquipementInput) =>
      apiFetch<LogementEquipement>('/logement-equipements', {
        method: 'POST',
        body: { logement_id: logementId, ...body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-equipements', logementId] }),
  });
}

/** Ajout groupé depuis le catalogue (idempotent côté API). */
export function useBulkCreateEquipements(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: EquipementInput[]) =>
      apiFetch<LogementEquipement[]>('/logement-equipements/bulk', {
        method: 'POST',
        body: { logement_id: logementId, items },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-equipements', logementId] }),
  });
}

export function useUpdateEquipement(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<EquipementInput> }) =>
      apiFetch<LogementEquipement>(`/logement-equipements/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-equipements', logementId] }),
  });
}

export function useDeleteEquipement(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/logement-equipements/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-equipements', logementId] }),
  });
}
