import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Flag, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useDialog } from '@/contexts/DialogContext';
import { useCreateReport, REPORT_REASONS, type ReportReason, type ReportTarget } from '@/api/hooks/useReports';
import type { TranslationKeys } from '@/i18n/translations';

export interface ReportTargetRef {
  type: ReportTarget;
  id: string;
  /** Ce qu'on signale, rappelé en haut de la feuille. */
  label: string;
}

/** Libellés des motifs — table explicite pour que le typage vérifie chaque clé. */
const REASON_KEYS: Record<ReportReason, TranslationKeys> = {
  inappropriate: 'comments.report.reason.inappropriate',
  harassment: 'comments.report.reason.harassment',
  off_topic: 'comments.report.reason.spam',
  other: 'comments.report.reason.other',
};

const TITLE_KEYS: Record<ReportTarget, TranslationKeys> = {
  comment: 'comments.report.title',
  photo: 'moderation.reportPhotoTitle',
  user: 'moderation.reportUserTitle',
};

interface Props {
  /** null = feuille fermée. */
  target: ReportTargetRef | null;
  onClose: () => void;
}

/**
 * Feuille de signalement (reprise de Buildr), commune aux messages, photos et
 * membres (App Store 1.2). Le signalement part aux administrateurs de
 * l'organisation, jamais à la personne visée : la feuille le dit, pour que
 * personne n'hésite par crainte d'une confrontation.
 */
const ReportSheet: React.FC<Props> = ({ target, onClose }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const dialog = useDialog();
  const create = useCreateReport();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');

  const close = () => {
    setReason(null);
    setDetails('');
    setError('');
    onClose();
  };

  const submit = async () => {
    if (!target || !reason) return;
    setError('');
    try {
      await create.mutateAsync({
        target_type: target.type,
        target_id: target.id,
        reason,
        comment: details.trim() || undefined,
      });
      close();
      await dialog.alert({ title: t('comments.report.sentTitle'), message: t('comments.report.sentMessage') });
    } catch {
      setError(t('common.error'));
    }
  };

  const canSubmit = !!reason && !create.isPending;

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        {/* Pressable « bouclier » : capte le tap pour qu'il n'atteigne pas l'overlay (qui ferme). */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => undefined}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Flag size={IconSize.md} color={colors.red} />
              <Text style={[styles.title, { color: colors.text }]}>
                {t(TITLE_KEYS[target?.type ?? 'comment'])}
              </Text>
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

          {target?.label ? (
            <Text style={[styles.preview, { color: colors.mutedText }]} numberOfLines={2}>
              {target.label}
            </Text>
          ) : null}

          <Text style={[styles.label, { color: colors.text }]}>{t('comments.report.reasonLabel')}</Text>
          {REPORT_REASONS.map((r) => {
            const selected = reason === r;
            return (
              <TouchableOpacity
                key={r}
                style={[
                  styles.reasonRow,
                  { backgroundColor: colors.itemBackground, borderColor: selected ? colors.primary : colors.border },
                ]}
                onPress={() => setReason(r)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t(REASON_KEYS[r])}
              >
                <View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.mutedText }]}>
                  {selected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
                </View>
                <Text style={[styles.reasonText, { color: colors.text }]}>{t(REASON_KEYS[r])}</Text>
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

          <Text style={[styles.hint, { color: colors.mutedText }]}>{t('moderation.reportHint')}</Text>

          {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: reason ? colors.red : colors.border }]}
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
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
  hint: { fontSize: FontSize.xs, lineHeight: 16, marginTop: Spacing.sm },
  error: { fontSize: FontSize.sm, marginTop: Spacing.sm },
  submit: { height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
  submitText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
});

export default ReportSheet;
