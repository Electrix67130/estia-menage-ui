import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarPlus, RefreshCw, Trash2, X, ExternalLink } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useDialog } from '@/contexts/DialogContext';
import {
  useExternalCalendars,
  useCreateExternalCalendar,
  useDeleteExternalCalendar,
  useSyncExternalCalendar,
  type ExternalCalendarProvider,
  type ExternalCalendar,
} from '@/api/hooks/useExternalCalendars';
import { formatDateFr } from '@/lib/date-fr';
import { useTranslation } from '@/contexts/I18nContext';

/**
 * Section "Calendriers externes" sur la page logement (admin only).
 *
 * Permet d'ajouter une URL iCal (Airbnb, Booking, Vrbo, générique) ; le
 * worker côté API la sync auto toutes les 30 minutes. Le bouton "Synchroniser"
 * permet aussi de déclencher manuellement.
 *
 * Chaque sync crée/met à jour les ménages programmés sur la date de checkout
 * (`DTEND`) en utilisant les valeurs par défaut du logement (durée, prix, etc.).
 */
interface Props {
  logementId: string;
}

/** Noms propres des plateformes ; le fournisseur iCal générique est traduit. */
const PROVIDER_BRANDS: Record<Exclude<ExternalCalendarProvider, 'ical'>, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  vrbo: 'Vrbo',
};

const PROVIDERS: ExternalCalendarProvider[] = ['airbnb', 'booking', 'vrbo', 'ical'];

const LogementExternalCalendarsSection: React.FC<Props> = ({ logementId }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const { t, tp } = useTranslation();
  const providerLabel = (p: ExternalCalendarProvider): string =>
    p === 'ical' ? t('logementCalendars.providerIcal') : PROVIDER_BRANDS[p];
  const list = useExternalCalendars(logementId);
  const create = useCreateExternalCalendar();
  const remove = useDeleteExternalCalendar();
  const sync = useSyncExternalCalendar();
  const [addOpen, setAddOpen] = useState(false);

  const handleRemove = async (cal: ExternalCalendar) => {
    const ok = await dialog.confirm({
      title: t('logementCalendars.deleteTitle'),
      message: t('logementCalendars.deleteBody'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(cal.id);
    } catch (err) {
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('common.unknownError'),
      });
    }
  };

  const handleSync = async (cal: ExternalCalendar) => {
    try {
      const result = await sync.mutateAsync(cal.id);
      if (result.error) {
        void dialog.alert({
          title: t('logementCalendars.syncErrorTitle'),
          message: result.error,
        });
        return;
      }
      // `fetched_events` = événements lus dans le flux. L'afficher distingue
      // « le lien ne renvoie rien » de « le flux est lu mais rien n'en sort ».
      const fetched = tp('logementCalendars.fetched', result.fetched_events);
      const impact =
        result.created_menages + result.updated_menages + result.cancelled_menages;
      void dialog.alert({
        title: t('logementCalendars.syncDoneTitle'),
        message:
          result.fetched_events === 0
            ? t('logementCalendars.syncEmpty')
            : impact === 0
              ? t('logementCalendars.syncNoImpact', { fetched })
              : t('logementCalendars.syncSummary', {
                  fetched,
                  created: result.created_menages,
                  updated: result.updated_menages,
                  cancelled: result.cancelled_menages,
                }),
      });
    } catch (err) {
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('common.unknownError'),
      });
    }
  };

  const items = list.data ?? [];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text2 }]}>{t('logementCalendars.title').toUpperCase()}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            {t('logementCalendars.subtitle')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setAddOpen(true)}
        >
          <CalendarPlus size={IconSize.sm} color="#FFFFFF" />
          <Text style={styles.addBtnText}>{t('common.add')}</Text>
        </TouchableOpacity>
      </View>

      {list.isLoading ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedText, textAlign: 'center' }}>
            {t('logementCalendars.empty')}
          </Text>
        </View>
      ) : (
        items.map((cal) => (
          <View
            key={cal.id}
            style={[styles.calRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.calTitleRow}>
                <ExternalLink size={IconSize.sm} color={colors.primary} />
                <Text style={[styles.calLabel, { color: colors.text }]} numberOfLines={1}>
                  {cal.label || providerLabel(cal.provider)}
                </Text>
                <View
                  style={[styles.providerPill, { backgroundColor: colors.primary + '15' }]}
                >
                  <Text style={{ color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                    {providerLabel(cal.provider)}
                  </Text>
                </View>
              </View>
              <Text
                style={{ color: colors.mutedText, fontSize: FontSize.xs }}
                numberOfLines={1}
              >
                {cal.url}
              </Text>
              <Text style={{ color: colors.text2, fontSize: FontSize.xs, marginTop: 2 }}>
                {cal.last_error
                  ? t('logementCalendars.lastError', { error: cal.last_error })
                  : cal.last_synced_at
                    ? t('logementCalendars.lastSync', { date: formatDateFr(cal.last_synced_at, 'datetime') })
                    : t('logementCalendars.neverSynced')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleSync(cal)}
              disabled={sync.isPending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('logementCalendars.syncA11y')}
            >
              <RefreshCw
                size={IconSize.md}
                color={sync.isPending ? colors.mutedText : colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleRemove(cal)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('common.delete')}
            >
              <Trash2 size={IconSize.sm} color={colors.red} />
            </TouchableOpacity>
          </View>
        ))
      )}

      <AddCalendarModal
        visible={addOpen}
        logementId={logementId}
        onClose={() => setAddOpen(false)}
        onSubmit={async (input) => {
          try {
            await create.mutateAsync(input);
            setAddOpen(false);
          } catch (err) {
            void dialog.alert({
              title: t('common.error'),
              message: err instanceof Error ? err.message : t('common.unknownError'),
            });
          }
        }}
      />
    </View>
  );
};

// =============================================================================
// AddCalendarModal — bottom sheet pour saisir provider + label + URL
// =============================================================================

function AddCalendarModal({
  visible,
  logementId,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  logementId: string;
  onClose: () => void;
  onSubmit: (input: { logement_id: string; provider: ExternalCalendarProvider; label?: string; url: string }) => Promise<void>;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const providerLabel = (p: ExternalCalendarProvider): string =>
    p === 'ical' ? t('logementCalendars.providerIcal') : PROVIDER_BRANDS[p];
  const [provider, setProvider] = useState<ExternalCalendarProvider>('airbnb');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible });
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        logement_id: logementId,
        provider,
        label: label.trim() || undefined,
        url: url.trim(),
      });
      setProvider('airbnb');
      setLabel('');
      setUrl('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => {
        setProvider('airbnb');
        setLabel('');
        setUrl('');
      }}
    >
      <View style={sheetStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            sheetStyles.sheet,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
            Shadow.lg,
            animatedModalStyle,
          ]}
        >
          <View style={sheetStyles.handle}>
            <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={sheetStyles.header}>
            <Text style={[sheetStyles.title, { color: colors.text }]}>{t('logementCalendars.addTitle')}</Text>
          </View>

          <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>{t('logementCalendars.source').toUpperCase()}</Text>
          <View style={sheetStyles.providerRow}>
            {PROVIDERS.map((p) => {
              const active = provider === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    sheetStyles.providerChip,
                    {
                      backgroundColor: active ? colors.primary + '20' : colors.itemBackground,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setProvider(p)}
                >
                  <Text
                    style={{
                      color: active ? colors.primary : colors.text2,
                      fontSize: FontSize.sm,
                      fontWeight: FontWeight.medium,
                    }}
                  >
                    {providerLabel(p)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>{t('logementCalendars.labelOptional').toUpperCase()}</Text>
          <TextInput
            style={[
              sheetStyles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
            ]}
            value={label}
            onChangeText={setLabel}
            placeholder={t('logementCalendars.labelPlaceholder')}
            placeholderTextColor={colors.placeholder}
          />

          <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>{t('logementCalendars.urlField').toUpperCase()}</Text>
          <TextInput
            style={[
              sheetStyles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
            ]}
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.airbnb.com/calendar/ical/…ics?s=…"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={[sheetStyles.hint, { color: colors.mutedText }]}>
            {t('logementCalendars.urlHint')}
          </Text>

          <TouchableOpacity
            style={[
              sheetStyles.submit,
              { backgroundColor: colors.primary, opacity: url.trim() && !submitting ? 1 : 0.5 },
            ]}
            onPress={handleSubmit}
            disabled={!url.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={sheetStyles.submitText}>{t('logementCalendars.addAndSync')}</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  subtitle: { fontSize: FontSize.xs, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  card: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  calTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  calLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1 },
  providerPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});

const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  handle: { alignItems: 'center', paddingBottom: Spacing.sm },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
  },
  hint: { fontSize: FontSize.xs, marginTop: 4 },
  providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  providerChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
  },
  submitText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
});

export default LogementExternalCalendarsSection;
