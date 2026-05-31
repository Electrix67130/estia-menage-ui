import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type {
  CreateRescheduleRequestInput,
  PaginatedResponse,
  RescheduleRequest,
  RescheduleStatus,
} from '../types';

const KEY = ['reschedule-requests'] as const;

export function useMyRescheduleRequests(status?: RescheduleStatus) {
  const qs = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: [...KEY, status ?? 'all'],
    queryFn: () =>
      apiFetch<PaginatedResponse<RescheduleRequest>>(`/reschedule-requests${qs}`),
  });
}

export function useRescheduleRequestsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'user', userId],
    queryFn: () =>
      apiFetch<PaginatedResponse<RescheduleRequest>>(
        `/reschedule-requests?requested_by=${userId}`,
      ),
    enabled: !!userId,
  });
}

export function useDecideReschedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      decision_reason,
      apply_to_menage,
    }: {
      id: string;
      decision: 'approved' | 'rejected';
      decision_reason?: string;
      apply_to_menage?: boolean;
    }) =>
      apiFetch<RescheduleRequest>(`/reschedule-requests/${id}/decide`, {
        method: 'POST',
        body: { decision, decision_reason, apply_to_menage },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useCreateRescheduleRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRescheduleRequestInput) =>
      apiFetch<RescheduleRequest>('/reschedule-requests', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useCancelRescheduleRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RescheduleRequest>(`/reschedule-requests/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
