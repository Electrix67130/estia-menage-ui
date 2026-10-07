import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import ReportCommentSheet, { commentExcerpt, EXCERPT_LENGTH } from './ReportCommentSheet';
import { apiFetch } from '@/api/client';
import { translate } from '@/i18n/runtime';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual<typeof import('@/api/client')>('@/api/client');
  return { ...actual, apiFetch: jest.fn() };
});
jest.mock('expo-updates', () => ({ runtimeVersion: '1.0.0' }));

const mockAlert = jest.fn(async () => undefined);
jest.mock('@/contexts/DialogContext', () => ({
  useDialog: () => ({ alert: mockAlert, confirm: jest.fn(async () => true) }),
}));

const api = apiFetch as jest.MockedFunction<typeof apiFetch>;
const LONG = 'Ce commentaire est vraiment beaucoup trop long pour tenir dans un extrait';

function setup(content = LONG) {
  const onClose = jest.fn();
  const utils = renderWithProviders(
    <ReportCommentSheet visible commentId="c1" commentContent={content} screen="menage.comments" onClose={onClose} />,
  );
  const submit = () => utils.getByLabelText(translate('comments.report.submit'));
  return { ...utils, onClose, submit };
}

beforeEach(() => {
  api.mockReset().mockResolvedValue({ id: 'f1' });
  mockAlert.mockClear();
});

describe('commentExcerpt', () => {
  it('tronque à 30 caractères avec une ellipse, sinon rend le texte tel quel', () => {
    expect(commentExcerpt('Court')).toBe('Court');
    expect(commentExcerpt(LONG)).toBe(`${LONG.slice(0, EXCERPT_LENGTH)}…`);
    expect(commentExcerpt('  espaces  ')).toBe('espaces');
  });
});

describe('ReportCommentSheet — motif requis', () => {
  it('le bouton reste désactivé sans motif, s’active une fois un motif coché', () => {
    const { submit, getByLabelText } = setup();
    expect(submit().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(submit());
    expect(api).not.toHaveBeenCalled();

    fireEvent.press(getByLabelText(translate('comments.report.reason.harassment')));
    expect(submit().props.accessibilityState.disabled).toBe(false);
  });

  it('propose les 4 motifs en boutons radio', () => {
    const { getByLabelText } = setup();
    for (const key of [
      'comments.report.reason.inappropriate',
      'comments.report.reason.harassment',
      'comments.report.reason.spam',
      'comments.report.reason.other',
    ] as const) {
      expect(getByLabelText(translate(key)).props.accessibilityRole).toBe('radio');
    }
  });
});

describe('ReportCommentSheet — envoi', () => {
  it('POST /feedbacks de type report avec le motif, les précisions, la cible et le contexte', async () => {
    const { submit, getByLabelText, onClose } = setup();
    fireEvent.press(getByLabelText(translate('comments.report.reason.inappropriate')));
    fireEvent.changeText(getByLabelText(translate('comments.report.detailsLabel')), '  Il insulte le client.  ');
    fireEvent.press(submit());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/feedbacks', {
      method: 'POST',
      body: {
        type: 'report',
        subject: translate('comments.report.reason.inappropriate'),
        message: 'Il insulte le client.',
        target_type: 'comment',
        target_id: 'c1',
        platform: 'mobile',
        app_version: '1.0.0',
        screen: 'menage.comments',
        locale: 'fr',
      },
    });
    expect(mockAlert).toHaveBeenCalledWith({
      title: translate('comments.report.sentTitle'),
      message: translate('comments.report.sentMessage'),
    });
  });

  it('sans précisions, le message reprend l’extrait du commentaire (≥ 10 caractères)', async () => {
    const { submit, getByLabelText } = setup();
    fireEvent.press(getByLabelText(translate('comments.report.reason.spam')));
    fireEvent.press(submit());

    await waitFor(() => expect(api).toHaveBeenCalled());
    const call = api.mock.calls[0];
    const body = (call[1] as { body: { message: string; subject: string } }).body;
    expect(body.message).toBe(
      translate('comments.report.fallbackMessage', { excerpt: `${LONG.slice(0, EXCERPT_LENGTH)}…` }),
    );
    expect(body.message.length).toBeGreaterThanOrEqual(10);
    expect(body.subject).toBe(translate('comments.report.reason.spam'));
  });

  it('un commentaire court n’est pas tronqué dans le message par défaut', async () => {
    const { submit, getByLabelText } = setup('Bof.');
    fireEvent.press(getByLabelText(translate('comments.report.reason.other')));
    fireEvent.press(submit());
    await waitFor(() => expect(api).toHaveBeenCalled());
    const body = (api.mock.calls[0][1] as { body: { message: string } }).body;
    expect(body.message).toBe(translate('comments.report.fallbackMessage', { excerpt: 'Bof.' }));
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
