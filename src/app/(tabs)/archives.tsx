import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePersistedState } from '@/hooks/usePersistedState';
import AppHeader from '@/components/AppHeader';
import MenageCard from '@/components/MenageCard';
import { useMenages } from '@/api/hooks/useMenages';
import { useAuth } from '@/contexts/AuthContext';
import { menageLogementLabel } from '@/api/types';
import { useTranslation } from '@/contexts/I18nContext';
import { INTL_LOCALES } from '@/i18n/runtime';
import type { TranslationKeys } from '@/i18n/translations';

type StatusFilter = 'all' | 'valide' | 'annule';
type Granularity = 'week' | 'month' | 'year' | 'all';

const STATUSES: { key: StatusFilter; labelKey: TranslationKeys }[] = [
  { key: 'all', labelKey: 'common.all' },
  { key: 'valide', labelKey: 'archives.statusValidated' },
  { key: 'annule', labelKey: 'archives.statusCancelled' },
];
const GRANULARITIES: { key: Granularity; labelKey: TranslationKeys }[] = [
  { key: 'week', labelKey: 'archives.periodWeek' },
  { key: 'month', labelKey: 'archives.periodMonth' },
  { key: 'year', labelKey: 'archives.periodYear' },
  { key: 'all', labelKey: 'archives.periodAll' },
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ArchivesScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t, locale } = useTranslation();

  const [statusFilter, setStatusFilter] = usePersistedState<StatusFilter>('archives.filter.status', 'all');
  const [granularity, setGranularity] = usePersistedState<Granularity>('archives.filter.period', 'all');
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');

  const period = useMemo<{ from?: string; to?: string; label: string }>(() => {
    if (granularity === 'all') return { label: '' };
    const now = new Date();
    if (granularity === 'week') {
      const dow = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - dow + offset * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const f = (d: Date) => new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'short' }).format(d);
      return { from: ymd(monday), to: ymd(sunday), label: `${f(monday)} – ${f(sunday)}` };
    }
    if (granularity === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
      return {
        from: ymd(first),
        to: ymd(last),
        label: new Intl.DateTimeFormat(INTL_LOCALES[locale], { month: 'long', year: 'numeric' }).format(first),
      };
    }
    const y = now.getFullYear() + offset;
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  }, [granularity, offset, locale]);

  const list = useMenages({
    closed: true,
    status: statusFilter === 'all' ? undefined : statusFilter,
    // Un prestataire ne voit ici que les prestations qu'il a réellement faites
    // (référent ou co-presta) — pas celles restées non assignées sur ses
    // logements, que l'API lui montre par ailleurs pour qu'il puisse les
    // prendre. L'admin garde la vue complète.
    assigned: isAdmin ? undefined : 'me',
    from: period.from,
    to: period.to,
    limit: 200,
  });

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const data = list.data?.data ?? [];
    if (!q) return data;
    return data.filter(
      (m) =>
        menageLogementLabel(m).toLowerCase().includes(q) ||
        (m.logement_city ?? '').toLowerCase().includes(q) ||
        (m.prestataire_first_name ?? '').toLowerCase().includes(q) ||
        (m.prestataire_last_name ?? '').toLowerCase().includes(q),
    );
  }, [list.data, search]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <AppHeader>
        <Text style={[styles.title, { color: colors.text }]}>{t('archives.title')}</Text>
      </AppHeader>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        refreshControl={
          <RefreshControl refreshing={list.isRefetching} onRefresh={list.refetch} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListHeaderComponent={
          <View style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
            <View style={[styles.searchRow, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}>
              <Search size={IconSize.sm} color={colors.mutedText} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('archives.searchPlaceholder')}
                placeholderTextColor={colors.placeholder}
                value={search}
                onChangeText={setSearch}
                accessibilityLabel={t('archives.search')}
              />
            </View>
            <View style={styles.pillRow}>
              {STATUSES.map((s) => {
                const active = statusFilter === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.pill, { backgroundColor: active ? colors.primary : colors.itemBackground, borderColor: active ? colors.primary : colors.border }]}
                    onPress={() => setStatusFilter(s.key)}
                  >
                    <Text style={[styles.pillText, { color: active ? '#FFFFFF' : colors.text2, fontWeight: active ? FontWeight.semibold : FontWeight.medium }]}>
                      {t(s.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.pillRow}>
              {GRANULARITIES.map((p) => {
                const active = granularity === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.pill, { backgroundColor: active ? colors.primary : colors.itemBackground, borderColor: active ? colors.primary : colors.border }]}
                    onPress={() => {
                      setGranularity(p.key);
                      setOffset(0);
                    }}
                  >
                    <Text style={[styles.pillText, { color: active ? '#FFFFFF' : colors.text2, fontWeight: active ? FontWeight.semibold : FontWeight.medium }]}>
                      {t(p.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {granularity !== 'all' ? (
              <View style={styles.periodNav}>
                <TouchableOpacity onPress={() => setOffset((o) => o - 1)} style={styles.periodNavBtn} accessibilityLabel={t('archives.prevPeriod')}>
                  <ChevronLeft size={IconSize.md} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.periodNavLabel, { color: colors.text }]} numberOfLines={1}>{period.label}</Text>
                <TouchableOpacity onPress={() => setOffset((o) => o + 1)} style={styles.periodNavBtn} accessibilityLabel={t('archives.nextPeriod')}>
                  <ChevronRight size={IconSize.md} color={colors.text} />
                </TouchableOpacity>
                {offset !== 0 ? (
                  <TouchableOpacity onPress={() => setOffset(0)} style={styles.periodNavToday}>
                    <Text style={[styles.periodNavTodayLabel, { color: colors.primary }]}>{t('common.today')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <MenageCard menage={item} onPress={(id) => router.push(`/menage/${id}`)} />
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={[styles.empty, { color: colors.mutedText }]}>{t('archives.emptyFiltered')}</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: FontSize.xxl, fontWeight: '700' as const },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xxxl },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 42 },
  searchInput: { flex: 1, fontSize: FontSize.base, paddingVertical: 0 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  pill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, borderWidth: 1 },
  pillText: { fontSize: FontSize.sm },
  periodNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  periodNavBtn: { padding: Spacing.xs },
  periodNavLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, textAlign: 'center', minWidth: 150, textTransform: 'capitalize' },
  periodNavToday: { paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  periodNavTodayLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxxl },
  empty: { fontSize: FontSize.md, textAlign: 'center' },
});
