import { useQuery } from '@tanstack/react-query';
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
  kind: RoomKind | null;
  position: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useLogementRooms(logementId: string | undefined) {
  return useQuery({
    queryKey: ['logement-rooms', logementId],
    queryFn: () =>
      apiFetch<LogementRoom[]>(`/logement-rooms?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}
