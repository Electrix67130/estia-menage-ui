import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Pressable} from 'react-native';
import Animated from 'react-native-reanimated';
import { X, Save } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useCreateClient, type CreateClientInput, type Client } from '@/api/hooks/useClients';
import { useDialog } from '@/contexts/DialogContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated?: (client: Client) => void;
}

const CreateClientModal: React.FC<Props> = ({ visible, onClose, onCreated }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const create = useCreateClient();
  const [form, setForm] = useState<CreateClientInput>({ country: 'FR' });
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible, maxHeightRatio: 0.9 });

  const set = (k: keyof CreateClientInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.first_name?.trim() && !form.last_name?.trim() && !form.company_name?.trim()) {
      void dialog.alert({ title: 'Erreur', message: 'Au moins un nom (personne ou entreprise) est requis.' });
      return;
    }
    try {
      const created = await create.mutateAsync(form);
      onCreated?.(created);
      onClose();
      setForm({ country: 'FR' });
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, { backgroundColor: colors.background }, Shadow.lg, animatedModalStyle]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Nouveau client</Text>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xxl }}>
            <Text style={[styles.section, { color: colors.text2 }]}>IDENTITÉ</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.first_name ?? ''}
                onChangeText={(v) => set('first_name', v)}
                placeholder="Prénom"
                placeholderTextColor={colors.placeholder}
              />
              <TextInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.last_name ?? ''}
                onChangeText={(v) => set('last_name', v)}
                placeholder="Nom"
                placeholderTextColor={colors.placeholder}
              />
            </View>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={form.company_name ?? ''}
              onChangeText={(v) => set('company_name', v)}
              placeholder="Entreprise (si pro)"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={[styles.section, { color: colors.text2 }]}>CONTACT</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={form.email ?? ''}
              onChangeText={(v) => set('email', v)}
              placeholder="Email"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={form.phone ?? ''}
              onChangeText={(v) => set('phone', v)}
              placeholder="Téléphone"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
            />

            <Text style={[styles.section, { color: colors.text2 }]}>FACTURATION</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={form.billing_address ?? ''}
              onChangeText={(v) => set('billing_address', v)}
              placeholder="Adresse"
              placeholderTextColor={colors.placeholder}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.postal_code ?? ''}
                onChangeText={(v) => set('postal_code', v)}
                placeholder="CP"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, { flex: 2, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.city ?? ''}
                onChangeText={(v) => set('city', v)}
                placeholder="Ville"
                placeholderTextColor={colors.placeholder}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.siret ?? ''}
                onChangeText={(v) => set('siret', v)}
                placeholder="SIRET"
                placeholderTextColor={colors.placeholder}
                maxLength={14}
              />
              <TextInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={form.vat_number ?? ''}
                onChangeText={(v) => set('vat_number', v)}
                placeholder="N° TVA"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <TouchableOpacity
              style={[styles.submit, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
              disabled={create.isPending}
            >
              <Save size={IconSize.md} color="#FFFFFF" />
              <Text style={styles.submitText}>{create.isPending ? 'Création…' : 'Créer le client'}</Text>
            </TouchableOpacity>
          </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  body: { padding: Spacing.lg },
  section: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginTop: Spacing.sm },
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

export default CreateClientModal;
