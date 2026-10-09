import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import ReportSheet, { type ReportTargetRef } from './ReportSheet';
import { apiFetch } from '@/api/client';
import { translate } from '@/i18n/runtime';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual<typeof import('@/api/client')>('@/api/client');
  return { ...actual, apiFetch: jest.fn() };
});

const mockAlert = jest.fn(async () => undefined);
jest.mock('@/contexts/DialogContext', () => ({
  useDialog: () => ({ alert: mockAlert, confirm: jest.fn(async () => true) }),
}));

const api = apiFetch as jest.MockedFunction<typeof apiFetch>;
const COMMENT: ReportTargetRef = { type: 'comment', id: 'c1', label: 'Sofia Martin : Propos déplacés' };

function setup(target: ReportTargetRef | null = COMMENT) {
  const onClose = jest.fn();
  const utils = renderWithProviders(<ReportSheet target={target} onClose={onClose} />);
  const submit = () => utils.getByLabelText(translate('comments.report.submit'));
  return { ...utils, onClose, submit };
}

beforeEach(() => {
  api.mockReset().mockResolvedValue({ id: 'r1' });
  mockAlert.mockClear();
});

describe('ReportSheet — affichage', () => {
  it('rappelle ce qu’on signale, le titre suit le type de cible, et dit que la personne n’est pas prévenue', () => {
    const { getByText } = setup();
    expect(getByText(COMMENT.label)).toBeTruthy();
    expect(getByText(translate('comments.report.title'))).toBeTruthy();
    expect(getByText(translate('moderation.reportHint'))).toBeTruthy();
  });

  it('une photo et un membre ont leur propre titre', () => {
    expect(setup({ type: 'photo', id: 'p1', label: '' }).getByText(translate('moderation.reportPhotoTitle'))).toBeTruthy();
    expect(
      setup({ type: 'user', id: 'u1', label: 'Sofia Martin' }).getByText(translate('moderation.reportUserTitle')),
    ).toBeTruthy();
  });

  it('propose les 4 motifs en boutons radio, sans motif par défaut', () => {
    const { getByLabelText, submit } = setup();
    for (const key of [
      'comments.report.reason.inappropriate',
      'comments.report.reason.harassment',
      'comments.report.reason.spam',
      'comments.report.reason.other',
    ] as const) {
      const radio = getByLabelText(translate(key));
      expect(radio.props.accessibilityRole).toBe('radio');
      expect(radio.props.accessibilityState.checked).toBe(false);
    }
    expect(submit().props.accessibilityState.disabled).toBe(true);
  });
});

describe('ReportSheet — envoi', () => {
  it('rien ne part sans motif', () => {
    const { submit } = setup();
    fireEvent.press(submit());
    expect(api).not.toHaveBeenCalled();
  });

  it('POST /reports avec la cible, le motif et la précision nettoyée', async () => {
    const { submit, getByLabelText, onClose } = setup();
    fireEvent.press(getByLabelText(translate('comments.report.reason.spam')));
    fireEvent.changeText(getByLabelText(translate('comments.report.detailsLabel')), '  Hors sujet répété.  ');
    fireEvent.press(submit());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/reports', {
      method: 'POST',
      body: { target_type: 'comment', target_id: 'c1', reason: 'off_topic', comment: 'Hors sujet répété.' },
    });
    expect(mockAlert).toHaveBeenCalledWith({
      title: translate('comments.report.sentTitle'),
      message: translate('comments.report.sentMessage'),
    });
  });

  it('une précision vide n’est pas envoyée', async () => {
    const { submit, getByLabelText } = setup({ type: 'user', id: 'u1', label: 'Sofia Martin' });
    fireEvent.press(getByLabelText(translate('comments.report.reason.harassment')));
    fireEvent.changeText(getByLabelText(translate('comments.report.detailsLabel')), '   ');
    fireEvent.press(submit());
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect((api.mock.calls[0][1] as { body: unknown }).body).toEqual({
      target_type: 'user',
      target_id: 'u1',
      reason: 'harassment',
      comment: undefined,
    });
  });

  it('erreur API → message d’erreur, la feuille reste ouverte', async () => {
    api.mockRejectedValue(new Error('network'));
    const { submit, getByLabelText, getByText, onClose } = setup();
    fireEvent.press(getByLabelText(translate('comments.report.reason.other')));
    fireEvent.press(submit());
    await waitFor(() => expect(getByText(translate('common.error'))).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
