import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import { createCrudHooks } from './useCrud';
import { menagesApi } from '../services';
import type {
  Menage,
  MenageStatus,
  PrestationType,
  PaginatedResponse,
  PaginationParams,
  CreateMenageInput,
  UpdateMenageInput,
  ValidateReportInput,
} from '../types';

export const menageHooks = createCrudHooks<Menage, CreateMenageInput, UpdateMenageInput>(
  'menages',
  menagesApi,
);

interface ListParams extends PaginationParams {
  status?: MenageStatus;
  /** Filtre par type de prestation (ménage / check-in / check-out). */
  type?: PrestationType;
  prestataire_user_id?: string;
  logement_id?: string;
  validated?: boolean;
  /** true = uniquement les ménages sans prestataire assigné. */
  unassigned?: boolean;
  /** true = clôturés (valide/annule) → archives ; false = worklist active. */
  closed?: boolean;
  manager?: 'me';
  from?: string;
  to?: string;
}

export function useMenages(params?: ListParams) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.type) query.set('type', params.type);
  if (params?.prestataire_user_id) query.set('prestataire_user_id', params.prestataire_user_id);
  if (params?.logement_id) query.set('logement_id', params.logement_id);
  if (params?.validated !== undefined) query.set('validated', String(params.validated));
  if (params?.closed !== undefined) query.set('closed', String(params.closed));
  if (params?.manager) query.set('manager', params.manager);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.orderBy) query.set('orderBy', params.orderBy);
  if (params?.order) query.set('order', params.order);
  const qs = query.toString();

  return useQuery({
    queryKey: ['menages', 'list', params],
    queryFn: () => apiFetch<PaginatedResponse<Menage>>(`/menages${qs ? `?${qs}` : ''}`),
  });
}

// Pas d'endpoint search côté API MVP, on garde stub vide pour compat
export function useMenageSearch(_q?: string, _lat?: number, _lng?: number, _status?: MenageStatus) {
  return useQuery({
    queryKey: ['menages', 'search-stub'],
    queryFn: async () => ({ data: [] as Menage[], meta: { total: 0, page: 1, limit: 0, totalPages: 0 } }),
    enabled: false,
  });
}

export function useCreateMenage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMenageInput) =>
      apiFetch<Menage>('/menages', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menages'] }),
  });
}

export function useEligiblePrestataires(menageId: string | undefined) {
  return useQuery({
    queryKey: ['menage-eligible-prestataires', menageId],
    queryFn: () =>
      apiFetch<{ data: Array<{ id: string; first_name: string; last_name: string; email: string; avatar_url: string | null; is_member: boolean }> }>(
        `/menages/${menageId}/eligible-prestataires`,
      ).then((r) => r.data),
    enabled: !!menageId,
  });
}

export function useUpdateMenage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMenageInput }) =>
      apiFetch<Menage>(`/menages/${id}`, { method: 'PATCH', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menages'] }),
  });
}

export interface PointagePayload {
  id: string;
  /** Photo/GPS obligatoires pour un ménage, omis pour un check-in/check-out. */
  photo_url?: string;
  lat?: number;
  lng?: number;
}

export interface DegradationPhotoInput {
  url: string;
  thumbnail_url?: string;
  file_size?: number;
  mime_type?: string;
}

export interface ArrivalPayload extends PointagePayload {
  traveler_rating?: number;
  has_degradation?: boolean;
  degradation_note?: string;
  degradation_photos?: DegradationPhotoInput[];
}

export function useArrival() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ArrivalPayload) =>
      apiFetch<Menage>(`/menages/${id}/arrival`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menages'] }),
  });
}

export interface DeclarationPayload {
  id: string;
  traveler_rating?: number;
  has_degradation?: boolean;
  degradation_note?: string;
  degradation_photos?: DegradationPhotoInput[];
}

/** Édite la déclaration voyageurs (note + dégradation) après coup. */
export function useUpdateDeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: DeclarationPayload) =>
      apiFetch<Menage>(`/menages/${id}/declaration`, { method: 'PUT', body }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['menages'] });
      qc.invalidateQueries({ queryKey: ['photos', 'menage', vars.id] });
    },
  });
}

export function useDeparture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, photo_url, lat, lng }: PointagePayload) =>
      apiFetch<Menage>(`/menages/${id}/departure`, {
        method: 'POST',
        body: { photo_url, lat, lng },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menages'] }),
  });
}

export function useValidateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, price }: { id: string; price?: number }) =>
      apiFetch<Menage>(`/menages/${id}/validate`, {
        method: 'POST',
        body: { price } as ValidateReportInput,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menages'] }),
  });
}

// Stubs gardés pour rétrocompat — les ménages n'ont pas d'archivage côté MVP
export function useArchiveMenage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/menages/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menages'] }),
  });
}

export function useUnarchiveMenage() {
  return useMutation({
    mutationFn: async (_id: string) => undefined,
  });
}

export function useSetMenageRetention() {
  return useMutation({
    mutationFn: async (_args: { id: string; years: number }) => undefined,
  });
}

export function useMenageArchives(_params?: PaginationParams & { q?: string }) {
  return useQuery({
    queryKey: ['menages', 'archives-stub'],
    queryFn: async () => ({ data: [] as Menage[], meta: { total: 0, page: 1, limit: 0, totalPages: 0 } }),
  });
}
