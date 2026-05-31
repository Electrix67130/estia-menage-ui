import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type {
  MenageCheckTree,
  CreateSectionInput,
  UpdateSectionInput,
  CreateItemInput,
  UpdateItemInput,
  ToggleItemInput,
  MenageCheckSection,
  MenageCheckItem,
} from '../types';

export function useMenageCheck(menageId: string | undefined) {
  return useQuery({
    queryKey: ['menage-check', menageId],
    queryFn: () => apiFetch<MenageCheckTree>(`/menages/${menageId}/check`),
    enabled: !!menageId,
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSectionInput) =>
      apiFetch<MenageCheckSection>('/menage-check-sections', { method: 'POST', body }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['menage-check', vars.menage_id] }),
  });
}

export function useUpdateSection(menageId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSectionInput }) =>
      apiFetch<MenageCheckSection>(`/menage-check-sections/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menage-check', menageId] }),
  });
}

export function useDeleteSection(menageId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/menage-check-sections/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menage-check', menageId] }),
  });
}

export function useReorderSections(menageId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiFetch<void>(`/menages/${menageId}/check/sections/reorder`, {
        method: 'POST',
        body: { ordered_ids: orderedIds },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menage-check', menageId] }),
  });
}

export function useCreateItem(menageId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateItemInput) =>
      apiFetch<MenageCheckItem>('/menage-check-items', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menage-check', menageId] }),
  });
}

export function useUpdateItem(menageId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateItemInput }) =>
      apiFetch<MenageCheckItem>(`/menage-check-items/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menage-check', menageId] }),
  });
}

export function useDeleteItem(menageId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/menage-check-items/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menage-check', menageId] }),
  });
}

export function useToggleItem(menageId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ToggleItemInput }) =>
      apiFetch<MenageCheckItem>(`/menage-check-items/${id}/toggle`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menage-check', menageId] }),
  });
}
