import React from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/contexts/I18nContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { Menage } from '@/api/types';

/** QueryClient sans retry ni cache persistant, pour des tests déterministes. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

/**
 * Rend un composant avec les providers dont dépendent tous les écrans :
 * i18n (français par défaut), thème (clair) et React Query.
 */
export function renderWithProviders(ui: React.ReactElement, options?: RenderOptions & { queryClient?: QueryClient }) {
  const qc = options?.queryClient ?? makeQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <I18nProvider>{children}</I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient: qc };
}

/** Prestation de test : un ménage « à venir » non assigné, à compléter par `overrides`. */
export function makeMenage(overrides: Partial<Menage> = {}): Menage {
  return {
    id: 'm1',
    logement_id: 'l1',
    organization_id: 'o1',
    created_by: 'u-admin',
    prestataire_user_id: null,
    status: 'a_venir',
    prestation_type: 'menage',
    date_prevue: '2026-10-07',
    horaire_prevu: '10:00:00',
    horaire_fin_prevu: null,
    duree_estimee_min: 90,
    date_realisation: null,
    arrived_at: null,
    departed_at: null,
    prix_prevu: 60,
    n_lit_simple: 0,
    n_lit_double: 1,
    n_canape_lit: 0,
    n_lit_appoint: 0,
    n_lit_parapluie: 0,
    n_travelers: 2,
    validated_at: null,
    validated_by: null,
    validated_price: null,
    notes_intervention: null,
    archived_at: null,
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
    logement_name: 'Villa Azur',
    logement_city: 'Nice',
    logement_color: '#FF8800',
    ...overrides,
  };
}
