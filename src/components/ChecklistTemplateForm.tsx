import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save, X, Plus, GripVertical } from 'lucide-react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDialog } from '@/contexts/DialogContext';
import AutoScrollInput from '@/components/AutoScrollInput';
import {
  useChecklistTemplate,
  useCreateChecklistTemplate,
  useUpdateChecklistTemplate,
  type TemplateSectionInput,
} from '@/api/hooks/useChecklistTemplates';

interface EditableSection {
  /** Stable key pour DraggableFlatList — généré côté client, jamais persisté. */
  key: string;
  label: string;
  items: { label: string; required: boolean }[];
}

let SECTION_KEY_COUNTER = 0;
const nextKey = () => `s_${Date.now()}_${SECTION_KEY_COUNTER++}`;

/**
 * Éditeur de modèle de checklist (création + édition). On édite l'arbre
 * localement puis on sauve en un seul PATCH/POST (l'API remplace tout l'arbre).
 * Les sections sont réorganisables par drag (long press sur la poignée).
 */
export default function ChecklistTemplateForm({ templateId }: { templateId?: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const dialog = useDialog();
  const isEdit = !!templateId;

  const detail = useChecklistTemplate(templateId);
  const create = useCreateChecklistTemplate();
  const update = useUpdateChecklistTemplate(templateId ?? '');

  const [name, setName] = useState('');
  const [sections, setSections] = useState<EditableSection[]>([]);

  useEffect(() => {
    if (isEdit && detail.data) {
      setName(detail.data.name);
      setSections(
        detail.data.sections.map((s) => ({
          key: nextKey(),
          label: s.label,
          items: s.items.map((it) => ({ label: it.label, required: it.required })),
        })),
      );
    }
  }, [isEdit, detail.data]);

  const addSection = () =>
    setSections((s) => [...s, { key: nextKey(), label: '', items: [] }]);
  const removeSection = (key: string) => setSections((s) => s.filter((sec) => sec.key !== key));
  const setSectionLabel = (key: string, label: string) =>
    setSections((s) => s.map((sec) => (sec.key === key ? { ...sec, label } : sec)));
  const addItem = (key: string) =>
    setSections((s) =>
      s.map((sec) =>
        sec.key === key ? { ...sec, items: [...sec.items, { label: '', required: true }] } : sec,
      ),
    );
  const removeItem = (key: string, ii: number) =>
    setSections((s) =>
      s.map((sec) =>
        sec.key === key ? { ...sec, items: sec.items.filter((_, j) => j !== ii) } : sec,
      ),
    );
  const setItemLabel = (key: string, ii: number, label: string) =>
    setSections((s) =>
      s.map((sec) =>
        sec.key === key
          ? { ...sec, items: sec.items.map((it, j) => (j === ii ? { ...it, label } : it)) }
          : sec,
      ),
    );

  const handleSave = async () => {
    if (!name.trim()) {
      void dialog.alert({ title: 'Nom requis', message: 'Donne un nom au modèle.' });
      return;
    }
    const cleanSections: TemplateSectionInput[] = sections
      .filter((s) => s.label.trim())
      .map((s) => ({
        label: s.label.trim(),
        items: s.items
          .filter((it) => it.label.trim())
          .map((it) => ({ label: it.label.trim(), required: it.required })),
      }));
    try {
      if (isEdit) {
        await update.mutateAsync({ name: name.trim(), sections: cleanSections });
      } else {
        await create.mutateAsync({ name: name.trim(), sections: cleanSections });
      }
      router.back();
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  const saving = create.isPending || update.isPending;

  const renderSection = ({ item: section, drag, isActive }: RenderItemParams<EditableSection>) => (
    <ScaleDecorator>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: isActive ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={120}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Déplacer la section (maintenir appuyé)"
          >
            <GripVertical size={IconSize.md} color={colors.mutedText} />
          </TouchableOpacity>
          <AutoScrollInput
            style={[
              styles.sectionInput,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
            ]}
            value={section.label}
            onChangeText={(t) => setSectionLabel(section.key, t)}
            placeholder="Nom de la section (ex. Cuisine)"
            placeholderTextColor={colors.placeholder}
          />
          <TouchableOpacity
            onPress={() => removeSection(section.key)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={IconSize.md} color={colors.red} />
          </TouchableOpacity>
        </View>
        {section.items.map((item, ii) => (
          <View key={ii} style={styles.itemRow}>
            <Text style={{ color: colors.mutedText }}>•</Text>
            <AutoScrollInput
              style={[
                styles.itemInput,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
              ]}
              value={item.label}
              onChangeText={(t) => setItemLabel(section.key, ii, t)}
              placeholder="Tâche (ex. Nettoyer le plan de travail)"
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity
              onPress={() => removeItem(section.key, ii)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={IconSize.sm} color={colors.mutedText} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addItemBtn} onPress={() => addItem(section.key)}>
          <Plus size={IconSize.sm} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>
            Ajouter une tâche
          </Text>
        </TouchableOpacity>
      </View>
    </ScaleDecorator>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {isEdit ? 'Modifier le modèle' : 'Nouveau modèle'}
        </Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      {isEdit && detail.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <DraggableFlatList
          data={sections}
          onDragEnd={({ data }) => setSections(data)}
          keyExtractor={(item) => item.key}
          renderItem={renderSection}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              <Text style={[styles.label, { color: colors.text2 }]}>Nom du modèle</Text>
              <AutoScrollInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                value={name}
                onChangeText={setName}
                placeholder="Ex. Studio standard"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={[styles.hint, { color: colors.mutedText }]}>
                Maintiens appuyé sur la poignée à gauche d'une section pour la déplacer.
              </Text>
            </>
          }
          ListFooterComponent={
            <>
              <TouchableOpacity
                style={[styles.addSectionBtn, { borderColor: colors.primary }]}
                onPress={addSection}
              >
                <Plus size={IconSize.sm} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
                  Ajouter une section
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submit, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Save size={IconSize.md} color="#FFFFFF" />
                <Text style={styles.submitText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  hint: { fontSize: FontSize.xs, fontStyle: 'italic', marginTop: Spacing.xs },
  input: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, fontSize: FontSize.md },
  sectionCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionInput: { flex: 1, padding: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing.sm },
  itemInput: { flex: 1, padding: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, fontSize: FontSize.sm },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingLeft: Spacing.sm, paddingVertical: 4 },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
  },
  submitText: { color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.md },
});
