import { useEffect } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * Geste swipe-down to close pour bottom-sheets.
 *
 * Usage :
 * ```tsx
 * const { gesture, animatedStyle, reset } = useSwipeToClose(onClose);
 * <GestureDetector gesture={gesture}>
 *   <Animated.View style={[styles.modal, animatedStyle, keyboardStyle]}>
 *     <SheetHandle />
 *     ...
 *   </Animated.View>
 * </GestureDetector>
 * ```
 *
 * Le geste tire la modale vers le bas, et la ferme si on dépasse 80 px de
 * translation OU si la vélocité de relâchement dépasse 500. Sinon snap retour.
 * `reset()` à appeler à l'ouverture si la modale est ré-affichée (sinon elle
 * garde l'animation précédente).
 */
export function useSwipeToClose(onClose: () => void, visible?: boolean) {
  const translateY = useSharedValue(0);

  // Reset translateY quand la modale réapparait (sinon elle garde la position
  // de fermeture précédente et reste invisible).
  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      // Ne suit que les drags vers le bas — un drag vers le haut est ignoré
      // pour ne pas faire bouger la modale vers le haut.
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 500) {
        // Dismiss : on glisse vers le bas puis ferme.
        translateY.value = withTiming(600, { duration: 180 });
        runOnJS(onClose)();
      } else {
        // Snap back.
        translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const reset = () => {
    translateY.value = 0;
  };

  return { gesture, animatedStyle, reset };
}
