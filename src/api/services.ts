import { apiFetch } from './client';
import type { PaginationParams, PaginatedResponse } from './types';

// --------------- CRUD Factory ---------------

export function createCrudApi<TEntity, TCreate = never, TUpdate = never>(basePath: string) {
  return {
    list(params?: PaginationParams): Promise<PaginatedResponse<TEntity>> {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.orderBy) query.set('orderBy', params.orderBy);
      if (params?.order) query.set('order', params.order);
      const qs = query.toString();
      return apiFetch<PaginatedResponse<TEntity>>(`${basePath}${qs ? `?${qs}` : ''}`);
    },

    getById(id: string): Promise<TEntity> {
      return apiFetch<TEntity>(`${basePath}/${id}`);
    },

    create(body: TCreate): Promise<TEntity> {
      return apiFetch<TEntity>(basePath, { method: 'POST', body });
    },

    update(id: string, body: TUpdate): Promise<TEntity> {
      return apiFetch<TEntity>(`${basePath}/${id}`, { method: 'PATCH', body });
    },

    remove(id: string): Promise<void> {
      return apiFetch<void>(`${basePath}/${id}`, { method: 'DELETE' });
    },
  };
}

// --------------- API Services ---------------

import type {
  Logement,
  CreateLogementInput,
  UpdateLogementInput,
  Menage,
  CreateMenageInput,
  UpdateMenageInput,
  LogementMember,
  CreateLogementMemberInput,
  UpdateLogementMemberInput,
  Comment,
  CreateCommentInput,
  UpdateCommentInput,
  Photo,
  CreatePhotoInput,
  MeResponse,
} from './types';

export const logementsApi = createCrudApi<Logement, CreateLogementInput, UpdateLogementInput>('/logements');
export const menagesApi = createCrudApi<Menage, CreateMenageInput, UpdateMenageInput>('/menages');
export const logementMembersApi = createCrudApi<LogementMember, CreateLogementMemberInput, UpdateLogementMemberInput>('/logement-members');
export const commentsApi = createCrudApi<Comment, CreateCommentInput, UpdateCommentInput>('/comments');
export const photosApi = createCrudApi<Photo, CreatePhotoInput, never>('/photos');
export const usersApi = createCrudApi<MeResponse, never, Partial<MeResponse>>('/users');
