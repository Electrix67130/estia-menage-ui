import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Pressable,
  Switch,
  Linking,
  ScrollView,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  UserPlus,
  Trash2,
  X,
  Search,
  Mail,
  Phone,
  Pencil,
  Copy,
  Check,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
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
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';
import {
  useLogementMembers,
  useAddMember,
  useRemoveMember,
  useUpdateMember,
  useAllUsers,
  type MemberWithUser,
} from '@/api/hooks/useLogementMembers';
import type { LogementMemberRole } from '@/api/types';

type SectionRole = Extract<LogementMemberRole, 'prestataire' | 'manager'>;

interface Props {
  logementId: string;
  isAdmin: boolean;
  /** Role à afficher dans cette section. */
  role: SectionRole;
}

/** Clés i18n par rôle de section (`members.prestataire.*` / `members.manager.*`). */
const SECTION_KEYS: Record<
  SectionRole,
  {
    title: TranslationKeys;
    subtitle: TranslationKeys;
    empty: TranslationKeys;
    emptyAdmin: TranslationKeys;
    pickerTitle: TranslationKeys;
    searchPlaceholder: TranslationKeys;
    removeBody: TranslationKeys;
  }
> = {
  prestataire: {
    title: 'members.prestataire.title',
    subtitle: 'members.prestataire.subtitle',
    empty: 'members.prestataire.empty',
    emptyAdmin: 'members.prestataire.emptyAdmin',
    pickerTitle: 'members.prestataire.pickerTitle',
    searchPlaceholder: 'members.prestataire.searchPlaceholder',
    removeBody: 'members.prestataire.removeBody',
  },
  manager: {
    title: 'members.manager.title',
    subtitle: 'members.manager.subtitle',
    empty: 'members.manager.empty',
    emptyAdmin: 'members.manager.emptyAdmin',
    pickerTitle: 'members.manager.pickerTitle',
    searchPlaceholder: 'members.manager.searchPlaceholder',
    removeBody: 'members.manager.removeBody',
  },
};

const LogementMembersSection: React.FC<Props> = ({ logementId, isAdmin, role }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const { t } = useTranslation();
  const members = useLogementMembers(logementId);
  const remove = useRemoveMember();
  const [addOpen, setAddOpen] = useState(false);
  const [viewing, setViewing] = useState<MemberWithUser | null>(null);
  const [editingPerms, setEditingPerms] = useState<MemberWithUser | null>(null);

  const keys = SECTION_KEYS[role];

  const items = useMemo(
    () => (members.data?.data ?? []).filter((m) => m.role === role),
    [members.data, role],
  );

  const handleRemove = async (member: MemberWithUser) => {
    const name = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.email;
    const ok = await dialog.confirm({
      title: t('members.removeConfirmTitle', { name }),
      message: t(keys.removeBody),
      confirmLabel: t('common.remove'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(member.id);
      setViewing(null);
    } catch (err) {
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('common.unknownError'),
      });
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text2 }]}>{t(keys.title)}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>{t(keys.subtitle)}</Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setAddOpen(true)}
          >
            <UserPlus size={IconSize.sm} color="#FFFFFF" />
            <Text style={styles.addBtnText}>{t('common.add')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {members.isLoading ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedText, textAlign: 'center' }}>
            {t(keys.empty)}
            {isAdmin ? ` ${t(keys.emptyAdmin)}` : ''}
          </Text>
        </View>
      ) : (
        items.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.memberRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setViewing(m)}
            activeOpacity={0.7}
          >
            <View style={[styles.roleBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                {(m.first_name?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}
              >
                {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
              </Text>
              <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }}>{m.email}</Text>
            </View>
            {isAdmin ? (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleRemove(m);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={t('common.remove')}
              >
                <Trash2 size={IconSize.sm} color={colors.red} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        ))
      )}

      <AddMemberModal
        visible={addOpen}
        logementId={logementId}
        role={role}
        existingUserIds={items.map((m) => m.user_id)}
        onClose={() => setAddOpen(false)}
        title={t(keys.pickerTitle)}
        searchPlaceholder={t(keys.searchPlaceholder)}
      />

      <MemberContactSheet
        member={viewing}
        isAdmin={isAdmin}
        canEditPerms={isAdmin && viewing?.role === 'prestataire'}
        onClose={() => setViewing(null)}
        onEditPerms={() => {
          if (viewing) {
            setEditingPerms(viewing);
            setViewing(null);
          }
        }}
        onRemove={(m) => {
          // iOS ne peut pas afficher un Alert au-dessus d'un Modal ouvert : on
          // ferme le contact sheet d'abord, puis on déclenche l'Alert après que
          // l'animation de dismiss soit terminée (sinon l'Alert est avalé).
          setViewing(null);
          setTimeout(() => handleRemove(m), 350);
        }}
      />

      <MemberPermissionsModal
        member={editingPerms}
        logementId={logementId}
        onClose={() => setEditingPerms(null)}
      />
    </View>
  );
};

// =============================================================================
// AddMemberModal — bottom sheet pour piocher un user à ajouter au logement
// =============================================================================

function AddMemberModal({
  visible,
  logementId,
  role,
  existingUserIds,
  onClose,
  title,
  searchPlaceholder,
}: {
  visible: boolean;
  logementId: string;
  role: SectionRole;
  existingUserIds: string[];
  onClose: () => void;
  title: string;
  searchPlaceholder: string;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const { t } = useTranslation();
  const allUsers = useAllUsers();
  const add = useAddMember();
  const [search, setSearch] = useState('');
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible });

  // Pour la section prestataire on cible les users role='prestataire'.
  // Pour la section responsable (manager du logement), on autorise admin OU
  // prestataire — l'admin org est l'archétype du responsable, mais on peut
  // aussi promouvoir un prestataire en référent du logement.
  const available = useMemo(() => {
    const users = allUsers.data?.data ?? [];
    if (role === 'prestataire') {
      return users.filter(
        (u) => u.role === 'prestataire' && !existingUserIds.includes(u.id),
      );
    }
    return users.filter(
      (u) => (u.role === 'admin' || u.role === 'prestataire') && !existingUserIds.includes(u.id),
    );
  }, [allUsers.data, existingUserIds, role]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter((u) =>
      [u.first_name, u.last_name, u.email, u.company_name]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [available, search]);

  const handlePick = async (userId: string) => {
    try {
      await add.mutateAsync({
        logement_id: logementId,
        user_id: userId,
        role,
      });
      setSearch('');
      onClose();
    } catch (err) {
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('common.unknownError'),
      });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[sheetStyles.sheet, { backgroundColor: colors.surface }, Shadow.lg, animatedModalStyle]}
        >
          <View style={sheetStyles.handle}>
            <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={sheetStyles.header}>
            <Text style={[sheetStyles.title, { color: colors.text }]}>{title}</Text>
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
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.placeholder}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {allUsers.isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ padding: Spacing.lg }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(u) => u.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={sheetStyles.list}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: colors.border }} />
              )}
              ListEmptyComponent={
                <Text style={[sheetStyles.empty, { color: colors.mutedText }]}>
                  {search
                    ? t('members.noResult')
                    : available.length === 0
                      ? t('members.noCandidate')
                      : ''}
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={sheetStyles.userRow}
                  onPress={() => handlePick(item.id)}
                  disabled={add.isPending}
                >
                  <View style={[sheetStyles.avatar, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[sheetStyles.avatarText, { color: colors.primary }]}>
                      {(item.first_name?.[0] ?? '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: FontSize.md,
                        fontWeight: FontWeight.semibold,
                      }}
                    >
                      {[item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}
                    </Text>
                    <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }}>
                      {item.email}
                    </Text>
                  </View>
                  <UserPlus size={IconSize.sm} color={colors.primary} />
                </TouchableOpacity>
              )}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// =============================================================================
// MemberContactSheet — petite fiche contact ouverte au tap sur un member
// =============================================================================

export function MemberContactSheet({
  member,
  isAdmin,
  canEditPerms,
  onClose,
  onEditPerms,
  onRemove,
}: {
  member: MemberWithUser | null;
  isAdmin: boolean;
  canEditPerms?: boolean;
  onClose: () => void;
  onEditPerms?: () => void;
  onRemove?: (m: MemberWithUser) => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);

  const copy = async (value: string, field: 'email' | 'phone') => {
    await Clipboard.setStringAsync(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const visible = !!member;

  if (!member) return null;

  const name =
    [member.first_name, member.last_name].filter(Boolean).join(' ') || member.email;
  const initials = (member.first_name?.[0] ?? member.email?.[0] ?? '?').toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            sheetStyles.sheet,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.md) },
            Shadow.lg,
          ]}
        >
          <View style={sheetStyles.handle}>
            <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={sheetStyles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
              <View
                style={[contactStyles.avatar, { backgroundColor: colors.primary + '20' }]}
              >
                <Text style={[contactStyles.avatarText, { color: colors.primary }]}>
                  {initials}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold }}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                {member.company_name ? (
                  <Text
                    style={{ color: colors.text2, fontSize: FontSize.sm, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {member.company_name}
                  </Text>
                ) : null}
                <View
                  style={[
                    contactStyles.roleChip,
                    { backgroundColor: colors.primary + '15' },
                  ]}
                >
                  <Text
                    style={{ color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}
                  >
                    {member.role === 'prestataire'
                      ? t('collab.role.prestataire')
                      : member.role === 'manager'
                        ? t('members.role.manager')
                        : t('members.role.client_proprietaire')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[contactStyles.sectionLabel, { color: colors.text2 }]}>{t('members.contactSection')}</Text>

            {member.email ? (
              <ContactRow
                icon={<Mail size={IconSize.md} color={colors.primary} />}
                label={t('auth.email')}
                value={member.email}
                accent={colors.primary}
                onPress={() => Linking.openURL(`mailto:${member.email}`)}
                copied={copiedField === 'email'}
                onCopy={() => copy(member.email!, 'email')}
              />
            ) : null}

            {member.phone ? (
              <ContactRow
                icon={<Phone size={IconSize.md} color="#059669" />}
                label={t('auth.phone')}
                value={member.phone}
                accent="#059669"
                onPress={() => Linking.openURL(`tel:${member.phone}`)}
                copied={copiedField === 'phone'}
                onCopy={() => copy(member.phone!, 'phone')}
                style={{ marginTop: Spacing.sm }}
              />
            ) : null}

            {canEditPerms && onEditPerms ? (
              <TouchableOpacity
                style={[contactStyles.actionBtn, { borderColor: colors.primary, marginTop: Spacing.xl }]}
                onPress={onEditPerms}
              >
                <Pencil size={IconSize.md} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.medium }}>
                  {t('members.managePermissions')}
                </Text>
              </TouchableOpacity>
            ) : null}

            {isAdmin && onRemove ? (
              <TouchableOpacity
                style={[contactStyles.actionBtn, { borderColor: colors.red, marginTop: Spacing.sm }]}
                onPress={() => onRemove(member)}
              >
                <Trash2 size={IconSize.md} color={colors.red} />
                <Text style={{ color: colors.red, fontSize: FontSize.base, fontWeight: FontWeight.medium }}>
                  {t('members.removeFromLogement')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ContactRow({
  icon,
  label,
  value,
  accent,
  onPress,
  copied,
  onCopy,
  style,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  onPress: () => void;
  copied: boolean;
  onCopy: () => void;
  style?: object;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={[
        contactStyles.row,
        { backgroundColor: colors.itemBackground, borderColor: colors.border },
        style,
      ]}
      onPress={onPress}
    >
      <View style={[contactStyles.iconBox, { backgroundColor: accent + '15' }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text2, fontSize: FontSize.xs }}>{label}</Text>
        <Text
          style={{ color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: 2 }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          contactStyles.copyBtn,
          {
            backgroundColor: copied ? colors.green + '25' : accent + '15',
            borderColor: copied ? colors.green : accent,
          },
        ]}
        onPress={onCopy}
        accessibilityLabel={t('common.copy')}
      >
        {copied ? (
          <Check size={IconSize.sm} color={colors.green} />
        ) : (
          <Copy size={IconSize.sm} color={accent} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// =============================================================================
// MemberPermissionsModal — toggles can_view_* (admin only, prestataire only)
// =============================================================================

const PERMISSION_TOGGLES: {
  key: 'can_view_prestataires' | 'can_view_responsables' | 'can_view_clients';
  label: TranslationKeys;
  desc: TranslationKeys;
}[] = [
  {
    key: 'can_view_prestataires',
    label: 'members.perm.viewPrestataires',
    desc: 'members.perm.viewPrestatairesDesc',
  },
  {
    key: 'can_view_responsables',
    label: 'members.perm.viewResponsables',
    desc: 'members.perm.viewResponsablesDesc',
  },
  {
    key: 'can_view_clients',
    label: 'members.perm.viewClients',
    desc: 'members.perm.viewClientsDesc',
  },
];

function MemberPermissionsModal({
  member,
  logementId,
  onClose,
}: {
  member: MemberWithUser | null;
  logementId: string;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const update = useUpdateMember();
  // On lit la version FRAÎCHE du member depuis la query — quand le mutation
  // invalide le cache, la liste se rafraîchit et on récupère les nouveaux
  // flags. Sans ça, le Switch reste figé sur la valeur initiale (le prop
  // `member` ne change plus après ouverture de la modal).
  const members = useLogementMembers(logementId);
  const liveMember = useMemo(
    () => (member ? (members.data?.data ?? []).find((m) => m.id === member.id) ?? member : null),
    [members.data, member],
  );
  const visible = !!member;

  if (!liveMember) return null;

  const togglePerm = (
    key: 'can_view_prestataires' | 'can_view_responsables' | 'can_view_clients',
    value: boolean,
  ) => {
    update.mutate({ id: liveMember.id, body: { [key]: value } });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            sheetStyles.sheet,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.md) },
            Shadow.lg,
          ]}
        >
          <View style={sheetStyles.handle}>
            <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={sheetStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[sheetStyles.title, { color: colors.text }]}>{t('members.permissionsTitle')}</Text>
              <Text style={{ color: colors.mutedText, fontSize: FontSize.sm, marginTop: 2 }}>
                {[liveMember.first_name, liveMember.last_name].filter(Boolean).join(' ') ||
                  liveMember.email}
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[contactStyles.sectionLabel, { color: colors.text2 }]}>{t('members.permissionsSection')}</Text>

            {PERMISSION_TOGGLES.map((p) => {
              const value = !!liveMember[p.key];
              return (
                <View key={p.key} style={[permStyles.row, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.medium }}
                    >
                      {t(p.label)}
                    </Text>
                    <Text style={{ color: colors.mutedText, fontSize: FontSize.xs, marginTop: 2 }}>
                      {t(p.desc)}
                    </Text>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={(v) => togglePerm(p.key, v)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              );
            })}
          </ScrollView>
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  roleBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeText: { fontWeight: FontWeight.bold, fontSize: FontSize.md },
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
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, height: 44 },
  list: { paddingBottom: Spacing.xl },
  empty: { fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.lg },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
});

const contactStyles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  roleChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    marginTop: Spacing.xs,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});

const permStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
});

export default LogementMembersSection;
