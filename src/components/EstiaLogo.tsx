import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';

const logoPrincipal = require('@/assets/logos/logo-estia-principal.png');
const logoBlanc = require('@/assets/logos/logo-estia-blanc.png');

interface Props {
  /** Hauteur du logo en pixels. Défaut 96. */
  size?: number;
  /** Conservé pour rétro-compat ; ignoré. */
  color?: string;
  /** Conservé pour rétro-compat ; ignoré. */
  showText?: boolean;
}

// Ratio du logo principal (199.1 × 300.06, vertical)
const ASPECT_RATIO = 199.1 / 300.06;

const EstiaLogo: React.FC<Props> = ({ size = 96 }) => {
  const colorScheme = useColorScheme();
  const width = Math.round(size * ASPECT_RATIO);

  return (
    <View style={styles.container}>
      <Image
        source={colorScheme === 'dark' ? logoBlanc : logoPrincipal}
        style={{ width, height: size }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
});

export default React.memo(EstiaLogo);
