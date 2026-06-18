import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { MenageStatus } from '@/api/types';

export type MenageFilter = MenageStatus | 'all' | 'to_validate';

interface Chip {
  key: MenageFilter;
  label: string;
}

/** Chip "picker" supplémentaire (logement / presta / créateur) : ouvre une feuille. */
export interface ExtraChip {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
}

// Validés/Annulés ne sont plus des filtres ici : les ménages clôturés vivent
// dans les Archives. La liste = worklist active.
const CHIPS: Chip[] = [
  { key: 'all', label: 'Tous' },
  { key: 'a_venir', label: 'À venir' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'termine', label: 'Terminés' },
  { key: 'to_validate', label: 'À valider' },
];

interface Props {
  selected: MenageFilter;
  onSelect: (value: MenageFilter) => void;
  /** Chips picker additionnels rendus à la suite (mêmes style/rangée). */
  extra?: ExtraChip[];
}

const FilterChips: React.FC<Props> = ({ selected, onSelect, extra }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const getChipColor = (key: string) => {
    if (key === 'a_venir') return colors.statusAVenir;
    if (key === 'en_cours') return colors.statusEnCours;
    if (key === 'termine') return colors.statusTermine;
    if (key === 'to_validate') return colors.statusTermine;
    if (key === 'valide') return colors.statusValide;
    return colors.primary;
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {CHIPS.map((chip) => {
        const isActive = selected === chip.key;
        const chipColor = getChipColor(chip.key);
        return (
          <TouchableOpacity
            key={chip.key}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? chipColor + '20' : colors.itemBackground,
                borderColor: isActive ? chipColor : colors.border,
              },
            ]}
            onPress={() => onSelect(chip.key)}
            accessibilityRole="tab"
            accessibilityLabel={chip.label}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.chipText, { color: isActive ? chipColor : colors.text2 }]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Séparateur visuel + chips picker (logement / presta / créateur) */}
      {extra && extra.length > 0 ? (
        <View style={[styles.sep, { backgroundColor: colors.border }]} />
      ) : null}
      {(extra ?? []).map((c) => (
        <TouchableOpacity
          key={c.key}
          style={[
            styles.chip,
            styles.pickerChip,
            {
              backgroundColor: c.active ? colors.primary + '20' : colors.itemBackground,
              borderColor: c.active ? colors.primary : colors.border,
            },
          ]}
          onPress={c.onPress}
          accessibilityRole="button"
          accessibilityLabel={c.label}
        >
          <Text style={[styles.chipText, { color: c.active ? colors.primary : colors.text2 }]} numberOfLines={1}>
            {c.label}
          </Text>
          <ChevronDown size={13} color={c.active ? colors.primary : colors.text2} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingRight: Spacing.lg },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, borderWidth: 1 },
  pickerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 180 },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  sep: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: 2 },
});

export default React.memo(FilterChips);
