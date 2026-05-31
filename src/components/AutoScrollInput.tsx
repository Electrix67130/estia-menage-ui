import React, { forwardRef, useCallback } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { useKeyboardScroll } from './KeyboardAwareScroll';

/**
 * Drop-in replacement pour TextInput : appelle automatiquement
 * scrollToInput au focus si on est dans un KeyboardAwareScroll.
 * Évite que le clavier cache l'input.
 */
const AutoScrollInput = forwardRef<TextInput, TextInputProps>(function AutoScrollInput(
  { onFocus, ...rest },
  ref,
) {
  const ks = useKeyboardScroll();

  const handleFocus = useCallback<NonNullable<TextInputProps['onFocus']>>(
    (e) => {
      const target = (e.nativeEvent as unknown as { target?: number }).target;
      if (target) ks?.scrollToInput(target);
      onFocus?.(e);
    },
    [ks, onFocus],
  );

  return <TextInput ref={ref} {...rest} onFocus={handleFocus} />;
});

export default AutoScrollInput;
