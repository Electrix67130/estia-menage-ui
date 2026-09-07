import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gift, Pencil, Check, Square } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDialog } from '@/contexts/DialogContext';
import {
  useLogementOptions,
  useMenageOptions,
  useSetMenageOptions,
  type MenageOption,
} from '@/api/hooks/useLogementOptions';

/**
 * « Options choisies » sur le détail d'une prestation : les packs retenus par
 * le client (pack romantique, anniversaire…).
 *
 * L'admin coche ce que le client a pris ; le prestataire est en **lecture
 * seule** — il consulte ce qu'il doit installer.
 */
interface Props {
  menageId: string;
  logementId: string;
  isAdmin: boolean;
}

const MenageOptionsSection: React.FC<Props> = ({ menageId, logementId, isAdmin }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const list = useMenageOptions(menageId);
  const [picking, setPicking] = useState(false);

  const items = list.data ?? [];
  if (items.length === 0 && !isAdmin) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text2 }]}>OPTIONS CHOISIES</Text>
        {isAdmin ? (
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: colors.border }]}
            onPress={() => setPicking(true)}
          >
            <Pencil size={IconSize.sm} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.medium }}>
              Modifier
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {list.isLoading ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedText, textAlign: 'center' }}>
            Aucune option. « Modifier » pour cocher un pack proposé sur le logement.
          </Text>
        </View>
      ) : (
        items.map((o) => (
          <View
            key={o.id}
            style={[
              styles.optionCard,
              { backgroundColor: colors.primary + '12', borderColor: colors.primary + '55' },
            ]}
          >
            <Gift size={IconSize.sm} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
                {o.label}
              </Text>
              {o.description ? (
                <Text style={{ color: colors.text2, fontSize: FontSize.sm }}>{o.description}</Text>
              ) : null}
              {o.notes ? (
                <Text style={{ color: colors.text2, fontSize: FontSize.sm, fontStyle: 'italic' }}>
                  {o.notes}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      )}

      {picking ? (
        <OptionsPickerModal
          menageId={menageId}
          logementId={logementId}
          selected={items}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </View>
  );
};

/** Sélection des options retenues par le client (admin). */
function OptionsPickerModal({
  menageId,
  logementId,
  selected,
  onClose,
}: {
  menageId: string;
  logementId: string;
  selected: MenageOption[];
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const options = useLogementOptions(logementId);
  const save = useSetMenageOptions(menageId);
  const [checked, setChecked] = useState<string[]>(selected.map((s) => s.logement_option_id));

  const toggle = (id: string) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    try {
      await save.mutateAsync(checked.map((id) => ({ logement_option_id: id })));
      onClose();
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Enregistrement impossible',
      });
    }
  };

  const items = options.data ?? [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            sheetStyles.sheet,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
            Shadow.lg,
          ]}
        >
          <View style={sheetStyles.handle}>
            <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <Text style={[sheetStyles.title, { color: colors.text }]}>Options choisies</Text>
          <Text style={[sheetStyles.hint, { color: colors.mutedText }]}>
            Coche les options retenues par le client.
          </Text>

          {options.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.lg }} />
          ) : items.length === 0 ? (
            <Text style={{ color: colors.mutedText, marginVertical: Spacing.lg }}>
              Aucune option configurée sur ce logement. Ajoute-les d&apos;abord sur la fiche
              logement, section « Options ».
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              {items.map((o) => {
                const active = checked.includes(o.id);
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[
                      sheetStyles.option,
                      { borderColor: active ? colors.primary : colors.border },
                    ]}
                    onPress={() => toggle(o.id)}
                  >
                    {active ? (
                      <View
                        style={[
                          sheetStyles.checkbox,
                          { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        <Check size={14} color="#FFFFFF" />
                      </View>
                    ) : (
                      <Square size={IconSize.md} color={colors.text2} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: FontSize.md }}>{o.label}</Text>
                      {o.description ? (
                        <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }}>
                          {o.description}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[
              sheetStyles.submit,
              { backgroundColor: colors.primary, opacity: save.isPending ? 0.5 : 1 },
            ]}
            onPress={handleSave}
            disabled={save.isPending}
          >
            {save.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={sheetStyles.submitText}>
                Enregistrer{checked.length > 0 ? ` (${checked.length})` : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 0.5 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  card: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
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
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  hint: { fontSize: FontSize.sm, marginBottom: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
});

export default MenageOptionsSection;
