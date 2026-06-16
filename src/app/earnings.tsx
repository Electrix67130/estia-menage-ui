import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Wallet, CheckCircle2, Building2, User as UserIcon, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import { usePersistedState } from '@/hooks/usePersistedState';
import SheetHandle from '@/components/SheetHandle';
import { useEarnings, useAdminEarnings } from '@/api/hooks/useEarnings';
import { useUserEarnings, useClientReport } from '@/api/hooks/useUserEarnings';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize, FontWeight, Radius, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { formatDateFr, formatCurrencyFr } from '@/lib/date-fr';

type Granularity = 'week' | 'month' | 'year' | 'all';

const PERIOD_OPTIONS: { key: Granularity; label: string }[] = [
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Année' },
  { key: 'all', label: 'Tout' },
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Bornes + libellé d'une période selon granularité et décalage (0 = courante). */
function computeRange(g: Granularity, offset: number): { from?: string; to?: string; label: string } {
  if (g === 'all') return { label: '' };
  const now = new Date();
  if (g === 'week') {
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return { from: ymd(monday), to: ymd(sunday), label: `${f(monday)} – ${f(sunday)} ${sunday.getFullYear()}` };
  }
  if (g === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return {
      from: ymd(first),
      to: ymd(last),
      label: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  }
  const y = now.getFullYear() + offset;
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
}

export default function EarningsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [granularity, setGranularity] = usePersistedState<Granularity>(
    'earnings.filter.granularity',
    'month',
  );
  const [periodOffset, setPeriodOffset] = useState(0);
  const range = computeRange(granularity, periodOffset);
  const earnings = useEarnings({ from: range.from, to: range.to });
  const adminEarnings = useAdminEarnings({ from: range.from, to: range.to }, isAdmin);
  const [detail, setDetail] = useState<{ kind: 'client' | 'presta'; id: string; name: string } | null>(null);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.title, { color: colors.text }]}>
          {isAdmin ? 'Gains de l\'équipe' : 'Mes gains'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View
          style={[
            styles.totalCard,
            { backgroundColor: colors.primary },
          ]}
        >
          <Wallet size={IconSize.lg} color="#fff" />
          <Text style={styles.totalLabel}>
            {isAdmin ? "Total équipe (coût prestataire)" : 'Total période'}
          </Text>
          {(isAdmin ? adminEarnings.isLoading : earnings.isLoading) ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.totalValue}>
              {formatCurrencyFr(
                (isAdmin ? adminEarnings.data?.total : earnings.data?.total) ?? 0,
                (isAdmin ? adminEarnings.data?.currency : earnings.data?.currency) ?? 'EUR',
              )}
            </Text>
          )}
          <Text style={styles.totalCount}>
            {(isAdmin ? adminEarnings.data?.count : earnings.data?.count) ?? 0} ménage
            {((isAdmin ? adminEarnings.data?.count : earnings.data?.count) ?? 0) > 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.filters}>
          {PERIOD_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => {
                setGranularity(opt.key);
                setPeriodOffset(0);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    granularity === opt.key ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipLabel,
                  {
                    color: granularity === opt.key ? '#fff' : colors.text,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {granularity !== 'all' ? (
          <View style={styles.periodNav}>
            <TouchableOpacity
              onPress={() => setPeriodOffset((o) => o - 1)}
              style={[styles.periodNavBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityLabel="Période précédente"
            >
              <ChevronLeft size={IconSize.md} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.periodNavLabel, { color: colors.text }]} numberOfLines={1}>
              {range.label}
            </Text>
            <TouchableOpacity
              onPress={() => setPeriodOffset((o) => o + 1)}
              style={[styles.periodNavBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
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

        {isAdmin ? (
          <AdminBreakdown
            data={adminEarnings.data}
            loading={adminEarnings.isLoading}
            colors={colors}
            onSelectClient={(c) => setDetail({ kind: 'client', id: c.id, name: c.name })}
            onSelectPresta={(p) => setDetail({ kind: 'presta', id: p.id, name: p.name })}
          />
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text2 }]}>Détail</Text>
            {earnings.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
            ) : earnings.data && earnings.data.items.length > 0 ? (
              earnings.data.items.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemDate, { color: colors.text }]}>
                      {formatDateFr(item.date_prevue, 'long')}
                    </Text>
                    <View style={styles.itemMeta}>
                      {item.validated_at ? (
                        <View style={styles.statusBadge}>
                          <CheckCircle2 size={12} color="#10b981" />
                          <Text style={styles.statusLabel}>Validé</Text>
                        </View>
                      ) : (
                        <Text style={[styles.statusLabelMuted, { color: colors.mutedText }]}>
                          {item.status === 'termine' ? 'Terminé' : item.status}
                        </Text>
                      )}
                      {item.laundry_included ? (
                        <Text style={[styles.itemSub, { color: colors.mutedText }]}>
                          · linge {formatCurrencyFr(item.laundry_provider_price)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text style={[styles.itemAmount, { color: colors.text }]}>
                    {formatCurrencyFr(item.subtotal)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.empty, { color: colors.mutedText }]}>
                Aucun ménage sur cette période.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      <DetailSheet
        detail={detail}
        range={range}
        currency={adminEarnings.data?.currency ?? 'EUR'}
        onClose={() => setDetail(null)}
        colors={colors}
      />
    </SafeAreaView>
  );
}

function DetailSheet({
  detail,
  range,
  currency,
  onClose,
  colors,
}: {
  detail: { kind: 'client' | 'presta'; id: string; name: string } | null;
  range: { from?: string; to?: string };
  currency: string;
  onClose: () => void;
  colors: typeof Colors.light;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const visible = !!detail;
  const isClient = detail?.kind === 'client';
  const isPresta = detail?.kind === 'presta';
  const swipe = useSwipeToClose(onClose, visible);

  const clientReport = useClientReport(
    isClient ? detail.id : undefined,
    { from: range.from ?? '1970-01-01', to: range.to ?? '2999-12-31' },
    isClient,
  );
  const userEarnings = useUserEarnings(isPresta ? detail.id : undefined, range);

  const items: { id: string; date: string; label: string; subtotal: number }[] = isClient
    ? (clientReport.data?.menages ?? []).map((m) => ({
        id: m.id,
        date: m.date_prevue,
        label: m.logement_name ?? m.logement_city ?? 'Logement',
        subtotal:
          Number(m.validated_price ?? m.client_price_ht ?? 0) +
          (m.laundry_included ? Number(m.laundry_client_price_ht ?? 0) : 0),
      }))
    : isPresta
      ? (userEarnings.data?.items ?? []).map((m) => ({
          id: m.id,
          date: m.date_prevue,
          label: '—',
          subtotal: m.subtotal,
        }))
      : [];

  const loading = (isClient && clientReport.isLoading) || (isPresta && userEarnings.isLoading);
  const total = items.reduce((s, x) => s + x.subtotal, 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, Spacing.lg),
              },
              swipe.animatedStyle,
            ]}
          >
            <SheetHandle gesture={swipe.gesture} />
          <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
            {detail?.name}
          </Text>
          <Text style={{ color: colors.mutedText, fontSize: FontSize.xs, marginBottom: Spacing.sm }}>
            {items.length} ménage{items.length > 1 ? 's' : ''} ·{' '}
            {formatCurrencyFr(total, currency)}
          </Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ padding: Spacing.lg }} />
          ) : items.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedText }]}>
              Aucun ménage sur cette période.
            </Text>
          ) : (
            <ScrollView
              style={{ maxHeight: 480 }}
              contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.md }}
              showsVerticalScrollIndicator={false}
            >
              {items.map((it) => (
                <TouchableOpacity
                  key={it.id}
                  style={[
                    styles.itemRow,
                    { backgroundColor: colors.itemBackground, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    onClose();
                    router.push(`/menage/${it.id}` as never);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemDate, { color: colors.text }]} numberOfLines={1}>
                      {formatDateFr(it.date.slice(0, 10), 'long')}
                    </Text>
                    {it.label !== '—' ? (
                      <Text style={[styles.itemSub, { color: colors.mutedText }]} numberOfLines={1}>
                        {it.label}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.itemAmount, { color: colors.text }]}>
                    {formatCurrencyFr(it.subtotal, currency)}
                  </Text>
                  <ChevronRight size={IconSize.sm} color={colors.mutedText} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          </Animated.View>
      </View>
    </Modal>
  );
}

function AdminBreakdown({
  data,
  loading,
  colors,
  onSelectClient,
  onSelectPresta,
}: {
  data: import('@/api/hooks/useEarnings').AdminEarnings | undefined;
  loading: boolean;
  colors: typeof Colors.light;
  onSelectClient: (b: { id: string; name: string }) => void;
  onSelectPresta: (b: { id: string; name: string }) => void;
}) {
  if (loading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />;
  }
  if (!data) return null;
  const currency = data.currency ?? 'EUR';

  return (
    <>
      <View style={styles.breakdownHeader}>
        <Building2 size={IconSize.sm} color={colors.text2} />
        <Text style={[styles.sectionTitle, { color: colors.text2, marginTop: 0 }]}>Par client</Text>
      </View>
      {data.by_client.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedText }]}>Aucune donnée.</Text>
      ) : (
        data.by_client.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[styles.itemRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => onSelectClient({ id: b.id, name: b.name })}
            activeOpacity={0.7}
            disabled={b.id === '__no_client__'}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemDate, { color: colors.text }]} numberOfLines={1}>
                {b.name}
              </Text>
              <Text style={[styles.itemSub, { color: colors.mutedText }]}>
                {b.count} ménage{b.count > 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={[styles.itemAmount, { color: colors.text }]}>
              {formatCurrencyFr(b.total, currency)}
            </Text>
            {b.id !== '__no_client__' ? (
              <ChevronRight size={IconSize.sm} color={colors.mutedText} />
            ) : null}
          </TouchableOpacity>
        ))
      )}

      <View style={styles.breakdownHeader}>
        <UserIcon size={IconSize.sm} color={colors.text2} />
        <Text style={[styles.sectionTitle, { color: colors.text2, marginTop: 0 }]}>
          Par prestataire
        </Text>
      </View>
      <Text style={[styles.hint, { color: colors.mutedText }]}>
        Pour un ménage multi-prestataires, le coût est réparti à parts égales.
      </Text>
      {data.by_prestataire.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedText }]}>Aucune donnée.</Text>
      ) : (
        data.by_prestataire.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[styles.itemRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => onSelectPresta({ id: b.id, name: b.name })}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemDate, { color: colors.text }]} numberOfLines={1}>
                {b.name}
              </Text>
              <Text style={[styles.itemSub, { color: colors.mutedText }]}>
                {Number.isInteger(b.count) ? b.count : b.count.toFixed(1)} ménage{b.count > 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={[styles.itemAmount, { color: colors.text }]}>
              {formatCurrencyFr(b.total, currency)}
            </Text>
            <ChevronRight size={IconSize.sm} color={colors.mutedText} />
          </TouchableOpacity>
        ))
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  backBtn: { padding: Spacing.xs },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  totalCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  totalLabel: { color: '#fff', opacity: 0.9, fontSize: FontSize.sm },
  totalValue: { color: '#fff', fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  totalCount: { color: '#fff', opacity: 0.85, fontSize: FontSize.xs },
  filters: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  filterChipLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  periodNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  periodNavBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
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
  periodNavToday: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  periodNavTodayLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  sectionTitle: {
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  itemDate: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  itemSub: { fontSize: FontSize.xs },
  itemAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  statusLabel: { fontSize: FontSize.xs, color: '#065f46', fontWeight: FontWeight.medium },
  statusLabelMuted: { fontSize: FontSize.xs },
  empty: { textAlign: 'center', marginTop: Spacing.xl, fontSize: FontSize.sm },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  hint: { fontSize: FontSize.xs, marginTop: -Spacing.xs, marginBottom: Spacing.xs },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  sheetHandle: { alignItems: 'center', paddingBottom: Spacing.sm },
  sheetHandleBar: { width: 36, height: 4, borderRadius: 2 },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
