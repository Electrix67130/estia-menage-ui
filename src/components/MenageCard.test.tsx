import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import MenageCard from './MenageCard';
import { translate } from '@/i18n/runtime';
import { makeMenage, renderWithProviders } from '@/test-utils/render';

const noop = () => undefined;

describe('MenageCard — carte de liste', () => {
  it('date (jour / mois / année), heure, durée, logement, type et statut', () => {
    const { getByText } = renderWithProviders(<MenageCard menage={makeMenage()} onPress={noop} />);
    expect(getByText('07')).toBeTruthy();
    expect(getByText('oct.')).toBeTruthy();
    expect(getByText('2026')).toBeTruthy();
    expect(getByText('10:00')).toBeTruthy();
    expect(getByText('1h30')).toBeTruthy();
    expect(getByText('Villa Azur')).toBeTruthy();
    expect(getByText(translate('prestationType.menage'))).toBeTruthy();
    expect(getByText(translate('menage.statusUpcoming'))).toBeTruthy();
  });

  it('source : « Manuelle » par défaut, « Airbnb » pour une presta iCal Airbnb', () => {
    const a = renderWithProviders(<MenageCard menage={makeMenage()} onPress={noop} />);
    expect(a.getByText(translate('source.manual'))).toBeTruthy();
    const b = renderWithProviders(<MenageCard menage={makeMenage({ external_source: 'cal_airbnb' })} onPress={noop} />);
    expect(b.getByText('Airbnb')).toBeTruthy();
  });

  it('« Non pointé » tient lieu de statut : le badge « À venir » disparaît', () => {
    const { getByText, queryByText } = renderWithProviders(
      <MenageCard menage={makeMenage({ needs_attention: true })} onPress={noop} />,
    );
    expect(getByText(translate('menage.statusNotClockedIn'))).toBeTruthy();
    expect(queryByText(translate('menage.statusUpcoming'))).toBeNull();
  });

  it('prix prévu, et prix validé s’il diffère', () => {
    const a = renderWithProviders(<MenageCard menage={makeMenage({ prix_prevu: 60 })} onPress={noop} />);
    expect(a.getByText(/60 €/)).toBeTruthy();
    expect(a.queryByText(/→/)).toBeNull();
    const b = renderWithProviders(
      <MenageCard menage={makeMenage({ prix_prevu: 60, validated_price: 55 })} onPress={noop} />,
    );
    expect(b.getByText(/→ 55 €/)).toBeTruthy();
  });

  it('non-lus et demande de report', () => {
    const { getByText, getByLabelText } = renderWithProviders(
      <MenageCard menage={makeMenage({ has_pending_reschedule: true })} onPress={noop} unread={4} />,
    );
    expect(getByText('4')).toBeTruthy();
    expect(getByLabelText('4 éléments non lus')).toBeTruthy();
    expect(getByLabelText(translate('planning.pendingRescheduleA11y'))).toBeTruthy();
  });

  it('tap → onPress(id), appui long → onLongPress(menage)', () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    const menage = makeMenage({ id: 'm42' });
    const { getByText } = renderWithProviders(<MenageCard menage={menage} onPress={onPress} onLongPress={onLongPress} />);
    fireEvent.press(getByText('Villa Azur'));
    expect(onPress).toHaveBeenCalledWith('m42');
    fireEvent(getByText('Villa Azur'), 'longPress');
    expect(onLongPress).toHaveBeenCalledWith(menage);
  });
});
