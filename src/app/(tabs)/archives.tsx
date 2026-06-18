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
import { menageLogementLabel } from '@/api/types';

type StatusFilter = 'all' | 'valide' | 'annule';
type Granularity = 'week' | 'month' | 'year' | 'all';

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'valide', label: 'Validés' },
  { key: 'annule', label: 'Annulés' },
];
const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Année' },
  { key: 'all', label: 'Tout' },
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ArchivesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();

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
      const f = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      return { from: ymd(monday), to: ymd(sunday), label: `${f(monday)} – ${f(sunday)}` };
    }
    if (granularity === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
      return { from: ymd(first), to: ymd(last), label: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) };
    }
    const y = now.getFullYear() + offset;
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  }, [granularity, offset]);

  const list = useMenages({
    closed: true,
    status: statusFilter === 'all' ? undefined : statusFilter,
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
        <Text style={[styles.title, { color: colors.text }]}>Archives</Text>
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
                placeholder="Logement, ville, prestataire…"
                placeholderTextColor={colors.placeholder}
                value={search}
                onChangeText={setSearch}
                accessibilityLabel="Rechercher dans les archives"
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
                      {s.label}
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
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {granularity !== 'all' ? (
              <View style={styles.periodNav}>
                <TouchableOpacity onPress={() => setOffset((o) => o - 1)} style={styles.periodNavBtn} accessibilityLabel="Période précédente">
                  <ChevronLeft size={IconSize.md} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.periodNavLabel, { color: colors.text }]} numberOfLines={1}>{period.label}</Text>
                <TouchableOpacity onPress={() => setOffset((o) => o + 1)} style={styles.periodNavBtn} accessibilityLabel="Période suivante">
                  <ChevronRight size={IconSize.md} color={colors.text} />
                </TouchableOpacity>
                {offset !== 0 ? (
                  <TouchableOpacity onPress={() => setOffset(0)} style={styles.periodNavToday}>
                    <Text style={[styles.periodNavTodayLabel, { color: colors.primary }]}>Aujourd&apos;hui</Text>
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
              <Text style={[styles.empty, { color: colors.mutedText }]}>Aucun ménage clôturé sur ces critères.</Text>
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
