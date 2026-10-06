import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyRound, Plus, Trash2, Eye, EyeOff } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useDialog } from '@/contexts/DialogContext';
import { useTranslation } from '@/contexts/I18nContext';
import {
  useLogementCodes,
  useCodeLabelSuggestions,
  useCreateLogementCode,
  useUpdateLogementCode,
  useDeleteLogementCode,
  type LogementCode,
} from '@/api/hooks/useLogementCodes';

/**
 * Section « Codes d'accès » de la fiche logement : autant de codes que
 * nécessaire (boîte à clés, portail, alarme…), chacun avec un libellé libre.
 *
 * Écriture admin ; lecture pour qui doit entrer dans le logement (membres +
 * prestataires affectés à une prestation). Chaque code est masqué par défaut,
 * révélé au tap — même esprit que l'ancien champ unique.
 */
interface Props {
  logementId: string;
  isAdmin: boolean;
}

const LogementCodesSection: React.FC<Props> = ({ logementId, isAdmin }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const codes = useLogementCodes(logementId);
  const [editing, setEditing] = useState<{ item: LogementCode | null } | null>(null);

  const list = codes.data ?? [];
  // Rien à montrer à un non-admin s'il n'y a aucun code.
  if (!isAdmin && list.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text2 }]}>{t('logementCodes.title').toUpperCase()}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            {t('logementCodes.subtitle')}
          </Text>
        </View>
      </View>

      {codes.isLoading ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedText, textAlign: 'center' }}>
            {t('logementCodes.empty')}
          </Text>
        </View>
      ) : (
        list.map((c) => (
          <CodeRow
            key={c.id}
            item={c}
            isAdmin={isAdmin}
            onEdit={() => setEditing({ item: c })}
          />
        ))
      )}

      {isAdmin ? (
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
          onPress={() => setEditing({ item: null })}
        >
          <Plus size={IconSize.sm} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
            {t('logementCodes.add')}
          </Text>
        </TouchableOpacity>
      ) : null}

      {editing ? (
        <CodeEditModal
          logementId={logementId}
          item={editing.item}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </View>
  );
};

/** Ligne d'un code : libellé + code masqué, révélé au tap sur l'œil. */
function CodeRow({
  item,
  isAdmin,
  onEdit,
}: {
  item: LogementCode;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={isAdmin ? onEdit : undefined}
      activeOpacity={isAdmin ? 0.7 : 1}
      disabled={!isAdmin}
    >
      <KeyRound size={IconSize.sm} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text2, fontSize: FontSize.sm }}>{item.label}</Text>
        <Text
          style={{
            color: colors.text,
            fontSize: FontSize.md,
            fontWeight: FontWeight.semibold,
            letterSpacing: revealed ? 1 : 2,
          }}
        >
          {revealed ? item.code : '•'.repeat(Math.min(item.code.length, 8))}
        </Text>
        {item.notes ? (
          <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }} numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={() => setRevealed((v) => !v)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={revealed ? t('logementCodes.hide') : t('logementCodes.reveal')}
      >
        {revealed ? (
          <EyeOff size={IconSize.md} color={colors.text2} />
        ) : (
          <Eye size={IconSize.md} color={colors.text2} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/** Création / édition d'un code (admin). */
function CodeEditModal({
  logementId,
  item,
  onClose,
}: {
  logementId: string;
  item: LogementCode | null;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { t } = useTranslation();
  const suggestions = useCodeLabelSuggestions();
  const create = useCreateLogementCode(logementId);
  const update = useUpdateLogementCode(logementId);
  const remove = useDeleteLogementCode(logementId);
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible: true });

  const [label, setLabel] = useState(item?.label ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');

  const saving = create.isPending || update.isPending;

  const handleSave = async () => {
    if (!label.trim()) {
      void dialog.alert({ title: t('logementCodes.labelRequiredTitle'), message: t('logementCodes.labelRequiredBody') });
      return;
    }
    if (!code.trim()) {
      void dialog.alert({ title: t('logementCodes.codeRequiredTitle'), message: t('logementCodes.codeRequiredBody') });
      return;
    }
    const body = { label: label.trim(), code: code.trim(), notes: notes.trim() || null };
    try {
      if (item) await update.mutateAsync({ id: item.id, body });
      else await create.mutateAsync(body);
      onClose();
    } catch (err) {
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('common.saveFailed'),
      });
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    const ok = await dialog.confirm({
      title: t('logementCodes.deleteTitle'),
      message: t('logementCodes.deleteBody', { label: item.label }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(item.id);
      onClose();
    } catch (err) {
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('common.deleteFailed'),
      });
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
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
          <Text style={[sheetStyles.title, { color: colors.text }]}>
            {item ? t('logementCodes.edit') : t('logementCodes.new')}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>{t('logementCodes.labelField').toUpperCase()}</Text>
            <TextInput
              style={[
                sheetStyles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={label}
              onChangeText={setLabel}
              placeholder={t('logementCodes.labelPlaceholder')}
              placeholderTextColor={colors.placeholder}
              maxLength={100}
            />
            {/* Suggestions : aide à la saisie, le libellé reste libre. */}
            <View style={sheetStyles.chipRow}>
              {(suggestions.data?.labels ?? []).map((s) => {
                const active = label === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      sheetStyles.chip,
                      {
                        backgroundColor: active ? colors.primary + '20' : colors.itemBackground,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setLabel(s)}
                  >
                    <Text style={{ color: active ? colors.primary : colors.text2, fontSize: FontSize.sm }}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>{t('logementCodes.codeField').toUpperCase()}</Text>
            <TextInput
              style={[
                sheetStyles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={code}
              onChangeText={setCode}
              placeholder={t('logementCodes.codePlaceholder')}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={100}
            />

            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>{t('logementCodes.notesField').toUpperCase()}</Text>
            <TextInput
              style={[
                sheetStyles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('logementCodes.notesPlaceholder')}
              placeholderTextColor={colors.placeholder}
            />
          </ScrollView>

          <TouchableOpacity
            style={[sheetStyles.submit, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={sheetStyles.submitText}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>

          {item ? (
            <TouchableOpacity
              style={[sheetStyles.deleteBtn, { borderColor: colors.red }]}
              onPress={handleDelete}
              disabled={remove.isPending}
            >
              <Trash2 size={IconSize.sm} color={colors.red} />
              <Text style={{ color: colors.red, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
                {t('common.delete')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  subtitle: { fontSize: FontSize.xs, marginTop: 2 },
  card: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
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
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  submit: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  deleteBtn: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});

export default LogementCodesSection;
