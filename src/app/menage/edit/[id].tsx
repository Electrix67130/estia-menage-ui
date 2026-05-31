import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { menageHooks, useUpdateMenage } from '@/api/hooks/useMenages';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import AutoScrollInput from '@/components/AutoScrollInput';
import DatePickerField from '@/components/DatePickerField';
import TimePickerField from '@/components/TimePickerField';
import DurationPickerField from '@/components/DurationPickerField';
import LabeledField from '@/components/LabeledField';
import type { MenageStatus, UpdateMenageInput } from '@/api/types';

const STATUS_OPTIONS: { value: MenageStatus; label: string }[] = [
  { value: 'a_venir', label: 'À venir' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'valide', label: 'Validé' },
  { value: 'annule', label: 'Annulé' },
];

export default function EditMenageScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: menage, isLoading } = menageHooks.useById(id);
  const update = useUpdateMenage();

  const [datePrevue, setDatePrevue] = useState('');
  const [horairePrevu, setHorairePrevu] = useState('');
  const [dureeEstimee, setDureeEstimee] = useState('');
  const [clientPriceHt, setClientPriceHt] = useState('');
  const [clientVatRate, setClientVatRate] = useState('20');
  const [providerPrice, setProviderPrice] = useState('');
  const [laundryIncluded, setLaundryIncluded] = useState(false);
  const [laundryClientPriceHt, setLaundryClientPriceHt] = useState('');
  const [laundryProviderPrice, setLaundryProviderPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<MenageStatus>('a_venir');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!menage) return;
    setDatePrevue(menage.date_prevue.slice(0, 10));
    setHorairePrevu(menage.horaire_prevu ? menage.horaire_prevu.slice(0, 5) : '');
    setDureeEstimee(menage.duree_estimee_min !== null ? String(menage.duree_estimee_min) : '');
    setClientPriceHt(
      menage.client_price_ht !== null && menage.client_price_ht !== undefined
        ? String(menage.client_price_ht)
        : '',
    );
    setClientVatRate(
      menage.client_vat_rate !== null && menage.client_vat_rate !== undefined
        ? String(menage.client_vat_rate)
        : '20',
    );
    setProviderPrice(
      menage.provider_price !== null && menage.provider_price !== undefined
        ? String(menage.provider_price)
        : '',
    );
    setLaundryIncluded(!!menage.laundry_included);
    setLaundryClientPriceHt(
      menage.laundry_client_price_ht !== null && menage.laundry_client_price_ht !== undefined
        ? String(menage.laundry_client_price_ht)
        : '',
    );
    setLaundryProviderPrice(
      menage.laundry_provider_price !== null && menage.laundry_provider_price !== undefined
        ? String(menage.laundry_provider_price)
        : '',
    );
    setNotes(menage.notes_intervention ?? '');
    setStatus(menage.status);
  }, [menage]);

  const parseMoney = (s: string): number | null | 'invalid' => {
    if (!s.trim()) return null;
    const n = parseFloat(s.replace(',', '.'));
    if (Number.isNaN(n) || n < 0) return 'invalid';
    return n;
  };

  const handleSubmit = async () => {
    setError('');
    if (!datePrevue) {
      setError('Date requise.');
      return;
    }
    const duree = dureeEstimee.trim() ? parseInt(dureeEstimee, 10) : null;
    if (dureeEstimee.trim() && (duree === null || Number.isNaN(duree) || duree < 0)) {
      setError('Durée invalide.');
      return;
    }
    const cPrice = parseMoney(clientPriceHt);
    if (cPrice === 'invalid') { setError('Prix client HT invalide'); return; }
    const cVat = parseMoney(clientVatRate);
    if (cVat === 'invalid') { setError('TVA invalide'); return; }
    const pPrice = parseMoney(providerPrice);
    if (pPrice === 'invalid') { setError('Prix prestataire invalide'); return; }
    const lCPrice = parseMoney(laundryClientPriceHt);
    if (lCPrice === 'invalid') { setError('Prix linge client invalide'); return; }
    const lPPrice = parseMoney(laundryProviderPrice);
    if (lPPrice === 'invalid') { setError('Prix linge prestataire invalide'); return; }

    const body: UpdateMenageInput = {
      date_prevue: datePrevue,
      horaire_prevu: horairePrevu || null,
      duree_estimee_min: duree,
      client_price_ht: cPrice,
      client_vat_rate: cVat,
      provider_price: pPrice,
      laundry_included: laundryIncluded,
      laundry_client_price_ht: laundryIncluded ? lCPrice : null,
      laundry_provider_price: laundryIncluded ? lPPrice : null,
      notes_intervention: notes.trim() || null,
      status,
    };

    try {
      await update.mutateAsync({ id: id!, body });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification.');
    }
  };

  if (isLoading || !menage) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={[styles.title, { color: colors.text }]}>Modifier le ménage</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.body}>
        <Text style={[styles.section, { color: colors.text2 }]}>PLANIFICATION</Text>
        <DatePickerField label="Date prévue" value={datePrevue} onChange={setDatePrevue} />
        <TimePickerField label="Horaire" value={horairePrevu} onChange={setHorairePrevu} />
        <DurationPickerField label="Durée estimée" value={dureeEstimee} onChange={setDureeEstimee} />

        <Text style={[styles.section, { color: colors.text2 }]}>STATUT</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((s) => {
            const selected = status === s.value;
            return (
              <TouchableOpacity
                key={s.value}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setStatus(s.value)}
              >
                <Text style={{ color: selected ? '#FFFFFF' : colors.text, fontSize: FontSize.sm }}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isAdmin ? (
          <>
            <Text style={[styles.section, { color: colors.text2 }]}>TARIFICATION</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <View style={{ flex: 2 }}>
                <LabeledField label="Prix client HT (€)">
                  <AutoScrollInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={clientPriceHt}
                    onChangeText={setClientPriceHt}
                    placeholder="ex. 80"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="decimal-pad"
                  />
                </LabeledField>
              </View>
              <View style={{ flex: 1 }}>
                <LabeledField label="TVA (%)">
                  <AutoScrollInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={clientVatRate}
                    onChangeText={setClientVatRate}
                    placeholder="20"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="decimal-pad"
                  />
                </LabeledField>
              </View>
            </View>
            <LabeledField label="Prix prestataire (€)">
              <AutoScrollInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={providerPrice}
                onChangeText={setProviderPrice}
                placeholder="ex. 50"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
              />
            </LabeledField>

            <Text style={[styles.section, { color: colors.text2 }]}>LINGE</Text>
            <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: FontSize.md }}>Gestion du linge incluse</Text>
              <Switch
                value={laundryIncluded}
                onValueChange={setLaundryIncluded}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
            {laundryIncluded ? (
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <LabeledField label="Linge — client HT (€)">
                    <AutoScrollInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                      value={laundryClientPriceHt}
                      onChangeText={setLaundryClientPriceHt}
                      placeholder="ex. 15"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="decimal-pad"
                    />
                  </LabeledField>
                </View>
                <View style={{ flex: 1 }}>
                  <LabeledField label="Linge — prestataire (€)">
                    <AutoScrollInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                      value={laundryProviderPrice}
                      onChangeText={setLaundryProviderPrice}
                      placeholder="ex. 10"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="decimal-pad"
                    />
                  </LabeledField>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        <Text style={[styles.section, { color: colors.text2 }]}>NOTES</Text>
        <AutoScrollInput
          style={[
            styles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 80, textAlignVertical: 'top' },
          ]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Consignes particulières, accès, codes…"
          placeholderTextColor={colors.placeholder}
          multiline
        />

        {error ? <Text style={{ color: colors.red, marginTop: Spacing.md }}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submit, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={update.isPending}
        >
          <Save size={IconSize.md} color="#FFFFFF" />
          <Text style={styles.submitText}>{update.isPending ? 'Enregistrement…' : 'Enregistrer'}</Text>
        </TouchableOpacity>
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  section: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginTop: Spacing.md },
  input: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, fontSize: FontSize.md },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statusChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
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
