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
import { Check, Square, Pencil, Package } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDialog } from '@/contexts/DialogContext';
import { useLogementEquipements } from '@/api/hooks/useLogementEquipements';
import {
  useMenageEquipements,
  useSetMenageEquipements,
  useToggleMenageEquipement,
  type MenageEquipement,
} from '@/api/hooks/useMenageEquipements';

/**
 * « À préparer » sur le détail d'une prestation : les équipements de
 * l'inventaire du logement que l'admin demande de sortir/installer (chaise
 * haute, baignoire bébé, lit parapluie…).
 *
 * L'admin choisit la liste et suit l'avancement ; le prestataire est en
 * **lecture seule** — il consulte ce qu'il doit préparer, il ne coche rien.
 */
interface Props {
  menageId: string;
  logementId: string;
  isAdmin: boolean;
}

const MenageEquipementsSection: React.FC<Props> = ({ menageId, logementId, isAdmin }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const list = useMenageEquipements(menageId);
  const toggle = useToggleMenageEquipement(menageId);
  const [picking, setPicking] = useState(false);

  const items = list.data ?? [];
  // Rien à afficher tant que l'admin n'a rien demandé (et qu'on n'est pas admin).
  if (items.length === 0 && !isAdmin) return null;

  const doneCount = items.filter((i) => i.done_at).length;

  const handleToggle = async (item: MenageEquipement) => {
    if (!isAdmin) return; // lecture seule pour le prestataire
    try {
      await toggle.mutateAsync({
        equipementId: item.logement_equipement_id,
        done: !item.done_at,
      });
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Action impossible',
      });
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text2 }]}>
          À PRÉPARER{items.length > 0 ? ` · ${doneCount}/${items.length}` : ''}
        </Text>
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
            Rien à préparer. « Modifier » pour choisir dans l&apos;inventaire du logement.
          </Text>
        </View>
      ) : (
        items.map((i) => {
          const done = !!i.done_at;
          return (
            <TouchableOpacity
              key={i.id}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleToggle(i)}
              activeOpacity={isAdmin ? 0.7 : 1}
              disabled={!isAdmin}
            >
              {done ? (
                <View style={[styles.checkbox, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <Check size={14} color="#FFFFFF" />
                </View>
              ) : isAdmin ? (
                <Square size={IconSize.md} color={colors.text2} />
              ) : (
                <Package size={IconSize.sm} color={colors.text2} />
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: done ? colors.text2 : colors.text,
                    fontSize: FontSize.md,
                    fontWeight: FontWeight.medium,
                    textDecorationLine: done ? 'line-through' : 'none',
                  }}
                >
                  {i.label}
                  {i.quantity > 1 ? ` ×${i.quantity}` : ''}
                </Text>
                {i.room_name || (done && i.done_by_first_name) ? (
                  <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }}>
                    {[i.room_name, done && i.done_by_first_name ? `préparé par ${i.done_by_first_name}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })
      )}

      {picking ? (
        <EquipementsPickerModal
          menageId={menageId}
          logementId={logementId}
          selected={items}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </View>
  );
};

/** Sélection des équipements à préparer, depuis l'inventaire du logement (admin). */
function EquipementsPickerModal({
  menageId,
  logementId,
  selected,
  onClose,
}: {
  menageId: string;
  logementId: string;
  selected: MenageEquipement[];
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const inventory = useLogementEquipements(logementId);
  const save = useSetMenageEquipements(menageId);
  const [checked, setChecked] = useState<string[]>(
    selected.map((s) => s.logement_equipement_id),
  );

  const toggle = (id: string) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    try {
      await save.mutateAsync(checked.map((id) => ({ logement_equipement_id: id })));
      onClose();
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Enregistrement impossible',
      });
    }
  };

  const items = inventory.data ?? [];

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
          <Text style={[sheetStyles.title, { color: colors.text }]}>Équipements à préparer</Text>
          <Text style={[sheetStyles.hint, { color: colors.mutedText }]}>
            Coche ce que le prestataire doit préparer pour cette prestation.
          </Text>

          {inventory.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.lg }} />
          ) : items.length === 0 ? (
            <Text style={{ color: colors.mutedText, marginVertical: Spacing.lg }}>
              L&apos;inventaire de ce logement est vide. Ajoute d&apos;abord des équipements sur la
              fiche logement.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              {items.map((e) => {
                const active = checked.includes(e.id);
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={[
                      sheetStyles.option,
                      { borderColor: active ? colors.primary : colors.border },
                    ]}
                    onPress={() => toggle(e.id)}
                  >
                    {active ? (
                      <View style={[styles.checkbox, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        <Check size={14} color="#FFFFFF" />
                      </View>
                    ) : (
                      <Square size={IconSize.md} color={colors.text2} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: FontSize.md }}>{e.label}</Text>
                      {e.room_name ? (
                        <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }}>
                          {e.room_name}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  submit: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
});

export default MenageEquipementsSection;
