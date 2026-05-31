import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface EarningsResponse {
  total: number;
  currency: string;
  count: number;
  from: string | null;
  to: string | null;
  items: Array<{
    id: string;
    date_prevue: string;
    logement_id: string;
    status: string;
    provider_price: string | number | null;
    laundry_provider_price: string | number | null;
    laundry_included: boolean;
    subtotal: number;
    validated_at: string | null;
  }>;
}

/** Earnings du user connecté (prestataire). */
export function useMyEarnings() {
  return useQuery({
    queryKey: ['earnings', 'me'],
    queryFn: () => apiFetch<EarningsResponse>('/me/earnings'),
  });
}

/** Earnings d'un autre user (admin uniquement). */
export function useUserEarnings(userId: string | undefined, params?: { from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const query = qs.toString();
  return useQuery({
    queryKey: ['earnings', 'user', userId, params?.from ?? '', params?.to ?? ''],
    queryFn: () =>
      apiFetch<EarningsResponse>(`/users/${userId}/earnings${query ? `?${query}` : ''}`),
    enabled: !!userId,
  });
}

export interface ClientReportPrestataire {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ClientReportMenage {
  id: string;
  date_prevue: string;
  status: string;
  currency: string;
  prix_prevu: string | null;
  client_price_ht: string | null;
  client_vat_rate: string | null;
  validated_price: string | null;
  provider_price: string | null;
  laundry_included: boolean;
  laundry_client_price_ht: string | null;
  laundry_provider_price: string | null;
  logement_id: string;
  logement_name: string | null;
  logement_city: string | null;
  logement_color: string | null;
  prestataires: ClientReportPrestataire[];
}

export interface ClientReportResponse {
  client: { id: string; first_name: string | null; last_name: string | null; company_name: string | null };
  period: { from: string; to: string };
  menages: ClientReportMenage[];
}

export function useClientReport(
  clientId: string | undefined,
  params: { from: string; to: string },
  enabled = true,
) {
  return useQuery({
    queryKey: ['client-report', clientId, params.from, params.to],
    queryFn: () =>
      apiFetch<ClientReportResponse>(
        `/clients/${clientId}/report?from=${params.from}&to=${params.to}`,
      ),
    enabled: enabled && !!clientId,
  });
}
