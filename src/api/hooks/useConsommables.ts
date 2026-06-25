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

// ---------- Gestion admin (niveau logement) ----------

/** Liste des consommables d'un logement + stock courant (dernier relevé). */
export function useLogementConsommables(logementId: string | undefined) {
  return useQuery({
    queryKey: ['logement-consommables', logementId],
    queryFn: () => apiFetch<ConsommableLine[]>(`/logement-consommables?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

export function useCreateConsommable(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { label: string; unit?: string | null; seuil_alerte?: number }) =>
      apiFetch('/logement-consommables', { method: 'POST', body: { logement_id: logementId, ...body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-consommables', logementId] }),
  });
}

export function useUpdateConsommable(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { label?: string; unit?: string | null; seuil_alerte?: number };
    }) => apiFetch(`/logement-consommables/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-consommables', logementId] }),
  });
}

export function useDeleteConsommable(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/logement-consommables/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-consommables', logementId] }),
  });
}

/** Fixe/initialise le stock courant d'un consommable (admin). */
export function useSetConsommableStock(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      apiFetch(`/logement-consommables/${id}/stock`, { method: 'PUT', body: { qty } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-consommables', logementId] }),
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
