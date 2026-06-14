import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type RoomKind =
  | 'chambre'
  | 'salle_de_bain'
  | 'wc'
  | 'cuisine'
  | 'salon'
  | 'salle_a_manger'
  | 'bureau'
  | 'entree'
  | 'couloir'
  | 'exterieur'
  | 'cave'
  | 'buanderie'
  | 'autre';

export interface LogementRoom {
  id: string;
  logement_id: string;
  name: string;
  /** Photo de couverture (URL signée renvoyée par l'API). */
  photo_url: string | null;
  kind: RoomKind | null; // legacy, non utilisé par l'UI
  position: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useLogementRooms(logementId: string | undefined) {
  return useQuery({
    queryKey: ['logement-rooms', logementId],
    queryFn: () => apiFetch<LogementRoom[]>(`/logement-rooms?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

export function useCreateRoom(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; photo_url?: string | null; position?: number }) =>
      apiFetch<LogementRoom>('/logement-rooms', {
        method: 'POST',
        body: { logement_id: logementId, ...body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-rooms', logementId] }),
  });
}

export function useUpdateRoom(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; photo_url?: string | null } }) =>
      apiFetch<LogementRoom>(`/logement-rooms/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-rooms', logementId] }),
  });
}

export function useDeleteRoom(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/logement-rooms/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-rooms', logementId] }),
  });
}
