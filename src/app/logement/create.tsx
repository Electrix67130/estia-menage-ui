import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useCreateLogement } from '@/api/hooks/useLogements';
import { useChecklistTemplates, useApplyChecklistTemplate } from '@/api/hooks/useChecklistTemplates';
import { useClients, clientDisplayName } from '@/api/hooks/useClients';
import CityAutocomplete from '@/components/CityAutocomplete';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import AutoScrollInput from '@/components/AutoScrollInput';
import SecretCodeField from '@/components/SecretCodeField';
import CreateClientModal from '@/components/CreateClientModal';
import DurationPickerField from '@/components/DurationPickerField';
import TimePickerField from '@/components/TimePickerField';
import ColorPicker from '@/components/ColorPicker';
import LabeledField from '@/components/LabeledField';
import ClientPickerSheet from '@/components/ClientPickerSheet';
import { User as UserIcon, ChevronRight } from 'lucide-react-native';
import { Plus } from 'lucide-react-native';

interface RoomCounterProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
}

function RoomCounter({ label, value, onChange }: RoomCounterProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  return (
    <View style={[counterStyles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[counterStyles.label, { color: colors.text }]}>{label}</Text>
      <View style={counterStyles.controls}>
        <TouchableOpacity
          style={[counterStyles.btn, { borderColor: colors.border }]}
          onPress={() => onChange(Math.max(0, value - 1))}
          accessibilityLabel={`Diminuer ${label}`}
        >
          <Text style={{ color: colors.text, fontSize: FontSize.lg }}>−</Text>
        </TouchableOpacity>
        <Text style={[counterStyles.value, { color: colors.text }]}>{value}</Text>
        <TouchableOpacity
          style={[counterStyles.btn, { borderColor: colors.border }]}
          onPress={() => onChange(value + 1)}
          accessibilityLabel={`Augmenter ${label}`}
        >
          <Text style={{ color: colors.text, fontSize: FontSize.lg }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const counterStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  label: { fontSize: FontSize.md },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, minWidth: 24, textAlign: 'center' },
});

export default function CreateLogementScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t: tr } = useTranslation();
  const createMutation = useCreateLogement();
  const clientsQuery = useClients();
  const checklistTemplatesQuery = useChecklistTemplates();
  const applyTemplate = useApplyChecklistTemplate();
  const [checklistTemplateId, setChecklistTemplateId] = useState('');

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState<string>('');
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [nLitSimple, setNLitSimple] = useState(0);
  const [nLitDouble, setNLitDouble] = useState(0);
  const [nCanapeLit, setNCanapeLit] = useState(0);
  const [nLitAppoint, setNLitAppoint] = useState(0);
  const [notes, setNotes] = useState('');
  const [keySafeCode, setKeySafeCode] = useState('');
  const [surfaceM2, setSurfaceM2] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [defDuration, setDefDuration] = useState('');
  const [defHoraireDebut, setDefHoraireDebut] = useState('');
  const [defHoraireFin, setDefHoraireFin] = useState('');
  const [defClientPrice, setDefClientPrice] = useState('');
  const [defClientVat, setDefClientVat] = useState('20');
  const [defProviderPrice, setDefProviderPrice] = useState('');
  const [defLaundryIncluded, setDefLaundryIncluded] = useState(false);
  const [defLaundryClient, setDefLaundryClient] = useState('');
  const [defLaundryProvider, setDefLaundryProvider] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Nom du logement requis.');
      return;
    }
    const parseMoneyOrUndef = (s: string): number | undefined => {
      const t = s.trim();
      if (!t) return undefined;
      const n = parseFloat(t.replace(',', '.'));
      return Number.isNaN(n) || n < 0 ? undefined : n;
    };
    const parseIntOrUndef = (s: string): number | undefined => {
      const t = s.trim();
      if (!t) return undefined;
      const n = parseInt(t, 10);
      return Number.isNaN(n) || n < 0 ? undefined : n;
    };
    try {
      const logement = await createMutation.mutateAsync({
        name: name.trim(),
        client_id: clientId || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        latitude,
        longitude,
        n_lit_simple: nLitSimple,
        n_lit_double: nLitDouble,
        n_canape_lit: nCanapeLit,
        n_lit_appoint: nLitAppoint,
        surface_m2: surfaceM2.trim() ? parseIntOrUndef(surfaceM2) : undefined,
        notes: notes.trim() || undefined,
        key_safe_code: keySafeCode.trim() || undefined,
        color: color || undefined,
        default_duration_min: parseIntOrUndef(defDuration),
        default_horaire_debut: defHoraireDebut.trim() || undefined,
        default_horaire_fin: defHoraireFin.trim() || undefined,
        default_client_price_ht: parseMoneyOrUndef(defClientPrice),
        default_client_vat_rate: parseMoneyOrUndef(defClientVat),
        default_provider_price: parseMoneyOrUndef(defProviderPrice),
        default_laundry_included: defLaundryIncluded,
        default_laundry_client_price_ht: defLaundryIncluded
          ? parseMoneyOrUndef(defLaundryClient)
          : undefined,
        default_laundry_provider_price: defLaundryIncluded
          ? parseMoneyOrUndef(defLaundryProvider)
          : undefined,
      });
      if (checklistTemplateId) {
        try {
          await applyTemplate.mutateAsync({ logementId: logement.id, templateId: checklistTemplateId });
        } catch {
          // Logement créé quand même : on n'échoue pas le flow si le modèle ne s'applique pas.
        }
      }
      router.replace(`/logement/${logement.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    }
  };

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
        <Text style={[styles.title, { color: colors.text }]}>Nouveau logement</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.body}>
        <Text style={[styles.section, { color: colors.text2 }]}>INFOS</Text>
        <LabeledField label="Nom du logement *">
          <AutoScrollInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={name}
            onChangeText={setName}
            placeholder="Ex. Studio Paris 11e"
            placeholderTextColor={colors.placeholder}
          />
        </LabeledField>

        <LabeledField label="Surface (m²)">
          <AutoScrollInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={surfaceM2}
            onChangeText={setSurfaceM2}
            placeholder="ex. 65"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
          />
        </LabeledField>

        <CityAutocomplete
          city={city}
          postalCode={postalCode}
          address={address}
          onCityChange={setCity}
          onSelect={(c, cp, lat, lng) => {
            setCity(c);
            setPostalCode(cp);
            setLatitude(lat);
            setLongitude(lng);
          }}
          onAddressChange={setAddress}
          onAddressSelect={(addr, lat, lng) => {
            setAddress(addr);
            setLatitude(lat);
            setLongitude(lng);
          }}
        />

        <Text style={[styles.section, { color: colors.text2 }]}>CLIENT (FACTURATION)</Text>
        <TouchableOpacity
          style={[
            styles.optionRow,
            {
              backgroundColor: colors.surface,
              borderColor: clientId ? colors.primary : colors.border,
              borderWidth: clientId ? 2 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
            },
          ]}
          onPress={() => setClientPickerOpen(true)}
          activeOpacity={0.7}
        >
          <UserIcon size={IconSize.sm} color={colors.text2} />
          <Text
            style={{
              flex: 1,
              color: clientId ? colors.text : colors.mutedText,
              fontWeight: clientId ? FontWeight.semibold : FontWeight.regular,
            }}
          >
            {clientId
              ? (() => {
                  const c = (clientsQuery.data?.data ?? []).find((x) => x.id === clientId);
                  return c ? clientDisplayName(c) : 'Client sélectionné';
                })()
              : 'Aucun client — appuyer pour en choisir un'}
          </Text>
          <ChevronRight size={IconSize.sm} color={colors.text2} />
        </TouchableOpacity>

        <ClientPickerSheet
          visible={clientPickerOpen}
          clients={clientsQuery.data?.data ?? []}
          selectedId={clientId}
          onSelect={(id) => {
            setClientId(id);
            setClientPickerOpen(false);
          }}
          onCreateNew={() => {
            setClientPickerOpen(false);
            setCreateClientOpen(true);
          }}
          onClose={() => setClientPickerOpen(false)}
        />

        <CreateClientModal
          visible={createClientOpen}
          onClose={() => setCreateClientOpen(false)}
          onCreated={(c) => {
            setClientId(c.id);
            setCreateClientOpen(false);
          }}
        />

        <Text style={[styles.section, { color: colors.text2 }]}>{tr('beds.section').toUpperCase()}</Text>
        <Text style={{ color: colors.text2, fontSize: FontSize.sm, marginBottom: Spacing.sm }}>
          {tr('beds.hintLogement')}
        </Text>
        <RoomCounter label={tr('beds.simple')} value={nLitSimple} onChange={setNLitSimple} />
        <RoomCounter label={tr('beds.double')} value={nLitDouble} onChange={setNLitDouble} />
        <RoomCounter label={tr('beds.sofa')} value={nCanapeLit} onChange={setNCanapeLit} />
        <RoomCounter label={tr('beds.extra')} value={nLitAppoint} onChange={setNLitAppoint} />

        <Text style={[styles.section, { color: colors.text2 }]}>CODE BOÎTE À CLEF</Text>
        <SecretCodeField
          value={keySafeCode}
          onChangeText={setKeySafeCode}
          placeholder="Ex : 1234"
        />

        <Text style={[styles.section, { color: colors.text2 }]}>COULEUR (CALENDRIER)</Text>
        <ColorPicker label="" value={color} onChange={setColor} />

        {(checklistTemplatesQuery.data ?? []).length > 0 ? (
          <>
            <Text style={[styles.section, { color: colors.text2 }]}>MODÈLE DE CHECKLIST</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: checklistTemplateId === '' ? colors.primary : colors.surface,
                    borderColor: checklistTemplateId === '' ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setChecklistTemplateId('')}
              >
                <Text style={{ color: checklistTemplateId === '' ? '#FFFFFF' : colors.text, fontSize: FontSize.sm }}>
                  Aucun
                </Text>
              </TouchableOpacity>
              {(checklistTemplatesQuery.data ?? []).map((tpl) => {
                const selected = checklistTemplateId === tpl.id;
                return (
                  <TouchableOpacity
                    key={tpl.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.primary : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setChecklistTemplateId(tpl.id)}
                  >
                    <Text style={{ color: selected ? '#FFFFFF' : colors.text, fontSize: FontSize.sm }}>
                      {tpl.name} ({tpl.section_count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <Text style={[styles.section, { color: colors.text2 }]}>VALEURS PAR DÉFAUT DU MÉNAGE</Text>
        <DurationPickerField
          label="Durée par défaut"
          value={defDuration}
          onChange={setDefDuration}
        />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TimePickerField
              label="Début"
              value={defHoraireDebut}
              onChange={setDefHoraireDebut}
              placeholder="--:--"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TimePickerField
              label="Fin"
              value={defHoraireFin}
              onChange={setDefHoraireFin}
              placeholder="--:--"
            />
          </View>
        </View>
        <LabeledField label="Prix client HT (€)">
          <AutoScrollInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={defClientPrice}
            onChangeText={setDefClientPrice}
            placeholder="ex. 80"
            placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad"
          />
        </LabeledField>
        <LabeledField label="TVA (%)">
          <AutoScrollInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={defClientVat}
            onChangeText={setDefClientVat}
            placeholder="20"
            placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad"
          />
        </LabeledField>
        <LabeledField label="Prix prestataire (€)">
          <AutoScrollInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={defProviderPrice}
            onChangeText={setDefProviderPrice}
            placeholder="ex. 50"
            placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad"
          />
        </LabeledField>
        <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontSize: FontSize.md }}>Linge inclus par défaut</Text>
          <Switch
            value={defLaundryIncluded}
            onValueChange={setDefLaundryIncluded}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        {defLaundryIncluded ? (
          <>
            <LabeledField label="Prix linge — client HT (€)">
              <AutoScrollInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={defLaundryClient}
                onChangeText={setDefLaundryClient}
                placeholder="ex. 15"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
              />
            </LabeledField>
            <LabeledField label="Prix linge — prestataire (€)">
              <AutoScrollInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={defLaundryProvider}
                onChangeText={setDefLaundryProvider}
                placeholder="ex. 10"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
              />
            </LabeledField>
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
          placeholder="Code interphone, instructions particulières…"
          placeholderTextColor={colors.placeholder}
          multiline
        />

        {error ? <Text style={{ color: colors.red, marginTop: Spacing.md }}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submit, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          <Save size={IconSize.md} color="#FFFFFF" />
          <Text style={styles.submitText}>{createMutation.isPending ? 'Création…' : 'Créer le logement'}</Text>
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
  optionRow: { padding: Spacing.md, borderRadius: Radius.md },
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
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
