import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import PrestaUpcomingList from './PrestaUpcomingList';
import {
  useMyUpcomingMenages,
  useRespondToMenageOptimistic,
  type MyUpcomingMenage,
} from '@/api/hooks/useMenageResponses';
import { useUnreadSummary } from '@/api/hooks/useMenageViews';
import { translate } from '@/i18n/runtime';
import { addDays, ymdLocal } from '@/lib/prestations';
import { renderWithProviders } from '@/test-utils/render';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/HistoriqueList', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: () => R.createElement(RN.Text, null, 'HISTORIQUE_LIST') };
});
jest.mock('@/api/hooks/useMenageResponses', () => ({
  useMyUpcomingMenages: jest.fn(),
  useRespondToMenageOptimistic: jest.fn(),
}));
jest.mock('@/api/hooks/useMenageViews', () => ({ useUnreadSummary: jest.fn() }));

const listMock = useMyUpcomingMenages as jest.MockedFunction<typeof useMyUpcomingMenages>;
const respondMock = useRespondToMenageOptimistic as jest.MockedFunction<typeof useRespondToMenageOptimistic>;
const unreadMock = useUnreadSummary as jest.MockedFunction<typeof useUnreadSummary>;
const mutate = jest.fn();

const today = ymdLocal(new Date());
const tomorrow = ymdLocal(addDays(new Date(), 1));
const yesterday = ymdLocal(addDays(new Date(), -1));

function item(overrides: Partial<MyUpcomingMenage> & Pick<MyUpcomingMenage, 'id'>): MyUpcomingMenage {
  return {
    logement_id: 'l1',
    logement_name: `Logement ${overrides.id}`,
    logement_color: null,
    logement_address: null,
    logement_city: null,
    date_prevue: today,
    horaire_prevu: '10:00:00',
    horaire_fin_prevu: null,
    duree_estimee_min: 60,
    status: 'a_venir',
    prestation_type: 'menage',
    my_response: null,
    is_assigned: false,
    assigned_to_someone: false,
    referent_first_name: null,
    referent_last_name: null,
    done_by_me: false,
    ...overrides,
  };
}

function setup(items: MyUpcomingMenage[], unread: Record<string, number> = {}) {
  listMock.mockReturnValue({ data: items, isLoading: false, isRefetching: false, refetch: jest.fn() } as unknown as ReturnType<typeof useMyUpcomingMenages>);
  respondMock.mockReturnValue({ mutate } as unknown as ReturnType<typeof useRespondToMenageOptimistic>);
  unreadMock.mockReturnValue({ data: { by_menage: unread, by_organization: {} } } as unknown as ReturnType<typeof useUnreadSummary>);
  return renderWithProviders(<PrestaUpcomingList />);
}

beforeEach(() => {
  mutate.mockClear();
  mockPush.mockClear();
});

describe('Liste presta — Planning groupé par jour', () => {
  it('sections « Aujourd’hui » et « Demain » avec leur effectif', () => {
    const { getByText } = setup([item({ id: 'a' }), item({ id: 'b', date_prevue: tomorrow }), item({ id: 'c', date_prevue: tomorrow })]);
    expect(getByText(translate('common.today'))).toBeTruthy();
    expect(getByText(translate('common.tomorrow'))).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('message vide dédié', () => {
    const { getByText } = setup([]);
    expect(getByText(translate('prestations.planningEmptyPresta'))).toBeTruthy();
  });

  it('pastille de non-lus sur la carte concernée', () => {
    const { getByLabelText } = setup([item({ id: 'a' })], { a: 2 });
    expect(getByLabelText('2 éléments non lus')).toBeTruthy();
  });

  it('tap sur une carte → fiche', () => {
    const { getByText } = setup([item({ id: 'a' })]);
    fireEvent.press(getByText('Logement a'));
    expect(mockPush).toHaveBeenCalledWith('/menage/a');
  });
});

describe('Liste presta — vote Présent / Absent seulement sur une prestation « à venir » future', () => {
  it('prestation ouverte : les deux boutons, un tap envoie la réponse', () => {
    const { getByLabelText } = setup([item({ id: 'a' })]);
    const event = { stopPropagation: () => undefined };
    fireEvent.press(getByLabelText(translate('prestations.present')), event);
    expect(mutate).toHaveBeenCalledWith({ menageId: 'a', status: 'present' });
    fireEvent.press(getByLabelText(translate('prestations.absent')), event);
    expect(mutate).toHaveBeenCalledWith({ menageId: 'a', status: 'absent' });
  });

  it('retenu par l’admin : pill « Présent » verrouillé, pas de bouton Absent', () => {
    const { getByText, queryByText, queryByLabelText } = setup([item({ id: 'a', is_assigned: true, assigned_to_someone: true })]);
    expect(getByText(translate('prestations.present'))).toBeTruthy();
    expect(queryByText(translate('prestations.absent'))).toBeNull();
    expect(queryByLabelText(translate('prestations.present'))).toBeNull();
  });

  it('en cours → bandeau « En cours », pas de vote', () => {
    const { getByText, queryByText } = setup([item({ id: 'a', status: 'en_cours', is_assigned: true })]);
    expect(getByText(translate('menage.statusInProgress'))).toBeTruthy();
    expect(queryByText(translate('prestations.present'))).toBeNull();
  });

  it('terminée → « Terminé · fait par X »', () => {
    const { getByText } = setup([item({ id: 'a', status: 'termine', referent_first_name: 'Jean', referent_last_name: 'Martin' })]);
    expect(getByText(translate('prestations.doneBy', { who: 'Jean Martin' }))).toBeTruthy();
  });

  it('validée → « Validée · fait par X », ou « vous » si c’est moi', () => {
    const a = setup([item({ id: 'a', status: 'valide', referent_first_name: 'Jean', referent_last_name: 'Martin' })]);
    expect(a.getByText(translate('prestations.validatedBy', { who: 'Jean Martin' }))).toBeTruthy();
    const b = setup([item({ id: 'b', status: 'valide', done_by_me: true })]);
    expect(b.getByText(translate('prestations.validatedBy', { who: translate('prestations.you') }))).toBeTruthy();
    const c = setup([item({ id: 'c', status: 'valide' })]);
    expect(c.getByText(translate('prestations.validatedF'))).toBeTruthy();
  });

  it('annulée → « Annulée »', () => {
    const { getByText, queryByText } = setup([item({ id: 'a', status: 'annule' })]);
    expect(getByText(translate('prestations.cancelledF'))).toBeTruthy();
    expect(queryByText(translate('prestations.present'))).toBeNull();
  });
});

describe('Liste presta — « À traiter »', () => {
  const toAnswer = item({ id: 'q' });
  const answered = item({ id: 'ok', my_response: 'present' });
  const late = item({ id: 'late', date_prevue: yesterday, is_assigned: true, assigned_to_someone: true, needs_attention: true });

  it('le compteur de l’onglet = à répondre + non pointées', () => {
    const { getByLabelText } = setup([toAnswer, answered, late]);
    expect(getByLabelText(`${translate('prestations.segTodo')} (2)`)).toBeTruthy();
  });

  it('sections « À répondre » et « Non pointée », bandeau rouge sur la prestation d’hier', () => {
    const { getByText, getByLabelText, queryByText } = setup([toAnswer, answered, late]);
    fireEvent.press(getByLabelText(`${translate('prestations.segTodo')} (2)`));
    expect(getByText(translate('prestations.toAnswer'))).toBeTruthy();
    expect(getByText(translate('todo.late_one'))).toBeTruthy();
    expect(getByText(translate('prestations.lateClockIn'))).toBeTruthy();
    expect(getByText('Logement q')).toBeTruthy();
    expect(queryByText('Logement ok')).toBeNull();
  });

  it('tout est à jour → message dédié', () => {
    const { getByText, getByLabelText } = setup([answered]);
    fireEvent.press(getByLabelText(translate('prestations.segTodo')));
    expect(getByText(translate('prestations.todoEmptyPresta'))).toBeTruthy();
  });

  it('l’onglet Historique affiche la liste partagée', () => {
    const { getByText, getByLabelText } = setup([]);
    fireEvent.press(getByLabelText(translate('historique.title')));
    expect(getByText('HISTORIQUE_LIST')).toBeTruthy();
  });
});
