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
import { Search, X, Check } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';

export interface FilterOption {
  id: string;
  label: string;
}

interface Props {
  visible: boolean;
  title: string;
  /** Option "Tous" implicite ajoutée en tête (id=''). */
  options: FilterOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  searchPlaceholder?: string;
  allLabel?: string;
}

/**
 * Bottom-sheet générique de sélection d'une option (avec recherche). Réutilisé
 * pour les filtres logement / prestataire / créateur de la liste des ménages.
 */
const FilterPickerSheet: React.FC<Props> = ({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  searchPlaceholder = 'Rechercher…',
  allLabel = 'Tous',
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [search, setSearch] = useState('');
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return [{ id: '', label: allLabel }, ...base];
  }, [options, search, allLabel]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={() => setSearch('')}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { backgroundColor: colors.surface }, Shadow.lg, animatedModalStyle]}>
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}>
            <Search size={16} color={colors.placeholder} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.placeholder}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id || '__all__'}
            keyboardShouldPersistTaps="handled"
            style={styles.flatList}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedText }]}>Aucun résultat.</Text>}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <TouchableOpacity style={styles.row} onPress={() => onSelect(item.id)} activeOpacity={0.7}>
                  <Text
                    style={{
                      flex: 1,
                      color: isSelected ? colors.primary : colors.text,
                      fontSize: FontSize.md,
                      fontWeight: isSelected ? FontWeight.semibold : FontWeight.regular,
                    }}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {isSelected ? <Check size={IconSize.sm} color={colors.primary} /> : null}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
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
  flatList: { flexShrink: 1 },
  list: { paddingBottom: Spacing.xxl },
  empty: { fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md },
});

export default React.memo(FilterPickerSheet);
