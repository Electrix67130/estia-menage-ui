import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator} from 'react-native';
import Animated from 'react-native-reanimated';
import { UserCog, Plus, Building2, X, Search } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useClients, useCreateClient, clientDisplayName } from '@/api/hooks/useClients';
import { useUpdateLogement } from '@/api/hooks/useLogements';
import CreateClientModal from '@/components/CreateClientModal';
import { useDialog } from '@/contexts/DialogContext';

interface Props {
  logementId: string;
  currentClientId: string | null;
  isAdmin: boolean;
}

interface PickerEntry {
  clientId: string;
  displayName: string;
  email: string | null;
}

const LogementClientSection: React.FC<Props> = ({ logementId, currentClientId, isAdmin }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const clients = useClients();
  const createClient = useCreateClient();
  const update = useUpdateLogement();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible: open });

  const openModal = () => {
    clients.refetch();
    setOpen(true);
  };

  // Liste des fiches client de l'org (annuaire), filtrées sur les non-archivées.
  const entries = useMemo<PickerEntry[]>(() => {
    const clientRows = clients.data?.data ?? [];
    return clientRows
      .filter((c) => !c.archived_at)
      .map((c) => ({
        clientId: c.id,
        displayName: clientDisplayName(c),
        email: c.email ?? null,
      }));
  }, [clients.data]);

  const current = useMemo(() => {
    if (!currentClientId) return null;
    return (clients.data?.data ?? []).find((c) => c.id === currentClientId) ?? null;
  }, [clients.data, currentClientId]);

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.displayName, e.email].filter(Boolean).some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [entries, search]);

  const assignEntry = async (entry: PickerEntry) => {
    try {
      await update.mutateAsync({ id: logementId, body: { client_id: entry.clientId } });
      setSearch('');
      setOpen(false);
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  const unassign = async () => {
    try {
      await update.mutateAsync({ id: logementId, body: { client_id: undefined } });
      setSearch('');
      setOpen(false);
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.text2 }]}>CLIENT (FACTURATION)</Text>
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          {current ? (
            <>
              <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
                {clientDisplayName(current)}
              </Text>
              {current.email ? (
                <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }}>{current.email}</Text>
              ) : null}
            </>
          ) : (
            <Text style={{ color: colors.mutedText, fontSize: FontSize.md, fontStyle: 'italic' }}>
              Aucun client rattaché
            </Text>
          )}
        </View>
        {isAdmin ? (
          <TouchableOpacity
            style={[styles.changeBtn, { backgroundColor: colors.primary }]}
            onPress={openModal}
          >
            <UserCog size={IconSize.sm} color="#FFFFFF" />
            <Text style={styles.changeBtnText}>{current ? 'Changer' : 'Affecter'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={sheetStyles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <Animated.View style={[sheetStyles.sheet, { backgroundColor: colors.surface }, Shadow.lg, animatedModalStyle]}>
            <View style={sheetStyles.handle}>
              <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
            </View>
            <View style={sheetStyles.header}>
              <View style={{ flex: 1 }}>
                <Text style={[sheetStyles.title, { color: colors.text }]}>Choisir un client</Text>
                <Text style={{ color: colors.mutedText, fontSize: FontSize.xs, marginTop: 2 }}>
                  {clients.isLoading || clients.isFetching
                    ? 'Chargement…'
                    : clients.error
                      ? `Erreur: ${clients.error instanceof Error ? clients.error.message : 'inconnue'}`
                      : `${entries.length} client${entries.length > 1 ? 's' : ''} disponible${entries.length > 1 ? 's' : ''}`}
                </Text>
              </View>
            </View>

            <View
              style={[
                sheetStyles.searchBox,
                { backgroundColor: colors.itemBackground, borderColor: colors.border },
              ]}
            >
              <Search size={16} color={colors.placeholder} />
              <TextInput
                style={[sheetStyles.searchInput, { color: colors.text }]}
                placeholder="Rechercher un client…"
                placeholderTextColor={colors.placeholder}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[
                sheetStyles.actionRow,
                { borderColor: colors.primary, borderStyle: 'dashed' },
              ]}
              onPress={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus size={IconSize.sm} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: FontWeight.semibold }}>
                Nouveau client…
              </Text>
            </TouchableOpacity>

            {clients.isLoading || clients.isFetching ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ padding: Spacing.lg }} />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(e) => e.clientId}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={sheetStyles.list}
                ItemSeparatorComponent={() => (
                  <View style={{ height: 1, backgroundColor: colors.border }} />
                )}
                ListHeaderComponent={
                  <TouchableOpacity
                    style={[
                      sheetStyles.row,
                      {
                        backgroundColor: !currentClientId ? colors.primary + '15' : 'transparent',
                      },
                    ]}
                    onPress={unassign}
                  >
                    <Text style={{ color: colors.text, fontStyle: 'italic' }}>
                      — Aucun (désassigner) —
                    </Text>
                  </TouchableOpacity>
                }
                ListEmptyComponent={
                  <Text style={[sheetStyles.empty, { color: colors.mutedText }]}>
                    {search
                      ? 'Aucun résultat.'
                      : "Aucun client dans ton équipe. Invite quelqu'un avec le rôle Client depuis l'onglet Équipe."}
                  </Text>
                }
                renderItem={({ item: e }) => {
                  const selected = !!e.clientId && e.clientId === currentClientId;
                  return (
                    <TouchableOpacity
                      style={[
                        sheetStyles.row,
                        {
                          backgroundColor: selected ? colors.primary + '15' : 'transparent',
                        },
                      ]}
                      onPress={() => assignEntry(e)}
                    >
                      <View
                        style={[sheetStyles.avatar, { backgroundColor: colors.primary + '20' }]}
                      >
                        <Building2 size={IconSize.sm} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: FontSize.md,
                            fontWeight: FontWeight.semibold,
                          }}
                        >
                          {e.displayName}
                        </Text>
                        {e.email ? (
                          <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }}>
                            {e.email}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </Animated.View>
        </View>
      </Modal>

      <CreateClientModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(c) => {
          // Auto-assign newly created client
          assignEntry({
            clientId: c.id,
            displayName: clientDisplayName(c),
            email: c.email ?? null,
          });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  changeBtnText: { color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
});

const sheetStyles = StyleSheet.create({
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
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, height: 44 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  list: { paddingBottom: Spacing.xl },
  empty: { fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

export default LogementClientSection;
