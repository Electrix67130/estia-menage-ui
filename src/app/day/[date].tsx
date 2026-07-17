import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMenages } from '@/api/hooks/useMenages';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePersistedState } from '@/hooks/usePersistedState';
import { formatDateFr } from '@/lib/date-fr';
import { DayTimeline } from '@/components/DayTimeline';

const PRESTATAIRE_UNASSIGNED = '__unassigned__';

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Détail d'un jour du calendrier : page dédiée (pas une modale) affichant la
 * timeline horaire des prestations du jour. Applique les mêmes filtres persistés
 * que le calendrier (type / logement / prestataire) pour rester cohérent.
 */
export default function DayScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const dateIso = (date ?? '').slice(0, 10);

  const { data, isLoading, isRefetching, refetch } = useMenages({ from: dateIso, to: dateIso, limit: 200 });

  const [prestataireFilter] = usePersistedState<string>('calendar.filter.prestataire', '');
  const [logementFilter] = usePersistedState<string>('calendar.filter.logement', '');
  const [typeFilter] = usePersistedState<string>('calendar.filter.type', '');

  const items = useMemo(() => {
    const all = (data?.data ?? []).filter((m) => m.date_prevue.slice(0, 10) === dateIso);
    return all
      .filter((m) => {
        if (prestataireFilter === PRESTATAIRE_UNASSIGNED) {
          if (m.prestataire_user_id) return false;
        } else if (prestataireFilter) {
          if (m.prestataire_user_id !== prestataireFilter) return false;
        }
        if (typeFilter && m.prestation_type !== typeFilter) return false;
        if (logementFilter && m.logement_id !== logementFilter) return false;
        return true;
      })
      .sort((a, b) => (a.horaire_prevu ?? '99:99').localeCompare(b.horaire_prevu ?? '99:99'));
  }, [data, dateIso, prestataireFilter, typeFilter, logementFilter]);

  const isToday = dateIso === isoLocal(new Date());

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
        <Text style={[styles.title, { color: isToday ? colors.primary : colors.text }]} numberOfLines={1}>
          {dateIso ? formatDateFr(dateIso, 'long') : ''}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.sm,
            paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {items.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedText }]}>Aucune prestation ce jour.</Text>
          ) : (
            <DayTimeline items={items} colors={colors} onPressItem={(id) => router.push(`/menage/${id}` as never)} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, textTransform: 'capitalize', flexShrink: 1 },
  empty: { fontSize: FontSize.sm, marginTop: Spacing.md },
});
