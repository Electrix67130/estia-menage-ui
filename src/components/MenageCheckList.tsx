import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Check, Circle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMenageCheck, useToggleItem } from '@/api/hooks/useMenageCheck';

interface Props {
  menageId: string;
  readonly?: boolean;
}

export const SECTION_ICONS: Record<string, string> = {
  kitchen: '🍳',
  living_room: '🛋️',
  bedroom: '🛏️',
  bathroom: '🚿',
  wc: '🚽',
  exterior: '🌳',
  basement: '📦',
  laundry: '🧺',
  general: '✨',
};

export default function MenageCheckList({ menageId, readonly }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { data: tree, isLoading } = useMenageCheck(menageId);
  const toggleMutation = useToggleItem(menageId);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!tree || tree.length === 0) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: colors.mutedText }}>Aucune checklist générée.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {tree.map((section) => {
        const total = section.items.length;
        const done = section.items.filter((i) => !!i.validated_at).length;
        return (
          <View key={section.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionIcon]}>{SECTION_ICONS[section.section_type] || '•'}</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.section_label}</Text>
              <Text style={[styles.progress, { color: colors.text2 }]}>
                {done}/{total}
              </Text>
            </View>
            <View style={[styles.itemsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {section.items.map((item, idx) => {
                const isValidated = !!item.validated_at;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.item,
                      idx < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                    disabled={readonly || toggleMutation.isPending}
                    onPress={() =>
                      toggleMutation.mutate({ id: item.id, body: { validated: !isValidated } })
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isValidated }}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: isValidated ? colors.primary : 'transparent',
                          borderColor: isValidated ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {isValidated ? <Check size={14} color="#FFFFFF" /> : null}
                    </View>
                    <Text
                      style={[
                        styles.itemText,
                        {
                          color: isValidated ? colors.mutedText : colors.text,
                          textDecorationLine: isValidated ? 'line-through' : 'none',
                        },
                      ]}
                    >
                      {item.item_label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionIcon: { fontSize: 20 },
  sectionTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  progress: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  itemsCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, fontSize: FontSize.md },
});
