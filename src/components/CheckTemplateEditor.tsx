import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import Animated from 'react-native-reanimated';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Check,
  X,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import {
  Spacing,
  Radius,
  FontSize,
  FontWeight,
  IconSize,
  Shadow,
} from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useDialog } from '@/contexts/DialogContext';
import {
  useCheckTemplate,
  useCreateTemplateSection,
  useDeleteTemplateSection,
  useCreateTemplateItem,
  useDeleteTemplateItem,
  type CheckTemplateSection,
} from '@/api/hooks/useCheckTemplate';
import {
  useChecklistTemplates,
  useApplyChecklistTemplate,
} from '@/api/hooks/useChecklistTemplates';

/**
 * Editeur de checklist personnalisée d'un logement, inspiré du composant
 * ChantierSteps de buildr-ui : sections collapsibles + modals pour ajouter
 * sections/items (au lieu de champs inline). Plus compact visuellement quand
 * il y a beaucoup de sections.
 */
interface Props {
  logementId: string;
  isAdmin: boolean;
}

const CheckTemplateEditor: React.FC<Props> = ({ logementId, isAdmin }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const template = useCheckTemplate(logementId);
  const createSection = useCreateTemplateSection(logementId);
  const deleteSection = useDeleteTemplateSection(logementId);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingSection, setAddingSection] = useState(false);
  const [addingItemFor, setAddingItemFor] = useState<CheckTemplateSection | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const checklistTemplates = useChecklistTemplates();
  const applyTemplate = useApplyChecklistTemplate();

  const handleApplyTemplate = async (templateId: string, name: string) => {
    setApplyOpen(false);
    try {
      await applyTemplate.mutateAsync({ logementId, templateId });
      void dialog.alert({ title: 'Modèle appliqué', message: `"${name}" a été ajouté à la checklist.` });
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  const handleDeleteSection = async (id: string, label: string) => {
    const ok = await dialog.confirm({
      title: `Supprimer la section "${label}" ?`,
      message: 'Tous les items de cette section seront supprimés.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteSection.mutateAsync(id);
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  if (template.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const sections = template.data ?? [];

  return (
    <View style={styles.wrap}>
      {sections.length === 0 ? (
        <View
          style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={{ color: colors.mutedText, textAlign: 'center' }}>
            Aucune section.
            {isAdmin ? ' Ajoute une section pour personnaliser la checklist du logement.' : ''}
          </Text>
        </View>
      ) : (
        sections.map((s) => {
          const isCollapsed = collapsed[s.id] !== false; // collapsed par défaut
          return (
            <View
              key={s.id}
              style={[
                styles.sectionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setCollapsed((c) => ({ ...c, [s.id]: !isCollapsed }))}
                activeOpacity={0.7}
              >
                {isCollapsed ? (
                  <ChevronRight size={IconSize.sm} color={colors.text2} />
                ) : (
                  <ChevronDown size={IconSize.sm} color={colors.text2} />
                )}
                <ListChecks size={IconSize.sm} color={colors.primary} />
                <Text style={[styles.sectionLabel, { color: colors.text }]} numberOfLines={1}>
                  {s.label}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: colors.itemBackground }]}>
                  <Text style={{ color: colors.text2, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                    {s.items.length}
                  </Text>
                </View>
                {isAdmin ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteSection(s.id, s.label);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={`Supprimer ${s.label}`}
                  >
                    <Trash2 size={IconSize.sm} color={colors.red} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              {!isCollapsed ? (
                <View style={styles.itemsBlock}>
                  {s.items.length === 0 ? (
                    <Text style={[styles.emptyItems, { color: colors.mutedText }]}>
                      Aucun item.
                    </Text>
                  ) : (
                    s.items.map((it) => (
                      <ItemRow
                        key={it.id}
                        itemId={it.id}
                        label={it.label}
                        required={it.required}
                        logementId={logementId}
                        isAdmin={isAdmin}
                      />
                    ))
                  )}
                  {isAdmin ? (
                    <TouchableOpacity
                      style={[styles.addItemBtn, { borderColor: colors.primary }]}
                      onPress={() => setAddingItemFor(s)}
                    >
                      <Plus size={IconSize.sm} color={colors.primary} />
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: FontSize.sm,
                          fontWeight: FontWeight.semibold,
                        }}
                      >
                        Ajouter un item
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {isAdmin ? (
        <>
          <TouchableOpacity
            style={[styles.addSectionBtn, { backgroundColor: colors.primary }]}
            onPress={() => setAddingSection(true)}
          >
            <Plus size={IconSize.sm} color="#FFFFFF" />
            <Text style={styles.addSectionText}>Ajouter une section</Text>
          </TouchableOpacity>
          {(checklistTemplates.data ?? []).length > 0 ? (
            <TouchableOpacity
              style={[styles.applyTemplateBtn, { borderColor: colors.primary }]}
              onPress={() => setApplyOpen(true)}
              disabled={applyTemplate.isPending}
            >
              <ListChecks size={IconSize.sm} color={colors.primary} />
              <Text style={[styles.applyTemplateText, { color: colors.primary }]}>
                {applyTemplate.isPending ? 'Application…' : 'Appliquer un modèle'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      <ApplyTemplateModal
        visible={applyOpen}
        templates={checklistTemplates.data ?? []}
        onClose={() => setApplyOpen(false)}
        onPick={handleApplyTemplate}
      />

      <AddSectionModal
        visible={addingSection}
        onClose={() => setAddingSection(false)}
        onSubmit={async (label) => {
          try {
            await createSection.mutateAsync({ label });
            setAddingSection(false);
          } catch (err) {
            void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
          }
        }}
      />

      <AddItemModal
        section={addingItemFor}
        logementId={logementId}
        onClose={() => setAddingItemFor(null)}
      />
    </View>
  );
};

// =============================================================================
// ItemRow — une ligne d'item dans une section dépliée
// =============================================================================

function ItemRow({
  itemId,
  label,
  required,
  logementId,
  isAdmin,
}: {
  itemId: string;
  label: string;
  required: boolean;
  logementId: string;
  isAdmin: boolean;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const deleteItem = useDeleteTemplateItem(logementId);

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: 'Supprimer cet item ?',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteItem.mutateAsync(itemId);
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  return (
    <View style={[styles.itemRow, { borderTopColor: colors.border }]}>
      <View style={styles.itemBullet}>
        {required ? (
          <View style={[styles.reqDot, { backgroundColor: colors.primary }]} />
        ) : (
          <View style={[styles.dot, { backgroundColor: colors.border }]} />
        )}
      </View>
      <Text style={[styles.itemLabel, { color: colors.text }]}>
        {label}
        {required ? (
          <Text style={[styles.requiredTag, { color: colors.primary }]}> · Requis</Text>
        ) : null}
      </Text>
      {isAdmin ? (
        <TouchableOpacity
          onPress={handleDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Supprimer ${label}`}
        >
          <Trash2 size={12} color={colors.mutedText} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// =============================================================================
// AddSectionModal — bottom sheet pour ajouter une section
// =============================================================================

function AddSectionModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (label: string) => Promise<void> | void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible });

  const handleSubmit = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setLabel('');
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
      onShow={() => setLabel('')}
    >
      <View style={sheetStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[sheetStyles.sheet, { backgroundColor: colors.surface }, Shadow.lg, animatedModalStyle]}
        >
          <View style={sheetStyles.handle}>
            <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={sheetStyles.header}>
            <Text style={[sheetStyles.title, { color: colors.text }]}>Nouvelle section</Text>
          </View>

          <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>NOM DE LA SECTION</Text>
          <TextInput
            style={[
              sheetStyles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
            ]}
            value={label}
            onChangeText={setLabel}
            placeholder="Ex : Cuisine"
            placeholderTextColor={colors.placeholder}
            autoFocus
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[
              sheetStyles.submit,
              { backgroundColor: colors.primary, opacity: label.trim() && !submitting ? 1 : 0.5 },
            ]}
            onPress={handleSubmit}
            disabled={!label.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Plus size={IconSize.sm} color="#FFFFFF" />
                <Text style={sheetStyles.submitText}>Créer la section</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// =============================================================================
// AddItemModal — bottom sheet pour ajouter un item à une section donnée
// =============================================================================

function AddItemModal({
  section,
  logementId,
  onClose,
}: {
  section: CheckTemplateSection | null;
  logementId: string;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const createItem = useCreateTemplateItem(logementId);
  const [label, setLabel] = useState('');
  const [required, setRequired] = useState(false);
  const visible = !!section;
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible });

  const handleSubmit = async () => {
    const trimmed = label.trim();
    if (!trimmed || !section) return;
    try {
      await createItem.mutateAsync({ section_id: section.id, label: trimmed, required });
      setLabel('');
      setRequired(false);
      onClose();
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  if (!section) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => {
        setLabel('');
        setRequired(false);
      }}
    >
      <View style={sheetStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[sheetStyles.sheet, { backgroundColor: colors.surface }, Shadow.lg, animatedModalStyle]}
        >
          <View style={sheetStyles.handle}>
            <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={sheetStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[sheetStyles.title, { color: colors.text }]}>Nouvel item</Text>
              <Text style={{ color: colors.mutedText, fontSize: FontSize.sm, marginTop: 2 }}>
                Section : {section.label}
              </Text>
            </View>
          </View>

          <Text style={[sheetStyles.fieldLabel, { color: colors.text2 }]}>NOM DE L'ITEM</Text>
          <TextInput
            style={[
              sheetStyles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
            ]}
            value={label}
            onChangeText={setLabel}
            placeholder="Ex : Nettoyer la plaque"
            placeholderTextColor={colors.placeholder}
            autoFocus
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[
              sheetStyles.requiredRow,
              {
                backgroundColor: colors.itemBackground,
                borderColor: required ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setRequired((r) => !r)}
            activeOpacity={0.7}
          >
            <View
              style={[
                sheetStyles.requiredCheckbox,
                required
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { borderColor: colors.border },
              ]}
            >
              {required ? <Check size={12} color="#FFFFFF" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.medium }}
              >
                Item requis
              </Text>
              <Text style={{ color: colors.mutedText, fontSize: FontSize.xs, marginTop: 2 }}>
                Le presta doit obligatoirement le cocher pour terminer le ménage.
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              sheetStyles.submit,
              {
                backgroundColor: colors.primary,
                opacity: label.trim() && !createItem.isPending ? 1 : 0.5,
              },
            ]}
            onPress={handleSubmit}
            disabled={!label.trim() || createItem.isPending}
          >
            {createItem.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Plus size={IconSize.sm} color="#FFFFFF" />
                <Text style={sheetStyles.submitText}>Ajouter l&apos;item</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Picker pour appliquer un modèle de checklist org au logement. Les sections
 * du modèle sont ajoutées à la suite de la checklist existante.
 */
function ApplyTemplateModal({
  visible,
  templates,
  onClose,
  onPick,
}: {
  visible: boolean;
  templates: { id: string; name: string; section_count: number }[];
  onClose: () => void;
  onPick: (templateId: string, name: string) => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sheetStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[sheetStyles.applyCard, { backgroundColor: colors.surface }, Shadow.lg]}>
          <View style={sheetStyles.header}>
            <Text style={[sheetStyles.title, { color: colors.text }]}>Appliquer un modèle</Text>
          </View>
          <Text style={{ color: colors.text2, fontSize: FontSize.sm, marginBottom: Spacing.md }}>
            Les sections du modèle sont ajoutées à la checklist actuelle.
          </Text>
          {templates.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[sheetStyles.applyRow, { borderColor: colors.border }]}
              onPress={() => onPick(t.id, t.name)}
              activeOpacity={0.7}
            >
              <ListChecks size={IconSize.sm} color={colors.primary} />
              <Text style={{ flex: 1, color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.medium }}>
                {t.name}
              </Text>
              <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }}>
                {t.section_count} section{t.section_count > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  center: { padding: Spacing.lg, alignItems: 'center' },
  empty: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  sectionCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  sectionLabel: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    minWidth: 24,
    alignItems: 'center',
  },
  itemsBlock: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.xs },
  emptyItems: { fontSize: FontSize.xs, paddingVertical: Spacing.xs, textAlign: 'center' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  itemBullet: { width: 16, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  reqDot: { width: 8, height: 8, borderRadius: 4 },
  itemLabel: { flex: 1, fontSize: FontSize.sm },
  requiredTag: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'uppercase' },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.xs,
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  addSectionText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  applyTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.sm,
  },
  applyTemplateText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
});

const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  applyCard: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xs,
  },
  applyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheet: {
    maxHeight: '85%',
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
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
  },
  requiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  requiredCheckbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
  },
  submitText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
});

export default CheckTemplateEditor;
