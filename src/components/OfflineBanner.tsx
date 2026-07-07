import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

/** Hauteur visible du bandeau sous la zone safe (le contenu descend d'autant). */
const STRIP = 30;

/**
 * Enveloppe le contenu de l'app : quand l'API n'est plus joignable, un bandeau
 * « Mode hors ligne » coulisse depuis le haut ET pousse le contenu vers le bas
 * (au lieu de le recouvrir), pour ne pas écraser le logo/header. Les données
 * affichées sont alors les dernières enregistrées (cache React Query persisté).
 */
export default function OfflineBanner({ children }: { children: React.ReactNode }) {
  const online = useOnlineStatus();
  const insets = useSafeAreaInsets();
  const colors = Colors[useColorScheme()];
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(online ? 0 : 1, { duration: 250 });
  }, [online, progress]);

  const contentStyle = useAnimatedStyle(() => ({
    paddingTop: interpolate(progress.value, [0, 1], [0, STRIP]),
  }));

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-6, 0]) }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.banner,
          { paddingTop: insets.top, height: insets.top + STRIP, backgroundColor: colors.red },
          bannerStyle,
        ]}
      >
        <CloudOff size={15} color="#fff" />
        <Text style={styles.text}>Mode hors ligne — dernières données enregistrées</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  text: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
