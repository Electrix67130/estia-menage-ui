import React, { useEffect } from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudOff } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { FontSize, FontWeight, Spacing } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useOnlineStatus } from '@/lib/network';

/**
 * Bandeau « Mode hors ligne » qui coulisse depuis le haut quand l'API n'est
 * plus joignable. Les données affichées sont alors les dernières enregistrées
 * (cache React Query persisté).
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  const insets = useSafeAreaInsets();
  const colors = Colors[useColorScheme()];
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(online ? 0 : 1, { duration: 250 });
  }, [online, progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-8, 0]) }],
  }));

  // Toujours monté (l'animation gère l'apparition), mais on retire des
  // interactions quand caché.
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.xs, backgroundColor: colors.red },
        animStyle,
      ]}
    >
      <CloudOff size={15} color="#fff" />
      <Text style={styles.text}>Mode hors ligne — dernières données enregistrées</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    ...Platform.select({ ios: {}, android: {} }),
  },
  text: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
