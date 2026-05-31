import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, ListChecks, Pencil, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDialog } from '@/contexts/DialogContext';
import {
  useChecklistTemplates,
  useDeleteChecklistTemplate,
  type ChecklistTemplateListItem,
} from '@/api/hooks/useChecklistTemplates';

export default function ChecklistTemplateListScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const dialog = useDialog();
  const { data, isLoading, isRefetching, refetch } = useChecklistTemplates();
  const remove = useDeleteChecklistTemplate();

  const handleDelete = async (tpl: ChecklistTemplateListItem) => {
    const ok = await dialog.confirm({
      title: 'Supprimer le modèle ?',
      message: `"${tpl.name}" sera supprimé. Les logements déjà créés ne sont pas affectés.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(tpl.id);
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Modèles de checklist</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={
            <Text style={{ color: colors.mutedText, textAlign: 'center', marginTop: Spacing.xl }}>
              Aucun modèle. Appuyez sur + pour en créer un.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, Shadow.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(`/checklist-template/edit/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
                <ListChecks size={IconSize.md} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.sub, { color: colors.mutedText }]}>
                  {item.section_count} section{item.section_count > 1 ? 's' : ''}
                </Text>
              </View>
              <Pencil size={IconSize.sm} color={colors.text2} />
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ marginLeft: Spacing.md }}
              >
                <Trash2 size={IconSize.sm} color={colors.red} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }, Shadow.lg]}
        onPress={() => router.push('/checklist-template/create')}
        accessibilityLabel="Créer un modèle"
      >
        <Plus size={IconSize.xl} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  sub: { fontSize: FontSize.sm, marginTop: 2 },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl + 20,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
