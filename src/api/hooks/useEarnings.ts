import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { EarningsSummary } from '../types';

interface Params {
  from?: string; // YYYY-MM-DD
  to?: string;
  validatedOnly?: boolean;
}

export function useEarnings(params: Params = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.validatedOnly !== undefined) qs.set('validated_only', String(params.validatedOnly));
  const query = qs.toString();
  return useQuery({
    queryKey: ['me-earnings', params.from ?? '', params.to ?? '', params.validatedOnly ?? false],
    queryFn: () => apiFetch<EarningsSummary>(`/me/earnings${query ? `?${query}` : ''}`),
  });
}

export interface AdminEarningsBucket {
  id: string;
  name: string;
  total: number;
  count: number;
}

export interface AdminEarnings {
  total: number;
  currency: string;
  count: number;
  from: string | null;
  to: string | null;
  by_client: AdminEarningsBucket[];
  by_prestataire: AdminEarningsBucket[];
}

export function useAdminEarnings(params: Params = {}, enabled = true) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.validatedOnly !== undefined) qs.set('validated_only', String(params.validatedOnly));
  const query = qs.toString();
  return useQuery({
    queryKey: ['admin-earnings', params.from ?? '', params.to ?? '', params.validatedOnly ?? false],
    queryFn: () => apiFetch<AdminEarnings>(`/admin/earnings${query ? `?${query}` : ''}`),
    enabled,
  });
}
