import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type {
  LogementMember,
  CreateLogementMemberInput,
  UpdateLogementMemberInput,
  PaginatedResponse,
  MeResponse,
} from '../types';

export type MemberWithUser = LogementMember & {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;
};

export function useLogementMembers(logementId?: string) {
  return useQuery({
    queryKey: ['logement-members', logementId],
    queryFn: () =>
      apiFetch<PaginatedResponse<MemberWithUser>>(
        `/logement-members/by-logement?logement_id=${logementId}&limit=100`,
      ),
    enabled: !!logementId,
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLogementMemberInput) =>
      apiFetch<LogementMember>('/logement-members', { method: 'POST', body }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['logement-members', vars.logement_id] }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateLogementMemberInput }) =>
      apiFetch<LogementMember>(`/logement-members/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-members'] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/logement-members/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logement-members'] }),
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => apiFetch<PaginatedResponse<MeResponse>>('/users?limit=100'),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['logement-members'] });
    },
  });
}

// Compat stubs (l'ancien concept de "team" du manager Buildr n'existe plus côté MVP Estia)
export function useTeam(_managerId?: string) {
  return useQuery({
    queryKey: ['team-stub'],
    queryFn: async () => ({ data: [] as MemberWithUser[] }),
    enabled: false,
  });
}

export function useAddTeamMember() {
  return useMutation({
    mutationFn: async (_body: { manager_id: string; user_id: string }) => undefined,
  });
}

export function useRemoveTeamMember() {
  return useMutation({
    mutationFn: async (_id: string) => undefined,
  });
}
