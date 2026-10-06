import React from 'react';
import { describe, expect, it } from '@jest/globals';
import StatusBadge from '@/components/StatusBadge';
import { translate } from '@/i18n/runtime';
import type { MenageStatus } from '@/api/types';
import type { TranslationKeys } from '@/i18n/translations';
import { renderWithProviders } from '@/test-utils/render';

describe('StatusBadge — libellé du statut de prestation', () => {
  it.each<[MenageStatus, TranslationKeys]>([
    ['a_venir', 'menage.statusUpcoming'],
    ['en_cours', 'menage.statusInProgress'],
    ['termine', 'menage.statusToValidate'],
    ['valide', 'menage.statusValidated'],
    ['annule', 'menage.statusCancelled'],
  ])('%s → « %s »', (status, key) => {
    const { getByText } = renderWithProviders(<StatusBadge status={status} />);
    expect(getByText(translate(key))).toBeTruthy();
  });

  it('« terminé » se lit « À valider » (rapport rendu, en attente de l’admin)', () => {
    const { getByText } = renderWithProviders(<StatusBadge status="termine" />);
    expect(getByText('À valider')).toBeTruthy();
  });
});
