import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
  type NotificationPreferenceKey,
} from '@/api/hooks/useNotificationPreferences';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';

const PREFERENCES: { key: NotificationPreferenceKey; labelKey: TranslationKeys }[] = [
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
];

export default function NotificationPreferencesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { data, isLoading } = useNotificationPreferences();
  const updatePreference = useUpdateNotificationPreference();

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
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {PREFERENCES.map((pref, index) => (
              <View
                key={pref.key}
                style={[
                  styles.row,
                  index < PREFERENCES.length - 1 ? { borderBottomWidth: 1, borderColor: colors.border } : null,
                ]}
              >
                <Text style={[styles.label, { color: colors.text }]}>{t(pref.labelKey)}</Text>
                <Switch
                  value={data[pref.key]}
                  onValueChange={(enabled) => updatePreference.mutate({ key: pref.key, enabled })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  accessibilityLabel={t(pref.labelKey)}
                />
              </View>
            ))}
          </View>
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
});
