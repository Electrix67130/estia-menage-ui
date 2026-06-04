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
import { useTranslation } from '@/contexts/I18nContext';
import { menageHooks, useUpdateMenage } from '@/api/hooks/useMenages';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import AutoScrollInput from '@/components/AutoScrollInput';
import DatePickerField from '@/components/DatePickerField';
import TimePickerField from '@/components/TimePickerField';
import DurationPickerField from '@/components/DurationPickerField';
import LabeledField from '@/components/LabeledField';
import type { MenageStatus, UpdateMenageInput } from '@/api/types';

const STATUS_KEYS: Record<MenageStatus, 'menage.statusUpcoming' | 'menage.statusInProgress' | 'menage.statusCompleted' | 'menage.statusValidated' | 'menage.statusCancelled'> = {
  a_venir: 'menage.statusUpcoming',
  en_cours: 'menage.statusInProgress',
  termine: 'menage.statusCompleted',
  valide: 'menage.statusValidated',
  annule: 'menage.statusCancelled',
};
const STATUS_ORDER: MenageStatus[] = ['a_venir', 'en_cours', 'termine', 'valide', 'annule'];

export default function EditMenageScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t: tr } = useTranslation();
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
  const [nLitSimple, setNLitSimple] = useState('0');
  const [nLitDouble, setNLitDouble] = useState('0');
  const [nCanapeLit, setNCanapeLit] = useState('0');
  const [nLitAppoint, setNLitAppoint] = useState('0');
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
    setNLitSimple(String(menage.n_lit_simple ?? 0));
    setNLitDouble(String(menage.n_lit_double ?? 0));
    setNCanapeLit(String(menage.n_canape_lit ?? 0));
    setNLitAppoint(String(menage.n_lit_appoint ?? 0));
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
      setError(tr('menage.errors.dateRequired'));
      return;
    }
    const duree = dureeEstimee.trim() ? parseInt(dureeEstimee, 10) : null;
    if (dureeEstimee.trim() && (duree === null || Number.isNaN(duree) || duree < 0)) {
      setError(tr('menage.errors.dureeInvalid'));
      return;
    }
    const cPrice = parseMoney(clientPriceHt);
    if (cPrice === 'invalid') { setError(tr('menage.errors.fieldInvalid', { field: tr('menage.fields.clientPriceHt') })); return; }
    const cVat = parseMoney(clientVatRate);
    if (cVat === 'invalid') { setError(tr('menage.errors.fieldInvalid', { field: tr('menage.fields.clientVatRate') })); return; }
    const pPrice = parseMoney(providerPrice);
    if (pPrice === 'invalid') { setError(tr('menage.errors.fieldInvalid', { field: tr('menage.fields.providerPrice') })); return; }
    const lCPrice = parseMoney(laundryClientPriceHt);
    if (lCPrice === 'invalid') { setError(tr('menage.errors.fieldInvalid', { field: tr('menage.fields.laundryClientHt') })); return; }
    const lPPrice = parseMoney(laundryProviderPrice);
    if (lPPrice === 'invalid') { setError(tr('menage.errors.fieldInvalid', { field: tr('menage.fields.laundryProvider') })); return; }

    const parseCount = (s: string): number => {
      const n = parseInt(s, 10);
      return Number.isNaN(n) || n < 0 ? 0 : n;
    };

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
      n_lit_simple: parseCount(nLitSimple),
      n_lit_double: parseCount(nLitDouble),
      n_canape_lit: parseCount(nCanapeLit),
      n_lit_appoint: parseCount(nLitAppoint),
      notes_intervention: notes.trim() || null,
      status,
    };

    try {
      await update.mutateAsync({ id: id!, body });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('menage.errors.updateError'));
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
          accessibilityLabel={tr('common.back')}
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{tr('menage.edit.title')}</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.body}>
        <Text style={[styles.section, { color: colors.text2 }]}>{tr('menage.edit.sectionPlanning').toUpperCase()}</Text>
        <DatePickerField label={tr('menage.fields.datePrevue')} value={datePrevue} onChange={setDatePrevue} />
        <TimePickerField label={tr('menage.fields.horaire')} value={horairePrevu} onChange={setHorairePrevu} />
        <DurationPickerField label={tr('menage.fields.dureeEstimee')} value={dureeEstimee} onChange={setDureeEstimee} />

        <Text style={[styles.section, { color: colors.text2 }]}>{tr('menage.edit.sectionStatus').toUpperCase()}</Text>
        <View style={styles.statusRow}>
          {STATUS_ORDER.map((value) => {
            const selected = status === value;
            return (
              <TouchableOpacity
                key={value}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setStatus(value)}
              >
                <Text style={{ color: selected ? '#FFFFFF' : colors.text, fontSize: FontSize.sm }}>
                  {tr(STATUS_KEYS[value])}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isAdmin ? (
          <>
            <Text style={[styles.section, { color: colors.text2 }]}>{tr('menage.edit.sectionPricing').toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <View style={{ flex: 2 }}>
                <LabeledField label={tr('menage.fields.clientPriceHt')}>
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
                <LabeledField label={tr('menage.fields.clientVatRate')}>
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
            <LabeledField label={tr('menage.fields.providerPrice')}>
              <AutoScrollInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={providerPrice}
                onChangeText={setProviderPrice}
                placeholder="ex. 50"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
              />
            </LabeledField>

            <Text style={[styles.section, { color: colors.text2 }]}>{tr('menage.edit.sectionLaundry').toUpperCase()}</Text>
            <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: FontSize.md }}>{tr('menage.fields.laundryIncluded')}</Text>
              <Switch
                value={laundryIncluded}
                onValueChange={setLaundryIncluded}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
            {laundryIncluded ? (
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <LabeledField label={tr('menage.fields.laundryClientHt')}>
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
                  <LabeledField label={tr('menage.fields.laundryProvider')}>
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

            <Text style={[styles.section, { color: colors.text2 }]}>{tr('beds.section').toUpperCase()}</Text>
            <Text style={{ color: colors.text2, fontSize: FontSize.sm, marginBottom: Spacing.xs }}>
              {tr('beds.hintMenage')}
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <LabeledField label={tr('beds.simple')}>
                  <AutoScrollInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={nLitSimple}
                    onChangeText={setNLitSimple}
                    keyboardType="number-pad"
                  />
                </LabeledField>
              </View>
              <View style={{ flex: 1 }}>
                <LabeledField label={tr('beds.double')}>
                  <AutoScrollInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={nLitDouble}
                    onChangeText={setNLitDouble}
                    keyboardType="number-pad"
                  />
                </LabeledField>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <LabeledField label={tr('beds.sofa')}>
                  <AutoScrollInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={nCanapeLit}
                    onChangeText={setNCanapeLit}
                    keyboardType="number-pad"
                  />
                </LabeledField>
              </View>
              <View style={{ flex: 1 }}>
                <LabeledField label={tr('beds.extra')}>
                  <AutoScrollInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={nLitAppoint}
                    onChangeText={setNLitAppoint}
                    keyboardType="number-pad"
                  />
                </LabeledField>
              </View>
            </View>
          </>
        ) : null}

        <Text style={[styles.section, { color: colors.text2 }]}>{tr('menage.edit.sectionNotes').toUpperCase()}</Text>
        <AutoScrollInput
          style={[
            styles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 80, textAlignVertical: 'top' },
          ]}
          value={notes}
          onChangeText={setNotes}
          placeholder={tr('menage.fields.notesPlaceholder')}
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
          <Text style={styles.submitText}>{update.isPending ? tr('common.saving') : tr('common.save')}</Text>
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
