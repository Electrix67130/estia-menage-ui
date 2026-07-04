import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import { createCrudHooks } from './useCrud';
import { logementsApi } from '../services';
import type {
  Logement,
  CreateLogementInput,
  UpdateLogementInput,
  PaginatedResponse,
  PaginationParams,
} from '../types';

export const logementHooks = createCrudHooks<Logement, CreateLogementInput, UpdateLogementInput>(
  'logements',
  logementsApi,
);

export function useLogements(params?: PaginationParams) {
  return useQuery({
    queryKey: ['logements', 'list', params],
    queryFn: () => logementsApi.list(params) as Promise<PaginatedResponse<Logement>>,
  });
}

export function useLogement(id: string | undefined) {
  return useQuery({
    queryKey: ['logements', 'detail', id],
    queryFn: () => logementsApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreateLogement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLogementInput) => logementsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logements'] }),
  });
}

export function useUpdateLogement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateLogementInput }) =>
      logementsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logements'] }),
  });
}

export function useDeleteLogement() {
  const qc = useQueryClient();
  return useMutation({
    // Archivage en cascade côté API : le logement + toutes ses prestations
    // (ménages/check-in/check-out) + ses consommables. Renvoie le nombre de
    // prestations archivées.
    mutationFn: (id: string) =>
      apiFetch<{ archived_menages: number }>(`/logements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logements'] });
      qc.invalidateQueries({ queryKey: ['menages'] });
      qc.invalidateQueries({ queryKey: ['my-upcoming-menages'] });
    },
  });
}
