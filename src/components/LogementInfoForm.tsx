import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { User as UserIcon, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useLogement, useUpdateLogement } from '@/api/hooks/useLogements';
import { useClients, clientDisplayName } from '@/api/hooks/useClients';
import CityAutocomplete from '@/components/CityAutocomplete';
import AutoScrollInput from '@/components/AutoScrollInput';
import SecretCodeField from '@/components/SecretCodeField';
import TimePickerField from '@/components/TimePickerField';
import DurationPickerField from '@/components/DurationPickerField';
import ColorPicker from '@/components/ColorPicker';
import LabeledField from '@/components/LabeledField';
import ClientPickerSheet from '@/components/ClientPickerSheet';
import CreateClientModal from '@/components/CreateClientModal';

function RoomCounter({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
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

/**
 * Édition « sur place » des infos d'un logement, avec auto-save par champ
 * (debounce). Destiné à être rendu inline dans l'écran détail (admin only).
 */
export default function LogementInfoForm({ logementId }: { logementId: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t: tr } = useTranslation();
  const { data: logement } = useLogement(logementId);
  const updateMutation = useUpdateLogement();
  const clientsQuery = useClients();

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
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
  const [surfaceM2, setSurfaceM2] = useState('');
  const [notes, setNotes] = useState('');
  const [keySafeCode, setKeySafeCode] = useState('');
  const [defaultDurationMin, setDefaultDurationMin] = useState('');
  const [defaultClientPriceHt, setDefaultClientPriceHt] = useState('');
  const [defaultClientVatRate, setDefaultClientVatRate] = useState('');
  const [defaultProviderPrice, setDefaultProviderPrice] = useState('');
  const [defaultLaundryIncluded, setDefaultLaundryIncluded] = useState(false);
  const [defaultLaundryClientPriceHt, setDefaultLaundryClientPriceHt] = useState('');
  const [defaultLaundryProviderPrice, setDefaultLaundryProviderPrice] = useState('');
  const [defaultHoraireDebut, setDefaultHoraireDebut] = useState('');
  const [defaultHoraireFin, setDefaultHoraireFin] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [hasPool, setHasPool] = useState(false);
  const [hasJacuzzi, setHasJacuzzi] = useState(false);
  const [enableCheckIn, setEnableCheckIn] = useState(false);
  const [enableCheckOut, setEnableCheckOut] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const seeded = useRef(false);

  // Initialise les champs une fois le logement chargé.
  useEffect(() => {
    if (!logement || seeded.current) return;
    seeded.current = true;
    setName(logement.name);
    setClientId(logement.client_id ?? '');
    setAddress(logement.address ?? '');
    setCity(logement.city ?? '');
    setPostalCode(logement.postal_code ?? '');
    setLatitude(logement.latitude !== null ? Number(logement.latitude) : undefined);
    setLongitude(logement.longitude !== null ? Number(logement.longitude) : undefined);
    setNLitSimple(logement.n_lit_simple ?? 0);
    setNLitDouble(logement.n_lit_double ?? 0);
    setNCanapeLit(logement.n_canape_lit ?? 0);
    setNLitAppoint(logement.n_lit_appoint ?? 0);
    setSurfaceM2(logement.surface_m2 !== null ? String(logement.surface_m2) : '');
    setNotes(logement.notes ?? '');
    setKeySafeCode(logement.key_safe_code ?? '');
    const toStr = (v: number | string | null): string => (v === null || v === undefined ? '' : String(v));
    setDefaultDurationMin(toStr(logement.default_duration_min));
    setDefaultClientPriceHt(toStr(logement.default_client_price_ht));
    setDefaultClientVatRate(toStr(logement.default_client_vat_rate));
    setDefaultProviderPrice(toStr(logement.default_provider_price));
    setDefaultLaundryIncluded(logement.default_laundry_included);
    setDefaultLaundryClientPriceHt(toStr(logement.default_laundry_client_price_ht));
    setDefaultLaundryProviderPrice(toStr(logement.default_laundry_provider_price));
    setDefaultHoraireDebut(logement.default_horaire_debut ?? '');
    setDefaultHoraireFin(logement.default_horaire_fin ?? '');
    setColor(logement.color ?? null);
    setHasPool(logement.has_pool ?? false);
    setHasJacuzzi(logement.has_jacuzzi ?? false);
    setEnableCheckIn(logement.enable_check_in ?? false);
    setEnableCheckOut(logement.enable_check_out ?? false);
  }, [logement]);

  // Auto-save (debounce 700ms) à chaque modification, une fois les champs initialisés.
  const stateKey = [
    name, clientId, address, city, postalCode, latitude, longitude,
    nLitSimple, nLitDouble, nCanapeLit, nLitAppoint, surfaceM2, notes, keySafeCode,
    defaultDurationMin, defaultClientPriceHt, defaultClientVatRate, defaultProviderPrice,
    defaultLaundryIncluded, defaultLaundryClientPriceHt, defaultLaundryProviderPrice,
    defaultHoraireDebut, defaultHoraireFin, color, hasPool, hasJacuzzi,
    enableCheckIn, enableCheckOut,
  ].join('¦');

  useEffect(() => {
    if (!seeded.current) return;
    if (!name.trim()) return;
    const surface = surfaceM2.trim() ? Number(surfaceM2.replace(',', '.')) : undefined;
    if (surfaceM2.trim() && (surface === undefined || Number.isNaN(surface) || surface < 0)) return;
    const money = (s: string): number | undefined => {
      const v = s.trim();
      if (!v) return undefined;
      const n = Number(v.replace(',', '.'));
      return Number.isNaN(n) || n < 0 ? undefined : n;
    };
    setSaveState('saving');
    const timer = setTimeout(() => {
      updateMutation.mutate(
        {
          id: logementId,
          body: {
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
            surface_m2: surface,
            notes: notes.trim() || undefined,
            key_safe_code: keySafeCode.trim() || undefined,
            default_duration_min: defaultDurationMin.trim() ? parseInt(defaultDurationMin, 10) : undefined,
            default_client_price_ht: money(defaultClientPriceHt),
            default_client_vat_rate: money(defaultClientVatRate),
            default_provider_price: money(defaultProviderPrice),
            default_laundry_included: defaultLaundryIncluded,
            default_laundry_client_price_ht: defaultLaundryIncluded ? money(defaultLaundryClientPriceHt) : undefined,
            default_laundry_provider_price: defaultLaundryIncluded ? money(defaultLaundryProviderPrice) : undefined,
            default_horaire_debut: defaultHoraireDebut.trim() || undefined,
            default_horaire_fin: defaultHoraireFin.trim() || undefined,
            color: color || undefined,
            has_pool: hasPool,
            has_jacuzzi: hasJacuzzi,
            enable_check_in: enableCheckIn,
            enable_check_out: enableCheckOut,
          },
        },
        {
          onSuccess: () => setSaveState('saved'),
          onError: () => setSaveState('error'),
        },
      );
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  if (!logement) return null;

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[styles.section, { color: colors.text2, marginTop: 0 }]}>INFOS</Text>
        <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }}>
          {saveState === 'saving'
            ? 'Enregistrement…'
            : saveState === 'saved'
              ? '✓ Enregistré'
              : saveState === 'error'
                ? '⚠ Erreur'
                : 'Auto-enregistré'}
        </Text>
      </View>

      <LabeledField label="Nom du logement *">
        <AutoScrollInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={name}
          onChangeText={setName}
          placeholder="Ex. Studio Paris 11e"
          placeholderTextColor={colors.placeholder}
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
      <SecretCodeField value={keySafeCode} onChangeText={setKeySafeCode} placeholder="Ex : 1234" />

      <Text style={[styles.section, { color: colors.text2 }]}>COULEUR (CALENDRIER)</Text>
      <ColorPicker label="" value={color} onChange={setColor} />

      <Text style={[styles.section, { color: colors.text2 }]}>VALEURS PAR DÉFAUT (MÉNAGES)</Text>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TimePickerField label="Tranche début" value={defaultHoraireDebut} onChange={setDefaultHoraireDebut} placeholder="--:--" />
        </View>
        <View style={{ flex: 1 }}>
          <TimePickerField label="Tranche fin" value={defaultHoraireFin} onChange={setDefaultHoraireFin} placeholder="--:--" />
        </View>
      </View>
      <DurationPickerField label="Durée moyenne" value={defaultDurationMin} onChange={setDefaultDurationMin} />
      <LabeledField label="Prix client HT (€)">
        <AutoScrollInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={defaultClientPriceHt}
          onChangeText={setDefaultClientPriceHt}
          placeholder="ex. 80"
          placeholderTextColor={colors.placeholder}
          keyboardType="decimal-pad"
        />
      </LabeledField>
      <LabeledField label="Taux TVA (%)">
        <AutoScrollInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={defaultClientVatRate}
          onChangeText={setDefaultClientVatRate}
          placeholder="20"
          placeholderTextColor={colors.placeholder}
          keyboardType="decimal-pad"
        />
      </LabeledField>
      <LabeledField label="Prix prestataire (€)">
        <AutoScrollInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={defaultProviderPrice}
          onChangeText={setDefaultProviderPrice}
          placeholder="ex. 50"
          placeholderTextColor={colors.placeholder}
          keyboardType="decimal-pad"
        />
      </LabeledField>
      <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: FontSize.md }}>Linge inclus par défaut</Text>
        <Switch
          value={defaultLaundryIncluded}
          onValueChange={setDefaultLaundryIncluded}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      </View>
      {defaultLaundryIncluded ? (
        <>
          <LabeledField label="Prix linge — client HT (€)">
            <AutoScrollInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={defaultLaundryClientPriceHt}
              onChangeText={setDefaultLaundryClientPriceHt}
              placeholder="ex. 15"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
            />
          </LabeledField>
          <LabeledField label="Prix linge — prestataire (€)">
            <AutoScrollInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={defaultLaundryProviderPrice}
              onChangeText={setDefaultLaundryProviderPrice}
              placeholder="ex. 10"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
            />
          </LabeledField>
        </>
      ) : null}

      <Text style={[styles.section, { color: colors.text2 }]}>ÉQUIPEMENTS</Text>
      <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: FontSize.md }}>Piscine</Text>
        <Switch value={hasPool} onValueChange={setHasPool} trackColor={{ false: colors.border, true: colors.primary }} />
      </View>
      <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: FontSize.md }}>Jacuzzi</Text>
        <Switch value={hasJacuzzi} onValueChange={setHasJacuzzi} trackColor={{ false: colors.border, true: colors.primary }} />
      </View>

      <Text style={[styles.section, { color: colors.text2 }]}>{tr('logement.prestationsSection').toUpperCase()}</Text>
      <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: FontSize.md }}>{tr('logement.enableCheckIn')}</Text>
        <Switch value={enableCheckIn} onValueChange={setEnableCheckIn} trackColor={{ false: colors.border, true: colors.primary }} />
      </View>
      <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: FontSize.md }}>{tr('logement.enableCheckOut')}</Text>
        <Switch value={enableCheckOut} onValueChange={setEnableCheckOut} trackColor={{ false: colors.border, true: colors.primary }} />
      </View>

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
  btn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, minWidth: 24, textAlign: 'center' },
});

const styles = StyleSheet.create({
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
});
