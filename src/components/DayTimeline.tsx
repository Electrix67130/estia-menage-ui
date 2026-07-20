import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/Layout';
import type { Menage, MenageStatus } from '@/api/types';
import {
  menagePrestataireLabel,
  menageLogementLabel,
  prestationTypeLabel,
  prestationTypeColorKey,
} from '@/api/types';

type ColorSet = (typeof Colors)['light'];

// Timeline horaire (détail du jour) : hauteur d'une heure + largeur de la gouttière des heures.
const TL_HOUR_H = 56;
const TL_GUTTER = 52;

export function labelForStatus(s: MenageStatus): string {
  switch (s) {
    case 'a_venir':
      return 'À venir';
    case 'en_cours':
      return 'En cours';
    case 'termine':
      return 'Terminé';
    case 'valide':
      return 'Validé';
    case 'annule':
      return 'Annulé';
  }
}

/** Une ligne agenda (style liste Calendrier Apple). */
export function AgendaRow({
  menage: m,
  colors,
  onPress,
  topBorder,
  surface,
}: {
  menage: Menage;
  colors: ColorSet;
  onPress: () => void;
  topBorder?: boolean;
  surface?: boolean;
}) {
  const unassigned = !m.prestataire_user_id;
  const needsAttention = !!m.needs_attention;
  const typeColor = colors[prestationTypeColorKey(m.prestation_type)];
  // Liseré = couleur du logement (le tag de type reste, lui, coloré par type).
  const logementColor = m.logement_color ?? typeColor;
  return (
    <TouchableOpacity
      style={[
        styles.agendaRow,
        surface && { backgroundColor: colors.surface },
        topBorder && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        needsAttention && { backgroundColor: colors.red + '0F' },
      ]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.agendaTime}>
        <Text style={[styles.agendaTimeText, { color: colors.text }]}>{m.horaire_prevu?.slice(0, 5) ?? '—'}</Text>
      </View>
      <View style={[styles.agendaStripe, { backgroundColor: logementColor }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.agendaTitleRow}>
          <Text style={[styles.agendaTitle, { color: colors.text }]} numberOfLines={1}>
            {menageLogementLabel(m)}
          </Text>
          <View
            style={[styles.badgeType, { backgroundColor: typeColor + '20' }]}
            accessibilityLabel={prestationTypeLabel(m.prestation_type)}
          >
            <Text style={[styles.badgeTypeText, { color: typeColor }]}>{prestationTypeLabel(m.prestation_type)}</Text>
          </View>
        </View>
        <Text style={[styles.agendaSub, { color: colors.text2 }]} numberOfLines={1}>
          {unassigned ? 'Non assigné' : menagePrestataireLabel(m)}
          {' · '}
          {labelForStatus(m.status)}
        </Text>
        {needsAttention ? (
          <View
            style={[styles.badgeLate, { backgroundColor: colors.red + '20', alignSelf: 'flex-start', marginTop: 4 }]}
            accessibilityLabel="Jour passé sans pointage"
          >
            <AlertTriangle size={11} color={colors.red} />
            <Text style={[styles.badgeLateText, { color: colors.red }]}>Non pointé</Text>
          </View>
        ) : null}
      </View>
      <ChevronRight size={16} color={colors.mutedText} />
    </TouchableOpacity>
  );
}

interface TimelineEvent {
  m: Menage;
  start: number;
  end: number;
  col: number;
  cols: number;
}

function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Assigne à chaque événement une colonne au sein de son groupe de chevauchement
 * (algorithme d'intervalle glouton) → les prestations qui se chevauchent se
 * placent côte à côte, comme dans Calendrier Apple.
 */
function assignColumns(evs: TimelineEvent[]): void {
  let i = 0;
  while (i < evs.length) {
    let j = i;
    let clusterEnd = evs[i].end;
    while (j + 1 < evs.length && evs[j + 1].start < clusterEnd) {
      j++;
      clusterEnd = Math.max(clusterEnd, evs[j].end);
    }
    const cluster = evs.slice(i, j + 1);
    const colEnds: number[] = [];
    for (const e of cluster) {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= e.start) {
          e.col = c;
          colEnds[c] = e.end;
          placed = true;
          break;
        }
      }
      if (!placed) {
        e.col = colEnds.length;
        colEnds.push(e.end);
      }
    }
    for (const e of cluster) e.cols = colEnds.length;
    i = j + 1;
  }
}

/**
 * Journée en timeline : gouttière d'heures à gauche, chaque prestation = un bloc
 * positionné (heure de début) et dimensionné (durée estimée), coloré par type.
 * Les prestations sans heure sont listées au-dessus (lignes agenda).
 */
export function DayTimeline({
  items,
  colors,
  onPressItem,
}: {
  items: Menage[];
  colors: ColorSet;
  onPressItem: (id: string) => void;
}) {
  const untimed = items.filter((m) => !m.horaire_prevu);
  const evs: TimelineEvent[] = items
    .filter((m) => m.horaire_prevu)
    .map((m) => {
      const start = toMinutes(m.horaire_prevu!);
      const dur = Math.max(m.duree_estimee_min ?? (m.prestation_type === 'menage' ? 60 : 30), 30);
      return { m, start, end: start + dur, col: 0, cols: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  assignColumns(evs);

  // Plage horaire affichée : 8h→20h par défaut, élargie pour couvrir tous les événements.
  let minH = 8;
  let maxH = 20;
  for (const e of evs) {
    minH = Math.min(minH, Math.floor(e.start / 60));
    maxH = Math.max(maxH, Math.ceil(e.end / 60));
  }
  minH = Math.max(0, minH);
  maxH = Math.min(24, maxH);
  const hours: number[] = [];
  for (let h = minH; h <= maxH; h++) hours.push(h);
  const bodyH = (maxH - minH) * TL_HOUR_H;

  return (
    <View>
      {untimed.length > 0 ? (
        <View
          style={[
            styles.agendaCard,
            { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: Spacing.md },
          ]}
        >
          {untimed.map((m, idx) => (
            <AgendaRow key={m.id} menage={m} colors={colors} onPress={() => onPressItem(m.id)} topBorder={idx > 0} />
          ))}
        </View>
      ) : null}

      {/* La grille horaire est toujours affichée, même sans prestation (jour vide). */}
      <View style={{ height: bodyH }}>
        {hours.map((h) => (
            <View key={h} style={[styles.tlHourRow, { top: (h - minH) * TL_HOUR_H }]}>
              <Text style={[styles.tlHourLabel, { color: colors.mutedText }]}>{`${String(h).padStart(2, '0')}:00`}</Text>
              <View style={[styles.tlHourLine, { backgroundColor: colors.border }]} />
            </View>
          ))}
          <View style={{ position: 'absolute', left: TL_GUTTER, right: 0, top: 0, bottom: 0 }}>
            {evs.map((e) => {
              const top = ((e.start - minH * 60) / 60) * TL_HOUR_H;
              const height = Math.max(((e.end - e.start) / 60) * TL_HOUR_H - 2, 24);
              const widthPct = 100 / e.cols;
              // Bloc coloré par logement (fallback couleur de type), fond adouci.
              const evColor = e.m.logement_color ?? colors[prestationTypeColorKey(e.m.prestation_type)];
              return (
                <TouchableOpacity
                  key={e.m.id}
                  activeOpacity={0.7}
                  onPress={() => onPressItem(e.m.id)}
                  style={[styles.tlEvent, { top, height, left: `${e.col * widthPct}%`, width: `${widthPct}%` }]}
                >
                  <View style={[styles.tlEventInner, { backgroundColor: evColor + '26', borderLeftColor: evColor }]}>
                    <Text numberOfLines={1} style={[styles.tlEventTitle, { color: colors.text }]}>
                      {menageLogementLabel(e.m)}
                    </Text>
                    {height > 34 ? (
                      <Text numberOfLines={1} style={[styles.tlEventSub, { color: colors.text2 }]}>
                        {`${fmtMinutes(e.start)}–${fmtMinutes(e.end)}`}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  agendaCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  agendaTime: { width: 52, alignItems: 'flex-end' },
  agendaTimeText: { fontSize: FontSize.md, fontWeight: FontWeight.medium, fontVariant: ['tabular-nums'] },
  agendaStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginVertical: 2 },
  agendaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  agendaTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flexShrink: 1 },
  agendaSub: { fontSize: FontSize.sm, marginTop: 1 },
  badgeType: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
  badgeTypeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeLate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeLateText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  tlHourRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  tlHourLabel: {
    width: TL_GUTTER - 8,
    textAlign: 'right',
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'],
  },
  tlHourLine: { flex: 1, height: StyleSheet.hairlineWidth, marginLeft: 8 },
  tlEvent: { position: 'absolute', paddingHorizontal: 1.5 },
  tlEventInner: {
    flex: 1,
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  tlEventTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  tlEventSub: { fontSize: 10, marginTop: 1, fontVariant: ['tabular-nums'] },
});
