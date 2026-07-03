import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  title: string;
  /** Petite ligne d'aide sous le titre. */
  subtitle?: string;
  /** Contenu optionnel aligné à droite du titre (badge, état…). */
  right?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Carte de section : conteneur blanc (surface) titré, pour regrouper
 * visuellement un ensemble de champs. Les champs à l'intérieur restent en
 * `itemBackground` pour ressortir sur le fond de la carte.
 */
export default function SectionCard({ title, subtitle, right, children }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.mutedText }]}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.xs, marginTop: 2 },
  body: { gap: Spacing.sm },
});
