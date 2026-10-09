import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import LogementNotificationSection from './LogementNotificationSection';
import { apiFetch } from '@/api/client';
import { translate } from '@/i18n/runtime';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual<typeof import('@/api/client')>('@/api/client');
  return { ...actual, apiFetch: jest.fn() };
});

const api = apiFetch as jest.MockedFunction<typeof apiFetch>;

beforeEach(() => {
  api.mockReset().mockImplementation(async () => ({ logement_id: 'l1', level: 'important' }) as never);
});

describe('LogementNotificationSection', () => {
  it('montre le réglage courant du logement et ce qu’il laisse passer', async () => {
    const { getByText, getByRole } = renderWithProviders(<LogementNotificationSection logementId="l1" />);
    await waitFor(() =>
      expect(getByRole('radio', { name: translate('notifPrefs.level.important') }).props.accessibilityState).toMatchObject({
        checked: true,
      }),
    );
    expect(getByText(translate('notifPrefs.levelDesc.important'))).toBeTruthy();
  });

  it('choisir « Rien » enregistre le réglage du logement', async () => {
    const { getByRole } = renderWithProviders(<LogementNotificationSection logementId="l1" />);
    const rien = getByRole('radio', { name: translate('notifPrefs.level.none') });
    await waitFor(() => expect(rien.props.accessibilityState).toMatchObject({ disabled: false }));
    fireEvent.press(rien);
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/notification-preferences/logements/l1', { method: 'PUT', body: { level: 'none' } }),
    );
  });
});
