import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ban } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useBlocks, useUnblockUser } from '@/api/hooks/useBlocks';

/**
 * Profil → « Utilisateurs bloqués » (repris de Buildr) : les personnes dont on
 * ne voit plus les messages ni les photos, avec de quoi les débloquer.
 */
const BlockedUsersSection: React.FC = () => {
  const colors = Colors[useColorScheme()];
  const { t } = useTranslation();
  const { data: blocked } = useBlocks();
  const unblock = useUnblockUser();

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('block.section')}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.hint, { color: colors.mutedText }]}>{t('block.hint')}</Text>
        {(blocked ?? []).length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedText }]}>{t('block.empty')}</Text>
        ) : (
          (blocked ?? []).map((b) => (
            <View key={b.user_id} style={styles.row}>
              <Ban size={IconSize.sm} color={colors.text2} />
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {b.first_name} {b.last_name}
              </Text>
              <TouchableOpacity
                onPress={() => unblock.mutate(b.user_id)}
                disabled={unblock.isPending}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`${t('block.unblock')} ${b.first_name} ${b.last_name}`}
              >
                <Text style={[styles.unblock, { color: colors.primary }]}>{t('block.unblock')}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginTop: Spacing.lg, marginLeft: Spacing.sm },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  hint: { fontSize: FontSize.sm },
  empty: { fontSize: FontSize.sm, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  name: { flex: 1, fontSize: FontSize.base },
  unblock: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});

export default BlockedUsersSection;
