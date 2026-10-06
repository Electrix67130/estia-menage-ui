import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CalendarClock, CheckCircle2, X as XIcon } from 'lucide-react-native';
import { useMyRescheduleRequests, useDecideReschedule } from '@/api/hooks/useReschedule';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize, FontWeight, Radius, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDialog } from '@/contexts/DialogContext';
import { formatDateFr } from '@/lib/date-fr';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';

type Tab = 'pending' | 'all';

const STATUS_KEYS: Record<string, TranslationKeys> = {
  pending: 'reschedule.status.pending',
  approved: 'reschedule.status.approved',
  rejected: 'reschedule.status.rejected',
  cancelled: 'reschedule.status.cancelled',
};

export default function RescheduleRequestsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('pending');
  const list = useMyRescheduleRequests(tab === 'pending' ? 'pending' : undefined);
  const decide = useDecideReschedule();

  const items = list.data?.data ?? [];

  const handleDecide = async (
    id: string,
    decision: 'approved' | 'rejected',
    applyToMenage: boolean,
  ) => {
    try {
      await decide.mutateAsync({ id, decision, apply_to_menage: applyToMenage });
    } catch (err) {
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('common.unknownError'),
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={IconSize.md} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('reschedule.title')}</Text>
      </View>

      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm }}>
        <View style={[styles.tabRow, { backgroundColor: colors.itemBackground }]}>
          {(
            [
              { key: 'pending' as const, label: t('reschedule.tabPending') },
              { key: 'all' as const, label: t('reschedule.tabAll') },
            ]
          ).map((tabItem) => {
            const active = tab === tabItem.key;
            return (
              <TouchableOpacity
                key={tabItem.key}
                style={[
                  styles.tabBtn,
                  { backgroundColor: active ? colors.surface : 'transparent' },
                ]}
                onPress={() => setTab(tabItem.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: active ? colors.text : colors.mutedText,
                      fontWeight: active ? FontWeight.semibold : FontWeight.medium,
                    },
                  ]}
                >
                  {tabItem.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm }}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching}
            onRefresh={() => list.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {list.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <CalendarClock size={36} color={colors.mutedText} />
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              {tab === 'pending' ? t('reschedule.emptyPending') : t('reschedule.emptyAll')}
            </Text>
          </View>
        ) : (
          items.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => router.push(`/menage/${r.menage_id}` as never)}
              activeOpacity={0.7}
            >
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardSub, { color: colors.text2 }]}>{t('reschedule.currentDate')}</Text>
                  <Text style={[styles.cardDate, { color: colors.text }]}>
                    {formatDateFr(r.original_date.slice(0, 10), 'long')}
                  </Text>
                </View>
                <StatusPill status={r.status} colors={colors} />
              </View>
              <View style={{ marginTop: Spacing.sm }}>
                <Text style={[styles.cardSub, { color: colors.text2 }]}>{t('reschedule.proposedDate')}</Text>
                <Text style={[styles.cardDate, { color: colors.primary }]}>
                  {r.proposed_time
                    ? t('reschedule.dateAtTime', {
                        date: formatDateFr(r.proposed_date.slice(0, 10), 'long'),
                        time: r.proposed_time.slice(0, 5),
                      })
                    : formatDateFr(r.proposed_date.slice(0, 10), 'long')}
                </Text>
              </View>
              {r.reason ? (
                <Text style={[styles.reason, { color: colors.text2 }]}>{t('reschedule.quotedReason', { reason: r.reason })}</Text>
              ) : null}
              {r.status === 'pending' ? (
                <View style={[styles.actions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.primary }]}
                    onPress={() => handleDecide(r.id, 'approved', true)}
                    disabled={decide.isPending}
                  >
                    <CheckCircle2 size={14} color="#FFFFFF" />
                    <Text style={styles.btnText}>{t('reschedule.approve')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.red }]}
                    onPress={() => handleDecide(r.id, 'rejected', false)}
                    disabled={decide.isPending}
                  >
                    <XIcon size={14} color="#FFFFFF" />
                    <Text style={styles.btnText}>{t('reschedule.reject')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({
  status,
  colors,
}: {
  status: string;
  colors: typeof Colors.light;
}) {
  const { t } = useTranslation();
  const palette: Record<string, { bg: string; fg: string }> = {
    pending: { bg: colors.statusEnCours + '25', fg: colors.statusEnCours },
    approved: { bg: colors.green + '25', fg: colors.green },
    rejected: { bg: colors.red + '25', fg: colors.red },
    cancelled: { bg: colors.mutedText + '25', fg: colors.mutedText },
  };
  const p = palette[status] ?? { bg: colors.itemBackground, fg: colors.text2 };
  const statusKey = STATUS_KEYS[status];
  const label = statusKey ? t(statusKey) : status;
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <Text style={[styles.pillText, { color: p.fg }]}>{label}</Text>
    </View>
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
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, flexShrink: 1 },
  tabRow: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, gap: 2 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  tabText: { fontSize: FontSize.sm },
  empty: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xxl },
  emptyText: { fontSize: FontSize.sm },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardSub: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  cardDate: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  reason: { fontStyle: 'italic', marginTop: Spacing.sm, fontSize: FontSize.sm },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  btnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  pill: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
  pillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'uppercase' },
});
