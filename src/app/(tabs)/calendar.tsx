import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Search, X, AlertTriangle } from 'lucide-react-native';
import { useMenages } from '@/api/hooks/useMenages';
import { useAllUsers } from '@/api/hooks/useLogementMembers';
import { useLogements } from '@/api/hooks/useLogements';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize, FontWeight, Radius, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useAuth } from '@/contexts/AuthContext';
import type { Menage, MenageStatus, PrestationType } from '@/api/types';
import { menagePrestataireLabel, menageLogementLabel, prestationTypeLabel, prestationTypeColorKey } from '@/api/types';
import { formatDateFr } from '@/lib/date-fr';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const STATUS_COLOR: Record<MenageStatus, string> = {
  a_venir: '#3B82F6',
  en_cours: '#F59E0B',
  termine: '#0D9488',
  valide: '#0F766E',
  annule: '#94A3B8',
};

const PRESTATAIRE_ALL = '';
const PRESTATAIRE_UNASSIGNED = '__unassigned__';
const LOGEMENT_ALL = '';
const TYPE_ALL = '';

interface CalendarScreenProps {
  /**
   * Mode "embarqué" : le calendrier est rendu DANS un autre écran (ex: Dispos),
   * sans son propre SafeAreaView ni son header back+titre. Le parent gère le
   * chrome (toggle, navigation).
   */
  embedded?: boolean;
}

export default function CalendarScreen({ embedded = false }: CalendarScreenProps = {}) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  // Le filtre prestataire ne sert qu'à l'admin (pour voir les dispos / ménages
  // d'un presta donné). Un prestataire ne voit que ses propres ménages, donc
  // le filtre est inutile pour lui.
  const showPrestataireFilter = user?.role === 'admin';
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const [weekView, setWeekView] = usePersistedState<boolean>('calendar.weekView', false);
  const { from, to } = useMemo(
    () => (weekView ? weekRange(cursor) : monthRange(cursor)),
    [cursor, weekView],
  );
  const menagesQuery = useMenages({ from, to, limit: 200 });
  const { data, isLoading, isRefetching, refetch } = menagesQuery;
  const allMenages = useMemo(() => data?.data ?? [], [data]);
  // Fetch tous les users de l'org pour pouvoir filtrer par n'importe quel
  // prestataire, même s'il n'a aucun ménage ce mois (utile pour voir sa dispo).
  const allUsers = useAllUsers();

  const handleRefresh = React.useCallback(() => {
    void refetch();
    void allUsers.refetch();
  }, [refetch, allUsers]);

  const [prestataireFilter, setPrestataireFilter] = usePersistedState<string>(
    'calendar.filter.prestataire',
    PRESTATAIRE_ALL,
  );
  const [logementFilter, setLogementFilter] = usePersistedState<string>(
    'calendar.filter.logement',
    LOGEMENT_ALL,
  );
  const [typeFilter, setTypeFilter] = usePersistedState<string>('calendar.filter.type', TYPE_ALL);
  const [prestataireSheetOpen, setPrestataireSheetOpen] = useState(false);
  const [logementSheetOpen, setLogementSheetOpen] = useState(false);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);

  const typeOptions = useMemo(
    () =>
      (['menage', 'check_in', 'check_out'] as PrestationType[]).map((t) => ({
        id: t,
        label: prestationTypeLabel(t),
      })),
    [],
  );

  const prestataireOptions = useMemo(
    () => buildPrestataireOptions(allMenages, allUsers.data?.data ?? []),
    [allMenages, allUsers.data],
  );
  // Source = tous les logements de l'org (et pas seulement ceux du mois affiché),
  // sinon un logement sans ménage ce mois disparaît du filtre.
  const allLogements = useLogements({ limit: 500 });
  const logementOptions = useMemo(() => {
    const list = (allLogements.data?.data ?? [])
      .filter((l) => !l.archived_at)
      .map((l) => ({ id: l.id, label: l.name }));
    return list.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [allLogements.data]);

  const filteredMenages = useMemo(
    () =>
      allMenages.filter((m) => {
        if (prestataireFilter === PRESTATAIRE_UNASSIGNED) {
          if (m.prestataire_user_id) return false;
        } else if (prestataireFilter) {
          if (m.prestataire_user_id !== prestataireFilter) return false;
        }
        if (typeFilter && m.prestation_type !== typeFilter) return false;
        if (logementFilter && m.logement_id !== logementFilter) return false;
        return true;
      }),
    [allMenages, prestataireFilter, typeFilter, logementFilter],
  );

  const byDate = useMemo(() => groupByDate(filteredMenages), [filteredMenages]);
  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const weekDays = useMemo(() => buildWeekDays(cursor), [cursor]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const todayIso = isoLocal(new Date());

  const selectedItems = selectedDate ? byDate.get(selectedDate) ?? [] : [];
  const filtersActive =
    prestataireFilter !== PRESTATAIRE_ALL ||
    logementFilter !== LOGEMENT_ALL ||
    typeFilter !== TYPE_ALL;

  const prestataireFilterLabel =
    prestataireFilter === PRESTATAIRE_ALL
      ? 'Tous'
      : prestataireFilter === PRESTATAIRE_UNASSIGNED
        ? 'Non assigné'
        : prestataireOptions.find((p) => p.id === prestataireFilter)?.label ?? 'Tous';

  const logementFilterLabel =
    logementFilter === LOGEMENT_ALL
      ? 'Tous'
      : logementOptions.find((l) => l.id === logementFilter)?.label ?? 'Tous';

  const typeFilterLabel =
    typeFilter === TYPE_ALL
      ? 'Type'
      : typeOptions.find((o) => o.id === typeFilter)?.label ?? 'Type';

  const prestatairePickerOptions = useMemo(
    () => [
      { id: PRESTATAIRE_ALL, label: 'Tous les prestataires' },
      { id: PRESTATAIRE_UNASSIGNED, label: 'Non assigné' },
      ...prestataireOptions,
    ],
    [prestataireOptions],
  );

  const logementPickerOptions = useMemo(
    () => [{ id: LOGEMENT_ALL, label: 'Tous les logements' }, ...logementOptions],
    [logementOptions],
  );

  const Wrapper: React.ComponentType<{ children: React.ReactNode }> = embedded
    ? ({ children }) => (
        <View style={[styles.container, { backgroundColor: colors.background }]}>{children}</View>
      )
    : ({ children }) => (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          {children}
        </SafeAreaView>
      );

  return (
    <Wrapper>
      {!embedded ? (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <ArrowLeft size={IconSize.md} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Calendrier</Text>
        </View>
      ) : null}

      <View style={styles.monthNav}>
        <TouchableOpacity
          onPress={() => setCursor(weekView ? addDays(cursor, -7) : addMonths(cursor, -1))}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={styles.monthNavBtn}
          accessibilityRole="button"
          accessibilityLabel={weekView ? 'Semaine précédente' : 'Mois précédent'}
        >
          <ChevronLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>
          {weekView ? weekTitle(cursor) : formatDateFr(cursor, 'month')}
        </Text>
        <TouchableOpacity
          onPress={() => setCursor(weekView ? addDays(cursor, 7) : addMonths(cursor, 1))}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={styles.monthNavBtn}
          accessibilityRole="button"
          accessibilityLabel={weekView ? 'Semaine suivante' : 'Mois suivant'}
        >
          <ChevronRight size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekToggleRow}>
        <Text style={[styles.weekToggleLabel, { color: colors.text2 }]}>Vue semaine (durées)</Text>
        <Switch
          value={weekView}
          onValueChange={setWeekView}
          trackColor={{ true: colors.primary }}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor: typeFilter !== TYPE_ALL ? colors.primary + '20' : colors.itemBackground,
              borderColor: typeFilter !== TYPE_ALL ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setTypeSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Filtrer par type"
        >
          <Text
            style={[
              styles.filterLabel,
              { color: typeFilter !== TYPE_ALL ? colors.primary : colors.text2 },
            ]}
            numberOfLines={1}
          >
            {typeFilterLabel}
          </Text>
          <ChevronDown size={12} color={typeFilter !== TYPE_ALL ? colors.primary : colors.text2} />
        </TouchableOpacity>

        {showPrestataireFilter ? (
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor:
                  prestataireFilter !== PRESTATAIRE_ALL
                    ? colors.primary + '20'
                    : colors.itemBackground,
                borderColor:
                  prestataireFilter !== PRESTATAIRE_ALL ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setPrestataireSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Filtrer par prestataire"
          >
            <Text
              style={[
                styles.filterLabel,
                {
                  color:
                    prestataireFilter !== PRESTATAIRE_ALL ? colors.primary : colors.text2,
                },
              ]}
              numberOfLines={1}
            >
              {prestataireFilter !== PRESTATAIRE_ALL ? prestataireFilterLabel : 'Prestataire'}
            </Text>
            <ChevronDown
              size={12}
              color={prestataireFilter !== PRESTATAIRE_ALL ? colors.primary : colors.text2}
            />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor:
                logementFilter !== LOGEMENT_ALL ? colors.primary + '20' : colors.itemBackground,
              borderColor: logementFilter !== LOGEMENT_ALL ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setLogementSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Filtrer par logement"
        >
          <Text
            style={[
              styles.filterLabel,
              { color: logementFilter !== LOGEMENT_ALL ? colors.primary : colors.text2 },
            ]}
            numberOfLines={1}
          >
            {logementFilter !== LOGEMENT_ALL ? logementFilterLabel : 'Logement'}
          </Text>
          <ChevronDown
            size={12}
            color={logementFilter !== LOGEMENT_ALL ? colors.primary : colors.text2}
          />
        </TouchableOpacity>

        {filtersActive ? (
          <TouchableOpacity
            style={[
              styles.filterReset,
              { backgroundColor: colors.itemBackground, borderColor: colors.border },
            ]}
            onPress={() => {
              setPrestataireFilter(PRESTATAIRE_ALL);
              setLogementFilter(LOGEMENT_ALL);
              setTypeFilter(TYPE_ALL);
            }}
            accessibilityRole="button"
            accessibilityLabel="Réinitialiser les filtres"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={12} color={colors.text2} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {weekView ? (
        <WeekTimelineMobile
          weekDays={weekDays}
          byDate={byDate}
          colors={colors}
          todayIso={todayIso}
          isLoading={isLoading}
          refreshing={isRefetching || allUsers.isRefetching}
          onRefresh={handleRefresh}
          onOpenMenage={(mid) => router.push(`/menage/${mid}` as never)}
        />
      ) : (
      <>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.weekdayLabel, { color: colors.text2 }]}>
            {d}
          </Text>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <View style={styles.grid}>
          {days.map(({ date, inMonth }) => {
            const iso = isoLocal(date);
            const items = byDate.get(iso) ?? [];
            const isToday = iso === todayIso;
            const isSelected = iso === selectedDate;
            return (
              <TouchableOpacity
                key={iso}
                style={styles.dayCell}
                onPress={() => setSelectedDate(iso)}
                activeOpacity={0.6}
              >
                <View
                  style={[
                    styles.dayCircle,
                    isToday && { backgroundColor: colors.primary },
                    isSelected && !isToday && { backgroundColor: colors.itemBackground },
                  ]}
                >
                  <Text
                    style={{
                      color: isToday
                        ? '#fff'
                        : inMonth
                          ? colors.text
                          : colors.mutedText,
                      fontSize: FontSize.sm,
                      fontWeight: isToday ? FontWeight.bold : FontWeight.regular,
                    }}
                  >
                    {date.getDate()}
                  </Text>
                </View>
                <View style={styles.dotsRow}>
                  {items.slice(0, 3).map((m) => (
                    <View
                      key={m.id}
                      style={[
                        styles.dot,
                        { backgroundColor: m.logement_color ?? STATUS_COLOR[m.status] },
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.detailScroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || allUsers.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Text style={[styles.detailTitle, { color: colors.text }]}>
          {selectedDate ? formatDateFr(selectedDate.slice(0, 10), 'long') : 'Sélectionne une date'}
        </Text>
        {selectedItems.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedText }]}>
            {selectedDate ? 'Aucun ménage ce jour.' : ''}
          </Text>
        ) : (
          selectedItems.map((m) => {
            const unassigned = !m.prestataire_user_id;
            const needsAttention = !!m.needs_attention;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.itemRow,
                  {
                    backgroundColor: needsAttention ? colors.red + '12' : colors.surface,
                    borderColor: needsAttention ? colors.red + '55' : colors.border,
                  },
                ]}
                onPress={() => router.push(`/menage/${m.id}` as never)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.statusBar,
                    { backgroundColor: m.logement_color ?? STATUS_COLOR[m.status] },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTime, { color: colors.text }]}>
                    {m.horaire_prevu?.slice(0, 5) ?? 'Heure non précisée'}
                    {' · '}
                    <Text style={{ color: colors.text2 }}>{menageLogementLabel(m)}</Text>
                  </Text>
                  <View style={styles.itemMetaRow}>
                    {(() => {
                      const typeColor = colors[prestationTypeColorKey(m.prestation_type)];
                      return (
                        <View
                          style={[styles.badgeType, { backgroundColor: typeColor + '20' }]}
                          accessibilityLabel={prestationTypeLabel(m.prestation_type)}
                        >
                          <Text style={[styles.badgeTypeText, { color: typeColor }]}>
                            {prestationTypeLabel(m.prestation_type)}
                          </Text>
                        </View>
                      );
                    })()}
                    {needsAttention ? (
                      <View
                        style={[styles.badgeLate, { backgroundColor: colors.red + '20' }]}
                        accessibilityLabel="Jour passé sans pointage"
                      >
                        <AlertTriangle size={11} color={colors.red} />
                        <Text style={[styles.badgeLateText, { color: colors.red }]}>Non pointé</Text>
                      </View>
                    ) : null}
                    {unassigned ? (
                      <View style={styles.badgeUnassigned}>
                        <Text style={styles.badgeUnassignedText}>NON ASSIGNÉ</Text>
                      </View>
                    ) : (
                      <Text style={[styles.itemSub, { color: colors.text2 }]}>
                        Prestataire : {menagePrestataireLabel(m)}
                      </Text>
                    )}
                    <Text style={[styles.itemSub, { color: colors.mutedText }]}>
                      {' · '}
                      {labelForStatus(m.status)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      </>
      )}

      <FilterPickerSheet
        visible={showPrestataireFilter && prestataireSheetOpen}
        title="Filtrer par prestataire"
        searchPlaceholder="Rechercher un prestataire…"
        options={prestatairePickerOptions}
        selectedId={prestataireFilter}
        onSelect={(id) => {
          setPrestataireFilter(id);
          setPrestataireSheetOpen(false);
        }}
        onClose={() => setPrestataireSheetOpen(false)}
      />
      <FilterPickerSheet
        visible={logementSheetOpen}
        title="Filtrer par logement"
        searchPlaceholder="Rechercher un logement…"
        options={logementPickerOptions}
        selectedId={logementFilter}
        onSelect={(id) => {
          setLogementFilter(id);
          setLogementSheetOpen(false);
        }}
        onClose={() => setLogementSheetOpen(false)}
      />
      <FilterPickerSheet
        visible={typeSheetOpen}
        title="Filtrer par type"
        options={[{ id: TYPE_ALL, label: 'Tous les types' }, ...typeOptions]}
        selectedId={typeFilter}
        onSelect={(id) => {
          setTypeFilter(id);
          setTypeSheetOpen(false);
        }}
        onClose={() => setTypeSheetOpen(false)}
      />
    </Wrapper>
  );
}

interface FilterOption {
  id: string;
  label: string;
}

interface FilterPickerSheetProps {
  visible: boolean;
  title: string;
  /** Absent = pas de barre de recherche (listes courtes, ex. type de prestation). */
  searchPlaceholder?: string;
  options: FilterOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function FilterPickerSheet({
  visible,
  title,
  searchPlaceholder,
  options,
  selectedId,
  onSelect,
  onClose,
}: FilterPickerSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [search, setSearch] = useState('');
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible });
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setSearch('')}
    >
      <View style={sheetStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[sheetStyles.sheet, { backgroundColor: colors.surface }, Shadow.lg, animatedModalStyle]}>
          <View style={sheetStyles.handle}>
            <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={sheetStyles.header}>
            <Text style={[sheetStyles.title, { color: colors.text }]}>{title}</Text>
          </View>

          {searchPlaceholder ? (
            <View
              style={[
                sheetStyles.searchBox,
                { backgroundColor: colors.itemBackground, borderColor: colors.border },
              ]}
            >
              <Search size={16} color={colors.placeholder} />
              <TextInput
                style={[sheetStyles.searchInput, { color: colors.text }]}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.placeholder}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id || '__all__'}
            keyboardShouldPersistTaps="handled"
            style={sheetStyles.flatList}
            contentContainerStyle={[sheetStyles.list, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: colors.border }} />
            )}
            ListEmptyComponent={
              <Text style={[sheetStyles.empty, { color: colors.mutedText }]}>Aucun résultat.</Text>
            }
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={sheetStyles.optionRow}
                  onPress={() => onSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: isSelected ? colors.primary : colors.text,
                      fontSize: FontSize.md,
                      fontWeight: isSelected ? FontWeight.semibold : FontWeight.regular,
                    }}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                  {isSelected ? <Check size={IconSize.md} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: { padding: Spacing.xs },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  monthLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  monthNavBtn: { padding: Spacing.xs },
  weekToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  weekToggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: Radius.pill,
    maxWidth: 160,
  },
  filterLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  filterReset: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.sm,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: { flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  detailScroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  detailTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textTransform: 'capitalize',
    marginBottom: Spacing.sm,
  },
  empty: { fontSize: FontSize.sm },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statusBar: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: Spacing.sm },
  itemTime: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  itemSub: { fontSize: FontSize.xs, marginTop: 2 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  badgeType: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeTypeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeUnassigned: {
    backgroundColor: '#FED7AA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeUnassignedText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#9A3412',
    letterSpacing: 0.5,
  },
  badgeLate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginRight: Spacing.xs,
  },
  badgeLateText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
});

const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 0,
  },
  handle: { alignItems: 'center', paddingBottom: Spacing.sm },
  handleBar: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, height: 44 },
  flatList: { flexShrink: 1 },
  list: { paddingBottom: Spacing.sm },
  empty: { fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.lg },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
});

function labelForStatus(s: MenageStatus): string {
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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function monthRange(cursor: Date): { from: string; to: string } {
  const first = startOfMonth(cursor);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  return { from: isoLocal(first), to: isoLocal(last) };
}
function buildMonthGrid(cursor: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(cursor);
  const firstDow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstDow);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === cursor.getMonth() });
  }
  return cells;
}
function buildPrestataireOptions(
  menages: Menage[],
  users: Array<{ id: string; first_name: string; last_name: string; email: string; role: string }>,
): { id: string; label: string }[] {
  const map = new Map<string, string>();
  // 1. Tous les users de l'org avec role='prestataire' — ainsi un presta sans
  //    ménage ce mois apparaît quand même dans le filtre (vue dispo admin).
  for (const u of users) {
    if (u.role !== 'prestataire') continue;
    const label = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '—';
    map.set(u.id, label);
  }
  // 2. Filet de sécurité : prestataires affectés à des ménages mais qui n'apparaissent
  //    pas dans la liste des users (cas edge : presta hors org actuelle).
  for (const m of menages) {
    if (!m.prestataire_user_id) continue;
    if (!map.has(m.prestataire_user_id)) {
      map.set(m.prestataire_user_id, menagePrestataireLabel(m));
    }
  }
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

function buildLogementOptions(menages: Menage[]): { id: string; label: string }[] {
  const map = new Map<string, string>();
  for (const m of menages) {
    if (!map.has(m.logement_id)) {
      map.set(m.logement_id, menageLogementLabel(m));
    }
  }
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

function groupByDate(menages: Menage[]): Map<string, Menage[]> {
  const map = new Map<string, Menage[]>();
  for (const m of menages) {
    // Normalise YYYY-MM-DD ou ISO complet sur la clé date
    const key = m.date_prevue.slice(0, 10);
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }
  return map;
}

// ---------- Vue semaine chronologique (durées) ----------

const WEEKDAYS_FULL = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - dow);
  return x;
}

function weekRange(cursor: Date): { from: string; to: string } {
  const s = weekStart(cursor);
  return { from: isoLocal(s), to: isoLocal(addDays(s, 6)) };
}

function buildWeekDays(cursor: Date): Date[] {
  const s = weekStart(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

function weekTitle(cursor: Date): string {
  const s = weekStart(cursor);
  const e = addDays(s, 6);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} – ${e.getDate()} ${MONTHS_FR[s.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTHS_FR[s.getMonth()]} – ${e.getDate()} ${MONTHS_FR[e.getMonth()]}`;
}

function minutesFromHoraire(h: string): number {
  const [hh, mm] = h.slice(0, 5).split(':').map(Number);
  return hh * 60 + (mm || 0);
}

function fmtHm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

interface LaidOut {
  m: Menage;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
}

/** Positionne les ménages horodatés d'un jour en couloirs (chevauchements). */
function layoutDayMobile(events: Menage[]): LaidOut[] {
  const timed: LaidOut[] = events
    .filter((e) => e.horaire_prevu)
    .map((e) => {
      const startMin = minutesFromHoraire(e.horaire_prevu as string);
      const endMin = startMin + Math.max(e.duree_estimee_min ?? 60, 30);
      return { m: e, startMin, endMin, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const result: LaidOut[] = [];
  let i = 0;
  while (i < timed.length) {
    let j = i;
    let clusterEnd = timed[i].endMin;
    const laneEnds: number[] = [];
    const group: LaidOut[] = [];
    while (j < timed.length && timed[j].startMin < clusterEnd) {
      let lane = laneEnds.findIndex((end) => end <= timed[j].startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(timed[j].endMin);
      } else {
        laneEnds[lane] = timed[j].endMin;
      }
      timed[j].lane = lane;
      group.push(timed[j]);
      clusterEnd = Math.max(clusterEnd, timed[j].endMin);
      j++;
    }
    for (const g of group) {
      g.lanes = laneEnds.length;
      result.push(g);
    }
    i = j;
  }
  return result;
}

const TL_HOUR_PX = 44;
const TL_COL_W = 118;
const TL_GUTTER = 36;
const TL_HEADER_H = 46;
const TL_CHIP_H = 18;
const TL_UNTIMED_MAX = 2;

function WeekTimelineMobile({
  weekDays,
  byDate,
  colors,
  todayIso,
  isLoading,
  refreshing,
  onRefresh,
  onOpenMenage,
}: {
  weekDays: Date[];
  byDate: Map<string, Menage[]>;
  colors: (typeof Colors)['light'];
  todayIso: string;
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenMenage: (id: string) => void;
}) {
  if (isLoading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />;
  }
  const perDay = weekDays.map((d) => {
    const iso = isoLocal(d);
    const evts = byDate.get(iso) ?? [];
    return { d, iso, timed: layoutDayMobile(evts), untimed: evts.filter((e) => !e.horaire_prevu) };
  });

  let startHour = 7;
  let endHour = 20;
  for (const p of perDay) {
    for (const it of p.timed) {
      startHour = Math.min(startHour, Math.floor(it.startMin / 60));
      endHour = Math.max(endHour, Math.ceil(it.endMin / 60));
    }
  }
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);
  const bodyHeight = (endHour - startHour) * TL_HOUR_PX;
  const maxUntimed = perDay.reduce((mx, p) => Math.max(mx, p.untimed.length), 0);
  const untimedH =
    maxUntimed > 0
      ? Math.min(maxUntimed, TL_UNTIMED_MAX) * (TL_CHIP_H + 3) + (maxUntimed > TL_UNTIMED_MAX ? 12 : 0) + 4
      : 0;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingRight: Spacing.md }}>
        <View style={{ flexDirection: 'row' }}>
          {/* Gouttière des heures */}
          <View style={{ width: TL_GUTTER }}>
            <View style={{ height: TL_HEADER_H + untimedH }} />
            <View style={{ height: bodyHeight }}>
              {hours.map((h, i) => (
                <Text
                  key={h}
                  style={{ position: 'absolute', right: 3, top: i * TL_HOUR_PX - 6, fontSize: 9, color: colors.text2 }}
                >
                  {String(h).padStart(2, '0')}h
                </Text>
              ))}
            </View>
          </View>

          {perDay.map((p) => {
            const isToday = p.iso === todayIso;
            return (
              <View key={p.iso} style={{ width: TL_COL_W, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                {/* En-tête jour */}
                <View style={{ height: TL_HEADER_H, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, color: colors.text2, textTransform: 'uppercase' }}>
                    {WEEKDAYS_FULL[(p.d.getDay() + 6) % 7]}
                  </Text>
                  <View
                    style={{
                      marginTop: 2,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isToday ? colors.primary : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: FontWeight.semibold, color: isToday ? '#fff' : colors.text }}>
                      {p.d.getDate()}
                    </Text>
                  </View>
                </View>

                {/* Sans heure */}
                {untimedH > 0 ? (
                  <View style={{ height: untimedH, paddingHorizontal: 2, gap: 2 }}>
                    {p.untimed.slice(0, TL_UNTIMED_MAX).map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => onOpenMenage(m.id)}
                        style={{
                          height: TL_CHIP_H,
                          borderRadius: 4,
                          paddingHorizontal: 4,
                          justifyContent: 'center',
                          backgroundColor: m.logement_color ?? STATUS_COLOR[m.status],
                        }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 9, color: '#fff', fontWeight: FontWeight.medium }}>
                          {m.prestataire_user_id ? menagePrestataireLabel(m) : 'Non assigné'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {p.untimed.length > TL_UNTIMED_MAX ? (
                      <Text style={{ fontSize: 9, color: colors.text2 }}>+{p.untimed.length - TL_UNTIMED_MAX}</Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Corps chronologique */}
                <View style={{ height: bodyHeight }}>
                  {hours.map((h, i) => (
                    <View
                      key={h}
                      style={{ position: 'absolute', left: 0, right: 0, top: i * TL_HOUR_PX, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }}
                    />
                  ))}
                  {p.timed.map((it) => {
                    const top = ((it.startMin - startHour * 60) / 60) * TL_HOUR_PX;
                    const height = Math.max(((it.endMin - it.startMin) / 60) * TL_HOUR_PX, 16);
                    const widthPct = 100 / it.lanes;
                    const bg = it.m.logement_color ?? STATUS_COLOR[it.m.status];
                    return (
                      <TouchableOpacity
                        key={it.m.id}
                        onPress={() => onOpenMenage(it.m.id)}
                        activeOpacity={0.8}
                        style={{
                          position: 'absolute',
                          top,
                          height,
                          left: `${it.lane * widthPct}%`,
                          width: `${widthPct}%`,
                          padding: 3,
                          borderRadius: 5,
                          borderWidth: 1,
                          borderColor: 'rgba(0,0,0,0.06)',
                          backgroundColor: bg,
                          overflow: 'hidden',
                        }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: FontWeight.semibold, color: '#fff' }}>
                          {fmtHm(it.startMin)}
                        </Text>
                        {height > 26 ? (
                          <Text numberOfLines={1} style={{ fontSize: 9, color: '#fff', opacity: 0.9 }}>
                            {it.m.prestataire_user_id ? menagePrestataireLabel(it.m) : 'Non assigné'}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScrollView>
  );
}
