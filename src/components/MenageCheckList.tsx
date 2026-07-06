import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Check, CheckCheck, Square } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMenageCheck, useToggleItem, useToggleSection, useToggleAll } from '@/api/hooks/useMenageCheck';

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
  const toggleSection = useToggleSection(menageId);
  const toggleAll = useToggleAll(menageId);
  const bulkPending = toggleSection.isPending || toggleAll.isPending;

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

  const allItems = tree.flatMap((s) => s.items);
  const allDone = allItems.length > 0 && allItems.every((i) => !!i.validated_at);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {!readonly ? (
        <TouchableOpacity
          style={[styles.bulkAllBtn, { borderColor: colors.primary }]}
          onPress={() => toggleAll.mutate(!allDone)}
          disabled={bulkPending}
          accessibilityRole="button"
        >
          <CheckCheck size={IconSize.sm} color={colors.primary} />
          <Text style={[styles.bulkAllText, { color: colors.primary }]}>
            {allDone ? 'Tout décocher' : 'Tout cocher'}
          </Text>
        </TouchableOpacity>
      ) : null}
      {tree.map((section) => {
        const total = section.items.length;
        const done = section.items.filter((i) => !!i.validated_at).length;
        const sectionAllDone = total > 0 && done === total;
        // Icône : choisie (emoji) ; '' = aucune ; null/absent = défaut selon le type.
        const sectionIcon =
          section.icon === '' ? null : section.icon || SECTION_ICONS[section.section_type] || '•';
        return (
          <View key={section.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              {sectionIcon ? <Text style={[styles.sectionIcon]}>{sectionIcon}</Text> : null}
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.section_label}</Text>
              <Text style={[styles.progress, { color: colors.text2 }]}>
                {done}/{total}
              </Text>
              {!readonly && total > 0 ? (
                <TouchableOpacity
                  onPress={() => toggleSection.mutate({ sectionId: section.id, validated: !sectionAllDone })}
                  disabled={bulkPending}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={sectionAllDone ? 'Décocher la section' : 'Cocher toute la section'}
                >
                  {sectionAllDone ? (
                    <Square size={IconSize.sm} color={colors.text2} />
                  ) : (
                    <CheckCheck size={IconSize.sm} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ) : null}
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
  bulkAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  bulkAllText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
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
