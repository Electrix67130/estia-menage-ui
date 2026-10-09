import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import CommentThread from './CommentThread';
import { apiFetch } from '@/api/client';
import { translate } from '@/i18n/runtime';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual<typeof import('@/api/client')>('@/api/client');
  return { ...actual, apiFetch: jest.fn() };
});
jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
}));
jest.mock('@/hooks/useKeyboardAwareModalStyle', () => ({ useKeyboardAwareModalStyle: () => ({}) }));
jest.mock('@/api/hooks/useMenageViews', () => ({
  useUnreadCounts: () => ({ data: undefined }),
  useMarkTabViewed: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', first_name: 'Moi', last_name: 'Même' } }),
}));
const mockConfirm = jest.fn(async (_opts: { destructive?: boolean }) => true);
jest.mock('@/contexts/DialogContext', () => ({
  useDialog: () => ({ alert: jest.fn(async () => undefined), confirm: mockConfirm }),
}));

const api = apiFetch as jest.MockedFunction<typeof apiFetch>;

const base = { menage_id: 'm1', section_id: null, created_at: '2026-10-09T08:00:00.000Z', updated_at: '2026-10-09T08:00:00.000Z' };
const COMMENTS = [
  {
    ...base,
    id: 'c1',
    author_id: 'sofia',
    first_name: 'Sofia',
    last_name: 'Martin',
    content: 'Les clés sont où ?',
    reply_to: null,
    reactions: [{ emoji: '👍', count: 2, mine: false }],
  },
  {
    ...base,
    id: 'c2',
    author_id: 'me',
    first_name: 'Moi',
    last_name: 'Même',
    content: 'Dans la boîte',
    reply_to: { id: 'c1', content: 'Les clés sont où ?', author_id: 'sofia', first_name: 'Sofia', last_name: 'Martin' },
    reactions: [],
  },
];

beforeEach(() => {
  mockConfirm.mockClear();
  api.mockReset().mockImplementation((async (url: string) => {
    if (url.startsWith('/comments?')) return { data: COMMENTS, meta: { total: 2, page: 1, limit: 100, totalPages: 1 } };
    if (url.startsWith('/comments/mentionable')) return [];
    if (url.endsWith('/reactions')) return { comment_id: 'c1', reactions: [{ emoji: '👍', count: 3, mine: true }] };
    return {};
  }) as typeof apiFetch);
});

async function setup() {
  const utils = renderWithProviders(<CommentThread menageId="m1" sectionFilter="general" />);
  await utils.findByText('Dans la boîte');
  return utils;
}

describe('CommentThread — réponses et réactions', () => {
  it('affiche la citation d’une réponse et les pastilles de réaction', async () => {
    const { getAllByText, getByLabelText } = await setup();
    expect(getAllByText('Les clés sont où ?')).toHaveLength(2);
    expect(getByLabelText('👍 2')).toBeTruthy();
  });

  it('appuyer sur une pastille bascule ma réaction (optimiste, puis confirmée)', async () => {
    const { getByLabelText, findByLabelText } = await setup();
    fireEvent.press(getByLabelText('👍 2'));
    expect(await findByLabelText('👍 3')).toBeTruthy();
    expect(api).toHaveBeenCalledWith('/comments/c1/reactions', { method: 'POST', body: { emoji: '👍' } });
  });

  it('répondre à un message envoie reply_to_id puis retire la barre « Réponse à »', async () => {
    const { getAllByText, getByText, getByLabelText, queryByText } = await setup();
    fireEvent(getAllByText('Les clés sont où ?')[0].parent!.parent!, 'longPress');
    fireEvent.press(getByText(translate('comments.reply')));
    expect(getByText(translate('comments.replyingTo', { name: 'Sofia Martin' }))).toBeTruthy();

    fireEvent.changeText(getByLabelText(translate('comments.writeA11y')), 'Dans la boîte à clés');
    fireEvent.press(getByLabelText(translate('common.send')));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/comments', {
        method: 'POST',
        body: {
          menage_id: 'm1',
          section_id: null,
          content: 'Dans la boîte à clés',
          mentioned_user_ids: [],
          reply_to_id: 'c1',
        },
      }),
    );
    await waitFor(() => expect(queryByText(translate('comments.replyingTo', { name: 'Sofia Martin' }))).toBeNull());
  });
});

describe('CommentThread — actions selon l’auteur', () => {
  it('sur le message d’un autre : réagir, répondre, signaler, bloquer — pas modifier ni supprimer', async () => {
    const { getAllByText, getByText, queryByText, getByLabelText } = await setup();
    fireEvent(getAllByText('Les clés sont où ?')[0].parent!.parent!, 'longPress');
    expect(getByLabelText('❤️')).toBeTruthy();
    expect(getByText(translate('comments.reply'))).toBeTruthy();
    expect(getByText(translate('comments.report'))).toBeTruthy();
    expect(getByText(translate('block.actionNamed', { name: 'Sofia Martin' }))).toBeTruthy();
    expect(queryByText(translate('common.edit'))).toBeNull();
    expect(queryByText(translate('common.delete'))).toBeNull();
  });

  it('sur mon message : modifier et supprimer, ni signaler ni bloquer', async () => {
    const { getByText, queryByText } = await setup();
    fireEvent(getByText('Dans la boîte').parent!, 'longPress');
    expect(getByText(translate('common.edit'))).toBeTruthy();
    expect(getByText(translate('common.delete'))).toBeTruthy();
    expect(queryByText(translate('comments.report'))).toBeNull();
  });

  it('bloquer demande confirmation puis POST /blocks', async () => {
    const { getAllByText, getByText } = await setup();
    fireEvent(getAllByText('Les clés sont où ?')[0].parent!.parent!, 'longPress');
    fireEvent.press(getByText(translate('block.actionNamed', { name: 'Sofia Martin' })));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockConfirm.mock.calls[0][0]).toMatchObject({ destructive: true });
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/blocks', { method: 'POST', body: { user_id: 'sofia' } }),
    );
  });

  it('signaler ouvre la feuille de signalement sur ce message', async () => {
    const { getAllByText, getByText, findByText } = await setup();
    fireEvent(getAllByText('Les clés sont où ?')[0].parent!.parent!, 'longPress');
    fireEvent.press(getByText(translate('comments.report')));
    expect(await findByText('Sofia Martin : Les clés sont où ?')).toBeTruthy();
  });
});
