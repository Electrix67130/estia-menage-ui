import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  View,
  type ImageProps,
  type ImageStyle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
} from 'react-native';

/**
 * Chargement différé des images dans une `ScrollView`.
 *
 * Problème : la fiche prestation est une `ScrollView` (pas une liste
 * virtualisée), donc **toutes** les vignettes (photos de référence du logement,
 * grilles) partaient en téléchargement à l'ouverture, y compris celles hors
 * écran. Sur une fiche avec quarante photos, c'est quarante requêtes d'un coup
 * pour en afficher six.
 *
 * Principe : un `LazyLoadScope` entoure la zone scrollable et redistribue les
 * événements de scroll ; chaque `LazyImage` se mesure à l'écran (au layout puis
 * à chaque scroll, throttlé) et ne monte la vraie `Image` qu'une fois proche
 * du viewport (marge `PRELOAD_MARGIN`). Une fois chargée, elle le reste.
 *
 * Sans `LazyLoadScope` parent, `LazyImage` charge immédiatement : aucun risque
 * de vignette qui n'apparaît jamais là où personne n'a branché le scope.
 *
 * 100 % JS → livrable en OTA. Le cache disque persistant (expo-image) est
 * prévu pour la 1.0.1 (build natif).
 */

/** Distance (px) avant le bord du viewport à partir de laquelle on charge. */
const PRELOAD_MARGIN = 300;
/** Deux événements de scroll ne déclenchent pas deux mesures en moins de ce délai. */
const SCROLL_THROTTLE_MS = 120;

type Listener = () => void;

interface ScopeValue {
  subscribe: (listener: Listener) => () => void;
  notify: () => void;
}

const LazyLoadContext = createContext<ScopeValue | null>(null);

export const LazyLoadScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const listeners = useRef(new Set<Listener>());
  const value = useMemo<ScopeValue>(
    () => ({
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
      notify: () => {
        listeners.current.forEach((l) => l());
      },
    }),
    [],
  );
  return <LazyLoadContext.Provider value={value}>{children}</LazyLoadContext.Provider>;
};

/**
 * Handler `onScroll` à poser sur chaque `ScrollView` (verticale ET
 * horizontales imbriquées) du scope. Penser à `scrollEventThrottle={100}`.
 */
export function useLazyScrollHandler(): (e: NativeSyntheticEvent<NativeScrollEvent>) => void {
  const scope = useContext(LazyLoadContext);
  const last = useRef(0);
  return useCallback(() => {
    if (!scope) return;
    const now = Date.now();
    if (now - last.current < SCROLL_THROTTLE_MS) return;
    last.current = now;
    scope.notify();
  }, [scope]);
}

interface LazyImageProps extends Omit<ImageProps, 'style'> {
  style?: StyleProp<ImageStyle>;
  /** Couleur du bloc affiché tant que l'image n'est pas demandée. */
  placeholderColor?: string;
}

/**
 * Remplace `Image` à l'identique (mêmes props) ; le `style` donne la taille du
 * placeholder, donc la mise en page ne bouge pas quand l'image arrive.
 */
export const LazyImage: React.FC<LazyImageProps> = ({ style, placeholderColor, ...imageProps }) => {
  const scope = useContext(LazyLoadContext);
  const [visible, setVisible] = useState(scope === null);
  const ref = useRef<View>(null);

  const check = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y, w, h) => {
      // Pas encore posé (Android peut renvoyer 0×0 avant le premier layout).
      if (w === 0 && h === 0) return;
      const { width: W, height: H } = Dimensions.get('window');
      const onScreen =
        y + h >= -PRELOAD_MARGIN && y <= H + PRELOAD_MARGIN && x + w >= -PRELOAD_MARGIN && x <= W + PRELOAD_MARGIN;
      if (onScreen) setVisible(true);
    });
  }, []);

  useEffect(() => {
    if (visible || !scope) return;
    return scope.subscribe(check);
  }, [visible, scope, check]);

  if (visible) return <Image style={style} {...imageProps} />;

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={check}
      style={[style as StyleProp<ImageStyle>, placeholderColor ? { backgroundColor: placeholderColor } : null]}
      accessibilityElementsHidden
    />
  );
};

export default LazyImage;
