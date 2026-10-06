import React from 'react';
import { Text } from 'react-native';
import { afterEach, describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import OfflineBanner from './OfflineBanner';
import { useOnlineStatus } from '@/lib/network';
import { translate } from '@/i18n/runtime';
import { renderWithProviders } from '@/test-utils/render';

afterEach(() => onlineManager.setOnline(true));

describe('useOnlineStatus — suit onlineManager', () => {
  it('en ligne par défaut, réagit aux changements', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    act(() => onlineManager.setOnline(false));
    expect(result.current).toBe(false);
    act(() => onlineManager.setOnline(true));
    expect(result.current).toBe(true);
  });
});

describe('OfflineBanner', () => {
  it('enveloppe le contenu et porte le libellé « Mode hors ligne »', () => {
    const { getByText } = renderWithProviders(
      <OfflineBanner>
        <Text>CONTENU</Text>
      </OfflineBanner>,
    );
    expect(getByText('CONTENU')).toBeTruthy();
    expect(getByText(translate('offline.banner'))).toBeTruthy();
  });
});
