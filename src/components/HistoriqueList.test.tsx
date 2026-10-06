import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import HistoriqueList from './HistoriqueList';
import { useMenages, useRestoreMenage } from '@/api/hooks/useMenages';
import { useAuth } from '@/contexts/AuthContext';
import type { Menage } from '@/api/types';
import { translate } from '@/i18n/runtime';
import { PAST_WINDOW_DAYS, ymdLocal } from '@/lib/prestations';
import { makeMenage, renderWithProviders } from '@/test-utils/render';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const mockConfirm = jest.fn(async () => true);
jest.mock('@/contexts/DialogContext', () => ({ useDialog: () => ({ confirm: mockConfirm, alert: jest.fn() }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/hooks/useMenages', () => ({ useMenages: jest.fn(), useRestoreMenage: jest.fn() }));

const useMenagesMock = useMenages as jest.MockedFunction<typeof useMenages>;
const useRestoreMock = useRestoreMenage as jest.MockedFunction<typeof useRestoreMenage>;
const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;
const restore = jest.fn(async (_id: string) => ({ restored: true }));

function setup(items: Menage[], role: 'admin' | 'prestataire' = 'admin') {
  useAuthMock.mockReturnValue({ user: { role } } as unknown as ReturnType<typeof useAuth>);
  useMenagesMock.mockReturnValue({
    data: { data: items, meta: { total: items.length, page: 1, limit: 200, totalPages: 1 } },
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useMenages>);
  useRestoreMock.mockReturnValue({ mutateAsync: restore, isPending: false } as unknown as ReturnType<typeof useRestoreMenage>);
  return renderWithProviders(<HistoriqueList />);
}

const now = new Date();
const monthStart = ymdLocal(new Date(now.getFullYear(), now.getMonth(), 1));
const monthEnd = ymdLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0));
const inMonth = (day: number) => `${monthStart.slice(0, 8)}${String(day).padStart(2, '0')}`;

const valide = makeMenage({ id: 'v', status: 'valide', date_prevue: inMonth(3), logement_name: 'Villa Azur', logement_city: null });
const annule = makeMenage({ id: 'a', status: 'annule', date_prevue: inMonth(5), logement_name: 'Loft Centre', logement_city: 'Lyon' });
const retiree = makeMenage({ id: 'r', status: 'annule', sync_ignored: true, date_prevue: inMonth(2), logement_name: 'Chalet Neige', logement_city: null });
const oubliee = makeMenage({ id: 'o', status: 'a_venir', date_prevue: inMonth(1), logement_name: 'Studio Port', logement_city: null });
const aValider = makeMenage({ id: 't', status: 'termine', date_prevue: inMonth(4), logement_name: 'Maison Sud', logement_city: null });

beforeEach(() => {
  mockPush.mockClear();
  mockConfirm.mockClear().mockResolvedValue(true);
  restore.mockClear();
  useMenagesMock.mockReset();
});

describe('HistoriqueList — requête API', () => {
  it('admin : clôturées + oubliées (stale_before = aujourd’hui − 30 j) du mois courant, vue complète', () => {
    setup([]);
    const stale = new Date();
    stale.setDate(stale.getDate() - PAST_WINDOW_DAYS);
    expect(useMenagesMock).toHaveBeenCalledWith({
      closed: true,
      stale_before: ymdLocal(stale),
      from: monthStart,
      to: monthEnd,
      limit: 200,
    });
  });

  it('prestataire : seulement les prestations où il est affecté (assigned=me)', () => {
    setup([], 'prestataire');
    expect(useMenagesMock).toHaveBeenCalledWith(expect.objectContaining({ assigned: 'me', closed: true }));
  });
});

describe('HistoriqueList — lignes', () => {
  it('statuts : Validé, Annulé, « Non traitée · à valider », « Non traitée · jamais pointée », « Retirée (auto) »', () => {
    const { getByText, getAllByText } = setup([valide, annule, retiree, oubliee, aValider]);
    expect(getByText(translate('menage.statusValidated'))).toBeTruthy();
    expect(getAllByText(translate('menage.statusCancelled'))).toHaveLength(2);
    expect(getByText(translate('historique.untreatedToValidate'))).toBeTruthy();
    expect(getByText(translate('historique.untreatedNeverClocked'))).toBeTruthy();
    expect(getByText(translate('historique.retiredAuto'))).toBeTruthy();
    expect(getByText('Loft Centre · Lyon')).toBeTruthy();
  });

  it('le filtre « Non traitées » ne garde que les non clôturées', () => {
    const { getByText, queryByText } = setup([valide, annule, oubliee, aValider]);
    fireEvent.press(getByText(translate('historique.filterUntreated')));
    expect(queryByText('Villa Azur')).toBeNull();
    expect(queryByText('Loft Centre · Lyon')).toBeNull();
    expect(getByText('Studio Port')).toBeTruthy();
    expect(getByText('Maison Sud')).toBeTruthy();
  });

  it('le filtre « Validés » ne garde que les validées, message dédié si vide', () => {
    const { getByText, queryByText } = setup([valide, annule]);
    fireEvent.press(getByText(translate('historique.filterValidated')));
    expect(getByText('Villa Azur')).toBeTruthy();
    expect(queryByText('Loft Centre · Lyon')).toBeNull();
    fireEvent.press(getByText(translate('historique.filterUntreated')));
    expect(getByText(translate('historique.emptyUntreated'))).toBeTruthy();
  });

  it('message vide par défaut', () => {
    const { getByText } = setup([]);
    expect(getByText(translate('historique.emptyClosed'))).toBeTruthy();
  });

  it('tap sur une ligne → fiche de la prestation', () => {
    const { getByText } = setup([valide]);
    fireEvent.press(getByText('Villa Azur'));
    expect(mockPush).toHaveBeenCalledWith('/menage/v');
  });
});

describe('HistoriqueList — « Remettre » une presta auto retirée (admin)', () => {
  it('visible pour l’admin seulement', () => {
    const admin = setup([retiree]);
    expect(admin.getByText(translate('historique.restore'))).toBeTruthy();
    const presta = setup([retiree], 'prestataire');
    expect(presta.queryByText(translate('historique.restore'))).toBeNull();
  });

  it('demande confirmation puis appelle l’API', async () => {
    const { getByText } = setup([retiree]);
    fireEvent.press(getByText(translate('historique.restore')));
    await waitFor(() => expect(restore).toHaveBeenCalledWith('r'));
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: translate('historique.restoreTitle') }));
  });

  it('n’appelle pas l’API si l’admin renonce', async () => {
    mockConfirm.mockResolvedValue(false);
    const { getByText } = setup([retiree]);
    fireEvent.press(getByText(translate('historique.restore')));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(restore).not.toHaveBeenCalled();
  });
});

describe('HistoriqueList — navigation par mois', () => {
  it('mois courant par défaut, « Mois suivant » inactif, « Ce mois » après un recul', () => {
    const { getByText, queryByText, getByLabelText } = setup([]);
    const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(now);
    expect(getByText(label)).toBeTruthy();
    expect(queryByText(translate('historique.thisMonth'))).toBeNull();

    fireEvent.press(getByLabelText(translate('historique.nextMonth')));
    expect(getByText(label)).toBeTruthy();

    fireEvent.press(getByLabelText(translate('historique.prevMonth')));
    const prev = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
    );
    expect(getByText(prev)).toBeTruthy();
    expect(useMenagesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: ymdLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: ymdLocal(new Date(now.getFullYear(), now.getMonth(), 0)),
      }),
    );
    fireEvent.press(getByText(translate('historique.thisMonth')));
    expect(getByText(label)).toBeTruthy();
  });
});
