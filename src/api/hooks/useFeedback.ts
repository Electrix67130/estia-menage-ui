import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { PaginatedResponse } from '../types';

/** `report` = signalement d'un contenu publié par un autre utilisateur (App Store 1.2). */
export type FeedbackType = 'bug' | 'suggestion' | 'report';
/** Contenu généré par un utilisateur pouvant être signalé. */
export type FeedbackTargetType = 'comment' | 'photo';
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'declined';

export interface Feedback {
  id: string;
  type: FeedbackType;
  subject: string;
  message: string;
  status: FeedbackStatus;
  platform: 'mobile' | 'web' | null;
  app_version: string | null;
  screen: string | null;
  locale: string;
  /** Reponse du support. Nulle tant que personne n'a repondu. */
  response: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface CreateFeedbackInput {
  type: FeedbackType;
  subject: string;
  message: string;
  platform?: 'mobile' | 'web';
  app_version?: string;
  screen?: string;
  locale?: string;
  /** Requis quand `type === 'report'` : ce qui est signalé. */
  target_type?: FeedbackTargetType;
  target_id?: string;
}

/** Ses propres signalements, avec les reponses recues. */
export function useMyFeedbacks() {
  return useQuery({
    queryKey: ['feedbacks', 'mine'],
    queryFn: () => apiFetch<PaginatedResponse<Feedback>>('/feedbacks/mine?limit=50'),
  });
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFeedbackInput) =>
      apiFetch<Feedback>('/feedbacks', { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedbacks', 'mine'] });
    },
  });
}
