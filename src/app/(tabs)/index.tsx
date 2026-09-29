import React, { useState, useCallback, useMemo } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useDialog } from '@/contexts/DialogContext';
import Animated, { LinearTransition, FadeInLeft, FadeOutLeft, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Trash2, X, Check, MapIcon, List, Search, SlidersHorizontal, CheckCheck, Ban } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMenages, menageHooks, useValidateReport } from '@/api/hooks/useMenages';
import { useLogements } from '@/api/hooks/useLogements';
import { useAllUsers } from '@/api/hooks/useLogementMembers';
import { useMyRescheduleRequests, useDecideReschedule } from '@/api/hooks/useReschedule';
import { useTranslation } from '@/contexts/I18nContext';
import SearchBar from '@/components/SearchBar';
import { type FilterOption } from '@/components/FilterPickerSheet';
import PlanningCard from '@/components/prestations/PlanningCard';
import SegmentedTabs from '@/components/prestations/SegmentedTabs';
import FilterSheet, { countActiveFilters, type PrestationFilters } from '@/components/prestations/FilterSheet';
import HistoriqueList from '@/components/HistoriqueList';
import { useUnreadSummary } from '@/api/hooks/useMenageViews';
import MenageMap from '@/components/MenageMap';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import PrestaUpcomingList from '@/components/PrestaUpcomingList';
import { menageLogementLabel, menageSourceLabel, type Menage, type RescheduleRequest } from '@/api/types';
import { formatDateFr } from '@/lib/date-fr';
import { groupByDay, ymdLocal } from '@/lib/prestations';

type ViewMode = 'list' | 'map';
type MainView = 'planning' | 'todo' | 'history';

export default function MenagesScreen() {
  const { user } = useAuth();
  if (user?.role === 'prestataire') return <PrestataireMenagesScreen />;
  return <AdminMenagesScreen />;
}

/**
 * Vue prestataire de l'onglet « Prestations » : ses prestations par jour avec le
 * vote Présent/Absent, ce qui l'attend, et son historique.
 */
function PrestataireMenagesScreen() {
  const colors = Colors[useColorScheme()];
  const { t } = useTranslation();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>{t('prestation.title')}</Text>
        </View>
      </AppHeader>
      <PrestaUpcomingList />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Vue admin : une question par écran.
//   Planning  → qu'est-ce qui se passe ? (par jour)
//   À traiter → qu'est-ce qui m'attend ? (à valider, non pointées, sans presta, reports)
//   Historique → qu'est-ce qui s'est passé ? (un mois à la fois)
// ---------------------------------------------------------------------------

/** Élément de la vue « À traiter » : une prestation, ou une demande de report. */
type TodoItem =
  | { kind: 'menage'; id: string; m: Menage }
  | { kind: 'reschedule'; id: string; r: RescheduleRequest; m: Menage | undefined };

interface TodoSection {
  key: 'validate' | 'late' | 'unassigned' | 'reschedule';
  title: string;
  color: string;
  data: TodoItem[];
}

function AdminMenagesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const dialog = useDialog();
  const unreadSummary = useUnreadSummary(!!user).data;
  const unreadByMenage = useMemo(() => unreadSummary?.by_menage ?? {}, [unreadSummary]);

  const [view, setView] = useState<MainView>('planning');
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('menages.filter.viewMode', 'list');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  // Filtres persistés (mêmes clés qu'avant : on reprend l'état de l'utilisateur).
  const [typeFilter, setTypeFilter] = usePersistedState('menages.filter.type', '');
  const [logementFilter, setLogementFilter] = usePersistedState('menages.filter.logement', '');
  const [prestaFilter, setPrestaFilter] = usePersistedState('menages.filter.presta', '');
  const [creatorFilter, setCreatorFilter] = usePersistedState('menages.filter.creator', '');
  const filters: PrestationFilters = { type: typeFilter, logement: logementFilter, presta: prestaFilter, creator: creatorFilter };
  const setFilters = useCallback(
    (f: PrestationFilters) => {
      setTypeFilter(f.type);
      setLogementFilter(f.logement);
      setPrestaFilter(f.presta);
      setCreatorFilter(f.creator);
    },
    [setTypeFilter, setLogementFilter, setPrestaFilter, setCreatorFilter],
  );
  const filterCount = countActiveFilters(filters);
  const activeFilterCount = filterCount + (searchQuery.trim() ? 1 : 0);
  const todayYmd = ymdLocal(new Date());

  // Une seule requête : toute la worklist active (non clôturée). Planning et
  // À traiter s'en déduisent côté client ; les clôturées vivent dans l'Historique.
  const menagesQuery = useMenages({ closed: false, limit: 200 });
  const pendingReschedules = useMyRescheduleRequests('pending');
  const logementsQuery = useLogements({ limit: 500 });
  const usersQuery = useAllUsers();
  const allUsers = useMemo(() => usersQuery.data?.data ?? [], [usersQuery.data]);
  const userLabel = useCallback(
    (id: string) => {
      const u = allUsers.find((x) => x.id === id);
      return u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email : '—';
    },
    [allUsers],
  );

  // Filtres côté client : recherche (logement) + type / logement / presta / source.
  const filtered = useMemo(() => {
    const all = menagesQuery.data?.data ?? [];
    const q = searchQuery.trim().toLowerCase();
    return all.filter((m) => {
      if (q && !menageLogementLabel(m).toLowerCase().includes(q)) return false;
      if (typeFilter && m.prestation_type !== typeFilter) return false;
      if (logementFilter && m.logement_id !== logementFilter) return false;
      if (prestaFilter) {
        if (prestaFilter === '__unassigned__') {
          if (m.prestataire_user_id) return false;
        } else if (m.prestataire_user_id !== prestaFilter) {
          return false;
        }
      }
      if (creatorFilter) {
        if (creatorFilter.startsWith('src:')) {
          const src = creatorFilter.slice(4);
          const matches = src === 'manual' ? !m.external_source : m.external_source === src;
          if (!matches) return false;
        } else if (creatorFilter.startsWith('user:')) {
          if (m.created_by !== creatorFilter.slice(5)) return false;
        } else if (m.created_by !== creatorFilter) {
          return false;
        }
      }
      return true;
    });
  }, [menagesQuery.data, searchQuery, typeFilter, logementFilter, prestaFilter, creatorFilter]);

  // ---- Planning : par jour, à partir d'aujourd'hui.
  const planning = useMemo(() => groupByDay(filtered, todayYmd), [filtered, todayYmd]);
  const planningCount = planning.reduce((n, s) => n + s.data.length, 0);
  const summary = useMemo(() => {
    const today = filtered.filter((m) => m.date_prevue.slice(0, 10) === todayYmd);
    return {
      today: today.length,
      todayDone: today.filter((m) => m.status === 'termine').length,
      enCours: today.filter((m) => m.status === 'en_cours').length,
      unassigned: filtered.filter((m) => m.date_prevue.slice(0, 10) >= todayYmd && !m.prestataire_user_id).length,
      late: filtered.filter((m) => !!m.needs_attention).length,
    };
  }, [filtered, todayYmd]);

  // ---- À traiter : tout ce qui attend l'admin, avec son action.
  const todo = useMemo<TodoSection[]>(() => {
    const byId = new Map((menagesQuery.data?.data ?? []).map((m) => [m.id, m]));
    const shown = new Set(filtered.map((m) => m.id));
    const toValidate = filtered.filter((m) => m.status === 'termine');
    const late = filtered.filter((m) => !!m.needs_attention);
    const unassigned = filtered.filter(
      (m) => m.status === 'a_venir' && !m.needs_attention && m.date_prevue.slice(0, 10) >= todayYmd && !m.prestataire_user_id,
    );
    // Les demandes respectent les filtres courants via la prestation concernée
    // (une demande sur une prestation inconnue de la worklist reste visible).
    const reschedules = (pendingReschedules.data?.data ?? []).filter((r) => !byId.has(r.menage_id) || shown.has(r.menage_id));
    const sections: TodoSection[] = [];
    if (toValidate.length)
      sections.push({ key: 'validate', title: 'À valider', color: colors.statusTermine, data: toValidate.map((m) => ({ kind: 'menage', id: m.id, m })) });
    if (late.length)
      sections.push({ key: 'late', title: late.length > 1 ? 'Non pointées' : 'Non pointée', color: colors.red, data: late.map((m) => ({ kind: 'menage', id: m.id, m })) });
    if (unassigned.length)
      sections.push({ key: 'unassigned', title: 'Sans prestataire', color: colors.primary, data: unassigned.map((m) => ({ kind: 'menage', id: m.id, m })) });
    if (reschedules.length)
      sections.push({
        key: 'reschedule',
        title: reschedules.length > 1 ? 'Demandes de report' : 'Demande de report',
        color: colors.statusEnCours,
        data: reschedules.map((r) => ({ kind: 'reschedule', id: `r-${r.id}`, r, m: byId.get(r.menage_id) })),
      });
    return sections;
  }, [filtered, menagesQuery.data, pendingReschedules.data, todayYmd, colors]);
  const todoCount = todo.reduce((n, s) => n + s.data.length, 0);

  // ---- Options des filtres.
  const logementOptions: FilterOption[] = useMemo(
    () => (logementsQuery.data?.data ?? []).filter((l) => !l.archived_at).map((l) => ({ id: l.id, label: l.name })),
    [logementsQuery.data],
  );
  const prestaOptions: FilterOption[] = useMemo(
    () => [
      { id: '__unassigned__', label: 'Non assigné' },
      ...allUsers.filter((u) => u.role === 'prestataire').map((u) => ({ id: u.id, label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email })),
    ],
    [allUsers],
  );
  const creatorOptions: FilterOption[] = useMemo(() => {
    const menages = menagesQuery.data?.data ?? [];
    const userIds = new Set<string>();
    const sources = new Set<string>();
    let hasManual = false;
    for (const m of menages) {
      if (m.external_source) sources.add(m.external_source);
      else hasManual = true;
      if (m.created_by) userIds.add(m.created_by);
    }
    const out: FilterOption[] = [];
    if (hasManual) out.push({ id: 'src:manual', label: 'Manuel' });
    for (const s of Array.from(sources).sort()) out.push({ id: `src:${s}`, label: menageSourceLabel(s) });
    for (const id of userIds) out.push({ id: `user:${id}`, label: userLabel(id) });
    return out;
  }, [menagesQuery.data, userLabel]);

  // ---- Mutations.
  const deleteMutation = menageHooks.useRemove();
  const updateMutation = menageHooks.useUpdate();
  const validateMutation = useValidateReport();
  const decide = useDecideReschedule();
  const bulkPending = deleteMutation.isPending || updateMutation.isPending || validateMutation.isPending;

  // ---- Sélection multiple (appui long ; admin).
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectedMenages = useMemo(() => filtered.filter((m) => selectedIds.has(m.id)), [filtered, selectedIds]);
  const validableCount = selectedMenages.filter((m) => m.status === 'termine').length;

  const handleMenagePress = useCallback(
    (id: string) => {
      if (selectionMode) toggleSelection(id);
      else router.push(`/menage/${id}`);
    },
    [router, selectionMode, toggleSelection],
  );
  const handleMenageLongPress = useCallback(
    (menage: Menage) => {
      if (!isAdmin) return;
      setSelectionMode(true);
      setSelectedIds((prev) => new Set(prev).add(menage.id));
    },
    [isAdmin],
  );

  // Valider : seules les terminées (rapport rendu) — la validation engage la
  // facturation. Pas de clôture automatique : c'est un geste de l'admin.
  const validateMany = useCallback(
    async (ids: string[], ignored = 0) => {
      if (ids.length === 0) {
        void dialog.alert({ title: 'Rien à valider', message: 'Seules les prestations terminées (rapport rendu) peuvent être validées.' });
        return;
      }
      const ok = await dialog.confirm({
        title: `Valider ${ids.length} prestation${ids.length > 1 ? 's' : ''} ?`,
        message:
          `Elles passeront en « validée » au prix prévu et rejoindront l'Historique.` +
          (ignored > 0 ? ` ${ignored} sélectionnée${ignored > 1 ? 's' : ''} non terminée${ignored > 1 ? 's' : ''} sera ignorée.` : ''),
        confirmLabel: 'Valider',
      });
      if (!ok) return;
      try {
        await Promise.all(ids.map((id) => validateMutation.mutateAsync({ id })));
        exitSelection();
      } catch (err) {
        void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Validation partielle' });
      }
    },
    [dialog, validateMutation, exitSelection],
  );
  const handleBulkValidate = useCallback(() => {
    const ids = selectedMenages.filter((m) => m.status === 'termine').map((m) => m.id);
    return validateMany(ids, selectedMenages.length - ids.length);
  }, [selectedMenages, validateMany]);
  const handleValidateAll = useCallback(() => {
    const ids = filtered.filter((m) => m.status === 'termine').map((m) => m.id);
    return validateMany(ids);
  }, [filtered, validateMany]);

  const handleBulkCancel = useCallback(async () => {
    const ids = selectedMenages.filter((m) => m.status !== 'annule').map((m) => m.id);
    if (ids.length === 0) return;
    const ok = await dialog.confirm({
      title: `Annuler ${ids.length} prestation${ids.length > 1 ? 's' : ''} ?`,
      message: 'Elles passeront en « annulée » et rejoindront l’Historique (retrouvables, pas supprimées). Les prestataires affectés seront prévenus.',
      confirmLabel: 'Annuler les prestations',
      destructive: true,
    });
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => updateMutation.mutateAsync({ id, body: { status: 'annule' } })));
      exitSelection();
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Annulation partielle' });
    }
  }, [selectedMenages, updateMutation, exitSelection, dialog]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await dialog.confirm({
      title: `Supprimer ${ids.length} prestation${ids.length > 1 ? 's' : ''} ?`,
      message: 'Action irréversible : toutes leurs données (photos, documents, étapes…) seront supprimées.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)));
      exitSelection();
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Suppression partielle' });
    }
  }, [selectedIds, deleteMutation, exitSelection, dialog]);

  const handleDecide = useCallback(
    async (r: RescheduleRequest, decision: 'approved' | 'rejected') => {
      try {
        await decide.mutateAsync({ id: r.id, decision, apply_to_menage: decision === 'approved' });
      } catch (err) {
        void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
      }
    },
    [decide, dialog],
  );

  const refetchMenages = menagesQuery.refetch;
  const refetchReschedules = pendingReschedules.refetch;
  const refetchAll = useCallback(() => {
    void refetchMenages();
    void refetchReschedules();
  }, [refetchMenages, refetchReschedules]);

  // ---- Rendu.
  const wrapSelectable = useCallback(
    (id: string, card: React.ReactNode) => {
      const isSelected = selectedIds.has(id);
      return (
        <Animated.View style={styles.selectableRow} layout={LinearTransition.duration(220)}>
          {selectionMode ? (
            <Animated.View entering={FadeInLeft.duration(200)} exiting={FadeOutLeft.duration(180)}>
              <TouchableOpacity
                onPress={() => toggleSelection(id)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                style={[
                  styles.externalCheckbox,
                  { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent' },
                ]}
              >
                {isSelected ? <Check size={14} color="#FFFFFF" /> : null}
              </TouchableOpacity>
            </Animated.View>
          ) : null}
          <Animated.View style={{ flex: 1 }} layout={LinearTransition.duration(220)}>
            {card}
          </Animated.View>
        </Animated.View>
      );
    },
    [selectionMode, selectedIds, toggleSelection, colors],
  );

  const renderPlanningItem = useCallback(
    ({ item }: { item: Menage }) =>
      wrapSelectable(
        item.id,
        <PlanningCard
          menage={item}
          onPress={handleMenagePress}
          onLongPress={isAdmin ? handleMenageLongPress : undefined}
          selected={selectedIds.has(item.id)}
          unread={unreadByMenage[item.id] ?? 0}
        />,
      ),
    [wrapSelectable, handleMenagePress, handleMenageLongPress, isAdmin, selectedIds, unreadByMenage],
  );

  const renderPlanningHeader = useCallback(
    ({ section }: { section: (typeof planning)[number] }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
        <Text style={[styles.sectionTitle, { color: section.isToday ? colors.primary : colors.text2 }]}>{section.title}</Text>
        {section.subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.text2 }]}>{section.subtitle}</Text> : null}
        <View style={{ flex: 1 }} />
        {section.isToday && summary.today > 0 ? (
          <Text style={[styles.sectionSubtitle, { color: colors.text2 }]}>
            {summary.todayDone} / {summary.today} terminée{summary.today > 1 ? 's' : ''}
          </Text>
        ) : null}
        <View style={[styles.sectionCount, { backgroundColor: section.isToday ? colors.primary : colors.lightItemBackground }]}>
          <Text style={[styles.sectionCountText, { color: section.isToday ? '#FFFFFF' : colors.text2 }]}>{section.data.length}</Text>
        </View>
      </View>
    ),
    [colors, summary],
  );

  const renderTodoItem = useCallback(
    ({ item, section }: { item: TodoItem; section: TodoSection }) => {
      if (item.kind === 'reschedule') {
        const { r, m } = item;
        const proposed = `${formatDateFr(r.proposed_date.slice(0, 10), 'weekdayShort')}${r.proposed_time ? ` à ${r.proposed_time.slice(0, 5)}` : ''}`;
        const note = `${userLabel(r.requested_by)} propose ${proposed}${r.reason ? ` · « ${r.reason} »` : ''}`;
        const actions = (
          <>
            <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => handleDecide(r, 'rejected')} disabled={decide.isPending}>
              <Text style={[styles.actionBtnText, { color: colors.text2 }]}>Refuser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.statusEnCours, borderColor: colors.statusEnCours }]}
              onPress={() => handleDecide(r, 'approved')}
              disabled={decide.isPending}
            >
              <Check size={13} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Accepter</Text>
            </TouchableOpacity>
          </>
        );
        if (!m) {
          return (
            <TouchableOpacity
              style={[styles.fallbackCard, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
              onPress={() => router.push(`/menage/${r.menage_id}`)}
            >
              <Text style={[styles.fallbackText, { color: colors.text }]}>{note}</Text>
              <View style={styles.fallbackActions}>{actions}</View>
            </TouchableOpacity>
          );
        }
        return <PlanningCard menage={m} onPress={handleMenagePress} showDate muted note={note} actions={actions} />;
      }
      const m = item.m;
      let note: string | undefined;
      if (section.key === 'validate') {
        note = m.departed_at ? `Terminé le ${formatDateFr(m.departed_at, 'dayShortTime')}` : 'Rapport rendu';
      } else if (section.key === 'late') {
        note = 'Jour passé sans pointage · ouvre la fiche pour corriger les heures ou annuler';
      }
      return wrapSelectable(
        m.id,
        <PlanningCard
          menage={m}
          onPress={handleMenagePress}
          onLongPress={isAdmin ? handleMenageLongPress : undefined}
          selected={selectedIds.has(m.id)}
          unread={unreadByMenage[m.id] ?? 0}
          showDate
          muted={section.key === 'validate'}
          note={note}
        />,
      );
    },
    [wrapSelectable, handleMenagePress, handleMenageLongPress, isAdmin, selectedIds, unreadByMenage, userLabel, handleDecide, decide.isPending, colors, router],
  );

  const renderTodoHeader = useCallback(
    ({ section }: { section: TodoSection }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
        <Text style={[styles.sectionTitle, { color: section.color }]}>{section.title}</Text>
        <View style={[styles.sectionCount, { backgroundColor: section.color + '20' }]}>
          <Text style={[styles.sectionCountText, { color: section.color }]}>{section.data.length}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {section.key === 'validate' && isAdmin && !selectionMode ? (
          <TouchableOpacity
            style={[styles.headerAction, { backgroundColor: section.color }]}
            onPress={handleValidateAll}
            disabled={validateMutation.isPending}
            accessibilityRole="button"
          >
            <CheckCheck size={13} color="#FFFFFF" />
            <Text style={styles.headerActionText}>Tout valider</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    ),
    [colors, isAdmin, selectionMode, handleValidateAll, validateMutation.isPending],
  );

  const isLoading = menagesQuery.isLoading;
  const isRefetching = menagesQuery.isRefetching || pendingReschedules.isRefetching;
  const refreshControl = <RefreshControl refreshing={isRefetching} onRefresh={refetchAll} tintColor={colors.primary} colors={[colors.primary]} />;

  const renderEmpty = (title: string, hint: string) => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.mutedText }]}>{title}</Text>
      <Text style={[styles.emptyHint, { color: colors.mutedText }]}>{hint}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>{t('prestation.title')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: searchOpen ? colors.primary : colors.itemBackground }]}
              onPress={() => {
                setSearchOpen((o) => !o);
                if (searchOpen) setSearchQuery('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Rechercher"
            >
              <Search size={IconSize.md} color={searchOpen ? '#FFFFFF' : colors.text2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.itemBackground }]}
              onPress={() => setFilterOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Filtres${filterCount ? ` (${filterCount})` : ''}`}
            >
              <SlidersHorizontal size={IconSize.md} color={filterCount ? colors.primary : colors.text2} />
              {filterCount ? (
                <View style={[styles.iconBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.iconBadgeText}>{filterCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            {view === 'planning' ? (
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: viewMode === 'map' ? colors.primary : colors.itemBackground }]}
                onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
                accessibilityRole="button"
                accessibilityLabel={viewMode === 'map' ? 'Vue liste' : 'Vue carte'}
              >
                {viewMode === 'map' ? <List size={IconSize.md} color="#FFFFFF" /> : <MapIcon size={IconSize.md} color={colors.text2} />}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </AppHeader>

      <View style={styles.controls}>
        <SegmentedTabs
          segments={[
            { key: 'planning', label: 'Planning' },
            { key: 'todo', label: 'À traiter', badge: todoCount },
            { key: 'history', label: 'Historique' },
          ]}
          value={view}
          onChange={(v) => {
            setView(v);
            exitSelection();
          }}
        />
        {searchOpen ? <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder={t('menage.search')} /> : null}
      </View>

      {selectionMode ? (
        <Animated.View
          key="selection-bar"
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={[styles.selectionBar, { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary }]}
        >
          <TouchableOpacity onPress={exitSelection} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Annuler la sélection">
            <X size={IconSize.lg} color={colors.text} />
          </TouchableOpacity>
          <Animated.Text key={`count-${selectedIds.size}`} entering={FadeInDown.duration(140)} style={[styles.selectionCount, { color: colors.text }]}>
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </Animated.Text>
          <TouchableOpacity
            style={[styles.selectionAction, { backgroundColor: validableCount === 0 ? colors.itemBackground : colors.statusValide }]}
            onPress={handleBulkValidate}
            disabled={selectedIds.size === 0 || bulkPending}
            accessibilityLabel={`Valider la sélection (${validableCount})`}
          >
            <CheckCheck size={IconSize.sm} color={validableCount === 0 ? colors.mutedText : '#FFFFFF'} />
            <Text style={[styles.selectionActionText, { color: validableCount === 0 ? colors.mutedText : '#FFFFFF' }]}>
              Valider{validableCount > 0 ? ` ${validableCount}` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectionAction, { backgroundColor: selectedIds.size === 0 ? colors.itemBackground : colors.statusEnCours }]}
            onPress={handleBulkCancel}
            disabled={selectedIds.size === 0 || bulkPending}
            accessibilityLabel="Annuler la sélection"
          >
            <Ban size={IconSize.sm} color={selectedIds.size === 0 ? colors.mutedText : '#FFFFFF'} />
            <Text style={[styles.selectionActionText, { color: selectedIds.size === 0 ? colors.mutedText : '#FFFFFF' }]}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectionAction, { backgroundColor: selectedIds.size === 0 ? colors.itemBackground : colors.red }]}
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0 || bulkPending}
            accessibilityLabel="Supprimer la sélection"
          >
            <Trash2 size={IconSize.sm} color={selectedIds.size === 0 ? colors.mutedText : '#FFFFFF'} />
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        logementOptions={logementOptions}
        prestaOptions={prestaOptions}
        creatorOptions={creatorOptions}
        resultCount={view === 'todo' ? todoCount : planningCount}
        isAdmin={isAdmin}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : view === 'history' ? (
        <HistoriqueList />
      ) : view === 'planning' && viewMode === 'map' ? (
        <MenageMap onLogementPress={(id) => router.push(`/logement/${id}` as never)} />
      ) : view === 'planning' ? (
        <SectionList
          style={{ flex: 1 }}
          sections={planning}
          keyExtractor={(item) => item.id}
          renderItem={renderPlanningItem}
          renderSectionHeader={renderPlanningHeader}
          stickySectionHeadersEnabled
          ListHeaderComponent={
            <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {[
                { n: summary.today, label: "aujourd'hui", color: colors.text },
                { n: summary.enCours, label: 'en cours', color: colors.statusEnCours },
                { n: summary.unassigned, label: summary.unassigned > 1 ? 'non assignées' : 'non assignée', color: colors.primary },
                { n: summary.late, label: summary.late > 1 ? 'non pointées' : 'non pointée', color: colors.red },
              ].map((s) => (
                <View key={s.label} style={styles.summaryCell}>
                  <Text style={[styles.summaryNum, { color: s.n > 0 ? s.color : colors.mutedText }]}>{s.n}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.text2 }]} numberOfLines={1}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          }
          ListEmptyComponent={renderEmpty(
            activeFilterCount ? 'Aucune prestation pour ces filtres' : 'Rien de prévu',
            activeFilterCount ? 'Élargis les filtres ou la recherche.' : 'Les prestations à venir apparaîtront ici, jour par jour.',
          )}
          contentContainerStyle={[styles.list, { flexGrow: 1 }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          SectionSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={todo}
          keyExtractor={(item) => item.id}
          renderItem={renderTodoItem}
          renderSectionHeader={renderTodoHeader}
          stickySectionHeadersEnabled
          ListEmptyComponent={renderEmpty('Tout est à jour', 'Rien à valider, rien en retard, personne à affecter, aucune demande en attente.')}
          ListFooterComponent={
            todo.length ? (
              <TouchableOpacity style={styles.pastFooter} onPress={() => setView('history')} accessibilityRole="link">
                <Text style={[styles.pastFooterText, { color: colors.mutedText }]}>
                  Les prestations passées non traitées depuis plus longtemps sont dans{' '}
                  <Text style={{ color: colors.primary, fontWeight: FontWeight.semibold }}>l’Historique</Text>.
                </Text>
              </TouchableOpacity>
            ) : null
          }
          contentContainerStyle={[styles.list, { flexGrow: 1 }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          SectionSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
      )}

      {isAdmin && view !== 'history' ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }, Shadow.lg]}
          onPress={() => router.push('/menage/create')}
          accessibilityRole="button"
          accessibilityLabel={t('menage.create')}
        >
          <Plus size={IconSize.xl} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  headerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: FontWeight.bold },
  controls: { paddingHorizontal: Spacing.xxl, gap: Spacing.sm, paddingBottom: Spacing.sm },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  selectionCount: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1, textAlign: 'center' },
  selectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  selectionActionText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  selectableRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  externalCheckbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  summary: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  summaryCell: { flex: 1, gap: 1 },
  summaryNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: 11 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionSubtitle: { fontSize: FontSize.sm },
  sectionCount: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { fontSize: 11, fontWeight: FontWeight.bold },
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.pill },
  headerActionText: { color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1.5 },
  actionBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  fallbackCard: { padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.sm },
  fallbackText: { fontSize: FontSize.sm },
  fallbackActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  pastFooter: { paddingVertical: Spacing.lg, alignItems: 'center' },
  pastFooterText: { fontSize: FontSize.sm, textAlign: 'center' },
  list: { paddingHorizontal: Spacing.xxl, paddingBottom: 100 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing.xxxl * 2, paddingHorizontal: Spacing.xl },
  emptyText: { fontSize: FontSize.lg, fontWeight: FontWeight.medium },
  emptyHint: { fontSize: FontSize.base, marginTop: Spacing.sm, textAlign: 'center' },
  fab: { position: 'absolute', right: Spacing.xxl, bottom: Spacing.xxl, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
