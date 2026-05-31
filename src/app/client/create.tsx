import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import AutoScrollInput from '@/components/AutoScrollInput';
import { useCreateClient, type CreateClientInput } from '@/api/hooks/useClients';

export default function CreateClientScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const create = useCreateClient();

  const [form, setForm] = useState<CreateClientInput>({ country: 'FR' });
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!form.first_name?.trim() && !form.last_name?.trim() && !form.company_name?.trim()) {
      setError('Au moins un nom (personne ou entreprise) est requis.');
      return;
    }
    try {
      const c = await create.mutateAsync(form);
      router.replace(`/client/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    }
  };

  const set = (k: keyof CreateClientInput, v: string) =>
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
        <Text style={[styles.title, { color: colors.text }]}>Nouveau client</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.body}>
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
          placeholder="Entreprise (si pro)"
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
          placeholder="Adresse de facturation"
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
          style={[
            styles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 80, textAlignVertical: 'top' },
          ]}
          value={form.notes ?? ''}
          onChangeText={(v) => set('notes', v)}
          placeholder="Notes…"
          placeholderTextColor={colors.placeholder}
          multiline
        />

        {error ? <Text style={{ color: colors.red, marginTop: Spacing.md }}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submit, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={create.isPending}
        >
          <Save size={IconSize.md} color="#FFFFFF" />
          <Text style={styles.submitText}>{create.isPending ? 'Création…' : 'Créer le client'}</Text>
        </TouchableOpacity>
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  section: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginTop: Spacing.md },
  input: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, fontSize: FontSize.md },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
  },
  submitText: { color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.md },
});
