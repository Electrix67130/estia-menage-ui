import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import DeleteAccountScreen from '@/app/delete-account';
import { apiFetch, ApiError } from '@/api/client';
import { translate } from '@/i18n/runtime';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual<typeof import('@/api/client')>('@/api/client');
  return { ...actual, apiFetch: jest.fn() };
});
jest.mock('@/hooks/usePushRegistration', () => ({
  registerPushToken: jest.fn(async () => undefined),
  unregisterPushToken: jest.fn(async () => undefined),
}));

const mockForgetSession = jest.fn(async () => undefined);
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ forgetSession: mockForgetSession }),
}));

const mockAlert = jest.fn(async () => undefined);
const mockConfirm = jest.fn(async () => true);
jest.mock('@/contexts/DialogContext', () => ({
  useDialog: () => ({ alert: mockAlert, confirm: mockConfirm }),
}));

const api = apiFetch as jest.MockedFunction<typeof apiFetch>;

function setup() {
  const utils = renderWithProviders(<DeleteAccountScreen />);
  const submit = () => utils.getByLabelText(translate('deleteAccount.submit'));
  const password = () => utils.getByLabelText(translate('deleteAccount.passwordLabel'));
  return { ...utils, submit, password };
}

beforeEach(() => {
  api.mockReset();
  mockForgetSession.mockClear();
  mockAlert.mockClear();
  mockConfirm.mockClear().mockResolvedValue(true);
});

describe('DeleteAccountScreen — rendu', () => {
  it('affiche le titre, les 4 conséquences et le champ mot de passe', () => {
    const { getByText, password } = setup();
    expect(getByText(translate('deleteAccount.intro'))).toBeTruthy();
    for (const key of ['deleteAccount.point1', 'deleteAccount.point2', 'deleteAccount.point3', 'deleteAccount.point4'] as const) {
      expect(getByText(translate(key))).toBeTruthy();
    }
    expect(password().props.secureTextEntry).toBe(true);
  });

  it('le bouton est désactivé tant que le mot de passe est vide', () => {
    const { submit, password } = setup();
    expect(submit().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(submit());
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();

    fireEvent.changeText(password(), 'secret');
    expect(submit().props.accessibilityState.disabled).toBe(false);
  });
});

describe('DeleteAccountScreen — suppression', () => {
  it('confirme, appelle DELETE /auth/account avec le mot de passe, oublie la session puis prévient', async () => {
    api.mockResolvedValue(undefined);
    const { submit, password } = setup();
    fireEvent.changeText(password(), 'secret');
    fireEvent.press(submit());

    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    expect(api).toHaveBeenCalledWith('/auth/account', { method: 'DELETE', body: { password: 'secret' } });
    expect(mockForgetSession).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith({
      title: translate('deleteAccount.doneTitle'),
      message: translate('deleteAccount.doneMessage'),
    });
  });

  it('ne fait rien si la confirmation est refusée', async () => {
    mockConfirm.mockResolvedValue(false);
    const { submit, password } = setup();
    fireEvent.changeText(password(), 'secret');
    fireEvent.press(submit());
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(api).not.toHaveBeenCalled();
    expect(mockForgetSession).not.toHaveBeenCalled();
  });

  it('401 → « Mot de passe incorrect », la session est conservée', async () => {
    api.mockRejectedValue(new ApiError(401, 'Unauthorized', 'Invalid password'));
    const { submit, password, getByText } = setup();
    fireEvent.changeText(password(), 'wrong');
    fireEvent.press(submit());
    await waitFor(() => expect(getByText(translate('deleteAccount.wrongPassword'))).toBeTruthy());
    expect(mockForgetSession).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('409 (dernier admin) → affiche le message renvoyé par l’API', async () => {
    const apiMessage = 'Vous êtes le dernier administrateur de « Conciergerie Azur ».';
    api.mockRejectedValue(new ApiError(409, 'Conflict', apiMessage));
    const { submit, password, getByText } = setup();
    fireEvent.changeText(password(), 'secret');
    fireEvent.press(submit());
    await waitFor(() => expect(getByText(apiMessage)).toBeTruthy());
    expect(mockForgetSession).not.toHaveBeenCalled();
  });

  it('autre erreur → message générique', async () => {
    api.mockRejectedValue(new ApiError(500, 'Error', 'boom'));
    const { submit, password, getByText } = setup();
    fireEvent.changeText(password(), 'secret');
    fireEvent.press(submit());
    await waitFor(() => expect(getByText(translate('deleteAccount.error'))).toBeTruthy());
  });
});
