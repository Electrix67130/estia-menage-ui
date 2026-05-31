import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { Photo, CreatePhotoInput, PaginatedResponse } from '../types';

export function usePhotos(menageId?: string) {
  return useQuery({
    queryKey: ['photos', 'menage', menageId],
    queryFn: () =>
      apiFetch<PaginatedResponse<Photo & { first_name: string; last_name: string }>>(
        `/photos?menage_id=${menageId}&limit=100`,
      ),
    enabled: !!menageId,
    staleTime: 0,
  });
}

export function useLogementPhotos(logementId?: string, logementRoomId?: string) {
  const qs = new URLSearchParams();
  if (logementId) qs.set('logement_id', logementId);
  if (logementRoomId) qs.set('logement_room_id', logementRoomId);
  qs.set('limit', '100');
  return useQuery({
    queryKey: ['photos', 'logement', logementId, logementRoomId ?? null],
    queryFn: () =>
      apiFetch<PaginatedResponse<Photo & { first_name: string; last_name: string }>>(
        `/photos?${qs.toString()}`,
      ),
    enabled: !!logementId,
    staleTime: 0,
  });
}

export function useCreatePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePhotoInput) =>
      apiFetch<Photo>('/photos', { method: 'POST', body }),
    onSuccess: (_data, vars) => {
      if (vars.menage_id) {
        qc.invalidateQueries({ queryKey: ['photos', 'menage', vars.menage_id] });
      }
      if (vars.logement_id) {
        qc.invalidateQueries({ queryKey: ['photos', 'logement', vars.logement_id] });
      }
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/photos/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['photos'] }),
  });
}

// PhotoComment retiré du MVP — stubs pour compat
export function usePhotoComments(_photoId?: string) {
  return useQuery({
    queryKey: ['photo-comments-stub'],
    queryFn: async () => ({
      data: [] as { id: string; content: string; first_name: string; last_name: string }[],
      meta: { total: 0, page: 1, limit: 0, totalPages: 0 },
    }),
    enabled: false,
  });
}

export function useCreatePhotoComment() {
  return useMutation({
    mutationFn: async (_body: { photo_id: string; content: string }) => undefined,
  });
}
