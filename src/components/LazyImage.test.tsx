import React from 'react';
import { Image, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { describe, expect, it } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { LazyImage, LazyLoadScope, useLazyScrollHandler } from './LazyImage';

type MeasureCb = (x: number, y: number, w: number, h: number) => void;
interface Measurable {
  measureInWindow: (cb: MeasureCb) => void;
}

const src = { uri: 'https://example.test/photo.jpg' };
const style = { width: 100, height: 100 };
const scrollEvent = {} as NativeSyntheticEvent<NativeScrollEvent>;

/** ScrollView du scope qui expose son handler pour simuler un défilement. */
let fireScroll: (() => void) | null = null;
function ScopedScroll({ children }: { children: React.ReactNode }) {
  const onScroll = useLazyScrollHandler();
  fireScroll = () => onScroll(scrollEvent);
  return <ScrollView onScroll={onScroll}>{children}</ScrollView>;
}

/** Le placeholder (View) de la LazyImage : instance composite, dont `measureInWindow` est factice. */
function placeholderOf(utils: ReturnType<typeof render>) {
  const [node] = utils.UNSAFE_getAllByProps({ accessibilityElementsHidden: true });
  return node;
}

function measureAs(utils: ReturnType<typeof render>, x: number, y: number, w: number, h: number) {
  const node = placeholderOf(utils);
  (node.instance as Measurable).measureInWindow = (cb) => cb(x, y, w, h);
  act(() => {
    node.props.onLayout();
  });
}

describe('LazyImage — sans scope', () => {
  it('charge l’image immédiatement (aucun risque de vignette fantôme)', () => {
    const utils = render(<LazyImage source={src} style={style} />);
    expect(utils.UNSAFE_getByType(Image).props.source).toEqual(src);
    expect(utils.UNSAFE_queryAllByProps({ accessibilityElementsHidden: true })).toHaveLength(0);
  });
});

describe('LazyImage — dans un LazyLoadScope', () => {
  it('placeholder (taille du style, couleur optionnelle) tant que rien n’est mesuré', () => {
    const utils = render(
      <LazyLoadScope>
        <LazyImage source={src} style={style} placeholderColor="#EEE" />
      </LazyLoadScope>,
    );
    expect(utils.UNSAFE_queryByType(Image)).toBeNull();
    const ph = placeholderOf(utils);
    expect(ph.type).toBe(View);
    expect(ph.props.style).toEqual([style, { backgroundColor: '#EEE' }]);
  });

  it('monte l’Image dès que le layout la mesure dans le viewport', () => {
    const utils = render(
      <LazyLoadScope>
        <LazyImage source={src} style={style} />
      </LazyLoadScope>,
    );
    measureAs(utils, 0, 200, 100, 100);
    expect(utils.UNSAFE_getByType(Image).props.source).toEqual(src);
  });

  it('reste un placeholder hors écran, puis charge au scroll (notify) une fois visible', () => {
    const utils = render(
      <LazyLoadScope>
        <ScopedScroll>
          <LazyImage source={src} style={style} />
        </ScopedScroll>
      </LazyLoadScope>,
    );
    // Très loin sous le viewport (au-delà de la marge de préchargement de 300 px).
    measureAs(utils, 0, 5000, 100, 100);
    expect(utils.UNSAFE_queryByType(Image)).toBeNull();

    // L'utilisateur fait défiler : la mesure la trouve désormais proche du viewport.
    const node = placeholderOf(utils);
    (node.instance as Measurable).measureInWindow = (cb) => cb(0, 900, 100, 100);
    act(() => {
      fireScroll?.();
    });
    expect(utils.UNSAFE_getByType(Image)).toBeTruthy();
  });

  it('ignore une mesure 0×0 (pas encore posée sur Android)', () => {
    const utils = render(
      <LazyLoadScope>
        <LazyImage source={src} style={style} />
      </LazyLoadScope>,
    );
    measureAs(utils, 0, 0, 0, 0);
    expect(utils.UNSAFE_queryByType(Image)).toBeNull();
  });
});
