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

  const { from, to } = useMemo(() => monthRange(cursor), [cursor]);
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
  // Séjours = barres multi-jours (check-in → check-out), pour la grille mensuelle.
  const spans = useMemo(() => buildSpans(filteredMenages), [filteredMenages]);
  // Vue « séjours » (barres) vs vue classique (pastilles). Classique par défaut.
  const [spanView, setSpanView] = usePersistedState<boolean>('calendar.spanView', false);
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
          onPress={() => setCursor(addMonths(cursor, -1))}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={styles.monthNavBtn}
          accessibilityRole="button"
          accessibilityLabel="Mois précédent"
        >
          <ChevronLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>
          {formatDateFr(cursor, 'month')}
        </Text>
        <TouchableOpacity
          onPress={() => setCursor(addMonths(cursor, 1))}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={styles.monthNavBtn}
          accessibilityRole="button"
          accessibilityLabel="Mois suivant"
        >
          <ChevronRight size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekToggleRow}>
        <Text style={[styles.weekToggleLabel, { color: colors.text2 }]}>Vue séjours</Text>
        <Switch value={spanView} onValueChange={setSpanView} trackColor={{ true: colors.primary }} />
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

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.weekdayLabel, { color: colors.text2 }]}>
            {d}
          </Text>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : spanView ? (
        <MonthSpanGridMobile
          days={days}
          spans={spans}
          colors={colors}
          todayIso={todayIso}
          selectedDate={selectedDate}
          onSelectDay={setSelectedDate}
        />
      ) : (
        <MonthClassicGridMobile
          days={days}
          byDate={byDate}
          colors={colors}
          todayIso={todayIso}
          selectedDate={selectedDate}
          onSelectDay={setSelectedDate}
        />
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


// ---------- Barres de séjour (grille mensuelle) ----------

const SPAN_LANE_H = 18;
const MAX_LANES = 3;
const SPAN_GAP = 0.03; // retrait (fraction de journée) sur les extrémités réelles d'une barre → petit espace entre deux prestations

interface Span {
  key: string;
  startIso: string;
  endIso: string;
  color: string;
  isStay: boolean;
  needsAttention: boolean;
  hasCheckIn: boolean;
  /** 'stay' (séjour iCal) ou le type de la presta (géométrie demi-journée). */
  kind: 'stay' | 'menage' | 'check_in' | 'check_out';
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

function dayIndex(iso: string): number {
  return Math.round(new Date(`${iso}T00:00:00Z`).getTime() / 86400000);
}

/**
 * Regroupe ménage / check-in / check-out d'une même réservation (external_event_uid)
 * en un séjour ; les ménages manuels (sans uid) deviennent des événements 1 jour.
 */
function buildSpans(menages: Menage[]): Span[] {
  const groups = new Map<string, Menage[]>();
  const singles: Menage[] = [];
  for (const m of menages) {
    if (m.external_event_uid) {
      const arr = groups.get(m.external_event_uid) ?? [];
      arr.push(m);
      groups.set(m.external_event_uid, arr);
    } else {
      singles.push(m);
    }
  }

  const spans: Span[] = [];
  for (const rows of groups.values()) {
    const menage = rows.find((r) => r.prestation_type === 'menage');
    const checkIn = rows.find((r) => r.prestation_type === 'check_in');
    const checkOut = rows.find((r) => r.prestation_type === 'check_out');
    const anchor = menage ?? checkOut ?? checkIn ?? rows[0];
    const endIso = (checkOut ?? menage ?? anchor).date_prevue.slice(0, 10);
    let startIso: string;
    if (checkIn) startIso = checkIn.date_prevue.slice(0, 10);
    else if (menage?.stay_nights) startIso = isoLocal(addDays(new Date(`${endIso}T00:00:00`), -menage.stay_nights));
    else startIso = endIso;
    spans.push({
      key: anchor.id,
      startIso,
      endIso,
      color: anchor.logement_color ?? STATUS_COLOR[anchor.status],
      isStay: startIso < endIso,
      needsAttention: rows.some((r) => !!r.needs_attention),
      hasCheckIn: !!checkIn,
      kind: 'stay',
    });
  }

  for (const m of singles) {
    const endIso = m.date_prevue.slice(0, 10);
    const startIso = m.stay_nights
      ? isoLocal(addDays(new Date(`${endIso}T00:00:00`), -m.stay_nights))
      : endIso;
    spans.push({
      key: m.id,
      startIso,
      endIso,
      color: m.logement_color ?? STATUS_COLOR[m.status],
      isStay: startIso < endIso,
      needsAttention: !!m.needs_attention,
      hasCheckIn: m.prestation_type === 'check_in',
      kind: m.prestation_type,
    });
  }
  return spans.sort((a, b) => a.startIso.localeCompare(b.startIso) || a.endIso.localeCompare(b.endIso));
}

/**
 * Grille mensuelle : chaque séjour = une barre colorée s'étendant du check-in au
 * check-out. Demi-journées aux extrémités (turnover côte à côte) ; un ménage 1
 * jour se scinde aussi s'il partage sa date avec un check-in. Tap une case →
 * sélectionne le jour (le détail s'affiche dessous).
 */
function MonthSpanGridMobile({
  days,
  spans,
  colors,
  todayIso,
  selectedDate,
  onSelectDay,
}: {
  days: { date: Date; inMonth: boolean }[];
  spans: Span[];
  colors: (typeof Colors)['light'];
  todayIso: string;
  selectedDate: string | null;
  onSelectDay: (iso: string) => void;
}) {
  const weeks: { date: Date; inMonth: boolean }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  // Occupation des demi-journées par jour : matin = check-out / départ de séjour ;
  // après-midi = check-in / arrivée de séjour ; jours intermédiaires = journée pleine.
  const amClaimed = new Set<number>();
  const pmClaimed = new Set<number>();
  for (const s of spans) {
    const si = dayIndex(s.startIso);
    const ei = dayIndex(s.endIso);
    if (s.isStay) {
      pmClaimed.add(si);
      amClaimed.add(ei);
      for (let d = si + 1; d < ei; d++) {
        amClaimed.add(d);
        pmClaimed.add(d);
      }
    } else if (s.kind === 'check_in') {
      pmClaimed.add(si);
    } else if (s.kind === 'check_out') {
      amClaimed.add(si);
    }
  }

  // Un ménage 1 jour ne prend toute la journée que s'il est seul ce jour-là ;
  // sinon il se cale sur la moitié libre (deux ménages → matin / après-midi).
  const menageHalf = new Map<string, 'am' | 'pm' | 'full'>();
  const menagesByDay = new Map<number, Span[]>();
  for (const s of spans) {
    if (s.isStay || s.kind !== 'menage') continue;
    const d = dayIndex(s.startIso);
    const arr = menagesByDay.get(d) ?? [];
    arr.push(s);
    menagesByDay.set(d, arr);
  }
  for (const list of menagesByDay.values()) {
    const d = dayIndex(list[0].startIso);
    let am = amClaimed.has(d);
    let pm = pmClaimed.has(d);
    for (const s of list) {
      if (pm && !am) {
        menageHalf.set(s.key, 'am');
        am = true;
      } else if (am && !pm) {
        menageHalf.set(s.key, 'pm');
        pm = true;
      } else if (!am && !pm && list.length > 1) {
        menageHalf.set(s.key, 'am');
        am = true;
      } else {
        menageHalf.set(s.key, 'full');
      }
    }
  }

  const geom = (s: Span) => {
    const si = dayIndex(s.startIso);
    const ei = dayIndex(s.endIso);
    if (s.isStay) return { si, ei, lo: si + 0.5, hi: ei + 0.5 };
    if (s.kind === 'check_in') return { si, ei, lo: si + 0.5, hi: si + 1 };
    if (s.kind === 'check_out') return { si, ei, lo: si, hi: si + 0.5 };
    const half = menageHalf.get(s.key) ?? 'full';
    if (half === 'am') return { si, ei, lo: si, hi: si + 0.5 };
    if (half === 'pm') return { si, ei, lo: si + 0.5, hi: si + 1 };
    return { si, ei, lo: si, hi: si + 1 };
  };

  return (
    <View>
      {weeks.map((week, wi) => {
        const w0 = dayIndex(isoLocal(week[0].date));
        const w6 = w0 + 6;
        const inWeek = spans
          .map((s) => ({ s, g: geom(s) }))
          .filter(({ g }) => g.hi > w0 && g.lo < w6 + 1)
          // Tri par position (lo puis hi) : le first-fit remet côte à côte un
          // matin + un après-midi du même jour (turnover) sans les empiler.
          .sort((a, b) => a.g.lo - b.g.lo || a.g.hi - b.g.hi);
        const laneHi: number[] = [];
        const laneOf = new Map<string, number>();
        for (const { s, g } of inWeek) {
          let lane = laneHi.findIndex((hi) => hi <= g.lo);
          if (lane === -1) {
            lane = laneHi.length;
            laneHi.push(0);
          }
          laneHi[lane] = g.hi;
          laneOf.set(s.key, lane);
        }
        const laneCount = Math.min(laneHi.length, MAX_LANES);

        return (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((cell, di) => {
              const dayIdx = w0 + di;
              const iso = isoLocal(cell.date);
              const isToday = iso === todayIso;
              const isSelected = iso === selectedDate;
              const hidden = inWeek.filter(
                ({ s, g }) => g.lo < dayIdx + 1 && g.hi > dayIdx && (laneOf.get(s.key) ?? 0) >= MAX_LANES,
              ).length;
              return (
                <TouchableOpacity
                  key={iso}
                  activeOpacity={0.6}
                  onPress={() => onSelectDay(iso)}
                  style={{
                    flex: 1,
                    paddingBottom: 3,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    backgroundColor: isSelected ? colors.itemBackground : 'transparent',
                  }}
                >
                  <View style={{ alignItems: 'center', paddingTop: 3 }}>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isToday ? colors.primary : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: FontSize.xs,
                          fontWeight: isToday ? FontWeight.bold : FontWeight.regular,
                          color: isToday ? '#fff' : cell.inMonth ? colors.text : colors.mutedText,
                        }}
                      >
                        {cell.date.getDate()}
                      </Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 2 }}>
                    {Array.from({ length: laneCount }).map((_, lane) => {
                      // Toutes les barres du couloir touchant ce jour : un turnover en
                      // pose deux (départ le matin + arrivée l'après-midi) → filter, pas find.
                      const hits = inWeek.filter(
                        ({ s, g }) => laneOf.get(s.key) === lane && g.lo < dayIdx + 1 && g.hi > dayIdx,
                      );
                      if (hits.length === 0)
                        return <View key={lane} style={{ height: SPAN_LANE_H, marginBottom: 1 }} />;
                      return (
                        <View key={lane} style={{ height: SPAN_LANE_H, marginBottom: 1 }}>
                          {hits.map(({ s, g }) => {
                            const segLo = Math.max(g.lo, dayIdx);
                            const segHi = Math.min(g.hi, dayIdx + 1);
                            const roundLeft = segLo === g.lo;
                            const roundRight = segHi === g.hi;
                            // Petit retrait aux extrémités réelles → espace entre 2 prestations.
                            const dispLo = segLo + (roundLeft ? SPAN_GAP : 0);
                            const dispHi = segHi - (roundRight ? SPAN_GAP : 0);
                            return (
                              <View
                                key={s.key}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  left: `${(dispLo - dayIdx) * 100}%`,
                                  width: `${(dispHi - dispLo) * 100}%`,
                                  backgroundColor: s.color,
                                  borderTopLeftRadius: roundLeft ? 4 : 0,
                                  borderBottomLeftRadius: roundLeft ? 4 : 0,
                                  borderTopRightRadius: roundRight ? 4 : 0,
                                  borderBottomRightRadius: roundRight ? 4 : 0,
                                  borderWidth: s.needsAttention ? 1 : 0,
                                  borderColor: s.needsAttention ? '#EF4444' : 'transparent',
                                }}
                              />
                            );
                          })}
                        </View>
                      );
                    })}
                    {hidden > 0 ? (
                      <Text style={{ fontSize: 8, color: colors.mutedText, textAlign: 'center' }}>+{hidden}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/** Vue mensuelle classique : numéro du jour + pastilles (jusqu'à 3) par jour. */
function MonthClassicGridMobile({
  days,
  byDate,
  colors,
  todayIso,
  selectedDate,
  onSelectDay,
}: {
  days: { date: Date; inMonth: boolean }[];
  byDate: Map<string, Menage[]>;
  colors: (typeof Colors)['light'];
  todayIso: string;
  selectedDate: string | null;
  onSelectDay: (iso: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {days.map(({ date, inMonth }) => {
        const iso = isoLocal(date);
        const items = byDate.get(iso) ?? [];
        const isToday = iso === todayIso;
        const isSelected = iso === selectedDate;
        return (
          <TouchableOpacity key={iso} style={styles.dayCell} onPress={() => onSelectDay(iso)} activeOpacity={0.6}>
            <View
              style={[
                styles.dayCircle,
                isToday && { backgroundColor: colors.primary },
                isSelected && !isToday && { backgroundColor: colors.itemBackground },
              ]}
            >
              <Text
                style={{
                  color: isToday ? '#fff' : inMonth ? colors.text : colors.mutedText,
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
                  style={[styles.dot, { backgroundColor: m.logement_color ?? STATUS_COLOR[m.status] }]}
                />
              ))}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
