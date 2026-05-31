import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { MeResponse, UserRole } from '../types';

const KEY = ['users'] as const;

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => apiFetch<MeResponse>(`/users/${id}`),
    enabled: !!id,
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      apiFetch<MeResponse>(`/users/${id}`, { method: 'PATCH', body: { role } }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, 'detail', vars.id] });
    },
  });
}
