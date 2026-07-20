import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMenages } from '@/api/hooks/useMenages';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePersistedState } from '@/hooks/usePersistedState';
import { formatDateFr } from '@/lib/date-fr';
import { DayTimeline } from '@/components/DayTimeline';

const PRESTATAIRE_UNASSIGNED = '__unassigned__';
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const SCREEN_W = Dimensions.get('window').width;
// Bandeau semaine swipeable : on rend N semaines autour de la semaine de départ
// (swipe horizontal = changer de semaine). STRIP_HALF de chaque côté.
const STRIP_HALF = 52;

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

/** Lundi de la semaine contenant la date donnée. */
function mondayOf(iso: string): Date {
  const d = new Date(`${iso}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  return addDays(d, -dow);
}

/** Titre de colonne façon Calendrier Apple : « jeu. — 2 juil. » */
function columnTitle(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const wd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d);
  const dm = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
  return `${wd} — ${dm}`;
}

/**
 * Détail d'un jour du calendrier : page dédiée (pas une modale) façon vue jour
 * de Calendrier Apple — bandeau semaine navigable en haut, titre de colonne, puis
 * timeline horaire des prestations. Applique les filtres persistés du calendrier.
 */
export default function DayScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  // `baseIso` = date d'ouverture (figée) → sert d'ancre au bandeau semaine.
  // `activeDate` = jour affiché (change au tap d'un jour).
  const [baseIso] = useState(() => (date ?? '').slice(0, 10) || isoLocal(new Date()));
  const [activeDate, setActiveDate] = useState(baseIso);

  const { data, isLoading, isRefetching, refetch } = useMenages({ from: activeDate, to: activeDate, limit: 200 });

  const [prestataireFilter] = usePersistedState<string>('calendar.filter.prestataire', '');
  const [logementFilter] = usePersistedState<string>('calendar.filter.logement', '');
  const [typeFilter] = usePersistedState<string>('calendar.filter.type', '');

  const items = useMemo(() => {
    const all = (data?.data ?? []).filter((m) => m.date_prevue.slice(0, 10) === activeDate);
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
  }, [data, activeDate, prestataireFilter, typeFilter, logementFilter]);

  const todayIso = isoLocal(new Date());
  // Lundis des semaines rendues dans le bandeau (autour de la semaine de départ).
  const baseMonday = useMemo(() => mondayOf(baseIso), [baseIso]);
  const weekMondays = useMemo(
    () => Array.from({ length: STRIP_HALF * 2 + 1 }, (_, i) => addDays(baseMonday, (i - STRIP_HALF) * 7)),
    [baseMonday],
  );

  const renderWeek = ({ item: monday }: { item: Date }) => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    return (
      <View style={{ width: SCREEN_W }}>
        <View style={styles.weekStrip}>
          {days.map((d, i) => {
            const iso = isoLocal(d);
            const isSelected = iso === activeDate;
            const isToday = iso === todayIso;
            const isWeekend = i >= 5;
            const numColor = isSelected
              ? '#fff'
              : isToday
                ? colors.primary
                : isWeekend
                  ? colors.mutedText
                  : colors.text;
            return (
              <TouchableOpacity
                key={iso}
                style={styles.weekCell}
                onPress={() => setActiveDate(iso)}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={formatDateFr(iso, 'weekday')}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.weekLetter, { color: colors.text2 }]}>{WEEKDAYS[i]}</Text>
                <View style={[styles.weekPill, isSelected && { backgroundColor: colors.primary }]}>
                  <Text
                    style={{
                      color: numColor,
                      fontSize: FontSize.md,
                      fontWeight: isSelected || isToday ? FontWeight.bold : FontWeight.regular,
                    }}
                  >
                    {d.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header : retour vers le calendrier + mois courant */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backRow}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Retour au calendrier"
      >
        <ChevronLeft size={IconSize.lg} color={colors.primary} />
        <Text style={[styles.backLabel, { color: colors.primary }]}>{formatDateFr(activeDate, 'month')}</Text>
      </TouchableOpacity>

      {/* Bandeau semaine swipeable : swipe horizontal = changer de semaine. */}
      <FlatList
        data={weekMondays}
        renderItem={renderWeek}
        keyExtractor={(m) => isoLocal(m)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={STRIP_HALF}
        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
        style={styles.weekList}
        extraData={activeDate}
      />

      {/* Titre de colonne façon Apple */}
      <View style={[styles.colHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.colTitle, { color: colors.text }]}>{columnTitle(activeDate)}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <DayTimeline items={items} colors={colors} onPressItem={(id) => router.push(`/menage/${id}` as never)} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  backLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.medium, textTransform: 'capitalize' },
  weekList: { flexGrow: 0 },
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },

  weekCell: { flex: 1, alignItems: 'center', gap: 4 },
  weekLetter: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'uppercase' },
  weekPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, textTransform: 'capitalize' },
  empty: { fontSize: FontSize.sm, marginTop: Spacing.md },
});
