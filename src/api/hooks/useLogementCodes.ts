import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface LogementCode {
  id: string;
  logement_id: string;
  label: string;
  code: string;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface LogementCodeInput {
  label: string;
  code: string;
  notes?: string | null;
}

/**
 * Codes d'accès d'un logement (boîte à clés, portail, alarme…). Lisible par
 * l'admin, les membres du logement et les prestas affectés à un de ses ménages.
 */
export function useLogementCodes(logementId: string | undefined) {
  return useQuery({
    queryKey: ['logement-codes', logementId],
    queryFn: () => apiFetch<LogementCode[]>(`/logement-codes?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

/** Libellés proposés à la saisie (mêmes chips que sur le dashboard). */
export function useCodeLabelSuggestions() {
  return useQuery({
    queryKey: ['logement-codes', 'label-suggestions'],
    queryFn: () => apiFetch<{ labels: string[] }>('/logement-codes/label-suggestions'),
    staleTime: 60 * 60 * 1000,
  });
}

export function useCreateLogementCode(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LogementCodeInput) =>
      apiFetch<LogementCode>('/logement-codes', {
        method: 'POST',
        body: { logement_id: logementId, ...body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-codes', logementId] }),
  });
}

export function useUpdateLogementCode(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<LogementCodeInput> }) =>
      apiFetch<LogementCode>(`/logement-codes/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-codes', logementId] }),
  });
}

export function useDeleteLogementCode(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/logement-codes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-codes', logementId] }),
  });
}
