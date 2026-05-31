import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CalendarScreen from './calendar';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Onglet "Calendrier" : route conservée sous le slug `mes-disponibilites`
 * (pour ne pas casser les deep-links existants) mais on n'affiche plus que
 * la vue calendrier — la liste des ménages avec boutons Présent/Absent a été
 * fusionnée dans l'onglet "Ménages" (`/(tabs)/index.tsx`) pour les
 * prestataires.
 */
export default function CalendarTabScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={{ flex: 1 }}>
        <CalendarScreen embedded />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
