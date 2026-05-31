import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Home, Bed, Bath, Toilet, Utensils, Sofa, TreePine, ListChecks } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLogements } from '@/api/hooks/useLogements';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import type { Logement } from '@/api/types';

export default function LogementsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data, isLoading, isRefetching, refetch } = useLogements();

  const renderItem = ({ item }: { item: Logement }) => (
    <TouchableOpacity
      style={[styles.card, Shadow.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/logement/${item.id}`)}
      activeOpacity={0.7}
    >
      {item.cover_photo_url ? (
        <Image
          source={{ uri: item.cover_photo_url }}
          style={[styles.cover, { borderColor: colors.border }]}
        />
      ) : (
        <View
          style={[
            styles.cover,
            {
              backgroundColor: item.color ? item.color + '20' : colors.primary + '15',
              borderColor: item.color ? item.color : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Home size={IconSize.lg} color={item.color ?? colors.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          {item.color ? <View style={[styles.colorDot, { backgroundColor: item.color }]} /> : null}
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        {item.city ? (
          <Text style={[styles.sub, { color: colors.mutedText }]} numberOfLines={1}>
            {item.address ? `${item.address} · ` : ''}
            {item.city}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          {item.n_bedrooms > 0 ? (
            <View style={styles.stat}>
              <Bed size={14} color={colors.text2} />
              <Text style={[styles.statText, { color: colors.text2 }]}>{item.n_bedrooms}</Text>
            </View>
          ) : null}
          {item.n_bathrooms > 0 ? (
            <View style={styles.stat}>
              <Bath size={14} color={colors.text2} />
              <Text style={[styles.statText, { color: colors.text2 }]}>{item.n_bathrooms}</Text>
            </View>
          ) : null}
          {item.n_wc > 0 ? (
            <View style={styles.stat}>
              <Toilet size={14} color={colors.text2} />
              <Text style={[styles.statText, { color: colors.text2 }]}>{item.n_wc}</Text>
            </View>
          ) : null}
          {item.n_kitchens > 0 ? (
            <View style={styles.stat}>
              <Utensils size={14} color={colors.text2} />
              <Text style={[styles.statText, { color: colors.text2 }]}>{item.n_kitchens}</Text>
            </View>
          ) : null}
          {item.n_living_rooms > 0 ? (
            <View style={styles.stat}>
              <Sofa size={14} color={colors.text2} />
              <Text style={[styles.statText, { color: colors.text2 }]}>{item.n_living_rooms}</Text>
            </View>
          ) : null}
          {item.n_exterior_spaces > 0 ? (
            <View style={styles.stat}>
              <TreePine size={14} color={colors.text2} />
              <Text style={[styles.statText, { color: colors.text2 }]}>{item.n_exterior_spaces}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>Logements</Text>
          {isAdmin ? (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
              onPress={() => router.push('/checklist-template' as never)}
              accessibilityLabel="Modèles de checklist"
              accessibilityRole="button"
            >
              <ListChecks size={IconSize.sm} color={colors.primary} />
              <Text style={[styles.headerBtnText, { color: colors.text }]}>Modèles</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </AppHeader>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          ListEmptyComponent={
            <Text style={{ color: colors.mutedText, textAlign: 'center', marginTop: Spacing.xl }}>
              Aucun logement. Appuyez sur + pour en créer un.
            </Text>
          }
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        />
      )}

      {isAdmin ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }, Shadow.lg]}
          onPress={() => router.push('/logement/create')}
          accessibilityLabel="Créer un logement"
        >
          <Plus size={IconSize.xl} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  headerBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cover: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flexShrink: 1 },
  sub: { fontSize: FontSize.sm, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
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
