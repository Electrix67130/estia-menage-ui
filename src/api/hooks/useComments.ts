import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { Comment, PaginatedResponse } from '../types';

export function useComments(menageId?: string, sectionFilter?: string | 'general') {
  return useQuery({
    queryKey: ['comments', menageId, sectionFilter ?? 'all'],
    queryFn: () => {
      const params = new URLSearchParams({ menage_id: menageId!, limit: '100', order: 'asc' });
      if (sectionFilter) params.set('section_id', sectionFilter);
      return apiFetch<PaginatedResponse<Comment & { first_name: string; last_name: string; avatar_url?: string }>>(
        `/comments?${params.toString()}`,
      );
    },
    enabled: !!menageId,
    staleTime: 0,
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { menage_id: string; section_id?: string | null; content: string }) =>
      apiFetch<Comment>('/comments', { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.menage_id] });
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      apiFetch<Comment>(`/comments/${id}`, { method: 'PATCH', body: { content } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/comments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
