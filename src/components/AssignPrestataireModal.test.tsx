import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import AssignPrestataireModal from './AssignPrestataireModal';
import { useEligiblePrestataires } from '@/api/hooks/useMenages';
import { useMenagePrestataires, useSetMenagePrestataires } from '@/api/hooks/useMenagePrestataires';
import { useRelanceMenage } from '@/api/hooks/useMenageResponses';
import type { EligiblePrestataire } from '@/api/types';
import { translate } from '@/i18n/runtime';
import { renderWithProviders } from '@/test-utils/render';

const mockAlert = jest.fn(async () => undefined);
jest.mock('@/contexts/DialogContext', () => ({
  useDialog: () => ({ alert: mockAlert, confirm: jest.fn(async () => true) }),
}));
jest.mock('@/api/hooks/useMenages', () => ({ useEligiblePrestataires: jest.fn() }));
jest.mock('@/api/hooks/useMenagePrestataires', () => ({
  useMenagePrestataires: jest.fn(),
  useSetMenagePrestataires: jest.fn(),
}));
jest.mock('@/api/hooks/useMenageResponses', () => ({ useRelanceMenage: jest.fn() }));

const eligibleMock = useEligiblePrestataires as jest.MockedFunction<typeof useEligiblePrestataires>;
const currentMock = useMenagePrestataires as jest.MockedFunction<typeof useMenagePrestataires>;
const setMock = useSetMenagePrestataires as jest.MockedFunction<typeof useSetMenagePrestataires>;
const relanceMock = useRelanceMenage as jest.MockedFunction<typeof useRelanceMenage>;

function presta(p: Partial<EligiblePrestataire> & Pick<EligiblePrestataire, 'id' | 'first_name' | 'last_name'>): EligiblePrestataire {
  return { email: `${p.id}@x.fr`, avatar_url: null, is_member: true, response_status: null, responded_at: null, ...p };
}

const marie = presta({ id: 'u1', first_name: 'Marie', last_name: 'Dupont', response_status: 'present', responded_at: new Date().toISOString() });
const jean = presta({ id: 'u2', first_name: 'Jean', last_name: 'Martin' });
const lea = presta({ id: 'u3', first_name: 'Léa', last_name: 'Petit', is_member: false });
const paul = presta({ id: 'u4', first_name: 'Paul', last_name: 'Roux', response_status: 'absent' });

const setPrestas = jest.fn(async (_ids: string[]) => undefined);
const relance = jest.fn(async (_id: string) => ({ sent: 1 }));

function setup(list: EligiblePrestataire[], current: string[] = [], isLoading = false) {
  eligibleMock.mockReturnValue({ data: list, isLoading } as unknown as ReturnType<typeof useEligiblePrestataires>);
  currentMock.mockReturnValue({
    data: current.map((user_id) => ({ user_id })),
    isLoading: false,
  } as unknown as ReturnType<typeof useMenagePrestataires>);
  setMock.mockReturnValue({ mutateAsync: setPrestas, isPending: false } as unknown as ReturnType<typeof useSetMenagePrestataires>);
  relanceMock.mockReturnValue({ mutateAsync: relance, isPending: false } as unknown as ReturnType<typeof useRelanceMenage>);
  const onClose = jest.fn();
  const utils = renderWithProviders(<AssignPrestataireModal visible menageId="m1" onClose={onClose} />);
  return { ...utils, onClose };
}

beforeEach(() => {
  setPrestas.mockClear();
  relance.mockClear().mockResolvedValue({ sent: 1 });
  mockAlert.mockClear();
});

describe('AssignPrestataireModal — groupes d’après les votes', () => {
  it('Disponibles · Sans réponse · Indisponibles avec leurs effectifs', () => {
    const { getByText } = setup([marie, jean, lea, paul]);
    expect(getByText(`${translate('assign.available')} (1)`)).toBeTruthy();
    expect(getByText(`${translate('assign.noResponse')} (2)`)).toBeTruthy();
    expect(getByText(`${translate('assign.unavailable')} (1)`)).toBeTruthy();
  });

  it('un groupe vide n’apparaît pas', () => {
    const { queryByText } = setup([marie, jean]);
    expect(queryByText(new RegExp(`^${translate('assign.unavailable')}`))).toBeNull();
  });

  it('sous-ligne : vote, ancienneté et appartenance au logement', () => {
    const { getByText } = setup([marie, lea]);
    expect(getByText(`${translate('assign.present')} · ${translate('relative.justNow')} · ${translate('assign.member')}`)).toBeTruthy();
    expect(getByText(`${translate('assign.notAnswered')} · ${translate('assign.nonMember')}`)).toBeTruthy();
  });

  it('liste vide → message d’aide ; chargement → « Chargement... »', () => {
    const a = setup([]);
    expect(a.getByText(translate('assign.empty'))).toBeTruthy();
    const b = setup([], [], true);
    expect(b.getByText(translate('common.loading'))).toBeTruthy();
  });
});

describe('AssignPrestataireModal — bouton principal', () => {
  it('« Enregistrer » sans sélection, puis nomme la personne, puis compte', () => {
    const { getByText } = setup([marie, jean]);
    expect(getByText(translate('common.save'))).toBeTruthy();
    fireEvent.press(getByText('Marie Dupont'));
    expect(getByText(translate('assign.assignOne', { name: 'Marie Dupont' }))).toBeTruthy();
    fireEvent.press(getByText('Jean Martin'));
    expect(getByText(translate('assign.assignMany', { count: 2 }))).toBeTruthy();
  });

  it('le premier coché est le référent ; les affectés actuels sont pré-cochés', () => {
    const { getByText, getAllByText } = setup([marie, jean], ['u2']);
    expect(getAllByText(translate('menageDetail.referent'))).toHaveLength(1);
    expect(getByText(translate('assign.assignOne', { name: 'Jean Martin' }))).toBeTruthy();
  });

  it('enregistre la sélection puis ferme', async () => {
    const { getByText, onClose } = setup([marie, jean]);
    fireEvent.press(getByText('Marie Dupont'));
    fireEvent.press(getByText(translate('assign.assignOne', { name: 'Marie Dupont' })));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(setPrestas).toHaveBeenCalledWith(['u1']);
  });
});

describe('AssignPrestataireModal — relance des sans-réponse', () => {
  it('« Relancer les n » ne compte que les membres du logement sans vote', () => {
    const { getByText } = setup([marie, jean, lea, paul]);
    expect(getByText(translate('assign.relanceButton', { count: 1 }))).toBeTruthy();
  });

  it('pas de lien de relance si personne n’est relançable', () => {
    const { queryByText } = setup([marie, lea]);
    expect(queryByText(/^Relancer les/)).toBeNull();
  });

  it('la relance appelle l’API et confirme le nombre de prestataires prévenus', async () => {
    relance.mockResolvedValue({ sent: 2 });
    const { getByText } = setup([jean, presta({ id: 'u5', first_name: 'Ana', last_name: 'Lopez' })]);
    fireEvent.press(getByText(translate('assign.relanceButton', { count: 2 })));
    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(relance).toHaveBeenCalledWith('m1');
    expect(mockAlert).toHaveBeenCalledWith({
      title: translate('assign.relanceTitle'),
      message: translate('assign.relanceSent_other', { count: 2 }),
    });
  });

  it('0 envoi → « Tout le monde a déjà répondu »', async () => {
    relance.mockResolvedValue({ sent: 0 });
    const { getByText } = setup([jean]);
    fireEvent.press(getByText(translate('assign.relanceButton', { count: 1 })));
    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ message: translate('assign.everyoneAnswered') }));
  });
});
