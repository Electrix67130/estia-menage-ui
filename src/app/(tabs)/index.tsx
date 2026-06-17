import React, { useState, useCallback } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useDialog } from '@/contexts/DialogContext';
import Animated, { LinearTransition, FadeInLeft, FadeOutLeft, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Trash2, X, Check, List, MapIcon, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMenages, menageHooks } from '@/api/hooks/useMenages';
import { useLogements } from '@/api/hooks/useLogements';
import { useAllUsers } from '@/api/hooks/useLogementMembers';
import { useMyRescheduleRequests } from '@/api/hooks/useReschedule';
import { useTranslation } from '@/contexts/I18nContext';
import SearchBar from '@/components/SearchBar';
import FilterChips from '@/components/FilterChips';
import FilterPickerSheet, { type FilterOption } from '@/components/FilterPickerSheet';
import MenageCard from '@/components/MenageCard';
import { useUnreadSummary } from '@/api/hooks/useMenageViews';
import MenageMap from '@/components/MenageMap';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import PrestaUpcomingList from '@/components/PrestaUpcomingList';
import { menageLogementLabel, menageSourceLabel, type MenageStatus, type Menage } from '@/api/types';
import type { MenageFilter } from '@/components/FilterChips';

type ViewMode = 'list' | 'map';

export default function MenagesScreen() {
  const { user } = useAuth();
  if (user?.role === 'prestataire') return <PrestataireMenagesScreen />;
  return <AdminMenagesScreen />;
}

/**
 * Vue prestataire de l'onglet "Ménages" : la liste de ses prochains ménages
 * avec boutons Présent/Absent inline (anciennement onglet "Dispos").
 */
function PrestataireMenagesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{t('menage.title')}</Text>
          <Text style={{ color: colors.mutedText, fontSize: FontSize.xs, marginTop: 2 }}>
            Indique si tu peux faire chaque ménage.
          </Text>
        </View>
      </AppHeader>
      <PrestaUpcomingList />
    </SafeAreaView>
  );
}

function AdminMenagesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const dialog = useDialog();
  // Non-lus par ménage → pastille sur chaque carte.
  const unreadByMenage = useUnreadSummary(!!user).data?.by_menage ?? {};

  // Filtres persistés en AsyncStorage : reprend l'état précédent au prochain
  // lancement de l'app. La searchQuery reste éphémère (jamais utile de la
  // resaisir au démarrage).
  const [statusFilter, setStatusFilter] = usePersistedState<MenageFilter>('menages.filter.status', 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('menages.filter.viewMode', 'list');
  // Filtres avancés (id sélectionné, '' = tous).
  const [logementFilter, setLogementFilter] = usePersistedState('menages.filter.logement', '');
  const [prestaFilter, setPrestaFilter] = usePersistedState('menages.filter.presta', '');
  const [creatorFilter, setCreatorFilter] = usePersistedState('menages.filter.creator', '');
  const [openPicker, setOpenPicker] = useState<null | 'logement' | 'presta' | 'creator'>(null);
  const [periodFilter, setPeriodFilter] = usePersistedState<'week' | 'month' | 'year' | 'all'>(
    'menages.filter.period',
    'all',
  );
  const [periodOffset, setPeriodOffset] = useState(0);

  const period = React.useMemo<{ min: string | null; max: string | null; label: string }>(() => {
    if (periodFilter === 'all') return { min: null, max: null, label: '' };
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = new Date();
    if (periodFilter === 'week') {
      const dow = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - dow + periodOffset * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const f = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      return { min: ymd(monday), max: ymd(sunday), label: `${f(monday)} – ${f(sunday)} ${sunday.getFullYear()}` };
    }
    if (periodFilter === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
      const last = new Date(now.getFullYear(), now.getMonth() + periodOffset + 1, 0);
      return {
        min: ymd(first),
        max: ymd(last),
        label: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      };
    }
    const y = now.getFullYear() + periodOffset;
    return { min: `${y}-01-01`, max: `${y}-12-31`, label: String(y) };
  }, [periodFilter, periodOffset]);

  // Filtre "À valider" = ménages terminés sans validation
  const isToValidate = statusFilter === 'to_validate';
  const activeStatus: MenageStatus | undefined =
    statusFilter === 'all' || statusFilter === 'to_validate' ? undefined : statusFilter;

  const menagesQuery = useMenages({
    status: isToValidate ? 'termine' : activeStatus,
    validated: isToValidate ? false : undefined,
    // Limite haute pour ne pas tronquer silencieusement la liste (le défaut
    // API de 20 coupait les ménages les plus anciens en tri décroissant).
    limit: 200,
  });
  const logementsQuery = useLogements({ limit: 500 });
  const usersQuery = useAllUsers();
  const pendingReschedules = useMyRescheduleRequests('pending');
  const pendingCount = pendingReschedules.data?.data.length ?? 0;

  // Filtrage côté client : recherche texte (logement) + logement/presta/créateur.
  // Tri "agenda" : à venir d'abord (du plus proche au plus lointain), puis le
  // passé (du plus récent au plus ancien) → on arrive sur les ménages du jour.
  const data = React.useMemo(() => {
    const all = menagesQuery.data?.data ?? [];
    const q = searchQuery.trim().toLowerCase();
    const todayDate = new Date();
    const today = todayDate.toISOString().slice(0, 10);
    const periodMin = period.min;
    const periodMax = period.max;
    return all
      .filter((m) => {
        if (q && !menageLogementLabel(m).toLowerCase().includes(q)) return false;
        if (logementFilter && m.logement_id !== logementFilter) return false;
        if (prestaFilter && m.prestataire_user_id !== prestaFilter) return false;
        if (creatorFilter) {
          if (creatorFilter.startsWith('src:')) {
            const src = creatorFilter.slice(4);
            const matches = src === 'manual' ? !m.external_source : m.external_source === src;
            if (!matches) return false;
          } else if (creatorFilter.startsWith('user:')) {
            if (m.created_by !== creatorFilter.slice(5)) return false;
          } else if (m.created_by !== creatorFilter) {
            // Rétro-compat : valeurs sans préfixe = user_id brut.
            return false;
          }
        }
        if (periodMin && m.date_prevue.slice(0, 10) < periodMin) return false;
        if (periodMax && m.date_prevue.slice(0, 10) > periodMax) return false;
        return true;
      })
      .sort((a, b) => {
        const ad = a.date_prevue.slice(0, 10);
        const bd = b.date_prevue.slice(0, 10);
        const aUp = ad >= today;
        const bUp = bd >= today;
        if (aUp && bUp) return ad.localeCompare(bd);
        if (!aUp && !bUp) return bd.localeCompare(ad);
        return aUp ? -1 : 1;
      });
  }, [menagesQuery.data, searchQuery, logementFilter, prestaFilter, creatorFilter, period.min, period.max]);
  const isLoading = menagesQuery.isLoading;

  // Options pour les pickers.
  const logementOptions: FilterOption[] = React.useMemo(
    () =>
      (logementsQuery.data?.data ?? [])
        .filter((l) => !l.archived_at)
        .map((l) => ({ id: l.id, label: l.name })),
    [logementsQuery.data],
  );
  const allUsers = usersQuery.data?.data ?? [];
  const userLabel = (id: string) => {
    const u = allUsers.find((x) => x.id === id);
    return u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email : '—';
  };
  const prestaOptions: FilterOption[] = React.useMemo(
    () =>
      allUsers
        .filter((u) => u.role === 'prestataire')
        .map((u) => ({ id: u.id, label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email })),
    [allUsers],
  );
  // "Créateur" inclut à la fois les users qui ont créé un ménage manuellement
  // ET les sources externes (Airbnb, Booking, etc.) qui en ont créé via iCal.
  // Conventions d'id : `user:<uuid>` pour un user, `src:<external_source>` pour
  // une source externe, `src:manual` pour les ménages créés manuellement.
  const creatorOptions: FilterOption[] = React.useMemo(() => {
    const menages = menagesQuery.data?.data ?? [];
    const userIds = new Set<string>();
    const sources = new Set<string>();
    let hasManual = false;
    for (const m of menages) {
      if (m.external_source) sources.add(m.external_source);
      else hasManual = true;
      if (m.created_by) userIds.add(m.created_by);
    }
    const sourceOpts: FilterOption[] = [];
    if (hasManual) sourceOpts.push({ id: 'src:manual', label: 'Manuel' });
    for (const s of Array.from(sources).sort()) {
      sourceOpts.push({ id: `src:${s}`, label: menageSourceLabel(s) });
    }
    const userOpts: FilterOption[] = Array.from(userIds).map((id) => ({
      id: `user:${id}`,
      label: userLabel(id),
    }));
    return [...sourceOpts, ...userOpts];
  }, [menagesQuery.data, allUsers]);

  const deleteMutation = menageHooks.useRemove();

  // Mode multi-selection (active sur long-press d'une carte ; admin uniquement).
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

  const handleMenagePress = useCallback(
    (id: string) => {
      if (selectionMode) {
        toggleSelection(id);
      } else {
        router.push(`/menage/${id}`);
      }
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

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await dialog.confirm({
      title: `Supprimer ${ids.length} menage${ids.length > 1 ? 's' : ''} ?`,
      message:
        'Action irréversible : toutes leurs données (photos, documents, étapes…) seront supprimées.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)));
      exitSelection();
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Suppression partielle',
      });
    }
  }, [selectedIds, deleteMutation, exitSelection, dialog]);

  const renderItem = useCallback(
    ({ item }: { item: Menage }) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <Animated.View style={styles.selectableRow} layout={LinearTransition.duration(220)}>
          {selectionMode ? (
            <Animated.View entering={FadeInLeft.duration(200)} exiting={FadeOutLeft.duration(180)}>
              <TouchableOpacity
                onPress={() => toggleSelection(item.id)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                style={[
                  styles.externalCheckbox,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                  },
                ]}
              >
                {isSelected ? <Check size={14} color="#FFFFFF" /> : null}
              </TouchableOpacity>
            </Animated.View>
          ) : null}
          <Animated.View style={{ flex: 1 }} layout={LinearTransition.duration(220)}>
            <MenageCard
              menage={item}
              onPress={handleMenagePress}
              onLongPress={isAdmin ? handleMenageLongPress : undefined}
              selectionMode={selectionMode}
              selected={isSelected}
              unread={unreadByMenage[item.id] ?? 0}
            />
          </Animated.View>
        </Animated.View>
      );
    },
    [handleMenagePress, handleMenageLongPress, isAdmin, selectionMode, selectedIds, toggleSelection, colors, unreadByMenage],
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>
          {t('menage.empty')}
        </Text>
        <Text style={[styles.emptyHint, { color: colors.mutedText }]}>
          {searchQuery || logementFilter || prestaFilter || creatorFilter
            ? 'Aucun ménage pour ces filtres.'
            : 'Appuyez sur + pour créer votre premier menage.'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader>
        <Text style={[styles.title, { color: colors.text }]}>{t('menage.title')}</Text>
        {/* Demandes de changement — actif si pending > 0, muted sinon. */}
        <TouchableOpacity
          style={[
            styles.reschedBtn,
            {
              backgroundColor:
                pendingCount > 0 ? colors.statusEnCours + '20' : colors.itemBackground,
            },
          ]}
          onPress={() => router.push('/reschedule-requests' as never)}
          accessibilityRole="button"
          accessibilityLabel={`Demandes de changement (${pendingCount})`}
        >
          <CalendarClock
            size={IconSize.md}
            color={pendingCount > 0 ? colors.statusEnCours : colors.mutedText}
          />
          {pendingCount > 0 ? (
            <View style={[styles.reschedBadge, { backgroundColor: colors.statusEnCours }]}>
              <Text style={styles.reschedBadgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        {/* Toggle liste / carte */}
        <View style={[styles.viewToggle, { backgroundColor: colors.itemBackground }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode('list')}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'list' }}
            accessibilityLabel="Vue liste"
          >
            <List size={IconSize.md} color={viewMode === 'list' ? '#FFFFFF' : colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'map' && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode('map')}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'map' }}
            accessibilityLabel="Vue carte"
          >
            <MapIcon size={IconSize.md} color={viewMode === 'map' ? '#FFFFFF' : colors.text2} />
          </TouchableOpacity>
        </View>
      </AppHeader>

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
          <Animated.Text
            key={`count-${selectedIds.size}`}
            entering={FadeInDown.duration(140)}
            style={[styles.selectionCount, { color: colors.text }]}
          >
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </Animated.Text>
          <TouchableOpacity
            style={[
              styles.selectionDelete,
              { backgroundColor: selectedIds.size === 0 ? colors.itemBackground : colors.red },
            ]}
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0 || deleteMutation.isPending}
            accessibilityLabel="Supprimer la sélection"
          >
            <Trash2 size={IconSize.sm} color={selectedIds.size === 0 ? colors.mutedText : '#FFFFFF'} />
            <Text style={[styles.selectionDeleteText, { color: selectedIds.size === 0 ? colors.mutedText : '#FFFFFF' }]}>
              Supprimer
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View
          key="controls"
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={styles.controls}
        >
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('menage.search')}
          />
          <View style={[styles.periodToggle, { backgroundColor: colors.itemBackground }]}>
            {([
              { key: 'week' as const, label: 'Semaine' },
              { key: 'month' as const, label: 'Mois' },
              { key: 'year' as const, label: 'Année' },
              { key: 'all' as const, label: 'Tout' },
            ]).map((p) => {
              const active = periodFilter === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.periodTab,
                    { backgroundColor: active ? colors.surface : 'transparent' },
                  ]}
                  onPress={() => {
                    setPeriodFilter(p.key);
                    setPeriodOffset(0);
                  }}
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
          {periodFilter !== 'all' ? (
            <View style={styles.periodNav}>
              <TouchableOpacity
                onPress={() => setPeriodOffset((o) => o - 1)}
                style={[styles.periodNavBtn, { backgroundColor: colors.itemBackground }]}
                accessibilityLabel="Période précédente"
              >
                <ChevronLeft size={IconSize.md} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.periodNavLabel, { color: colors.text }]} numberOfLines={1}>
                {period.label}
              </Text>
              <TouchableOpacity
                onPress={() => setPeriodOffset((o) => o + 1)}
                style={[styles.periodNavBtn, { backgroundColor: colors.itemBackground }]}
                accessibilityLabel="Période suivante"
              >
                <ChevronRight size={IconSize.md} color={colors.text} />
              </TouchableOpacity>
              {periodOffset !== 0 ? (
                <TouchableOpacity onPress={() => setPeriodOffset(0)} style={styles.periodNavToday}>
                  <Text style={[styles.periodNavTodayLabel, { color: colors.primary }]}>Aujourd&apos;hui</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          <FilterChips
            selected={statusFilter}
            onSelect={setStatusFilter}
            extra={[
              {
                key: 'logement',
                label: logementFilter
                  ? logementOptions.find((o) => o.id === logementFilter)?.label ?? 'Logement'
                  : 'Logement',
                active: !!logementFilter,
                onPress: () => setOpenPicker('logement'),
              },
              ...(isAdmin
                ? [
                    {
                      key: 'presta',
                      label: prestaFilter
                        ? prestaOptions.find((o) => o.id === prestaFilter)?.label ?? 'Prestataire'
                        : 'Prestataire',
                      active: !!prestaFilter,
                      onPress: () => setOpenPicker('presta'),
                    },
                    {
                      key: 'creator',
                      label: creatorFilter
                        ? creatorOptions.find((o) => o.id === creatorFilter)?.label ?? 'Créateur'
                        : 'Créateur',
                      active: !!creatorFilter,
                      onPress: () => setOpenPicker('creator'),
                    },
                  ]
                : []),
            ]}
          />
        </Animated.View>
      )}

      <FilterPickerSheet
        visible={openPicker === 'logement'}
        title="Filtrer par logement"
        options={logementOptions}
        selectedId={logementFilter}
        onSelect={(id) => {
          setLogementFilter(id);
          setOpenPicker(null);
        }}
        onClose={() => setOpenPicker(null)}
        searchPlaceholder="Rechercher un logement…"
      />
      <FilterPickerSheet
        visible={openPicker === 'presta'}
        title="Filtrer par prestataire"
        options={prestaOptions}
        selectedId={prestaFilter}
        onSelect={(id) => {
          setPrestaFilter(id);
          setOpenPicker(null);
        }}
        onClose={() => setOpenPicker(null)}
        searchPlaceholder="Rechercher un prestataire…"
      />
      <FilterPickerSheet
        visible={openPicker === 'creator'}
        title="Filtrer par créateur"
        options={creatorOptions}
        selectedId={creatorFilter}
        onSelect={(id) => {
          setCreatorFilter(id);
          setOpenPicker(null);
        }}
        onClose={() => setOpenPicker(null)}
        searchPlaceholder="Rechercher un créateur…"
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : viewMode === 'map' ? (
        <MenageMap onLogementPress={(id) => router.push(`/logement/${id}` as never)} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[styles.list, { flexGrow: 1 }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={menagesQuery.isRefetching}
              onRefresh={() => menagesQuery.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* FAB — Création directe (admin only) */}
      {isAdmin && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }, Shadow.lg]}
          onPress={() => router.push('/menage/create')}
          accessibilityRole="button"
          accessibilityLabel={t('menage.create')}
        >
          <Plus size={IconSize.xl} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 2,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { paddingHorizontal: Spacing.xxl, gap: Spacing.md, paddingBottom: Spacing.md },
  reschedBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reschedBadge: {
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
  reschedBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: FontWeight.bold },
  periodToggle: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, gap: 2 },
  periodNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  periodNavBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'capitalize',
  },
  periodNavToday: { paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  periodNavTodayLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  periodTab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  periodTabText: { fontSize: FontSize.sm },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  selectionCount: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, flex: 1, textAlign: 'center' },
  selectionDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  selectionDeleteText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  selectableRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  externalCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: Spacing.xxl, paddingBottom: 100 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing.xxxl * 2 },
  emptyText: { fontSize: FontSize.lg, fontWeight: FontWeight.medium },
  emptyHint: { fontSize: FontSize.base, marginTop: Spacing.sm, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: Spacing.xxl,
    bottom: Spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

});
