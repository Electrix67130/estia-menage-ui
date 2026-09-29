import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, Bell, ClipboardCheck, Play, Plus, Clock, Lock } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  menageLogementLabel,
  menagePrestataireLabel,
  prestationTypeLabel,
  prestationTypeColorKey,
  type Menage,
} from '@/api/types';
import { formatDateFr, formatDurationMin } from '@/lib/date-fr';

interface Props {
  menage: Menage;
  onPress: (id: string) => void;
  onLongPress?: (menage: Menage) => void;
  /** Tap sur « Affecter » (non assigné). Par défaut, ouvre la fiche. */
  onAssign?: (menage: Menage) => void;
  selected?: boolean;
  unread?: number;
  /** Affiche la date (vue « À traiter », où les cartes ne sont pas groupées par jour). */
  showDate?: boolean;
  /** Carte atténuée (passé, à traiter) : fond du thème, sans relief. */
  muted?: boolean;
  /** Ligne d'information sous le prestataire (« Terminé à 15:40 · 4 photos »). */
  note?: string;
  /** Boutons d'action en pied de carte (Valider, Affecter…). */
  actions?: React.ReactNode;
}

/**
 * Carte de la vue Planning (admin). Le jour est dans l'en-tête de section, donc
 * la carte montre l'heure ; le prestataire est le premier regard, « Affecter »
 * est un bouton, et le statut n'apparaît que s'il sort de l'ordinaire.
 */
const PlanningCard: React.FC<Props> = ({
  menage,
  onPress,
  onLongPress,
  onAssign,
  selected,
  unread = 0,
  showDate = false,
  muted = false,
  note,
  actions,
}) => {
  const colors = Colors[useColorScheme()];
  const start = menage.horaire_prevu ? menage.horaire_prevu.slice(0, 5) : null;
  const end = menage.horaire_fin_prevu ? menage.horaire_fin_prevu.slice(0, 5) : null;
  const duration = menage.duree_estimee_min ? formatDurationMin(menage.duree_estimee_min) : null;
  const late = !!menage.needs_attention;
  const typeColor = colors[prestationTypeColorKey(menage.prestation_type)];
  const assigned = !!menage.prestataire_user_id;
  const initials = assigned
    ? [menage.prestataire_first_name?.[0], menage.prestataire_last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
    : '';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        muted ? null : Shadow.sm,
        {
          backgroundColor: late && !selected ? colors.red + '12' : muted ? colors.itemBackground : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : 1,
        },
        late && !selected ? { borderLeftColor: colors.red, borderLeftWidth: 3 } : null,
      ]}
      onPress={() => onPress(menage.id)}
      onLongPress={() => onLongPress?.(menage)}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={styles.topRow}>
        {/* Heure (ou date en vue À traiter) */}
        <View style={styles.timeBlock}>
          {showDate ? (
            <>
              <Text style={[styles.timeMain, { color: colors.text }]}>{menage.date_prevue.slice(8, 10)}</Text>
              <Text style={[styles.timeSub, { color: colors.text2 }]} numberOfLines={1}>
                {formatDateFr(menage.date_prevue.slice(0, 10), 'dayShort').split(' ').slice(1).join(' ')}
              </Text>
              {start ? <Text style={[styles.timeSub, { color: colors.mutedText }]}>{start}</Text> : null}
            </>
          ) : (
            <>
              <Text style={[styles.timeMain, { color: start ? colors.text : colors.mutedText }]}>{start ?? '—'}</Text>
              {end ? (
                <Text style={[styles.timeSub, { color: colors.mutedText }]}>{end}</Text>
              ) : duration ? (
                <Text style={[styles.timeSub, { color: colors.mutedText }]}>{duration}</Text>
              ) : null}
            </>
          )}
          {menage.date_locked ? <Lock size={10} color={colors.statusEnCours} /> : null}
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.infoBlock}>
          <View style={styles.titleRow}>
            <View style={styles.logementRow}>
              <View style={[styles.logementDot, { backgroundColor: menage.logement_color ?? colors.primary }]} />
              <Text style={[styles.logement, { color: colors.text }]} numberOfLines={1}>
                {menageLogementLabel(menage)}
              </Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>{prestationTypeLabel(menage.prestation_type)}</Text>
            </View>
          </View>

          <View style={styles.whoRow}>
            {assigned ? (
              <View style={styles.who}>
                <View style={[styles.avatar, { backgroundColor: (menage.logement_color ?? colors.primary) + '25' }]}>
                  <Text style={[styles.avatarText, { color: menage.logement_color ?? colors.primary }]}>{initials}</Text>
                </View>
                <Text style={[styles.whoText, { color: colors.text2 }]} numberOfLines={1}>
                  {menagePrestataireLabel(menage)}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.assignBtn, { borderColor: colors.primary }]}
                onPress={() => (onAssign ? onAssign(menage) : onPress(menage.id))}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Affecter un prestataire"
              >
                <Plus size={12} color={colors.primary} />
                <Text style={[styles.assignText, { color: colors.primary }]}>Affecter</Text>
              </TouchableOpacity>
            )}
            <View style={styles.badges}>
              {unread > 0 ? (
                <View style={[styles.pill, { backgroundColor: colors.red }]}>
                  <Bell size={10} color="#FFFFFF" />
                  <Text style={[styles.pillText, { color: '#FFFFFF' }]}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
              {menage.has_pending_reschedule ? (
                <View style={[styles.pill, { backgroundColor: colors.statusEnCours + '25' }]} accessibilityLabel="Demande de changement en attente">
                  <Clock size={11} color={colors.statusEnCours} />
                </View>
              ) : null}
              {late ? (
                <View style={[styles.pill, { backgroundColor: colors.red + '20' }]}>
                  <AlertTriangle size={11} color={colors.red} />
                  <Text style={[styles.pillText, { color: colors.red }]}>Non pointé</Text>
                </View>
              ) : menage.status === 'en_cours' ? (
                <View style={[styles.pill, { backgroundColor: colors.statusEnCours + '20' }]}>
                  <Play size={11} color={colors.statusEnCours} />
                  <Text style={[styles.pillText, { color: colors.statusEnCours }]}>En cours</Text>
                </View>
              ) : menage.status === 'termine' ? (
                <View style={[styles.pill, { backgroundColor: colors.statusTermine + '20' }]}>
                  <ClipboardCheck size={11} color={colors.statusTermine} />
                  <Text style={[styles.pillText, { color: colors.statusTermine }]}>À valider</Text>
                </View>
              ) : null}
            </View>
          </View>

          {note ? (
            <Text style={[styles.note, { color: colors.text2 }]} numberOfLines={2}>
              {note}
            </Text>
          ) : null}
        </View>
      </View>

      {actions ? <View style={[styles.actions, { borderTopColor: colors.border }]}>{actions}</View> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { padding: Spacing.md, borderRadius: Radius.lg, gap: Spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.md },
  timeBlock: { minWidth: 46, justifyContent: 'center', gap: 1 },
  timeMain: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontVariant: ['tabular-nums'] },
  timeSub: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, fontVariant: ['tabular-nums'] },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  infoBlock: { flex: 1, gap: 6, justifyContent: 'center', minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  logementRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1, minWidth: 0 },
  logementDot: { width: 8, height: 8, borderRadius: 4 },
  logement: { fontSize: FontSize.md, fontWeight: FontWeight.bold, flex: 1, letterSpacing: -0.2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  typeBadgeText: { fontSize: 10, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  whoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, flexWrap: 'wrap' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  avatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontWeight: FontWeight.bold },
  whoText: { fontSize: FontSize.sm, flexShrink: 1 },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  assignText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill },
  pillText: { fontSize: 10, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  note: { fontSize: FontSize.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
});

export default React.memo(PlanningCard);
