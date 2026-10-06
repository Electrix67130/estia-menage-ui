import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import SegmentedTabs from './SegmentedTabs';
import { renderWithProviders } from '@/test-utils/render';

const segments = [
  { key: 'planning', label: 'Planning' },
  { key: 'todo', label: 'À traiter', badge: 5 },
  { key: 'history', label: 'Historique', badge: 0 },
] as const;

describe('SegmentedTabs — Planning · À traiter · Historique', () => {
  it('affiche les libellés et le compteur (jamais 0)', () => {
    const { getByText, queryByText, getByLabelText } = renderWithProviders(
      <SegmentedTabs segments={[...segments]} value="planning" onChange={() => undefined} />,
    );
    expect(getByText('Planning')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
    expect(queryByText('0')).toBeNull();
    expect(getByLabelText('À traiter (5)')).toBeTruthy();
  });

  it('plafonne le compteur à 99+', () => {
    const { getByText } = renderWithProviders(
      <SegmentedTabs segments={[{ key: 'todo', label: 'À traiter', badge: 120 }]} value="todo" onChange={() => undefined} />,
    );
    expect(getByText('99+')).toBeTruthy();
  });

  it('marque l’onglet actif et remonte la sélection', () => {
    const onChange = jest.fn();
    const { getByLabelText } = renderWithProviders(
      <SegmentedTabs segments={[...segments]} value="planning" onChange={onChange} />,
    );
    expect(getByLabelText('Planning').props.accessibilityState).toEqual({ selected: true });
    expect(getByLabelText('Historique').props.accessibilityState).toEqual({ selected: false });
    fireEvent.press(getByLabelText('Historique'));
    expect(onChange).toHaveBeenCalledWith('history');
  });
});
