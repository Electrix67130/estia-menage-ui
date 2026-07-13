import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMenages, useRestoreMenage } from '@/api/hooks/useMenages';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/contexts/DialogContext';
import { prestationTypeLabel, prestationTypeColorKey } from '@/api/types';
import type { Menage } from '@/api/types';
import { formatDateFr } from '@/lib/date-fr';

type HistFilter = 'all' | 'valide' | 'annule';

const FILTERS: { key: HistFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'valide', label: 'Validés' },
  { key: 'annule', label: 'Annulés' },
];

export default function HistoriqueScreen() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { confirm } = useDialog();
  const [filter, setFilter] = useState<HistFilter>('all');

  // Prestations clôturées (validé/annulé) — c'est là que vivent les retirées.
  // Presta : ne voir que les prestations qu'il a réellement faites (affecté),
  // pas toutes celles des logements dont il est membre. Admin : vue complète.
  const { data, isLoading, isRefetching, refetch } = useMenages({
    closed: true,
    limit: 200,
    ...(isAdmin ? {} : { assigned: 'me' }),
  });
  const restore = useRestoreMenage();

  const items = useMemo(() => {
    const list = (data?.data ?? []).filter((m) => (filter === 'all' ? true : m.status === filter));
    return list
      .slice()
      .sort((a, b) => b.date_prevue.localeCompare(a.date_prevue));
  }, [data, filter]);

  const handleRestore = async (m: Menage) => {
    const ok = await confirm({
      title: 'Remettre cette prestation ?',
      message: 'Elle repassera en « à venir » et la synchronisation la reprendra normalement.',
      confirmLabel: 'Remettre',
    });
    if (ok) await restore.mutateAsync(m.id);
  };

  const renderItem = ({ item }: { item: Menage }) => {
    const typeColor = colors[prestationTypeColorKey(item.prestation_type)];
    const statusColor = item.status === 'valide' ? colors.statusValide : colors.mutedText;
    const isRetired = !!item.sync_ignored;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/menage/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text style={[styles.date, { color: colors.text }]}>
              {formatDateFr(item.date_prevue.slice(0, 10), 'weekday')}
            </Text>
            <View style={[styles.typeTag, { backgroundColor: typeColor + '20' }]}>
              <Text style={[styles.typeTagText, { color: typeColor }]}>
                {prestationTypeLabel(item.prestation_type)}
              </Text>
            </View>
          </View>
          {item.logement_name ? (
            <Text style={[styles.sub, { color: colors.mutedText }]} numberOfLines={1}>
              {item.logement_name}
              {item.logement_city ? ` · ${item.logement_city}` : ''}
            </Text>
          ) : null}
          <View style={styles.row}>
            <Text style={[styles.status, { color: statusColor }]}>
              {item.status === 'valide' ? 'Validé' : 'Annulé'}
            </Text>
            {isRetired ? (
              <Text style={[styles.retiredTag, { color: colors.mutedText }]}>· Retirée (auto)</Text>
            ) : null}
          </View>
        </View>
        {isAdmin && isRetired ? (
          <TouchableOpacity
            style={[styles.restoreBtn, { borderColor: colors.primary }]}
            onPress={() => handleRestore(item)}
            disabled={restore.isPending}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <RotateCcw size={14} color={colors.primary} />
            <Text style={[styles.restoreText, { color: colors.primary }]}>Remettre</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Historique</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary + '20' : colors.itemBackground,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.primary : colors.text2 }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          ListEmptyComponent={
            <Text style={{ color: colors.mutedText, textAlign: 'center', marginTop: Spacing.xl }}>
              Aucune prestation clôturée.
            </Text>
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  filters: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  date: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  typeTag: { paddingHorizontal: Spacing.sm, paddingVertical: 1, borderRadius: Radius.pill },
  typeTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  sub: { fontSize: FontSize.sm, marginTop: 2 },
  status: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  retiredTag: { fontSize: FontSize.sm },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  restoreText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
