import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

/** Option proposée au client sur un logement (pack romantique, anniversaire…). */
export interface LogementOption {
  id: string;
  logement_id: string;
  label: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/** Option retenue par le client pour une prestation donnée. */
export interface MenageOption {
  id: string;
  menage_id: string;
  logement_option_id: string;
  notes: string | null;
  label: string;
  description: string | null;
}

export function useLogementOptions(logementId: string | undefined) {
  return useQuery({
    queryKey: ['logement-options', logementId],
    queryFn: () => apiFetch<LogementOption[]>(`/logement-options?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

/** Packs suggérés à la saisie (mêmes libellés que sur le dashboard). */
export function useOptionSuggestions() {
  return useQuery({
    queryKey: ['logement-options', 'suggestions'],
    queryFn: () => apiFetch<{ labels: string[] }>('/logement-options/suggestions'),
    staleTime: 60 * 60 * 1000,
  });
}

export function useCreateLogementOption(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { label: string; description?: string | null }) =>
      apiFetch<LogementOption>('/logement-options', {
        method: 'POST',
        body: { logement_id: logementId, ...body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-options', logementId] }),
  });
}

export function useUpdateLogementOption(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { label?: string; description?: string | null };
    }) => apiFetch<LogementOption>(`/logement-options/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-options', logementId] }),
  });
}

export function useDeleteLogementOption(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/logement-options/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-options', logementId] }),
  });
}

export function useMenageOptions(menageId: string | undefined) {
  return useQuery({
    queryKey: ['menage-options', menageId],
    queryFn: () => apiFetch<MenageOption[]>(`/menages/${menageId}/options`),
    enabled: !!menageId,
  });
}

/** Définit les options retenues pour une prestation (admin). */
export function useSetMenageOptions(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { logement_option_id: string; notes?: string | null }[]) =>
      apiFetch<MenageOption[]>(`/menages/${menageId}/options`, { method: 'PUT', body: { items } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menage-options', menageId] }),
  });
}
