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
import { useRouter } from 'expo-router';
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMenages, useRestoreMenage } from '@/api/hooks/useMenages';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/contexts/DialogContext';
import { prestationTypeLabel, prestationTypeColorKey } from '@/api/types';
import type { Menage } from '@/api/types';
import { formatDateFr } from '@/lib/date-fr';
import { PAST_WINDOW_DAYS, ymdLocal } from '@/lib/prestations';

type HistFilter = 'all' | 'valide' | 'annule' | 'untreated';

const FILTERS: { key: HistFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'valide', label: 'Validés' },
  { key: 'annule', label: 'Annulés' },
  { key: 'untreated', label: 'Non traitées' },
];

/** Non clôturée (jamais validée / jamais pointée) : « oubliée », rangée ici passé
 *  la fenêtre du chip « Passées » pour que rien ne se perde. */
function isUntreated(m: Menage): boolean {
  return m.status !== 'valide' && m.status !== 'annule';
}

/**
 * Liste de l'Historique : clôturées (validées / annulées / retirées) + « oubliées »
 * (non clôturées de plus de 30 j), un mois à la fois. Utilisée par l'écran
 * /historique et par la vue « Historique » des listes admin et prestataire.
 */
export default function HistoriqueList() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { confirm } = useDialog();
  const [filter, setFilter] = useState<HistFilter>('all');
  // Un mois à la fois : l'Historique grandit sans fin, une fenêtre glissante le
  // garde lisible (et sous la limite de 200 lignes par appel de l'API).
  const [monthOffset, setMonthOffset] = useState(0);
  const month = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const last = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
    return {
      from: ymdLocal(first),
      to: ymdLocal(last),
      label: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  }, [monthOffset]);
  // Au-delà de la fenêtre du chip « Passées », une non clôturée est « oubliée » :
  // elle apparaît ici (étiquette « Non traitée ») au lieu de disparaître.
  const staleBefore = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - PAST_WINDOW_DAYS);
    return ymdLocal(d);
  }, []);

  // Prestations clôturées (validé/annulé) — c'est là que vivent les retirées —
  // plus les non clôturées « oubliées » (voir `stale_before`).
  // Presta : ne voir que les prestations qu'il a réellement faites (affecté),
  // pas toutes celles des logements dont il est membre. Admin : vue complète.
  const { data, isLoading, isRefetching, refetch } = useMenages({
    closed: true,
    stale_before: staleBefore,
    from: month.from,
    to: month.to,
    limit: 200,
    ...(isAdmin ? {} : { assigned: 'me' }),
  });
  const restore = useRestoreMenage();

  const items = useMemo(() => {
    const list = (data?.data ?? []).filter((m) => {
      if (filter === 'all') return true;
      if (filter === 'untreated') return isUntreated(m);
      return m.status === filter;
    });
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
    const untreated = isUntreated(item);
    const statusColor = item.status === 'valide' ? colors.statusValide : untreated ? colors.statusEnCours : colors.mutedText;
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
              {item.status === 'valide'
                ? 'Validé'
                : untreated
                  ? item.status === 'termine'
                    ? 'Non traitée · à valider'
                    : 'Non traitée · jamais pointée'
                  : 'Annulé'}
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
    <View style={styles.container}>
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

      <View style={styles.monthNav}>
        <TouchableOpacity
          onPress={() => setMonthOffset((o) => o - 1)}
          style={[styles.monthNavBtn, { backgroundColor: colors.itemBackground }]}
          accessibilityLabel="Mois précédent"
        >
          <ChevronLeft size={IconSize.md} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthNavLabel, { color: colors.text }]} numberOfLines={1}>
          {month.label}
        </Text>
        <TouchableOpacity
          onPress={() => setMonthOffset((o) => o + 1)}
          style={[styles.monthNavBtn, { backgroundColor: colors.itemBackground }]}
          disabled={monthOffset >= 0}
          accessibilityLabel="Mois suivant"
        >
          <ChevronRight size={IconSize.md} color={monthOffset >= 0 ? colors.mutedText : colors.text} />
        </TouchableOpacity>
        {monthOffset !== 0 ? (
          <TouchableOpacity onPress={() => setMonthOffset(0)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.monthNavToday, { color: colors.primary }]}>Ce mois</Text>
          </TouchableOpacity>
        ) : null}
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
              {filter === 'untreated' ? 'Aucune prestation non traitée ce mois-ci.' : 'Aucune prestation clôturée ce mois-ci.'}
            </Text>
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  monthNavBtn: { width: 34, height: 34, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  monthNavLabel: { flex: 1, textAlign: 'center', fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  monthNavToday: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
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
