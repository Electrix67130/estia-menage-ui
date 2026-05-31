import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppHeader from '@/components/AppHeader';

/**
 * Archives — placeholder. L'archivage des ménages MVP est géré via DELETE.
 * Une vraie page archives (par logement, avec restore) sera réintroduite en V2.
 */
export default function ArchivesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader>
        <Text style={[styles.title, { color: colors.text }]}>Archives</Text>
      </AppHeader>
      <View style={styles.center}>
        <Text style={[styles.empty, { color: colors.mutedText }]}>
          Les archives seront disponibles dans une prochaine version.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: FontSize.xxl, fontWeight: '700' as const },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  empty: { fontSize: FontSize.md, textAlign: 'center' },
});
