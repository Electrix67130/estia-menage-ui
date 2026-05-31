import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Spacing } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LOGO_ROND_LIGHT, LOGO_ROND_DARK } from '@/assets/logos/logo-svg';

interface Props {
  children?: React.ReactNode;
}

const AppHeader: React.FC<Props> = ({ children }) => {
  const colorScheme = useColorScheme();
  const xml = colorScheme === 'dark' ? LOGO_ROND_DARK : LOGO_ROND_LIGHT;

  return (
    <View style={styles.container}>
      <SvgXml xml={xml} width={44} height={44} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
});

export default React.memo(AppHeader);
