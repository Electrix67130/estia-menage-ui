import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  Pressable,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Search, X, User, Plus } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { clientDisplayName, type Client } from '@/api/hooks/useClients';

interface Props {
  visible: boolean;
  clients: Client[];
  selectedId: string;
  onSelect: (clientId: string) => void;
  onCreateNew?: () => void;
  onClose: () => void;
}

/**
 * Bottom-sheet recherchable pour choisir un client de facturation, calqué sur
 * la modal "gestion d'équipe" de buildr. Liste scrollable + champ de recherche
 * + option "Aucun" pour détacher + raccourci "Créer un client".
 */
const ClientPickerSheet: React.FC<Props> = ({
  visible,
  clients,
  selectedId,
  onSelect,
  onCreateNew,
  onClose,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [search, setSearch] = useState('');
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible });

  const filtered = useMemo(() => {
    const list = clients.filter((c) => !c.archived_at);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      [
        c.company_name,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        clientDisplayName(c),
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [clients, search]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setSearch('')}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { backgroundColor: colors.surface }, Shadow.lg, animatedModalStyle]}>
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Choisir un client</Text>
          </View>

          <View
            style={[
              styles.searchBox,
              { backgroundColor: colors.itemBackground, borderColor: colors.border },
            ]}
          >
            <Search size={16} color={colors.placeholder} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Rechercher un client…"
              placeholderTextColor={colors.placeholder}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {onCreateNew ? (
            <TouchableOpacity
              style={[styles.createBtn, { borderColor: colors.primary }]}
              onPress={onCreateNew}
              activeOpacity={0.7}
            >
              <Plus size={IconSize.sm} color={colors.primary} />
              <Text style={[styles.createText, { color: colors.primary }]}>
                Créer un nouveau client
              </Text>
            </TouchableOpacity>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={styles.flatList}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
            ListHeaderComponent={
              <TouchableOpacity
                style={[styles.row, selectedId === '' && { backgroundColor: colors.primary + '15' }]}
                onPress={() => onSelect('')}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: colors.itemBackground }]}>
                  <X size={IconSize.sm} color={colors.text2} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    color: selectedId === '' ? colors.primary : colors.text2,
                    fontSize: FontSize.md,
                    fontWeight: selectedId === '' ? FontWeight.semibold : FontWeight.regular,
                  }}
                >
                  Aucun client
                </Text>
              </TouchableOpacity>
            }
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.mutedText }]}>
                {search ? 'Aucun résultat.' : 'Aucun client. Crée-en un.'}
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              const sub = [item.company_name ? clientDisplayName({ first_name: item.first_name, last_name: item.last_name }) : null, item.email]
                .filter(Boolean)
                .join(' · ');
              return (
                <TouchableOpacity
                  style={[styles.row, isSelected && { backgroundColor: colors.primary + '15' }]}
                  onPress={() => onSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                    <User size={IconSize.sm} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: isSelected ? colors.primary : colors.text,
                        fontSize: FontSize.md,
                        fontWeight: isSelected ? FontWeight.semibold : FontWeight.medium,
                      }}
                      numberOfLines={1}
                    >
                      {clientDisplayName(item)}
                    </Text>
                    {sub ? (
                      <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }} numberOfLines={1}>
                        {sub}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 0,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, height: 44 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  createText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  flatList: { flexShrink: 1 },
  list: { paddingBottom: Spacing.sm },
  separator: { height: 1, marginHorizontal: -Spacing.md },
  empty: { fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(ClientPickerSheet);
