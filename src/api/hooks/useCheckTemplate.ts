import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface CheckTemplateItem {
  id: string;
  section_id: string;
  label: string;
  position: number;
  required: boolean;
  created_at: string;
  updated_at: string;
}

export interface CheckTemplateSection {
  id: string;
  logement_id: string;
  logement_room_id: string | null;
  label: string;
  position: number;
  created_at: string;
  updated_at: string;
  items: CheckTemplateItem[];
}

const KEY = ['check-template'] as const;

export function useCheckTemplate(logementId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, logementId],
    queryFn: () =>
      apiFetch<CheckTemplateSection[]>(`/logement-check-templates?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

export function useCreateTemplateSection(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; logement_room_id?: string }) =>
      apiFetch<CheckTemplateSection>(`/logement-check-template-sections`, {
        method: 'POST',
        body: { logement_id: logementId, ...input },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, logementId] }),
  });
}

export function useDeleteTemplateSection(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/logement-check-template-sections/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, logementId] }),
  });
}

export function useCreateTemplateItem(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { section_id: string; label: string; required?: boolean }) =>
      apiFetch<CheckTemplateItem>(`/logement-check-template-items`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, logementId] }),
  });
}

export function useDeleteTemplateItem(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/logement-check-template-items/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, logementId] }),
  });
}

export function useUpdateTemplateSection(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      apiFetch<CheckTemplateSection>(`/logement-check-template-sections/${id}`, {
        method: 'PATCH',
        body: { label },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, logementId] }),
  });
}

export function useUpdateTemplateItem(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      apiFetch<CheckTemplateItem>(`/logement-check-template-items/${id}`, {
        method: 'PATCH',
        body: { label },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, logementId] }),
  });
}

export function useReorderTemplateSections(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiFetch<void>(`/logement-check-templates/${logementId}/reorder-sections`, {
        method: 'POST',
        body: { ordered_ids: orderedIds },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, logementId] }),
  });
}
