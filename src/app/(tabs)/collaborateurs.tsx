import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, RefreshControl, ActivityIndicator, Pressable, Image } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import SheetHandle from '@/components/SheetHandle';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserPlus, Mail, X, Search, Plus, Building2, RefreshCw, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useAllUsers } from '@/api/hooks/useLogementMembers';
import { useInvitations, useCreateInvitation, useCancelInvitation, useResendInvitation, type Invitation } from '@/api/hooks/useInvitations';
import { useClients, clientDisplayName } from '@/api/hooks/useClients';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import SearchBar from '@/components/SearchBar';
import { useRouter } from 'expo-router';
import { useDialog } from '@/contexts/DialogContext';

const ROLE_COLORS: Record<string, string> = {
  admin: '#2563EB',
  prestataire: '#0891B2',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  prestataire: 'Prestataire',
};

type Tab = 'members' | 'clients';

/**
 * Collaborateurs — Phase M3 simplifiée.
 * Liste les utilisateurs de l'organisation + permet d'envoyer des invitations.
 * Gestion fine des équipes par manager (concept Buildr) supprimée du MVP.
 * En M5, on pourra ajouter la gestion des `logement-members` par logement.
 */
export default function CollaborateursScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const dialog = useDialog();

  const usersQuery = useAllUsers();
  const invitationsQuery = useInvitations();
  const createInvitation = useCreateInvitation();
  const cancelInvitation = useCancelInvitation();
  const resendInvitation = useResendInvitation();
  const clientsQuery = useClients();

  const [tab, setTab] = usePersistedState<Tab>('team.tab', 'members');
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'prestataire'>('prestataire');
  const inviteModalStyle = useKeyboardAwareModalStyle({ visible: showInviteModal });
  const inviteSwipe = useSwipeToClose(() => setShowInviteModal(false), showInviteModal);
  const insets = useSafeAreaInsets();

  const filtered = (usersQuery.data?.data ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.company_name || '').toLowerCase().includes(q)
    );
  });

  const filteredClients = (clientsQuery.data?.data ?? [])
    .filter((c) => !c.archived_at)
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const name = clientDisplayName(c).toLowerCase();
      return (
        name.includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.company_name || '').toLowerCase().includes(q)
      );
    });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await createInvitation.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
      setShowInviteModal(false);
      setInviteEmail('');
      void dialog.alert({ title: 'Invitation envoyée', message: `${inviteEmail.trim()} recevra un email.` });
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Envoi impossible' });
    }
  };

  // Invitations en attente, dédupliquées par email (on garde la plus récente).
  const pendingInvites = [
    ...(invitationsQuery.data?.data ?? [])
      .filter((i) => i.status === 'pending')
      .reduce((map, inv) => {
        const existing = map.get(inv.email);
        if (!existing || new Date(inv.created_at) > new Date(existing.created_at)) {
          map.set(inv.email, inv);
        }
        return map;
      }, new Map<string, Invitation>())
      .values(),
  ];

  const handleResendInvite = async (id: string, email: string) => {
    try {
      await resendInvitation.mutateAsync(id);
      void dialog.alert({ title: 'Invitation renvoyée', message: `${email} va recevoir un nouvel email.` });
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Renvoi impossible' });
    }
  };

  const handleCancelInvite = async (id: string, email: string) => {
    const ok = await dialog.confirm({
      title: "Annuler l'invitation ?",
      message: `L'invitation de ${email} sera supprimée.`,
    });
    if (!ok) return;
    await cancelInvitation.mutateAsync(id);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader>
        <Text style={[styles.title, { color: colors.text }]}>Équipe</Text>
        {isAdmin ? (
          tab === 'members' ? (
            <TouchableOpacity
              style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowInviteModal(true)}
            >
              <UserPlus size={IconSize.sm} color="#FFFFFF" />
              <Text style={styles.inviteBtnText}>Inviter</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/client/create' as never)}
            >
              <Plus size={IconSize.sm} color="#FFFFFF" />
              <Text style={styles.inviteBtnText}>Nouveau</Text>
            </TouchableOpacity>
          )
        ) : null}
      </AppHeader>

      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm }}>
        <View style={[styles.tabRow, { backgroundColor: colors.itemBackground }]}>
          {([
            { key: 'members', label: 'Membres' },
            { key: 'clients', label: 'Clients' },
          ] as { key: Tab; label: string }[]).map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tabBtn,
                  { backgroundColor: active ? colors.surface : 'transparent' },
                ]}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: active ? colors.text : colors.mutedText, fontWeight: active ? FontWeight.semibold : FontWeight.medium },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Rechercher…" />
      </View>

      {tab === 'members' ? (
        usersQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: Spacing.lg }}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            ListHeaderComponent={
              isAdmin && pendingInvites.length > 0 ? (
                <View style={{ marginBottom: Spacing.lg, gap: Spacing.sm }}>
                  <Text style={[styles.inviteSectionTitle, { color: colors.mutedText }]}>
                    INVITATIONS EN ATTENTE
                  </Text>
                  {pendingInvites.map((inv) => (
                    <View
                      key={inv.id}
                      style={[styles.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <Mail size={IconSize.md} color={colors.mutedText} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inviteEmail, { color: colors.text }]} numberOfLines={1}>
                          {inv.email}
                        </Text>
                        <Text style={[styles.inviteRole, { color: colors.mutedText }]}>
                          {ROLE_LABELS[inv.role] || inv.role}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleResendInvite(inv.id, inv.email)}
                        disabled={resendInvitation.isPending}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel="Renvoyer l'invitation"
                      >
                        <RefreshCw size={IconSize.md} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleCancelInvite(inv.id, inv.email)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel="Annuler l'invitation"
                      >
                        <Trash2 size={IconSize.md} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null
            }
            ListEmptyComponent={
              <Text style={{ color: colors.mutedText, textAlign: 'center', marginTop: Spacing.xl }}>
                Aucun membre.
              </Text>
            }
            refreshControl={
              <RefreshControl
                refreshing={usersQuery.isRefetching}
                onRefresh={() => usersQuery.refetch()}
                tintColor={colors.primary}
              />
            }
            renderItem={({ item }) => {
              const roleColor = ROLE_COLORS[item.role] || colors.mutedText;
              return (
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push(`/collaborateur/${item.id}` as never)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Text style={[styles.avatarText, { color: roleColor }]}>
                        {item.first_name[0]}
                        {item.last_name[0]}
                      </Text>
                    )}
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.name, { color: colors.text }]}>
                      {item.first_name} {item.last_name}
                    </Text>
                    <Text style={[styles.email, { color: colors.mutedText }]}>{item.email}</Text>
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor + '15' }]}>
                    <Text style={[styles.roleText, { color: roleColor }]}>
                      {ROLE_LABELS[item.role] || item.role}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )
      ) : clientsQuery.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          ListEmptyComponent={
            <Text style={{ color: colors.mutedText, textAlign: 'center', marginTop: Spacing.xl }}>
              Aucun client. {isAdmin ? 'Crée-en un avec le bouton Nouveau.' : ''}
            </Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={clientsQuery.isRefetching}
              onRefresh={() => clientsQuery.refetch()}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(`/client/${item.id}` as never)}
              activeOpacity={0.7}
            >
              <View style={[styles.avatar, { backgroundColor: '#0EA5E9' + '20' }]}>
                <Building2 size={20} color="#0EA5E9" />
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {clientDisplayName(item)}
                </Text>
                <Text style={[styles.email, { color: colors.mutedText }]} numberOfLines={1}>
                  {item.email || item.phone || item.city || '—'}
                </Text>
              </View>
              <View style={[styles.roleBadge, { backgroundColor: '#0EA5E9' + '15' }]}>
                <Text style={[styles.roleText, { color: '#0EA5E9' }]}>Client</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal invitation */}
      <Modal visible={showInviteModal} transparent animationType="slide" onRequestClose={() => setShowInviteModal(false)}>
        <GestureHandlerRootView style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowInviteModal(false)} />
            <Animated.View
              style={[
                styles.modal,
                { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
                inviteModalStyle,
                inviteSwipe.animatedStyle,
              ]}
            >
              <SheetHandle gesture={inviteSwipe.gesture} />
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: Spacing.sm }]}>Inviter un collaborateur</Text>
            <Text style={[styles.label, { color: colors.text2 }]}>Email</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground }]}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="nom@exemple.fr"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={[styles.label, { color: colors.text2 }]}>Rôle</Text>
            <View style={styles.rolePicker}>
              {(['admin', 'prestataire'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleChip,
                    {
                      backgroundColor: inviteRole === r ? ROLE_COLORS[r] + '20' : colors.itemBackground,
                      borderColor: inviteRole === r ? ROLE_COLORS[r] : colors.border,
                    },
                  ]}
                  onPress={() => setInviteRole(r)}
                >
                  <Text style={{ color: inviteRole === r ? ROLE_COLORS[r] : colors.text2 }}>
                    {ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.submit, { backgroundColor: colors.primary }]}
              onPress={handleInvite}
              disabled={createInvitation.isPending}
            >
              <Mail size={IconSize.md} color="#FFFFFF" />
              <Text style={styles.submitText}>
                {createInvitation.isPending ? 'Envoi…' : "Envoyer l'invitation"}
              </Text>
            </TouchableOpacity>
            </Animated.View>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  tabRow: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, gap: 2 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  tabText: { fontSize: FontSize.sm },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  inviteBtnText: { color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontWeight: FontWeight.bold, fontSize: FontSize.md },
  info: { flex: 1 },
  inviteSectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 0.5 },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  inviteEmail: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  inviteRole: { fontSize: FontSize.xs, marginTop: 2 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  email: { fontSize: FontSize.sm, marginTop: 2 },
  roleBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm, gap: Spacing.sm },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginTop: Spacing.sm },
  input: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, fontSize: FontSize.md },
  rolePicker: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.sm },
  roleChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1 },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  submitText: { color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.md },
});
