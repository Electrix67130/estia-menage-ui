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
import { Gift, Plus, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useDialog } from '@/contexts/DialogContext';
import { useTranslation } from '@/contexts/I18nContext';
import {
  useLogementOptions,
  useOptionSuggestions,
  useCreateLogementOption,
  useUpdateLogementOption,
  useDeleteLogementOption,
  type LogementOption,
} from '@/api/hooks/useLogementOptions';

/**
 * Section « Options » de la fiche logement : packs proposés au client (pack
 * romantique, pack anniversaire…). Configuration **admin uniquement** ; sur une
 * prestation, l'admin coche celui retenu et le prestataire l'installe.
 */
interface Props {
  logementId: string;
  isAdmin: boolean;
}

const LogementOptionsSection: React.FC<Props> = ({ logementId, isAdmin }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const options = useLogementOptions(logementId);
  const [editing, setEditing] = useState<{ item: LogementOption | null } | null>(null);

  const list = options.data ?? [];
  if (!isAdmin && list.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text2 }]}>{t('options.sectionTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            {t('options.sectionSubtitle')}
          </Text>
        </View>
      </View>

      {options.isLoading ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedText, textAlign: 'center' }}>
            {t('options.empty')}
          </Text>
        </View>
      ) : (
        list.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={isAdmin ? () => setEditing({ item: o }) : undefined}
            activeOpacity={isAdmin ? 0.7 : 1}
            disabled={!isAdmin}
          >
            <Gift size={IconSize.sm} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.medium }}>
                {o.label}
              </Text>
              {o.description ? (
                <Text style={{ color: colors.text2, fontSize: FontSize.sm }}>{o.description}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))
      )}

      {isAdmin ? (
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
          onPress={() => setEditing({ item: null })}
        >
          <Plus size={IconSize.sm} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
            {t('options.addOne')}
          </Text>
        </TouchableOpacity>
      ) : null}

      {editing ? (
        <OptionEditModal
          logementId={logementId}
          item={editing.item}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </View>
  );
};

function OptionEditModal({
  logementId,
  item,
  onClose,
}: {
  logementId: string;
  item: LogementOption | null;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { t } = useTranslation();
  const suggestions = useOptionSuggestions();
  const create = useCreateLogementOption(logementId);
  const update = useUpdateLogementOption(logementId);
  const remove = useDeleteLogementOption(logementId);
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible: true });

  const [label, setLabel] = useState(item?.label ?? '');
  const [description, setDescription] = useState(item?.description ?? '');

  const saving = create.isPending || update.isPending;

  const handleSave = async () => {
    if (!label.trim()) {
      void dialog.alert({ title: t('options.labelRequiredTitle'), message: t('options.labelRequiredBody') });
      return;
    }
    const body = { label: label.trim(), description: description.trim() || null };
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
      title: t('options.deleteConfirmTitle'),
      message: t('options.deleteConfirmBody', { label: item.label }),
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
            {item ? t('options.editTitle') : t('options.newTitle')}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>{t('options.fieldLabel')}</Text>
            <TextInput
              style={[
                sheetStyles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={label}
              onChangeText={setLabel}
              placeholder={t('options.labelPlaceholder')}
              placeholderTextColor={colors.placeholder}
              maxLength={150}
            />
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

            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>{t('options.fieldDescription')}</Text>
            <TextInput
              style={[
                sheetStyles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.itemBackground,
                  height: 90,
                  textAlignVertical: 'top',
                },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('options.descriptionPlaceholder')}
              placeholderTextColor={colors.placeholder}
              multiline
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

export default LogementOptionsSection;
