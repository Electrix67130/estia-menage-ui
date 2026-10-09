import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { Comment, CommentReaction, PaginatedResponse } from '../types';
import type { ReactionEmoji } from '@/constants/reactions';
import type { MentionCandidate } from '@/lib/mentions';

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

/** Personnes qu'on peut mentionner (« @ ») sur une prestation. */
export function useMentionable(menageId?: string) {
  return useQuery({
    queryKey: ['comments-mentionable', menageId],
    queryFn: () => apiFetch<MentionCandidate[]>(`/comments/mentionable?menage_id=${menageId}`),
    enabled: !!menageId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      menage_id: string;
      section_id?: string | null;
      content: string;
      mentioned_user_ids?: string[];
      reply_to_id?: string | null;
    }) =>
      apiFetch<Comment>('/comments', { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.menage_id] });
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content, mentioned_user_ids }: { id: string; content: string; mentioned_user_ids?: string[] }) =>
      apiFetch<Comment>(`/comments/${id}`, { method: 'PATCH', body: { content, mentioned_user_ids } }),
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

type CommentsPage = PaginatedResponse<Comment & { first_name: string; last_name: string; avatar_url?: string }>;

/** Bascule ma réaction localement, sans attendre le serveur (qui confirme ensuite). */
export function toggleLocally(reactions: CommentReaction[] | undefined, emoji: ReactionEmoji): CommentReaction[] {
  const list = reactions ?? [];
  const existing = list.find((r) => r.emoji === emoji);
  if (!existing) return [...list, { emoji, count: 1, mine: true }];
  if (existing.mine) {
    return existing.count <= 1
      ? list.filter((r) => r.emoji !== emoji)
      : list.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r));
  }
  return list.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
}

/**
 * Réagir à un message. Optimiste : la pastille apparaît sous le doigt, sans
 * attendre le réseau, comme dans une messagerie. En cas d'erreur, on relit.
 */
export function useToggleReaction(menageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: ReactionEmoji }) =>
      apiFetch<{ comment_id: string; reactions: CommentReaction[] }>(`/comments/${id}/reactions`, {
        method: 'POST',
        body: { emoji },
      }),
    onMutate: async ({ id, emoji }) => {
      await queryClient.cancelQueries({ queryKey: ['comments', menageId] });
      queryClient.setQueriesData<CommentsPage>({ queryKey: ['comments', menageId] }, (page) =>
        page
          ? { ...page, data: page.data.map((c) => (c.id === id ? { ...c, reactions: toggleLocally(c.reactions, emoji) } : c)) }
          : page,
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', menageId] });
    },
    onSuccess: ({ comment_id, reactions }) => {
      queryClient.setQueriesData<CommentsPage>({ queryKey: ['comments', menageId] }, (page) =>
        page ? { ...page, data: page.data.map((c) => (c.id === comment_id ? { ...c, reactions } : c)) } : page,
      );
    },
  });
}
