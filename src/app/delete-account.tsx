import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trash2, TriangleAlert } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useDialog } from '@/contexts/DialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDeleteAccount } from '@/api/hooks/useAuth';
import { ApiError } from '@/api/client';
import type { TranslationKeys } from '@/i18n/translations';

/** Ce qui se passe à la suppression — quatre points, lus avant de confirmer. */
const POINTS: TranslationKeys[] = [
  'deleteAccount.point1',
  'deleteAccount.point2',
  'deleteAccount.point3',
  'deleteAccount.point4',
];

/**
 * Suppression de compte depuis l'app (App Store 5.1.1). Le mot de passe est
 * redemandé ; l'API anonymise le compte et coupe toutes les sessions, on
 * oublie ensuite la session locale sans appeler `/auth/logout` (401 sinon).
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const { forgetSession } = useAuth();
  const deleteAccount = useDeleteAccount();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const canSubmit = password.length > 0 && !deleteAccount.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    setError('');
    const ok = await dialog.confirm({
      title: t('deleteAccount.confirmTitle'),
      message: t('deleteAccount.confirmMessage'),
      confirmLabel: t('deleteAccount.confirmShort'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAccount.mutateAsync(password);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        setError(t('deleteAccount.wrongPassword'));
      } else if (err instanceof ApiError && err.statusCode === 409) {
        // Dernier admin d'une org qui a encore des membres : le message de
        // l'API explique quoi faire (transférer le rôle ou retirer les membres).
        setError(err.message);
      } else {
        setError(t('deleteAccount.error'));
      }
      return;
    }
    // Session coupée côté serveur : on oublie la nôtre, l'AuthGuard renvoie au login.
    await forgetSession();
    await dialog.alert({ title: t('deleteAccount.doneTitle'), message: t('deleteAccount.doneMessage') });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={IconSize.md} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('deleteAccount.title')}</Text>
        <View style={{ width: IconSize.md }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.warningBox, { backgroundColor: colors.red + '15', borderColor: colors.red }]}>
            <TriangleAlert size={IconSize.md} color={colors.red} />
            <Text style={[styles.warningText, { color: colors.text }]}>{t('deleteAccount.intro')}</Text>
          </View>

          {POINTS.map((key) => (
            <View key={key} style={styles.pointRow}>
              <View style={[styles.bullet, { backgroundColor: colors.red }]} />
              <Text style={[styles.pointText, { color: colors.text2 }]}>{t(key)}</Text>
            </View>
          ))}

          <Text style={[styles.label, { color: colors.text }]}>{t('deleteAccount.passwordLabel')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder={t('deleteAccount.passwordPlaceholder')}
            placeholderTextColor={colors.placeholder}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError('');
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            accessibilityLabel={t('deleteAccount.passwordLabel')}
          />

          {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: colors.red, opacity: canSubmit ? 1 : 0.45 }]}
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            accessibilityLabel={t('deleteAccount.submit')}
          >
            {deleteAccount.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Trash2 size={IconSize.sm} color="#FFFFFF" />
                <Text style={styles.submitText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {t('deleteAccount.submit')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  warningText: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.medium, lineHeight: 20 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  pointText: { flex: 1, fontSize: FontSize.base, lineHeight: 20 },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    marginBottom: Spacing.md,
  },
  error: { fontSize: FontSize.sm, marginBottom: Spacing.sm },
  // Même gabarit que le bouton de connexion ; le libellé est long (« Supprimer
  // définitivement mon compte », plus long encore en allemand), donc une seule
  // ligne qui se réduit au besoin plutôt qu'un retour à la ligne dans le bouton.
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 50,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
  },
  submitText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold, flexShrink: 1 },
});
