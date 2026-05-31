import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Search, UserCircle, Building2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useClients, clientDisplayName, type Client } from '@/api/hooks/useClients';

export default function ClientsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const list = useClients();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = list.data?.data ?? [];
    if (!q) return items;
    return items.filter((c) =>
      [c.first_name, c.last_name, c.company_name, c.email, c.city]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [list.data, search]);

  const renderItem = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/client/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        {item.company_name ? (
          <Building2 size={IconSize.md} color="#FFFFFF" />
        ) : (
          <UserCircle size={IconSize.md} color="#FFFFFF" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {clientDisplayName(item)}
          </Text>
          {item.archived_at ? (
            <Text style={{ fontSize: 10, color: colors.mutedText, fontWeight: '700' }}>
              · ARCHIVÉ
            </Text>
          ) : null}
        </View>
        {item.city || item.email ? (
          <Text style={[styles.sub, { color: colors.mutedText }]} numberOfLines={1}>
            {[item.city, item.email].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Clients</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.searchField, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Search size={IconSize.sm} color={colors.mutedText} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Nom, entreprise, ville…"
            placeholderTextColor={colors.placeholder}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {list.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.mutedText }]}>
              {search ? 'Aucun client trouvé.' : 'Aucun client encore. Appuie sur + pour en créer un.'}
            </Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching}
              onRefresh={() => list.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {isAdmin ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }, Shadow.lg]}
          onPress={() => router.push('/client/create')}
          accessibilityRole="button"
          accessibilityLabel="Nouveau client"
        >
          <Plus size={IconSize.xl} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: FontSize.md },
  list: { padding: Spacing.lg, paddingBottom: 100, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: Spacing.xxxl, fontSize: FontSize.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  sub: { fontSize: FontSize.sm, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: Spacing.xxl,
    bottom: Spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
