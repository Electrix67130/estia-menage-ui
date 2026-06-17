import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface CompanyLookupResult {
  siret: string;
  siren: string;
  name: string;
  address: string;
  vat_number: string;
}

/** Résout un SIRET (14 chiffres) → raison sociale, adresse, n° TVA. */
export function useCompanyLookup() {
  return useMutation({
    mutationFn: (siret: string) =>
      apiFetch<CompanyLookupResult>(`/company/lookup?siret=${encodeURIComponent(siret)}`),
  });
}
