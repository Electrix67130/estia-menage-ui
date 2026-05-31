import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface Client {
  id: string;
  organization_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  siret: string | null;
  vat_number: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClientInput {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  billing_address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  siret?: string;
  vat_number?: string;
  notes?: string;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export function clientDisplayName(c: {
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Client sans nom';
}

interface PaginatedClients {
  data: Client[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useClients() {
  return useQuery({
    queryKey: ['clients', 'list'],
    queryFn: () => apiFetch<PaginatedClients>(`/clients?limit=200`),
    // 30s : assez pour qu'un aller-retour rapide reste instantané, assez court
    // pour refleter rapidement un nouveau client créé/invité.
    staleTime: 30_000,
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', 'detail', id],
    queryFn: () => apiFetch<Client>(`/clients/${id}`),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClientInput) =>
      apiFetch<Client>('/clients', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateClientInput) =>
      apiFetch<Client>(`/clients/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useArchiveClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useClientLogements(id: string | undefined) {
  return useQuery({
    queryKey: ['client-logements', id],
    queryFn: () =>
      apiFetch<Array<{ id: string; name: string; city: string | null }>>(
        `/clients/${id}/logements`,
      ),
    enabled: !!id,
  });
}
