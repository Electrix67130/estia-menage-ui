import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useDialog } from '@/contexts/DialogContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Mail, Phone, Building2, Check, CalendarClock } from 'lucide-react-native';
import { useUser, useUpdateUserRole } from '@/api/hooks/useUser';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize, FontWeight, Radius, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { openPhone, openEmail } from '@/lib/contact-links';
import type { UserRole } from '@/api/types';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'prestataire', label: 'Prestataire' },
];

export default function CollaborateurDetailScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const { data: user, isLoading } = useUser(id);
  const updateRole = useUpdateUserRole();
  const dialog = useDialog();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  React.useEffect(() => {
    if (user) setSelectedRole(user.role);
  }, [user]);

  const isAdmin = me?.role === 'admin';
  const isMe = me?.id === id;
  const canChangeRole = isAdmin && !isMe;
  const roleChanged = selectedRole !== null && user && selectedRole !== user.role;

  const handleSaveRole = async () => {
    if (!selectedRole || !user || !roleChanged) return;
    const ok = await dialog.confirm({
      title: 'Changer le rôle ?',
      message: `${user.first_name ?? user.email} passera de "${user.role}" à "${selectedRole}". Cela modifie immédiatement ses permissions.`,
      confirmLabel: 'Changer',
    });
    if (!ok) return;
    updateRole.mutate(
      { id: id!, role: selectedRole },
      {
        onSuccess: () => {
          void dialog.alert({ title: 'Rôle mis à jour' });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Erreur';
          void dialog.alert({ title: 'Erreur', message: msg });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <ArrowLeft size={IconSize.md} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.empty, { color: colors.mutedText }]}>Utilisateur introuvable.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={IconSize.md} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Collaborateur</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.identityRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {(user.first_name?.[0] ?? '') + (user.last_name?.[0] ?? '')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]}>
              {user.first_name} {user.last_name}
              {isMe ? <Text style={[styles.me, { color: colors.mutedText }]}> (vous)</Text> : null}
            </Text>
            <Text style={[styles.role, { color: colors.text2 }]}>
              {labelForRole(user.role)}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text2 }]}>Coordonnées</Text>

        <TouchableOpacity
          style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => openEmail(user.email)}
        >
          <Mail size={IconSize.sm} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactLabel, { color: colors.text2 }]}>Email</Text>
            <Text style={[styles.contactValue, { color: colors.text }]}>{user.email}</Text>
          </View>
        </TouchableOpacity>

        {user.phone ? (
          <TouchableOpacity
            style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => openPhone(user.phone)}
          >
            <Phone size={IconSize.sm} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactLabel, { color: colors.text2 }]}>Téléphone</Text>
              <Text style={[styles.contactValue, { color: colors.text }]}>{user.phone}</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {user.company_name ? (
          <View
            style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Building2 size={IconSize.sm} color={colors.text2} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactLabel, { color: colors.text2 }]}>Entreprise</Text>
              <Text style={[styles.contactValue, { color: colors.text }]}>
                {user.company_name}
              </Text>
            </View>
          </View>
        ) : null}

        {canChangeRole ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text2 }]}>Rôle</Text>
            <View style={styles.rolesRow}>
              {ROLES.map((r) => {
                const active = selectedRole === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedRole(r.value)}
                  >
                    <Text
                      style={[
                        styles.roleChipLabel,
                        { color: active ? '#fff' : colors.text },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {roleChanged ? (
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveRole}
                disabled={updateRole.isPending}
              >
                <Check size={IconSize.sm} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {updateRole.isPending ? 'Enregistrement…' : 'Enregistrer le rôle'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        {isAdmin && user && !isMe ? <PrestataireActivity userId={user.id} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

import { useUserEarnings } from '@/api/hooks/useUserEarnings';
import { useMenages } from '@/api/hooks/useMenages';
import { useRescheduleRequestsForUser, useDecideReschedule } from '@/api/hooks/useReschedule';
import { formatDateFr, formatCurrencyFr } from '@/lib/date-fr';

function PrestataireActivity({ userId }: { userId: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const earnings = useUserEarnings(userId);
  const menages = useMenages({ prestataire_user_id: userId, limit: 50 });
  const reschedules = useRescheduleRequestsForUser(userId);
  const decide = useDecideReschedule();
  const dialog = useDialog();

  const upcoming = (menages.data?.data ?? [])
    .filter((m) => m.status === 'a_venir' || m.status === 'en_cours')
    .sort((a, b) => a.date_prevue.slice(0, 10).localeCompare(b.date_prevue.slice(0, 10)))
    .slice(0, 5);

  const pendingReschedules = (reschedules.data?.data ?? []).filter((r) => r.status === 'pending');

  const handleDecide = async (
    id: string,
    decision: 'approved' | 'rejected',
    apply: boolean,
  ) => {
    try {
      await decide.mutateAsync({ id, decision, apply_to_menage: apply });
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  return (
    <View style={activityStyles.wrap}>
      <Text style={[styles.sectionTitle, { color: colors.text2 }]}>GAINS DU PRESTATAIRE</Text>
      <View style={[activityStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {earnings.isLoading ? (
          <Text style={{ color: colors.mutedText }}>Chargement…</Text>
        ) : earnings.data ? (
          <>
            <Text style={[activityStyles.total, { color: colors.text }]}>
              {formatCurrencyFr(earnings.data.total, earnings.data.currency)}
            </Text>
            <Text style={{ color: colors.mutedText, fontSize: FontSize.sm }}>
              sur {earnings.data.count} ménage{earnings.data.count > 1 ? 's' : ''} terminé{earnings.data.count > 1 ? 's' : ''}
            </Text>
          </>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text2 }]}>PROCHAINS MÉNAGES</Text>
      <View style={[activityStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {menages.isLoading ? (
          <Text style={{ color: colors.mutedText }}>Chargement…</Text>
        ) : upcoming.length === 0 ? (
          <Text style={{ color: colors.mutedText }}>Aucun ménage à venir.</Text>
        ) : (
          upcoming.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={activityStyles.row}
              onPress={() => router.push(`/menage/${m.id}`)}
            >
              <CalendarClock size={IconSize.sm} color={colors.primary} />
              <Text style={[activityStyles.rowText, { color: colors.text }]}>
                {formatDateFr(m.date_prevue.slice(0, 10), 'weekdayShort')}
                {m.horaire_prevu ? ` · ${m.horaire_prevu.slice(0, 5)}` : ''}
              </Text>
              <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }} numberOfLines={1}>
                {m.logement_name || m.logement_city || '—'}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {pendingReschedules.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text2 }]}>
            DEMANDES DE CHANGEMENT ({pendingReschedules.length})
          </Text>
          <View style={[activityStyles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: Spacing.md }]}>
            {pendingReschedules.map((r) => (
              <View key={r.id} style={activityStyles.reschedule}>
                <Text style={{ color: colors.text, fontSize: FontSize.sm }}>
                  <Text style={{ color: colors.mutedText }}>Du </Text>
                  {formatDateFr(r.original_date.slice(0, 10), 'long')}
                  <Text style={{ color: colors.mutedText }}> au </Text>
                  <Text style={{ color: colors.primary, fontWeight: FontWeight.semibold }}>
                    {formatDateFr(r.proposed_date.slice(0, 10), 'long')}
                  </Text>
                </Text>
                {r.reason ? (
                  <Text style={{ color: colors.text2, fontSize: FontSize.xs, fontStyle: 'italic' }}>
                    « {r.reason} »
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    style={[activityStyles.btn, { backgroundColor: colors.primary }]}
                    onPress={() => handleDecide(r.id, 'approved', true)}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                      Approuver
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[activityStyles.btn, { backgroundColor: colors.red }]}
                    onPress={() => handleDecide(r.id, 'rejected', false)}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                      Refuser
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const activityStyles = StyleSheet.create({
  wrap: { marginTop: Spacing.lg, gap: Spacing.sm },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  total: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  rowText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, textTransform: 'capitalize', flex: 1 },
  reschedule: { gap: Spacing.xs },
  btn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
});

function labelForRole(r: UserRole): string {
  return ROLES.find((opt) => opt.value === r)?.label ?? r;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: { padding: Spacing.xs },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  me: { fontSize: FontSize.sm, fontWeight: FontWeight.regular },
  role: { fontSize: FontSize.sm, marginTop: 2 },
  sectionTitle: {
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  contactLabel: { fontSize: FontSize.xs },
  contactValue: { fontSize: FontSize.md, fontWeight: FontWeight.medium, marginTop: 2 },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  roleChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  roleChipLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  saveBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  empty: { textAlign: 'center', marginTop: Spacing.xl, fontSize: FontSize.sm },
});
