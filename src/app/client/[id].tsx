import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save, Trash2, Building2, MapPin, Mail, Phone } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import AutoScrollInput from '@/components/AutoScrollInput';
import {
  useClient,
  useUpdateClient,
  useArchiveClient,
  useClientLogements,
  clientDisplayName,
  type UpdateClientInput,
} from '@/api/hooks/useClients';
import { useDialog } from '@/contexts/DialogContext';

export default function ClientDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const dialog = useDialog();
  const { data: client, isLoading } = useClient(id);
  const update = useUpdateClient(id!);
  const archive = useArchiveClient();
  const logements = useClientLogements(id);

  const [form, setForm] = useState<UpdateClientInput>({});
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (client) {
      setForm({
        first_name: client.first_name ?? undefined,
        last_name: client.last_name ?? undefined,
        company_name: client.company_name ?? undefined,
        email: client.email ?? undefined,
        phone: client.phone ?? undefined,
        billing_address: client.billing_address ?? undefined,
        postal_code: client.postal_code ?? undefined,
        city: client.city ?? undefined,
        country: client.country,
        siret: client.siret ?? undefined,
        vat_number: client.vat_number ?? undefined,
        notes: client.notes ?? undefined,
      });
    }
  }, [client]);

  if (isLoading || !client) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    setError('');
    if (!form.first_name?.trim() && !form.last_name?.trim() && !form.company_name?.trim()) {
      setError('Au moins un nom est requis.');
      return;
    }
    try {
      await update.mutateAsync(form);
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleArchive = async () => {
    const ok = await dialog.confirm({
      title: 'Archiver ce client ?',
      message: 'Le client sera caché des listes. Les logements rattachés restent.',
      confirmLabel: 'Archiver',
      destructive: true,
    });
    if (!ok) return;
    try {
      await archive.mutateAsync(id!);
      router.back();
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Erreur' });
    }
  };

  const set = (k: keyof UpdateClientInput, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

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
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {clientDisplayName(client)}
        </Text>
        {isAdmin ? (
          <TouchableOpacity
            onPress={handleArchive}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Archiver"
          >
            <Trash2 size={IconSize.md} color={colors.red} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: IconSize.lg }} />
        )}
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.body}>
        {editMode && isAdmin ? (
          <>
            <Text style={[styles.section, { color: colors.text2 }]}>IDENTITÉ</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <AutoScrollInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.first_name ?? ''}
                onChangeText={(v) => set('first_name', v)}
                placeholder="Prénom"
                placeholderTextColor={colors.placeholder}
              />
              <AutoScrollInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.last_name ?? ''}
                onChangeText={(v) => set('last_name', v)}
                placeholder="Nom"
                placeholderTextColor={colors.placeholder}
              />
            </View>
            <AutoScrollInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={form.company_name ?? ''}
              onChangeText={(v) => set('company_name', v)}
              placeholder="Entreprise"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={[styles.section, { color: colors.text2 }]}>CONTACT</Text>
            <AutoScrollInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={form.email ?? ''}
              onChangeText={(v) => set('email', v)}
              placeholder="Email"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AutoScrollInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={form.phone ?? ''}
              onChangeText={(v) => set('phone', v)}
              placeholder="Téléphone"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
            />

            <Text style={[styles.section, { color: colors.text2 }]}>FACTURATION</Text>
            <AutoScrollInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={form.billing_address ?? ''}
              onChangeText={(v) => set('billing_address', v)}
              placeholder="Adresse"
              placeholderTextColor={colors.placeholder}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <AutoScrollInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.postal_code ?? ''}
                onChangeText={(v) => set('postal_code', v)}
                placeholder="CP"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
              />
              <AutoScrollInput
                style={[styles.input, { flex: 2, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.city ?? ''}
                onChangeText={(v) => set('city', v)}
                placeholder="Ville"
                placeholderTextColor={colors.placeholder}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <AutoScrollInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.siret ?? ''}
                onChangeText={(v) => set('siret', v)}
                placeholder="SIRET"
                placeholderTextColor={colors.placeholder}
                maxLength={14}
              />
              <AutoScrollInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.vat_number ?? ''}
                onChangeText={(v) => set('vat_number', v)}
                placeholder="N° TVA"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <Text style={[styles.section, { color: colors.text2 }]}>NOTES</Text>
            <AutoScrollInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 80, textAlignVertical: 'top' }]}
              value={form.notes ?? ''}
              onChangeText={(v) => set('notes', v)}
              placeholder="Notes…"
              placeholderTextColor={colors.placeholder}
              multiline
            />

            {error ? <Text style={{ color: colors.red, marginTop: Spacing.md }}>{error}</Text> : null}

            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.itemBackground, flex: 1 }]}
                onPress={() => setEditMode(false)}
              >
                <Text style={{ color: colors.text, fontWeight: FontWeight.semibold }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={handleSave}
                disabled={update.isPending}
              >
                <Save size={IconSize.md} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: FontWeight.semibold }}>
                  {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {client.email ? (
              <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Mail size={IconSize.md} color={colors.primary} />
                <Text style={{ color: colors.text, flex: 1 }}>{client.email}</Text>
              </View>
            ) : null}
            {client.phone ? (
              <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Phone size={IconSize.md} color={colors.primary} />
                <Text style={{ color: colors.text, flex: 1 }}>{client.phone}</Text>
              </View>
            ) : null}
            {client.billing_address || client.city ? (
              <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MapPin size={IconSize.md} color={colors.primary} />
                <Text style={{ color: colors.text, flex: 1 }}>
                  {[client.billing_address, [client.postal_code, client.city].filter(Boolean).join(' ')]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              </View>
            ) : null}
            {client.siret ? (
              <Text style={[styles.meta, { color: colors.mutedText }]}>SIRET : {client.siret}</Text>
            ) : null}
            {client.vat_number ? (
              <Text style={[styles.meta, { color: colors.mutedText }]}>TVA : {client.vat_number}</Text>
            ) : null}

            {client.notes ? (
              <>
                <Text style={[styles.section, { color: colors.text2 }]}>NOTES</Text>
                <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={{ color: colors.text }}>{client.notes}</Text>
                </View>
              </>
            ) : null}

            <Text style={[styles.section, { color: colors.text2 }]}>LOGEMENTS RATTACHÉS</Text>
            {logements.data && logements.data.length > 0 ? (
              logements.data.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push(`/logement/${l.id}`)}
                >
                  <Building2 size={IconSize.md} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: FontWeight.semibold }}>{l.name}</Text>
                    {l.city ? (
                      <Text style={{ color: colors.mutedText, fontSize: FontSize.sm }}>{l.city}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={{ color: colors.mutedText, padding: Spacing.md }}>Aucun logement rattaché.</Text>
            )}

            {isAdmin ? (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, marginTop: Spacing.lg }]}
                onPress={() => setEditMode(true)}
              >
                <Save size={IconSize.md} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: FontWeight.semibold }}>Modifier</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  section: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  meta: { fontSize: FontSize.sm, paddingHorizontal: Spacing.md },
  input: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, fontSize: FontSize.md },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
});
