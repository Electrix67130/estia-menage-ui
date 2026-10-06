import React from 'react';
import { Text } from 'react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import PlanningCard from './PlanningCard';
import { translate } from '@/i18n/runtime';
import { makeMenage, renderWithProviders } from '@/test-utils/render';

const noop = () => undefined;

describe('PlanningCard — heure et date', () => {
  it('affiche l’heure de début et la durée quand il n’y a pas d’heure de fin', () => {
    const { getByText } = renderWithProviders(<PlanningCard menage={makeMenage()} onPress={noop} />);
    expect(getByText('10:00')).toBeTruthy();
    expect(getByText('1h30')).toBeTruthy();
  });

  it('préfère l’heure de fin à la durée', () => {
    const { getByText, queryByText } = renderWithProviders(
      <PlanningCard menage={makeMenage({ horaire_fin_prevu: '11:30:00' })} onPress={noop} />,
    );
    expect(getByText('11:30')).toBeTruthy();
    expect(queryByText('1h30')).toBeNull();
  });

  it('tiret sans heure prévue', () => {
    const { getByText } = renderWithProviders(
      <PlanningCard menage={makeMenage({ horaire_prevu: null, duree_estimee_min: null })} onPress={noop} />,
    );
    expect(getByText('—')).toBeTruthy();
  });

  it('vue « À traiter » (showDate) : jour, mois court et heure', () => {
    const { getByText } = renderWithProviders(<PlanningCard menage={makeMenage()} onPress={noop} showDate />);
    expect(getByText('07')).toBeTruthy();
    expect(getByText('oct.')).toBeTruthy();
    expect(getByText('10:00')).toBeTruthy();
  });

  it('nom du logement et tag de type', () => {
    const { getByText } = renderWithProviders(
      <PlanningCard menage={makeMenage({ prestation_type: 'check_out' })} onPress={noop} />,
    );
    expect(getByText('Villa Azur')).toBeTruthy();
    expect(getByText(translate('prestationType.check_out'))).toBeTruthy();
  });
});

describe('PlanningCard — prestataire ou bouton « Affecter »', () => {
  it('prestataire affecté : nom + initiales, pas de bouton Affecter', () => {
    const { getByText, queryByText } = renderWithProviders(
      <PlanningCard
        menage={makeMenage({ prestataire_user_id: 'u1', prestataire_first_name: 'Marie', prestataire_last_name: 'Dupont' })}
        onPress={noop}
      />,
    );
    expect(getByText('Marie Dupont')).toBeTruthy();
    expect(getByText('MD')).toBeTruthy();
    expect(queryByText(translate('planning.assign'))).toBeNull();
  });

  it('non assigné : bouton « Affecter » → onAssign(menage)', () => {
    const onAssign = jest.fn();
    const menage = makeMenage();
    const { getByText } = renderWithProviders(<PlanningCard menage={menage} onPress={noop} onAssign={onAssign} />);
    fireEvent.press(getByText(translate('planning.assign')));
    expect(onAssign).toHaveBeenCalledWith(menage);
  });

  it('sans onAssign, « Affecter » ouvre la fiche (onPress(id))', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithProviders(<PlanningCard menage={makeMenage({ id: 'xyz' })} onPress={onPress} />);
    fireEvent.press(getByText(translate('planning.assign')));
    expect(onPress).toHaveBeenCalledWith('xyz');
  });

  it('tap sur la carte → onPress(id)', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithProviders(<PlanningCard menage={makeMenage({ id: 'abc' })} onPress={onPress} />);
    fireEvent.press(getByText('Villa Azur'));
    expect(onPress).toHaveBeenCalledWith('abc');
  });
});

describe('PlanningCard — badge « Qui est dispo ? » (admin, showDispo)', () => {
  it('sans réponse et avec des membres : badge « Aucune réponse » + bouton « Relancer » → onRelance', () => {
    const onRelance = jest.fn();
    const menage = makeMenage({ present_count: 0, absent_count: 0, member_prestataire_count: 3 });
    const { getByText, queryByText } = renderWithProviders(
      <PlanningCard menage={menage} onPress={noop} onRelance={onRelance} showDispo />,
    );
    expect(getByText(translate('dispo.noResponse'))).toBeTruthy();
    expect(queryByText(translate('planning.assign'))).toBeNull();
    fireEvent.press(getByText(translate('planning.relance')));
    expect(onRelance).toHaveBeenCalledWith(menage);
  });

  it('sans réponse mais aucun membre à relancer : « Affecter »', () => {
    const { getByText, queryByText } = renderWithProviders(
      <PlanningCard menage={makeMenage({ member_prestataire_count: 0 })} onPress={noop} showDispo />,
    );
    expect(getByText(translate('planning.assign'))).toBeTruthy();
    expect(queryByText(translate('planning.relance'))).toBeNull();
  });

  it('quelqu’un de dispo : « 2 dispos » + « Affecter »', () => {
    const { getByText, queryByText } = renderWithProviders(
      <PlanningCard menage={makeMenage({ present_count: 2, member_prestataire_count: 4 })} onPress={noop} showDispo />,
    );
    expect(getByText('2 dispos')).toBeTruthy();
    expect(getByText(translate('planning.assign'))).toBeTruthy();
    expect(queryByText(translate('planning.relance'))).toBeNull();
  });

  it('prestataire déjà affecté : ni badge dispo ni bouton', () => {
    const { queryByText } = renderWithProviders(
      <PlanningCard
        menage={makeMenage({ prestataire_user_id: 'u1', prestataire_first_name: 'Marie', member_prestataire_count: 4 })}
        onPress={noop}
        showDispo
      />,
    );
    expect(queryByText(translate('dispo.noResponse'))).toBeNull();
    expect(queryByText(translate('planning.assign'))).toBeNull();
  });
});

describe('PlanningCard — badges « hors de l’ordinaire »', () => {
  it('rien pour une prestation à venir ordinaire', () => {
    const { queryByText } = renderWithProviders(<PlanningCard menage={makeMenage()} onPress={noop} />);
    expect(queryByText(translate('menage.statusNotClockedIn'))).toBeNull();
    expect(queryByText(translate('menage.statusInProgress'))).toBeNull();
    expect(queryByText(translate('menage.statusToValidate'))).toBeNull();
    expect(queryByText(translate('menage.statusUpcoming'))).toBeNull();
  });

  it('« Non pointé » remplace le statut (même en cours)', () => {
    const { getByText, queryByText } = renderWithProviders(
      <PlanningCard menage={makeMenage({ needs_attention: true, status: 'en_cours' })} onPress={noop} />,
    );
    expect(getByText(translate('menage.statusNotClockedIn'))).toBeTruthy();
    expect(queryByText(translate('menage.statusInProgress'))).toBeNull();
  });

  it('« En cours » et « À valider »', () => {
    const a = renderWithProviders(<PlanningCard menage={makeMenage({ status: 'en_cours' })} onPress={noop} />);
    expect(a.getByText(translate('menage.statusInProgress'))).toBeTruthy();
    const b = renderWithProviders(<PlanningCard menage={makeMenage({ status: 'termine' })} onPress={noop} />);
    expect(b.getByText(translate('menage.statusToValidate'))).toBeTruthy();
  });

  it('compteur de non-lus, plafonné à 99+', () => {
    const a = renderWithProviders(<PlanningCard menage={makeMenage()} onPress={noop} unread={3} />);
    expect(a.getByText('3')).toBeTruthy();
    const b = renderWithProviders(<PlanningCard menage={makeMenage()} onPress={noop} unread={150} />);
    expect(b.getByText('99+')).toBeTruthy();
  });

  it('pastille « demande de report en attente »', () => {
    const { getByLabelText } = renderWithProviders(
      <PlanningCard menage={makeMenage({ has_pending_reschedule: true })} onPress={noop} />,
    );
    expect(getByLabelText(translate('planning.pendingRescheduleA11y'))).toBeTruthy();
  });

  it('note d’information et actions en pied de carte', () => {
    const { getByText } = renderWithProviders(
      <PlanningCard menage={makeMenage()} onPress={noop} note="Terminé à 15:40 · 4 photos" actions={<Text>Valider</Text>} />,
    );
    expect(getByText('Terminé à 15:40 · 4 photos')).toBeTruthy();
    expect(getByText('Valider')).toBeTruthy();
  });
});
