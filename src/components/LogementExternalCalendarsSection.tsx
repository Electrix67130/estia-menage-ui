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

const PROVIDER_LABELS: Record<ExternalCalendarProvider, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  vrbo: 'Vrbo',
  ical: 'iCal générique',
};

const PROVIDERS: ExternalCalendarProvider[] = ['airbnb', 'booking', 'vrbo', 'ical'];

const LogementExternalCalendarsSection: React.FC<Props> = ({ logementId }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const list = useExternalCalendars(logementId);
  const create = useCreateExternalCalendar();
  const remove = useDeleteExternalCalendar();
  const sync = useSyncExternalCalendar();
  const [addOpen, setAddOpen] = useState(false);

  const handleRemove = async (cal: ExternalCalendar) => {
    const ok = await dialog.confirm({
      title: 'Supprimer ce calendrier ?',
      message:
        'Les ménages déjà créés depuis ce calendrier ne seront pas supprimés. Le calendrier ne sera juste plus sync.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(cal.id);
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Échec',
      });
    }
  };

  const handleSync = async (cal: ExternalCalendar) => {
    try {
      const result = await sync.mutateAsync(cal.id);
      if (result.error) {
        void dialog.alert({
          title: 'Erreur de sync',
          message: result.error,
        });
        return;
      }
      void dialog.alert({
        title: 'Sync terminée',
        message: `${result.created_menages} créé${result.created_menages > 1 ? 's' : ''}, ${result.updated_menages} mis à jour, ${result.cancelled_menages} annulé${result.cancelled_menages > 1 ? 's' : ''}.`,
      });
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Échec',
      });
    }
  };

  const items = list.data ?? [];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text2 }]}>CALENDRIERS EXTERNES</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            Connecte Airbnb, Booking, Vrbo… Les bookings deviennent des ménages auto.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setAddOpen(true)}
        >
          <CalendarPlus size={IconSize.sm} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {list.isLoading ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedText, textAlign: 'center' }}>
            Aucun calendrier. Colle l&apos;URL publique iCal d&apos;Airbnb / Booking pour automatiser
            la création des ménages.
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
                  {cal.label || PROVIDER_LABELS[cal.provider]}
                </Text>
                <View
                  style={[styles.providerPill, { backgroundColor: colors.primary + '15' }]}
                >
                  <Text style={{ color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                    {PROVIDER_LABELS[cal.provider]}
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
                  ? `⚠ Erreur : ${cal.last_error}`
                  : cal.last_synced_at
                    ? `Dernière sync : ${formatDateFr(cal.last_synced_at, 'datetime')}`
                    : 'Jamais sync'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleSync(cal)}
              disabled={sync.isPending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Synchroniser"
            >
              <RefreshCw
                size={IconSize.md}
                color={sync.isPending ? colors.mutedText : colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleRemove(cal)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Supprimer"
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
              title: 'Erreur',
              message: err instanceof Error ? err.message : 'Échec',
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
            <Text style={[sheetStyles.title, { color: colors.text }]}>Ajouter un calendrier</Text>
          </View>

          <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>SOURCE</Text>
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
                    {PROVIDER_LABELS[p]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>LIBELLÉ (OPTIONNEL)</Text>
          <TextInput
            style={[
              sheetStyles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
            ]}
            value={label}
            onChangeText={setLabel}
            placeholder="Ex : Appartement Bastille"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>URL iCAL</Text>
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
            Sur Airbnb : Calendrier → Exporter le calendrier → copie l&apos;URL.
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
              <Text style={sheetStyles.submitText}>Ajouter et synchroniser</Text>
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
