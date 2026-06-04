import React, { useMemo, useState } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, Check, X, CheckCircle2, Play, CalendarCheck, AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  useMyUpcomingMenages,
  useRespondToMenageOptimistic,
  type MyUpcomingMenage,
  type MenageResponseStatus,
} from '@/api/hooks/useMenageResponses';
import { formatDateFr, formatDurationMin } from '@/lib/date-fr';

/**
 * Liste agenda des prochains ménages du prestataire connecté.
 *
 * Pour chaque ménage : date + logement + durée, + boutons Présent/Absent qui
 * upsert la réponse via mutation optimiste. Une fois rendu, c'est ce que voit
 * un presta sur l'onglet "Ménages" (fusionné depuis l'ancienne tab "Dispos").
 */
export default function PrestaUpcomingList() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const [periodFilter, setPeriodFilter] = usePersistedState<'week' | 'month' | 'all' | 'past'>(
    'presta.filter.period',
    'all',
  );
  // Quand on est sur "Passés", on fait un appel séparé en mode history pour
  // récupérer les ménages déjà faits (termine/valide).
  const list = useMyUpcomingMenages({ mode: periodFilter === 'past' ? 'history' : 'upcoming' });
  const respond = useRespondToMenageOptimistic();

  // Filtre période + tri. Pas de headers de date — déjà sur chaque card.
  // "Passés" : tri descendant (plus récents d'abord). Autres : ascendant.
  const items = useMemo(() => {
    const today = new Date();
    let periodMin: string | null = null;
    let periodMax: string | null = null;
    if (periodFilter === 'week') {
      const dow = (today.getDay() + 6) % 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - dow);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      periodMin = monday.toISOString().slice(0, 10);
      periodMax = sunday.toISOString().slice(0, 10);
    } else if (periodFilter === 'month') {
      const y = today.getFullYear();
      const m = today.getMonth();
      periodMin = new Date(y, m, 1).toISOString().slice(0, 10);
      periodMax = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    }
    const filtered = (list.data ?? []).filter((m) => {
      const d = m.date_prevue.slice(0, 10);
      if (periodMin && d < periodMin) return false;
      if (periodMax && d > periodMax) return false;
      return true;
    });
    const desc = periodFilter === 'past';
    return filtered
      .slice()
      .sort((a, b) => {
        const ad = a.date_prevue.slice(0, 10);
        const bd = b.date_prevue.slice(0, 10);
        return desc ? bd.localeCompare(ad) : ad.localeCompare(bd);
      });
  }, [list.data, periodFilter]);

  const handleRespond = (menageId: string, status: MenageResponseStatus) => {
    respond.mutate({ menageId, status });
  };

  if (list.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={[styles.periodToggle, { backgroundColor: colors.itemBackground }]}>
          {([
            { key: 'week' as const, label: 'Semaine' },
            { key: 'month' as const, label: 'Mois' },
            { key: 'all' as const, label: 'Tout' },
            { key: 'past' as const, label: 'Passés' },
          ]).map((p) => {
            const active = periodFilter === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[
                  styles.periodTab,
                  { backgroundColor: active ? colors.surface : 'transparent' },
                ]}
                onPress={() => setPeriodFilter(p.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    {
                      color: active ? colors.text : colors.mutedText,
                      fontWeight: active ? FontWeight.semibold : FontWeight.medium,
                    },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching}
          onRefresh={list.refetch}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      renderItem={({ item }) => {
        const dayOfMonth = item.date_prevue.slice(8, 10);
        const dayShort = formatDateFr(item.date_prevue.slice(0, 10), 'dayShort');
        const monthShort = dayShort.split(' ').slice(1).join(' ');
        const startTime = item.horaire_prevu ? item.horaire_prevu.slice(0, 5) : null;
        const endTime = item.horaire_fin_prevu ? item.horaire_fin_prevu.slice(0, 5) : null;
        const duration = item.duree_estimee_min ? formatDurationMin(item.duree_estimee_min) : null;
        const needsAttention = !!item.needs_attention;
        return (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/menage/${item.id}` as never)}
            style={[
              styles.card,
              Shadow.sm,
              {
                backgroundColor: needsAttention ? colors.red + '12' : colors.surface,
                borderColor: needsAttention ? colors.red + '55' : colors.border,
              },
              needsAttention ? { borderLeftColor: colors.red, borderLeftWidth: 3 } : null,
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={styles.dateBlock}>
                <Text style={[styles.dateDay, { color: colors.text }]}>{dayOfMonth}</Text>
                <Text style={[styles.dateMonth, { color: colors.text2 }]} numberOfLines={1}>
                  {monthShort}
                </Text>
                {startTime ? (
                  <Text style={[styles.dateTime, { color: colors.text2 }]} numberOfLines={1}>
                    {startTime}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.infoBlock}>
                <View style={styles.logementRow}>
                  <View
                    style={[
                      styles.logementDot,
                      { backgroundColor: item.logement_color ?? colors.primary },
                    ]}
                  />
                  <Text
                    style={[styles.logementName, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {item.logement_name ||
                      [item.logement_address, item.logement_city].filter(Boolean).join(' ') ||
                      'Logement'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  {needsAttention ? (
                    <View
                      style={[styles.lateBadge, { backgroundColor: colors.red + '20' }]}
                      accessibilityLabel="Jour passé sans pointage"
                    >
                      <AlertTriangle size={12} color={colors.red} />
                      <Text style={[styles.lateBadgeText, { color: colors.red }]}>Non pointé</Text>
                    </View>
                  ) : null}
                  {duration ? (
                    <View style={[styles.durationChip, { backgroundColor: colors.primary + '20' }]}>
                      <Clock size={14} color={colors.primary} />
                      <Text style={[styles.durationChipText, { color: colors.primary }]}>
                        {duration}
                      </Text>
                    </View>
                  ) : null}
                  {endTime ? (
                    <Text style={[styles.timeRange, { color: colors.text2 }]} numberOfLines={1}>
                      → {endTime}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Les ménages affectés à d'autres sont filtrés côté API : ici on a
                soit un ménage ouvert (vote éditable), soit un ménage où je suis
                retenu (Présent figé), soit un ménage en cours / terminé.
                - en cours / terminé → statut du workflow
                - retenu (à venir) → pill vert "Présent" verrouillé
                - personne d'affecté (à venir) → vote Présent/Absent éditable */}
            {item.status === 'en_cours' || item.status === 'termine' ? (
              <WorkflowStatus item={item} colors={colors} />
            ) : item.is_assigned ? (
              <LockedResponse present colors={colors} />
            ) : (
              <View style={styles.responseRow}>
                <ResponseButton
                  active={item.my_response === 'present'}
                  status="present"
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRespond(item.id, 'present');
                  }}
                />
                <ResponseButton
                  active={item.my_response === 'absent'}
                  status="absent"
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRespond(item.id, 'absent');
                  }}
                />
              </View>
            )}
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.mutedText }]}>
            {periodFilter === 'week'
              ? 'Aucun ménage cette semaine.'
              : periodFilter === 'month'
                ? 'Aucun ménage ce mois-ci.'
                : periodFilter === 'past'
                  ? 'Aucun ménage déjà effectué.'
                  : 'Aucun ménage à venir sur les logements où tu es prestataire.'}
          </Text>
        </View>
      }
    />
  );
}

/**
 * Réponse figée (lecture seule) une fois l'équipe choisie par l'admin. Un seul
 * pill plein largeur : vert "Présent" si retenu, rouge "Absent" sinon.
 */
function LockedResponse({ present, colors }: { present: boolean; colors: typeof Colors.light }) {
  const accent = present ? colors.green : colors.red;
  const Icon = present ? Check : X;
  return (
    <View style={[styles.responseBtn, { backgroundColor: accent, borderColor: accent }]}>
      <Icon size={IconSize.sm} color="#FFFFFF" />
      <Text style={[styles.responseBtnText, { color: '#FFFFFF' }]}>
        {present ? 'Présent' : 'Absent'}
      </Text>
    </View>
  );
}

function ResponseButton({
  active,
  status,
  onPress,
}: {
  active: boolean;
  status: MenageResponseStatus;
  onPress: (e: { stopPropagation: () => void }) => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isPresent = status === 'present';
  const accent = isPresent ? colors.green : colors.red;
  const Icon = isPresent ? Check : X;
  const label = isPresent ? 'Présent' : 'Absent';
  return (
    <TouchableOpacity
      style={[
        styles.responseBtn,
        {
          backgroundColor: active ? accent : 'transparent',
          borderColor: active ? accent : colors.border,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={IconSize.sm} color={active ? '#FFFFFF' : accent} />
      <Text style={[styles.responseBtnText, { color: active ? '#FFFFFF' : accent }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Bandeau de statut affiché à la place du vote dès que le presta est affecté
 * (ou que le ménage avance). Reflète l'avancement réel : affecté → en cours →
 * terminé. Le presta pointe arrivée/départ depuis la fiche détail.
 */
function WorkflowStatus({
  item,
  colors,
}: {
  item: MyUpcomingMenage;
  colors: typeof Colors.light;
}) {
  let color: string;
  let label: string;
  let Icon: typeof Check;
  if (item.status === 'termine') {
    color = colors.statusTermine;
    const who = item.done_by_me
      ? 'vous'
      : [item.referent_first_name, item.referent_last_name].filter(Boolean).join(' ');
    label = who ? `Terminé · fait par ${who}` : 'Terminé';
    Icon = CheckCircle2;
  } else if (item.status === 'en_cours') {
    color = colors.statusEnCours;
    label = 'En cours';
    Icon = Play;
  } else {
    // a_venir mais affecté
    color = colors.primary;
    label = "Tu es affecté — pense à pointer ton arrivée";
    Icon = CalendarCheck;
  }
  return (
    <View style={[styles.statusBanner, { backgroundColor: color + '15', borderColor: color }]}>
      <Icon size={IconSize.sm} color={color} />
      <Text style={[styles.statusBannerText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { padding: Spacing.xl, alignItems: 'center' },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  periodToggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.pill,
    gap: 2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  periodTab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  periodTabText: { fontSize: FontSize.sm },
  card: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
  },
  logementRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  logementDot: { width: 8, height: 8, borderRadius: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dateBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    gap: 1,
  },
  dateDay: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, lineHeight: FontSize.xl + 2 },
  dateMonth: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dateTime: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 2 },
  infoBlock: { flex: 1, gap: 4, justifyContent: 'center' },
  logementName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  durationChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  lateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  lateBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeRange: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  responseRow: { flexDirection: 'row', gap: Spacing.sm },
  responseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  responseBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.2 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statusBannerText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, flexShrink: 1 },
  empty: { padding: Spacing.xxxl, alignItems: 'center' },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
});
