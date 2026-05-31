import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock, Lock } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import StatusBadge from './StatusBadge';
import { menageLogementLabel, menageSourceLabel, type Menage } from '@/api/types';
import { formatDateFr, formatDurationMin } from '@/lib/date-fr';

interface Props {
  menage: Menage;
  onPress: (id: string) => void;
  onLongPress?: (menage: Menage) => void;
  selectionMode?: boolean;
  selected?: boolean;
  unread?: number;
}

const MenageCard: React.FC<Props> = ({ menage, onPress, onLongPress, selected }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const day = menage.date_prevue.slice(8, 10);
  const dayShort = formatDateFr(menage.date_prevue.slice(0, 10), 'dayShort'); // "5 juin"
  const month = dayShort.split(' ').slice(1).join(' ');
  const year = menage.date_prevue.slice(0, 4);
  const time = menage.horaire_prevu ? menage.horaire_prevu.slice(0, 5) : null;
  const duration = menage.duree_estimee_min ? formatDurationMin(menage.duree_estimee_min) : null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        Shadow.sm,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : 1,
        },
      ]}
      onPress={() => onPress(menage.id)}
      onLongPress={() => onLongPress?.(menage)}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      {/* Date centrée à gauche */}
      <View style={styles.dateBlock}>
        <Text style={[styles.dateDay, { color: colors.text }]}>{day}</Text>
        <Text style={[styles.dateMonth, { color: colors.text2 }]} numberOfLines={1}>{month}</Text>
        <View style={styles.dateYearRow}>
          <Text style={[styles.dateYear, { color: colors.text2 }]}>{year}</Text>
          {menage.date_locked ? (
            <Lock size={10} color={colors.statusEnCours} />
          ) : null}
        </View>
      </View>

      {/* Séparateur vertical */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Infos : nom du logement (titre) + meta */}
      <View style={styles.infoBlock}>
        <View style={styles.titleRow}>
          <View style={styles.logementRow}>
            <View style={[styles.logementDot, { backgroundColor: menage.logement_color ?? colors.primary }]} />
            <Text style={[styles.logement, { color: colors.text }]} numberOfLines={1}>
              {menageLogementLabel(menage)}
            </Text>
          </View>
          <View style={styles.badgesRow}>
            {menage.has_pending_reschedule ? (
              <View
                style={[styles.reschedulePill, { backgroundColor: colors.statusEnCours + '25' }]}
                accessibilityLabel="Demande de changement en attente"
              >
                <Clock size={12} color={colors.statusEnCours} />
              </View>
            ) : null}
            <StatusBadge status={menage.status} />
          </View>
        </View>

        <View style={styles.metaRow}>
          {duration ? (
            <View style={[styles.durationChip, { backgroundColor: colors.primary + '20' }]}>
              <Clock size={13} color={colors.primary} />
              <Text style={[styles.durationText, { color: colors.primary }]}>{duration}</Text>
            </View>
          ) : null}
          {time ? <Text style={[styles.meta, { color: colors.text2 }]}>{time}</Text> : null}
          {menage.prix_prevu != null ? (
            <Text style={[styles.meta, { color: colors.text2 }]}>
              {menage.prix_prevu} €
              {menage.validated_price != null && Number(menage.validated_price) !== Number(menage.prix_prevu) ? (
                <Text style={{ color: colors.primary }}> → {menage.validated_price} €</Text>
              ) : null}
            </Text>
          ) : null}
          <View style={[styles.sourceChip, { backgroundColor: colors.itemBackground }]}>
            <Text style={[styles.sourceText, { color: colors.text2 }]}>
              {menageSourceLabel(menage.external_source)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  dateBlock: { alignItems: 'center', justifyContent: 'center', minWidth: 52 },
  dateDay: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, lineHeight: FontSize.xl + 2 },
  dateMonth: { fontSize: 10, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 1 },
  dateYear: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  dateYearRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 2 },
  infoBlock: { flex: 1, gap: Spacing.xs, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  logementRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  logementDot: { width: 10, height: 10, borderRadius: 5 },
  logement: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, flex: 1, letterSpacing: -0.2 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reschedulePill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  durationText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  meta: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  sourceChip: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  sourceText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
});

export default React.memo(MenageCard);
