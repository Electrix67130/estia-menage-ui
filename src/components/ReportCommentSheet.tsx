import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Flag, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useDialog } from '@/contexts/DialogContext';
import { useCreateFeedback } from '@/api/hooks/useFeedback';
import { feedbackContext } from '@/lib/feedbackContext';
import type { TranslationKeys } from '@/i18n/translations';

/** Motifs proposés — table explicite pour que le typage vérifie chaque clé. */
export type ReportReason = 'inappropriate' | 'harassment' | 'spam' | 'other';
const REASONS: { key: ReportReason; label: TranslationKeys }[] = [
  { key: 'inappropriate', label: 'comments.report.reason.inappropriate' },
  { key: 'harassment', label: 'comments.report.reason.harassment' },
  { key: 'spam', label: 'comments.report.reason.spam' },
  { key: 'other', label: 'comments.report.reason.other' },
];

/** Longueur de l'extrait du commentaire repris dans le message par défaut. */
export const EXCERPT_LENGTH = 30;

/** Les 30 premiers caractères du commentaire, « … » si tronqué. */
export function commentExcerpt(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > EXCERPT_LENGTH ? `${trimmed.slice(0, EXCERPT_LENGTH)}…` : trimmed;
}

interface Props {
  visible: boolean;
  commentId: string;
  commentContent: string;
  onClose: () => void;
  /** Écran d'origine, joint au contexte technique du signalement. */
  screen?: string;
}

/**
 * Feuille de signalement d'un commentaire d'un autre utilisateur (App Store
 * 1.2). Envoie un `feedback` de type `report` : les admins de l'org reçoivent
 * une push « Contenu signalé » et traitent depuis le dashboard.
 */
const ReportCommentSheet: React.FC<Props> = ({ visible, commentId, commentContent, onClose, screen }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t, locale } = useTranslation();
  const dialog = useDialog();
  const create = useCreateFeedback();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setReason(null);
    setDetails('');
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!reason) return;
    setError('');
    const label = REASONS.find((r) => r.key === reason)?.label ?? 'comments.report.reason.other';
    const precisions = details.trim();
    try {
      await create.mutateAsync({
        type: 'report',
        subject: t(label),
        // Sans précisions, l'extrait du commentaire donne quand même un
        // message lisible (et ≥ 10 caractères, borne du schéma API).
        message: precisions || t('comments.report.fallbackMessage', { excerpt: commentExcerpt(commentContent) }),
        target_type: 'comment',
        target_id: commentId,
        ...feedbackContext(locale, screen),
      });
      close();
      await dialog.alert({ title: t('comments.report.sentTitle'), message: t('comments.report.sentMessage') });
    } catch {
      setError(t('common.error'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        {/* Pressable « bouclier » : capte le tap pour qu'il n'atteigne pas l'overlay (qui ferme). */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => undefined}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Flag size={IconSize.md} color={colors.red} />
              <Text style={[styles.title, { color: colors.text }]}>{t('comments.report.title')}</Text>
            </View>
            <TouchableOpacity
              onPress={close}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <X size={IconSize.lg} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.preview, { color: colors.mutedText }]} numberOfLines={2}>
            {commentContent}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('comments.report.reasonLabel')}</Text>
          {REASONS.map((r) => {
            const selected = reason === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                style={[
                  styles.reasonRow,
                  { backgroundColor: colors.itemBackground, borderColor: selected ? colors.primary : colors.border },
                ]}
                onPress={() => setReason(r.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t(r.label)}
              >
                <View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.mutedText }]}>
                  {selected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
                </View>
                <Text style={[styles.reasonText, { color: colors.text }]}>{t(r.label)}</Text>
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.label, { color: colors.text }]}>{t('comments.report.detailsLabel')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder={t('comments.report.detailsPlaceholder')}
            placeholderTextColor={colors.placeholder}
            value={details}
            onChangeText={setDetails}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            accessibilityLabel={t('comments.report.detailsLabel')}
          />

          {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: reason ? colors.red : colors.border }]}
            onPress={submit}
            disabled={!reason || create.isPending}
            accessibilityRole="button"
            accessibilityState={{ disabled: !reason || create.isPending }}
            accessibilityLabel={t('comments.report.submit')}
          >
            {create.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>{t('comments.report.submit')}</Text>
            )}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
  preview: { fontSize: FontSize.sm, fontStyle: 'italic', marginBottom: Spacing.lg },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { fontSize: FontSize.base },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
  },
  error: { fontSize: FontSize.sm, marginTop: Spacing.sm },
  submit: { height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
  submitText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
});

export default ReportCommentSheet;
