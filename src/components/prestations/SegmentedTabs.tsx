import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize, FontWeight, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

export interface Segment<K extends string> {
  key: K;
  label: string;
  /** Compteur affiché à droite du libellé (0 / undefined = rien). */
  badge?: number;
}

interface Props<K extends string> {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
}

/**
 * Contrôle segmenté façon iOS (même dessin que le calendrier) : une question
 * par vue — Planning / À traiter / Historique.
 */
export default function SegmentedTabs<K extends string>({ segments, value, onChange }: Props<K>) {
  const colors = Colors[useColorScheme()];
  return (
    <View style={[styles.segmented, { backgroundColor: colors.itemBackground }]}>
      {segments.map((seg) => {
        const active = value === seg.key;
        return (
          <TouchableOpacity
            key={seg.key}
            style={[styles.segment, active && [styles.segmentActive, { backgroundColor: colors.surface }]]}
            onPress={() => onChange(seg.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={seg.badge ? `${seg.label} (${seg.badge})` : seg.label}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? colors.text : colors.text2, fontWeight: active ? FontWeight.semibold : FontWeight.medium },
              ]}
            >
              {seg.label}
            </Text>
            {seg.badge ? (
              <View style={[styles.badge, { backgroundColor: colors.red }]}>
                <Text style={styles.badgeText}>{seg.badge > 99 ? '99+' : seg.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: 8,
  },
  segmentActive: { ...Shadow.sm },
  segmentText: { fontSize: FontSize.sm },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: FontWeight.bold },
});
