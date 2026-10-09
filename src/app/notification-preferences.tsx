import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, BellOff } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  useNotificationPreferences,
  useSetLogementNotificationLevel,
  useUpdateNotificationPreference,
  type NotificationPreferenceKey,
} from '@/api/hooks/useNotificationPreferences';
import { useTranslation } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import type { TranslationKeys } from '@/i18n/translations';

/** Dans l'ordre affiché ; les signalements ne concernent que les admins. */
const PREFERENCES: { key: NotificationPreferenceKey; labelKey: TranslationKeys; adminOnly?: boolean }[] = [
  { key: 'mentions', labelKey: 'notifPrefs.category.mentions' },
  { key: 'assignment', labelKey: 'notifPrefs.category.assignment' },
  { key: 'available', labelKey: 'notifPrefs.category.available' },
  { key: 'reminders', labelKey: 'notifPrefs.category.reminders' },
  { key: 'reschedule', labelKey: 'notifPrefs.category.reschedule' },
  { key: 'presence', labelKey: 'notifPrefs.category.presence' },
  { key: 'pointage', labelKey: 'notifPrefs.category.pointage' },
  { key: 'validation', labelKey: 'notifPrefs.category.validation' },
  { key: 'comments', labelKey: 'notifPrefs.category.comments' },
  { key: 'consumables', labelKey: 'notifPrefs.category.consumables' },
  { key: 'invitations', labelKey: 'notifPrefs.category.invitations' },
  { key: 'reports', labelKey: 'notifPrefs.category.reports', adminOnly: true },
];

export default function NotificationPreferencesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { data, isLoading } = useNotificationPreferences();
  const updatePreference = useUpdateNotificationPreference();
  const setLogementLevel = useSetLogementNotificationLevel();
  const { user } = useAuth();
  const preferences = PREFERENCES.filter((p) => !p.adminOnly || user?.role === 'admin');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {t('profile.notifications')}
        </Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      {isLoading || !data ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.hint, { color: colors.mutedText }]}>
            {t('notifPrefs.hint')}
          </Text>

          {/* Interrupteur général : coupe tout, mentions comprises. */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={styles.labelBlock}>
                <Text style={[styles.label, { color: colors.text }]}>{t('notifPrefs.push')}</Text>
                <Text style={[styles.sub, { color: colors.mutedText }]}>{t('notifPrefs.pushDesc')}</Text>
              </View>
              <Switch
                value={data.push_enabled}
                onValueChange={(enabled) => updatePreference.mutate({ push_enabled: enabled })}
                trackColor={{ false: colors.border, true: colors.primary }}
                accessibilityLabel={t('notifPrefs.push')}
              />
            </View>
          </View>

          <Text style={[styles.section, { color: colors.mutedText }]}>{t('notifPrefs.byType').toUpperCase()}</Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
              !data.push_enabled && styles.dimmed,
            ]}
          >
            {preferences.map((pref, index) => (
              <View
                key={pref.key}
                style={[
                  styles.row,
                  index < preferences.length - 1 ? { borderBottomWidth: 1, borderColor: colors.border } : null,
                ]}
              >
                <Text style={[styles.label, { color: colors.text }]}>{t(pref.labelKey)}</Text>
                <Switch
                  value={data[pref.key]}
                  disabled={!data.push_enabled}
                  onValueChange={(enabled) => updatePreference.mutate({ key: pref.key, enabled })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  accessibilityLabel={t(pref.labelKey)}
                />
              </View>
            ))}
          </View>

          <Text style={[styles.section, { color: colors.mutedText }]}>{t('notifPrefs.byLogement').toUpperCase()}</Text>
          {data.logements.length === 0 ? (
            <Text style={[styles.hint, { color: colors.mutedText }]}>{t('notifPrefs.noLogement')}</Text>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {data.logements.map((l, index) => (
                <View
                  key={l.logement_id}
                  style={[
                    styles.row,
                    index < data.logements.length - 1 ? { borderBottomWidth: 1, borderColor: colors.border } : null,
                  ]}
                >
                  <BellOff size={IconSize.md} color={colors.primary} />
                  <View style={styles.labelBlock}>
                    <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                      {l.logement_name}
                    </Text>
                    <Text style={[styles.sub, { color: colors.mutedText }]}>{t(`notifPrefs.levelDesc.${l.level}`)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setLogementLevel.mutate({ logementId: l.logement_id, level: 'all' })}
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.reset, { color: colors.primary }]}>{t('notifPrefs.reset')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.hint, { color: colors.mutedText }]}>{t('notifPrefs.byLogementHint')}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.lg, gap: Spacing.md },
  hint: { fontSize: FontSize.sm },
  card: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  label: { flex: 1, fontSize: FontSize.md },
  labelBlock: { flex: 1, gap: 2 },
  sub: { fontSize: FontSize.xs },
  section: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: Spacing.sm },
  dimmed: { opacity: 0.5 },
  reset: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
