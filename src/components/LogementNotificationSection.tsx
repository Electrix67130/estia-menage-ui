import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import {
  useLogementNotificationLevel,
  useSetLogementNotificationLevel,
  type LogementNotificationLevel,
} from '@/api/hooks/useNotificationPreferences';

const LEVELS: LogementNotificationLevel[] = ['all', 'important', 'none'];

/**
 * Mes notifications pour ce logement (réglage personnel, inspiré de Buildr) :
 * tout, l'important (mentions, affectations, rappels) ou rien.
 */
export default function LogementNotificationSection({ logementId }: { logementId: string }) {
  const colors = Colors[useColorScheme()];
  const { t } = useTranslation();
  const current = useLogementNotificationLevel(logementId);
  const setLevel = useSetLogementNotificationLevel();
  const level = current.data?.level ?? 'all';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.titleRow}>
        <Bell size={IconSize.sm} color={colors.mutedText} />
        <Text style={[styles.title, { color: colors.text }]}>{t('notifPrefs.logementLabel')}</Text>
      </View>
      <View
        style={[styles.segmented, { backgroundColor: colors.itemBackground }]}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('notifPrefs.logementLabel')}
      >
        {LEVELS.map((l) => {
          const selected = level === l;
          return (
            <TouchableOpacity
              key={l}
              style={[styles.segment, selected && { backgroundColor: colors.primary }]}
              onPress={() => setLevel.mutate({ logementId, level: l }, { onSuccess: () => current.refetch() })}
              disabled={current.isLoading || setLevel.isPending}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <Text style={[styles.segmentText, { color: selected ? '#FFFFFF' : colors.text }]}>
                {t(`notifPrefs.level.${l}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.desc, { color: colors.mutedText }]}>{t(`notifPrefs.levelDesc.${level}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  segmented: { flexDirection: 'row', borderRadius: Radius.md, padding: 2 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md - 2 },
  segmentText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  desc: { fontSize: FontSize.xs },
});
