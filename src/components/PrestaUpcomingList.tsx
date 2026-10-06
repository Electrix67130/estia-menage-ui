import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, Check, X, CheckCircle2, Play, CalendarCheck, AlertTriangle, Bell, BadgeCheck, Ban } from 'lucide-react-native';
import SegmentedTabs from '@/components/prestations/SegmentedTabs';
import HistoriqueList from '@/components/HistoriqueList';
import { groupByDay, type DaySection } from '@/lib/prestations';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  useMyUpcomingMenages,
  useRespondToMenageOptimistic,
  type MyUpcomingMenage,
  type MenageResponseStatus,
} from '@/api/hooks/useMenageResponses';
import { useUnreadSummary } from '@/api/hooks/useMenageViews';
import { prestationTypeColorKey } from '@/api/types';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';
import { formatDateFr, formatDurationMin } from '@/lib/date-fr';

/** Date locale au format YYYY-MM-DD (sans décalage UTC). */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const { t, tp, locale } = useTranslation();
  // Une question par vue : Planning (mes prestations par jour), À traiter (ce
  // qui attend une action de ma part), Historique (ce que j'ai fait).
  const [view, setView] = useState<'planning' | 'todo' | 'history'>('planning');
  const todayYmd = ymd(new Date());
  // Mode « upcoming » de l'API : d'aujourd'hui à +90 j, plus les « à venir » en
  // retard (jour passé sans pointage). Le passé clôturé vit dans l'Historique.
  const list = useMyUpcomingMenages({ mode: 'upcoming' });
  const respond = useRespondToMenageOptimistic();
  // Non-lus par ménage → pastille sur la carte concernée (commentaires/photos…).
  const unreadByMenage = useUnreadSummary().data?.by_menage ?? {};

  type Section = DaySection<MyUpcomingMenage> & { color?: string };
  const sections = useMemo<Section[]>(() => {
    const all = list.data ?? [];
    if (view === 'planning') return groupByDay(all, todayYmd);
    // À traiter : à répondre (vote ouvert, pas encore de réponse) + non pointées
    // (affecté, jour passé sans pointage).
    const toAnswer = all.filter(
      (m) => m.status === 'a_venir' && !m.assigned_to_someone && !m.my_response && m.date_prevue.slice(0, 10) >= todayYmd,
    );
    const late = all.filter((m) => m.status === 'a_venir' && m.is_assigned && m.date_prevue.slice(0, 10) < todayYmd);
    const out: Section[] = [];
    if (toAnswer.length)
      out.push({ key: 'answer', title: t('prestations.toAnswer'), isToday: false, color: colors.primary, data: toAnswer.slice().sort((a, b) => a.date_prevue.localeCompare(b.date_prevue)) });
    if (late.length)
      out.push({ key: 'late', title: tp('todo.late', late.length), isToday: false, color: colors.red, data: late.slice().sort((a, b) => b.date_prevue.localeCompare(a.date_prevue)) });
    return out;
    // `groupByDay` lit la langue courante hors React : `locale` en dépendance pour
    // recalculer les titres (Aujourd'hui / Demain / jour) au changement de langue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data, view, todayYmd, colors, t, tp, locale]);
  const todoCount = useMemo(() => {
    const all = list.data ?? [];
    return (
      all.filter((m) => m.status === 'a_venir' && !m.assigned_to_someone && !m.my_response && m.date_prevue.slice(0, 10) >= todayYmd).length +
      all.filter((m) => m.status === 'a_venir' && m.is_assigned && m.date_prevue.slice(0, 10) < todayYmd).length
    );
  }, [list.data, todayYmd]);

  const handleRespond = (menageId: string, status: MenageResponseStatus) => {
    respond.mutate({ menageId, status });
  };

  const segmented = (
    <View style={styles.segmentedWrap}>
      <SegmentedTabs
        segments={[
          { key: 'planning', label: t('prestations.segPlanning') },
          { key: 'todo', label: t('prestations.segTodo'), badge: todoCount },
          { key: 'history', label: t('historique.title') },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'planning' ? (
        <Text style={[styles.hint, { color: colors.mutedText }]}>
          {t('prestations.prestaHint')}
        </Text>
      ) : null}
    </View>
  );

  if (view === 'history') {
    return (
      <View style={{ flex: 1 }}>
        {segmented}
        <HistoriqueList />
      </View>
    );
  }

  if (list.isLoading) {
    return (
      <View style={{ flex: 1 }}>
        {segmented}
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    {segmented}
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      stickySectionHeadersEnabled
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
          <Text style={[styles.sectionTitle, { color: section.color ?? (section.isToday ? colors.primary : colors.text2) }]}>{section.title}</Text>
          {section.subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.text2 }]}>{section.subtitle}</Text> : null}
          <View style={{ flex: 1 }} />
          <View style={[styles.sectionCount, { backgroundColor: section.isToday ? colors.primary : (section.color ?? colors.mutedText) + '20' }]}>
            <Text style={[styles.sectionCountText, { color: section.isToday ? '#FFFFFF' : section.color ?? colors.text2 }]}>{section.data.length}</Text>
          </View>
        </View>
      )}
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
        const unread = unreadByMenage[item.id] ?? 0;
        // Clôturée (validée / annulée) : carte atténuée, sans relief — c'est du
        // passé, elle ne doit pas ressembler à une prestation à faire.
        const closed = item.status === 'valide' || item.status === 'annule';
        // Jour passé : plus rien à voter ni à confirmer — un « Présent » sur une
        // prestation d'hier la ferait passer pour une prestation à faire.
        const pastDay = item.date_prevue.slice(0, 10) < ymd(new Date());
        return (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/menage/${item.id}` as never)}
            // Appui long sur une prestation à venir → demande de changement
            // (la modale s'ouvre pré-remplie sur le détail).
            onLongPress={() => {
              if (item.status === 'a_venir' && !pastDay) {
                router.push(`/menage/${item.id}?reschedule=1` as never);
              }
            }}
            style={[
              styles.card,
              closed ? null : Shadow.sm,
              {
                backgroundColor: needsAttention ? colors.red + '12' : closed ? colors.itemBackground : colors.surface,
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
                      t('prestations.logementFallback')}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  {(() => {
                    const typeColor = colors[prestationTypeColorKey(item.prestation_type)];
                    return (
                      <View
                        style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}
                        accessibilityLabel={t(`prestationType.${item.prestation_type ?? 'menage'}` as TranslationKeys)}
                      >
                        <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                          {t(`prestationType.${item.prestation_type ?? 'menage'}` as TranslationKeys)}
                        </Text>
                      </View>
                    );
                  })()}
                  {unread > 0 ? (
                    <View
                      style={[styles.unreadBadge, { backgroundColor: colors.red }]}
                      accessibilityLabel={tp('menageCard.unread', unread)}
                    >
                      <Bell size={11} color="#FFFFFF" />
                      <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  ) : null}
                  {needsAttention ? (
                    <View
                      style={[styles.lateBadge, { backgroundColor: colors.red + '20' }]}
                      accessibilityLabel={t('menageCard.lateA11y')}
                    >
                      <AlertTriangle size={12} color={colors.red} />
                      <Text style={[styles.lateBadgeText, { color: colors.red }]}>{t('menage.statusNotClockedIn')}</Text>
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
                retenu (Présent figé), soit un ménage en cours / terminé / clôturé.
                - tout sauf « à venir » → bandeau de statut (en cours, terminé,
                  validé, annulé) : jamais le pill « Présent », qui ferait passer
                  une prestation finie pour une prestation future
                - retenu (à venir) → pill vert "Présent" verrouillé
                - personne d'affecté (à venir) → vote Présent/Absent éditable */}
            {item.status !== 'a_venir' || pastDay ? (
              <WorkflowStatus item={item} colors={colors} pastDay={pastDay} />
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
            {view === 'todo' ? t('prestations.todoEmptyPresta') : t('prestations.planningEmptyPresta')}
          </Text>
        </View>
      }
    />
    </View>
  );
}

/**
 * Réponse figée (lecture seule) une fois l'équipe choisie par l'admin. Un seul
 * pill plein largeur : vert "Présent" si retenu, rouge "Absent" sinon.
 */
function LockedResponse({ present, colors }: { present: boolean; colors: typeof Colors.light }) {
  const { t } = useTranslation();
  const accent = present ? colors.green : colors.red;
  const Icon = present ? Check : X;
  return (
    <View style={[styles.responseBtn, { backgroundColor: accent, borderColor: accent }]}>
      <Icon size={IconSize.sm} color="#FFFFFF" />
      <Text style={[styles.responseBtnText, { color: '#FFFFFF' }]}>
        {present ? t('prestations.present') : t('prestations.absent')}
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
  const { t } = useTranslation();
  const isPresent = status === 'present';
  const accent = isPresent ? colors.green : colors.red;
  const Icon = isPresent ? Check : X;
  const label = isPresent ? t('prestations.present') : t('prestations.absent');
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
  pastDay = false,
}: {
  item: MyUpcomingMenage;
  colors: typeof Colors.light;
  /** Jour passé : une « à venir » non pointée est en retard, pas à faire. */
  pastDay?: boolean;
}) {
  const { t } = useTranslation();
  let color: string;
  let label: string;
  let Icon: typeof Check;
  const who = item.done_by_me
    ? t('prestations.you')
    : [item.referent_first_name, item.referent_last_name].filter(Boolean).join(' ');
  if (item.status === 'valide') {
    color = colors.statusValide;
    label = who ? t('prestations.validatedBy', { who }) : t('prestations.validatedF');
    Icon = BadgeCheck;
  } else if (item.status === 'annule') {
    color = colors.mutedText;
    label = t('prestations.cancelledF');
    Icon = Ban;
  } else if (item.status === 'termine') {
    color = colors.statusTermine;
    label = who ? t('prestations.doneBy', { who }) : t('menage.statusCompleted');
    Icon = CheckCircle2;
  } else if (item.status === 'en_cours') {
    color = colors.statusEnCours;
    label = t('menage.statusInProgress');
    Icon = Play;
  } else if (pastDay && item.is_assigned) {
    color = colors.red;
    label = t('prestations.lateClockIn');
    Icon = AlertTriangle;
  } else if (pastDay) {
    color = colors.mutedText;
    label = t('prestations.pastNobody');
    Icon = Ban;
  } else {
    // a_venir mais affecté
    color = colors.primary;
    label = t('prestations.assignedReminder');
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
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, flexGrow: 1 },
  segmentedWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs, paddingBottom: Spacing.sm, gap: Spacing.xs },
  hint: { fontSize: FontSize.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: 2 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionSubtitle: { fontSize: FontSize.sm },
  sectionCount: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { fontSize: 11, fontWeight: FontWeight.bold },
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
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
