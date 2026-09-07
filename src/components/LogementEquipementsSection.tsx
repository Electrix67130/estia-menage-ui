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
import { Plus, Trash2, Boxes, Package } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useDialog } from '@/contexts/DialogContext';
import { useLogementRooms } from '@/api/hooks/useLogementRooms';
import {
  useLogementEquipements,
  useEquipementCatalog,
  useCreateEquipement,
  useUpdateEquipement,
  useDeleteEquipement,
  useBulkCreateEquipements,
  type LogementEquipement,
  type EquipementCategory,
} from '@/api/hooks/useLogementEquipements';

/**
 * Section « Équipements » de la page logement : inventaire du bien (appareil à
 * raclette, plaque de cuisson, lave-vaisselle…).
 *
 * Lecture pour tous les membres — le prestataire doit savoir ce qu'il trouvera
 * sur place — écriture réservée à l'admin. Deux façons d'ajouter : au catalogue
 * (sélection multiple de suggestions servies par l'API, mêmes libellés que sur
 * le dashboard) ou à la main (libellé libre, quantité, pièce, notes).
 */
interface Props {
  logementId: string;
  isAdmin: boolean;
}

/** Familles d'équipements — miroir de l'enum côté API. */
const CATEGORIES: { value: EquipementCategory; label: string }[] = [
  { value: 'cuisine', label: 'Cuisine' },
  { value: 'electromenager', label: 'Électroménager' },
  { value: 'confort', label: 'Confort' },
  { value: 'exterieur', label: 'Extérieur' },
  { value: 'loisirs', label: 'Loisirs' },
  { value: 'bebe', label: 'Bébé' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'autre', label: 'Autre' },
];

const LogementEquipementsSection: React.FC<Props> = ({ logementId, isAdmin }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const list = useLogementEquipements(logementId);
  const [editing, setEditing] = useState<{ item: LogementEquipement | null } | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const items = list.data ?? [];
  const total = items.reduce((sum, e) => sum + e.quantity, 0);

  // Groupé par famille, dans l'ordre du catalogue (« Autre » en dernier).
  const groups = CATEGORIES.map((cat) => ({
    ...cat,
    items: items.filter((e) => (e.category ?? 'autre') === cat.value),
  })).filter((g) => g.items.length > 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text2 }]}>
            ÉQUIPEMENTS{total > 0 ? ` · ${total}` : ''}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            Ce que le prestataire trouvera sur place.
          </Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setCatalogOpen(true)}
          >
            <Boxes size={IconSize.sm} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Catalogue</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {list.isLoading ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : groups.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedText, textAlign: 'center' }}>
            Aucun équipement renseigné.
            {isAdmin ? ' Ouvre le catalogue pour en ajouter plusieurs d’un coup.' : ''}
          </Text>
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.value} style={{ gap: Spacing.xs }}>
            <Text style={[styles.groupTitle, { color: colors.mutedText }]}>{group.label}</Text>
            {group.items.map((e) => {
              const sub = [e.room_name, e.notes].filter(Boolean).join(' · ');
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={isAdmin ? () => setEditing({ item: e }) : undefined}
                  activeOpacity={isAdmin ? 0.7 : 1}
                  disabled={!isAdmin}
                >
                  <Package size={IconSize.sm} color={colors.text2} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.medium }}
                    >
                      {e.label}
                    </Text>
                    {sub ? (
                      <Text style={{ color: colors.text2, fontSize: FontSize.sm }} numberOfLines={1}>
                        {sub}
                      </Text>
                    ) : null}
                  </View>
                  {e.quantity > 1 ? (
                    <View style={[styles.qtyPill, { backgroundColor: colors.primary + '20' }]}>
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: FontSize.sm,
                          fontWeight: FontWeight.bold,
                        }}
                      >
                        ×{e.quantity}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))
      )}

      {isAdmin ? (
        <TouchableOpacity
          style={[styles.addRowBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
          onPress={() => setEditing({ item: null })}
        >
          <Plus size={IconSize.sm} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
            Ajouter un équipement
          </Text>
        </TouchableOpacity>
      ) : null}

      {editing ? (
        <EquipementEditModal
          logementId={logementId}
          item={editing.item}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {catalogOpen ? (
        <EquipementCatalogModal
          logementId={logementId}
          existing={items}
          onClose={() => setCatalogOpen(false)}
        />
      ) : null}
    </View>
  );
};

/** Création / édition d'un équipement (admin). */
function EquipementEditModal({
  logementId,
  item,
  onClose,
}: {
  logementId: string;
  item: LogementEquipement | null;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const rooms = useLogementRooms(logementId);
  const create = useCreateEquipement(logementId);
  const update = useUpdateEquipement(logementId);
  const remove = useDeleteEquipement(logementId);
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible: true });

  const [label, setLabel] = useState(item?.label ?? '');
  const [category, setCategory] = useState<EquipementCategory>(item?.category ?? 'cuisine');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [roomId, setRoomId] = useState<string | null>(item?.logement_room_id ?? null);
  const [notes, setNotes] = useState(item?.notes ?? '');

  const saving = create.isPending || update.isPending;

  const handleSave = async () => {
    if (!label.trim()) {
      void dialog.alert({ title: 'Nom requis', message: 'Donne un nom à l’équipement.' });
      return;
    }
    const qty = parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty < 1) {
      void dialog.alert({ title: 'Quantité invalide', message: 'La quantité doit être au moins 1.' });
      return;
    }
    const body = {
      label: label.trim(),
      category,
      quantity: qty,
      logement_room_id: roomId,
      notes: notes.trim() || null,
    };
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
      title: 'Supprimer l’équipement ?',
      message: `« ${item.label} » sera retiré de l’inventaire.`,
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
            {item ? 'Modifier l’équipement' : 'Nouvel équipement'}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>NOM</Text>
            <TextInput
              style={[
                sheetStyles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={label}
              onChangeText={setLabel}
              placeholder="Ex : Appareil à raclette"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>FAMILLE</Text>
            <View style={sheetStyles.chipRow}>
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[
                      sheetStyles.chip,
                      {
                        backgroundColor: active ? colors.primary + '20' : colors.itemBackground,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setCategory(c.value)}
                  >
                    <Text
                      style={{
                        color: active ? colors.primary : colors.text2,
                        fontSize: FontSize.sm,
                        fontWeight: FontWeight.medium,
                      }}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>QUANTITÉ</Text>
            <TextInput
              style={[
                sheetStyles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={colors.placeholder}
            />

            {(rooms.data ?? []).length > 0 ? (
              <>
                <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>PIÈCE (OPTIONNEL)</Text>
                <View style={sheetStyles.chipRow}>
                  <TouchableOpacity
                    style={[
                      sheetStyles.chip,
                      {
                        backgroundColor: roomId === null ? colors.primary + '20' : colors.itemBackground,
                        borderColor: roomId === null ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setRoomId(null)}
                  >
                    <Text
                      style={{
                        color: roomId === null ? colors.primary : colors.text2,
                        fontSize: FontSize.sm,
                      }}
                    >
                      Aucune
                    </Text>
                  </TouchableOpacity>
                  {(rooms.data ?? []).map((r) => {
                    const active = roomId === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          sheetStyles.chip,
                          {
                            backgroundColor: active ? colors.primary + '20' : colors.itemBackground,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setRoomId(r.id)}
                      >
                        <Text
                          style={{ color: active ? colors.primary : colors.text2, fontSize: FontSize.sm }}
                        >
                          {r.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>NOTES (OPTIONNEL)</Text>
            <TextInput
              style={[
                sheetStyles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex : dans le placard du haut"
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

/**
 * Sélection multiple depuis le catalogue de l'API. Les équipements déjà
 * présents sont grisés (l'API dédoublonne de toute façon sur le libellé).
 */
function EquipementCatalogModal({
  logementId,
  existing,
  onClose,
}: {
  logementId: string;
  existing: LogementEquipement[];
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const catalog = useEquipementCatalog();
  const bulkCreate = useBulkCreateEquipements(logementId);
  const [selected, setSelected] = useState<Record<string, EquipementCategory>>({});

  const alreadyThere = new Set(existing.map((e) => e.label.trim().toLowerCase()));
  const selectedLabels = Object.keys(selected);

  const toggle = (label: string, category: EquipementCategory) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[label]) delete next[label];
      else next[label] = category;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedLabels.length === 0) return;
    try {
      await bulkCreate.mutateAsync(
        selectedLabels.map((label) => ({ label, category: selected[label] })),
      );
      onClose();
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Ajout impossible',
      });
    }
  };

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
          <Text style={[sheetStyles.title, { color: colors.text }]}>Catalogue d’équipements</Text>
          <Text style={[sheetStyles.hint, { color: colors.mutedText }]}>
            Coche ce qui est présent dans le logement.
          </Text>

          {catalog.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.lg }} />
          ) : (
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {(catalog.data?.categories ?? [])
                .filter((c) => c.suggestions.length > 0)
                .map((cat) => (
                  <View key={cat.key} style={{ marginBottom: Spacing.md }}>
                    <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>
                      {cat.label.toUpperCase()}
                    </Text>
                    <View style={sheetStyles.chipRow}>
                      {cat.suggestions.map((label) => {
                        const present = alreadyThere.has(label.trim().toLowerCase());
                        const active = !!selected[label];
                        return (
                          <TouchableOpacity
                            key={label}
                            style={[
                              sheetStyles.chip,
                              {
                                backgroundColor: present
                                  ? colors.itemBackground
                                  : active
                                    ? colors.primary
                                    : colors.itemBackground,
                                borderColor: active ? colors.primary : colors.border,
                                opacity: present ? 0.45 : 1,
                              },
                            ]}
                            onPress={() => toggle(label, cat.key)}
                            disabled={present}
                          >
                            <Text
                              style={{
                                color: active ? '#FFFFFF' : colors.text2,
                                fontSize: FontSize.sm,
                                fontWeight: active ? FontWeight.semibold : FontWeight.regular,
                              }}
                            >
                              {present ? '✓ ' : ''}
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[
              sheetStyles.submit,
              {
                backgroundColor: colors.primary,
                opacity: selectedLabels.length > 0 && !bulkCreate.isPending ? 1 : 0.5,
              },
            ]}
            onPress={handleSubmit}
            disabled={selectedLabels.length === 0 || bulkCreate.isPending}
          >
            {bulkCreate.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={sheetStyles.submitText}>
                Ajouter{selectedLabels.length > 0 ? ` (${selectedLabels.length})` : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

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
  groupTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  qtyPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  addRowBtn: {
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  hint: { fontSize: FontSize.xs, marginBottom: Spacing.sm },
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

export default LogementEquipementsSection;
