import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontSize, FontWeight } from '@/constants/Layout';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  label: string;
  children: React.ReactNode;
}

/**
 * Wrapper réutilisable : pose un label sémantique au-dessus d'un champ
 * (input, select, etc.). Permet d'éviter les inputs "placeholder-only" qui
 * deviennent illisibles dès que l'utilisateur saisit quelque chose.
 */
const LabeledField: React.FC<Props> = ({ label, children }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.text2 }]}>{label}</Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});

export default React.memo(LabeledField);
