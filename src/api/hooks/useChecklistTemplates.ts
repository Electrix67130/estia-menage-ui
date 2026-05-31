import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface ChecklistTemplateListItem {
  id: string;
  name: string;
  section_count: number;
}

export interface TemplateItemInput {
  label: string;
  required?: boolean;
}
export interface TemplateSectionInput {
  label: string;
  items: TemplateItemInput[];
}

export interface ChecklistTemplateTree {
  id: string;
  name: string;
  sections: {
    id: string;
    label: string;
    position: number;
    items: { id: string; label: string; position: number; required: boolean }[];
  }[];
}

/** Liste des modèles de checklist de l'org (pour le picker à la création). */
export function useChecklistTemplates() {
  return useQuery({
    queryKey: ['checklist-templates'],
    queryFn: () =>
      apiFetch<{ data: ChecklistTemplateListItem[] }>('/checklist-templates').then((r) => r.data),
    staleTime: 30_000,
  });
}

/** Arbre complet d'un modèle (pour l'édition). */
export function useChecklistTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['checklist-template', id],
    queryFn: () => apiFetch<ChecklistTemplateTree>(`/checklist-templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; sections: TemplateSectionInput[] }) =>
      apiFetch<ChecklistTemplateTree>('/checklist-templates', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  });
}

export function useUpdateChecklistTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; sections?: TemplateSectionInput[] }) =>
      apiFetch<ChecklistTemplateTree>(`/checklist-templates/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist-templates'] });
      qc.invalidateQueries({ queryKey: ['checklist-template', id] });
    },
  });
}

export function useDeleteChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/checklist-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  });
}

/** Applique un modèle à un logement (copie sections+items). */
export function useApplyChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ logementId, templateId }: { logementId: string; templateId: string }) =>
      apiFetch(`/logements/${logementId}/apply-checklist-template`, {
        method: 'POST',
        body: { template_id: templateId },
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['check-template', vars.logementId] });
    },
  });
}
