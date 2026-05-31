import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, type ComposedGesture, type GestureType } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Petite barre grise centrée en haut d'une bottom-sheet, indique visuellement
 * qu'on peut tirer la modale vers le bas pour la fermer.
 *
 * Si `gesture` est fourni, la zone de la poignée capte le drag → on évite les
 * conflits avec un ScrollView/inputs internes (le geste ne triggerait jamais
 * sinon).
 */
interface Props {
  gesture?: GestureType | ComposedGesture;
}

const SheetHandle: React.FC<Props> = ({ gesture }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const content = (
    <View style={styles.wrap}>
      <View style={[styles.bar, { backgroundColor: colors.border }]} />
    </View>
  );
  if (!gesture) return content;
  return <GestureDetector gesture={gesture}>{content}</GestureDetector>;
};

const styles = StyleSheet.create({
  // Surface élargie pour offrir une bonne zone de drag même si la barre est
  // visuellement petite (style aligné sur la modale Gains).
  wrap: { alignItems: 'center', paddingTop: 4, paddingBottom: Spacing.sm },
  bar: { width: 36, height: 4, borderRadius: 2 },
});

export default SheetHandle;
