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
  const codes = useLogementCodes(logementId);
  const [editing, setEditing] = useState<{ item: LogementCode | null } | null>(null);

  const list = codes.data ?? [];
  // Rien à montrer à un non-admin s'il n'y a aucun code.
  if (!isAdmin && list.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text2 }]}>CODES D&apos;ACCÈS</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            Boîte à clés, portail, alarme… un libellé par code.
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
            Aucun code d&apos;accès renseigné.
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
            Ajouter un code
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
        accessibilityLabel={revealed ? 'Masquer le code' : 'Révéler le code'}
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
      void dialog.alert({ title: 'Libellé requis', message: 'Donne un libellé au code.' });
      return;
    }
    if (!code.trim()) {
      void dialog.alert({ title: 'Code requis', message: 'Saisis le code.' });
      return;
    }
    const body = { label: label.trim(), code: code.trim(), notes: notes.trim() || null };
    try {
      if (item) await update.mutateAsync({ id: item.id, body });
      else await create.mutateAsync(body);
      onClose();
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Enregistrement impossible',
      });
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    const ok = await dialog.confirm({
      title: 'Supprimer ce code ?',
      message: `« ${item.label} » sera supprimé.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(item.id);
      onClose();
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Suppression impossible',
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
            {item ? 'Modifier le code' : 'Nouveau code'}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>LIBELLÉ</Text>
            <TextInput
              style={[
                sheetStyles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={label}
              onChangeText={setLabel}
              placeholder="Ex : Portail"
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

            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>CODE</Text>
            <TextInput
              style={[
                sheetStyles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={code}
              onChangeText={setCode}
              placeholder="Ex : 1984"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={100}
            />

            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>NOTES (OPTIONNEL)</Text>
            <TextInput
              style={[
                sheetStyles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex : à gauche de la porte"
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
              <Text style={sheetStyles.submitText}>Enregistrer</Text>
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
                Supprimer
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
