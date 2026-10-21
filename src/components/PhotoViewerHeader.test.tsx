import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import PhotoViewerHeader from './PhotoViewerHeader';
import { translate } from '@/i18n/runtime';
import { renderWithProviders } from '@/test-utils/render';

describe('PhotoViewerHeader — croix de la visionneuse', () => {
  it('ferme la visionneuse au tap', () => {
    const onRequestClose = jest.fn();
    const { getByLabelText } = renderWithProviders(<PhotoViewerHeader onRequestClose={onRequestClose} />);
    fireEvent.press(getByLabelText(translate('common.close')));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});
