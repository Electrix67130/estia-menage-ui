import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import FilterSheet, { EMPTY_PRESTATION_FILTERS, countActiveFilters, type PrestationFilters } from './FilterSheet';
import { translate } from '@/i18n/runtime';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('@/components/FilterPickerSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/SheetHandle', () => ({ __esModule: true, default: () => null }));

const logements = [{ id: 'l1', label: 'Villa Azur' }];
const prestas = [{ id: 'u1', label: 'Marie Dupont' }];
const creators = [{ id: 'airbnb', label: 'Airbnb' }];

function renderSheet(filters: PrestationFilters, isAdmin: boolean, resultCount = 12, onChange = jest.fn()) {
  const utils = renderWithProviders(
    <FilterSheet
      visible
      onClose={() => undefined}
      filters={filters}
      onChange={onChange}
      logementOptions={logements}
      prestaOptions={prestas}
      creatorOptions={creators}
      resultCount={resultCount}
      isAdmin={isAdmin}
    />,
  );
  return { ...utils, onChange };
}

describe('countActiveFilters — pastille sur l’icône', () => {
  it('compte les filtres posés, tous champs confondus', () => {
    expect(countActiveFilters(EMPTY_PRESTATION_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_PRESTATION_FILTERS, type: 'menage' })).toBe(1);
    expect(countActiveFilters({ type: 'menage', logement: 'l1', presta: 'u1', creator: 'airbnb', availability: 'available' })).toBe(5);
  });
});

describe('FilterSheet — contenu', () => {
  it('annonce le nombre de prestations affichées (« Voir N prestations »)', () => {
    const a = renderSheet(EMPTY_PRESTATION_FILTERS, true, 12);
    expect(a.getByText('Voir 12 prestations')).toBeTruthy();
    const b = renderSheet(EMPTY_PRESTATION_FILTERS, true, 1);
    expect(b.getByText('Voir 1 prestation')).toBeTruthy();
  });

  it('prestataire, source et disponibilité sont réservés à l’admin', () => {
    const admin = renderSheet(EMPTY_PRESTATION_FILTERS, true);
    expect(admin.getByText(translate('menage.fields.prestataire'))).toBeTruthy();
    expect(admin.getByText(translate('filterSheet.source'))).toBeTruthy();
    expect(admin.getByText(translate('filterSheet.availability'))).toBeTruthy();
    expect(admin.getByText(translate('dispo.someoneAvailable'))).toBeTruthy();

    const presta = renderSheet(EMPTY_PRESTATION_FILTERS, false);
    expect(presta.getByText(translate('filterSheet.logement'))).toBeTruthy();
    expect(presta.queryByText(translate('menage.fields.prestataire'))).toBeNull();
    expect(presta.queryByText(translate('filterSheet.source'))).toBeNull();
    expect(presta.queryByText(translate('filterSheet.availability'))).toBeNull();
  });

  it('le sélecteur logement affiche l’option choisie, sinon « Tous les logements »', () => {
    const a = renderSheet(EMPTY_PRESTATION_FILTERS, false);
    expect(a.getByText(translate('filterSheet.allLogements'))).toBeTruthy();
    const b = renderSheet({ ...EMPTY_PRESTATION_FILTERS, logement: 'l1' }, false);
    expect(b.getByText('Villa Azur')).toBeTruthy();
  });

  it('un tap sur un type ou une disponibilité remonte les filtres mis à jour', () => {
    const { getByText, onChange } = renderSheet(EMPTY_PRESTATION_FILTERS, true);
    fireEvent.press(getByText(translate('prestationType.check_in')));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_PRESTATION_FILTERS, type: 'check_in' });
    fireEvent.press(getByText(translate('dispo.nobodyAvailable')));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_PRESTATION_FILTERS, availability: 'unavailable' });
  });

  it('« Réinitialiser » est inactif sans filtre, sinon remet les filtres à vide', () => {
    const empty = renderSheet(EMPTY_PRESTATION_FILTERS, true);
    fireEvent.press(empty.getByText(translate('common.reset')));
    expect(empty.onChange).not.toHaveBeenCalled();

    const filled = renderSheet({ ...EMPTY_PRESTATION_FILTERS, type: 'menage', presta: 'u1' }, true);
    fireEvent.press(filled.getByText(translate('common.reset')));
    expect(filled.onChange).toHaveBeenCalledWith(EMPTY_PRESTATION_FILTERS);
  });

  it('ne rend rien quand la feuille est fermée', () => {
    const { queryByText } = renderWithProviders(
      <FilterSheet
        visible={false}
        onClose={() => undefined}
        filters={EMPTY_PRESTATION_FILTERS}
        onChange={() => undefined}
        logementOptions={[]}
        prestaOptions={[]}
        creatorOptions={[]}
        resultCount={3}
        isAdmin
      />,
    );
    expect(queryByText(translate('common.filters'))).toBeNull();
  });
});
