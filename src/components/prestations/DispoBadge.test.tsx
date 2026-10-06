import React from 'react';
import { describe, expect, it } from '@jest/globals';
import DispoBadge, { dispoSecondaryLabel, dispoState } from './DispoBadge';
import { Colors } from '@/constants/Colors';
import { translate } from '@/i18n/runtime';
import { renderWithProviders } from '@/test-utils/render';

describe('« Qui est dispo ? » — état d’après les votes', () => {
  it('au moins un Présent → disponible, même avec des Absent', () => {
    expect(dispoState({ present_count: 1, absent_count: 3, member_prestataire_count: 4 })).toBe('available');
  });

  it('que des Absent → indisponible', () => {
    expect(dispoState({ present_count: 0, absent_count: 2, member_prestataire_count: 4 })).toBe('unavailable');
  });

  it('aucun vote (ou compteurs absents) → sans réponse', () => {
    expect(dispoState({ present_count: 0, absent_count: 0, member_prestataire_count: 4 })).toBe('no_response');
    expect(dispoState({})).toBe('no_response');
  });

  it('texte secondaire : rien si dispo, « n absents », « n membres » ou « Aucun membre prestataire »', () => {
    expect(dispoSecondaryLabel({ present_count: 2 })).toBeNull();
    expect(dispoSecondaryLabel({ absent_count: 1 })).toBe('1 absent');
    expect(dispoSecondaryLabel({ absent_count: 3 })).toBe('3 absents');
    expect(dispoSecondaryLabel({ member_prestataire_count: 4 })).toBe('4 membres');
    expect(dispoSecondaryLabel({ member_prestataire_count: 1 })).toBe('1 membre');
    expect(dispoSecondaryLabel({ member_prestataire_count: 0 })).toBe(translate('dispo.noPrestataireMember'));
  });
});

describe('DispoBadge — rendu des 3 états', () => {
  it('vert « 2 dispos » sans texte secondaire', () => {
    const { getByText, queryByText } = renderWithProviders(
      <DispoBadge menage={{ present_count: 2, absent_count: 1, member_prestataire_count: 5 }} colors={Colors.light} />,
    );
    expect(getByText('2 dispos')).toBeTruthy();
    expect(queryByText(/absent/)).toBeNull();
  });

  it('rouge « Personne de dispo » + « 3 absents »', () => {
    const { getByText } = renderWithProviders(
      <DispoBadge menage={{ present_count: 0, absent_count: 3, member_prestataire_count: 3 }} colors={Colors.light} />,
    );
    expect(getByText(translate('dispo.nobodyAvailable'))).toBeTruthy();
    expect(getByText('3 absents')).toBeTruthy();
  });

  it('gris « Aucune réponse » + « 4 membres », avec un libellé d’accessibilité combiné', () => {
    const { getByText, getByLabelText } = renderWithProviders(
      <DispoBadge menage={{ member_prestataire_count: 4 }} colors={Colors.light} />,
    );
    expect(getByText(translate('dispo.noResponse'))).toBeTruthy();
    expect(getByText('4 membres')).toBeTruthy();
    expect(getByLabelText('Aucune réponse, 4 membres')).toBeTruthy();
  });
});
