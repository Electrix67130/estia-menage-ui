import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Modal, TextInput, FlatList, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save, Building2, ChevronRight, Search, X } from 'lucide-react-native';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateMenage } from '@/api/hooks/useMenages';
import { useLogements } from '@/api/hooks/useLogements';
import { prestationTypeLabel, prestationTypeColorKey, type PrestationType } from '@/api/types';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import AutoScrollInput from '@/components/AutoScrollInput';
import DatePickerField from '@/components/DatePickerField';
import TimePickerField from '@/components/TimePickerField';
import DurationPickerField from '@/components/DurationPickerField';
import LabeledField from '@/components/LabeledField';

export default function CreateMenageScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ logement_id?: string; type?: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const createMutation = useCreateMenage();
  const { data: logements } = useLogements();

  const preselectedLogementId = typeof params.logement_id === 'string' ? params.logement_id : '';
  const [logementId, setLogementId] = useState<string>(preselectedLogementId);
  const [logementPickerOpen, setLogementPickerOpen] = useState(false);
  const initialType: PrestationType =
    params.type === 'check_in' || params.type === 'check_out' ? params.type : 'menage';
  const [prestationType, setPrestationType] = useState<PrestationType>(initialType);
  // Check-in / check-out ≠ ménage : pas de durée de ménage ni de linge.
  const isCheck = prestationType !== 'menage';
  const [datePrevue, setDatePrevue] = useState('');
  const [horairePrevu, setHorairePrevu] = useState('');
  const [horaireFinPrevu, setHoraireFinPrevu] = useState('');
  const [dureeEstimee, setDureeEstimee] = useState('');
  const [clientPriceHt, setClientPriceHt] = useState('');
  const [clientVatRate, setClientVatRate] = useState('20');
  const [providerPrice, setProviderPrice] = useState('');
  const [laundryIncluded, setLaundryIncluded] = useState(false);
  const [laundryClientPriceHt, setLaundryClientPriceHt] = useState('');
  const [laundryProviderPrice, setLaundryProviderPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Pré-remplit les champs financiers + durée + linge avec les defaults du
  // logement sélectionné. Réagit aux changements de logementId. Les champs
  // déjà touchés par l'admin ne sont pas écrasés (heuristique simple : on
  // n'overwrite que si le champ est vide string ou false).
  useEffect(() => {
    if (!logementId) return;
    const l = (logements?.data ?? []).find((x) => x.id === logementId);
    if (!l) return;
    const toStr = (v: number | string | null): string => {
      if (v === null || v === undefined) return '';
      return String(v);
    };
    setDureeEstimee((prev) => (prev ? prev : toStr(l.default_duration_min)));
    setClientPriceHt((prev) => (prev ? prev : toStr(l.default_client_price_ht)));
    setClientVatRate((prev) => (prev && prev !== '20' ? prev : toStr(l.default_client_vat_rate) || '20'));
    setProviderPrice((prev) => (prev ? prev : toStr(l.default_provider_price)));
    setLaundryIncluded((prev) => prev || l.default_laundry_included);
    setLaundryClientPriceHt((prev) => (prev ? prev : toStr(l.default_laundry_client_price_ht)));
    setLaundryProviderPrice((prev) => (prev ? prev : toStr(l.default_laundry_provider_price)));
    setHorairePrevu((prev) => (prev ? prev : l.default_horaire_debut ?? ''));
    setHoraireFinPrevu((prev) => (prev ? prev : l.default_horaire_fin ?? ''));
  }, [logementId, logements?.data]);

  const parseMoney = (s: string): number | undefined | 'invalid' => {
    if (!s.trim()) return undefined;
    const n = parseFloat(s.replace(',', '.'));
    if (Number.isNaN(n) || n < 0) return 'invalid';
    return n;
  };

  const handleSubmit = async () => {
    setError('');
    if (!logementId || !datePrevue.trim()) {
      setError('Logement et date prévue requis.');
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
    const duree = dureeEstimee.trim() ? parseInt(dureeEstimee, 10) : undefined;
    if (dureeEstimee.trim() && (duree === undefined || Number.isNaN(duree) || duree < 0)) {
      setError('Durée invalide'); return;
    }

    try {
      const menage = await createMutation.mutateAsync({
        logement_id: logementId,
        prestation_type: prestationType,
        date_prevue: datePrevue.trim(),
        horaire_prevu: horairePrevu || undefined,
        horaire_fin_prevu: horaireFinPrevu || undefined,
        duree_estimee_min: isCheck ? undefined : duree,
        client_price_ht: cPrice,
        client_vat_rate: cVat,
        provider_price: pPrice,
        laundry_included: isCheck ? false : laundryIncluded,
        laundry_client_price_ht: !isCheck && laundryIncluded ? lCPrice : undefined,
        laundry_provider_price: !isCheck && laundryIncluded ? lPPrice : undefined,
        notes_intervention: notes.trim() || undefined,
      });
      router.replace(`/menage/${menage.id}`);
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
        <Text style={[styles.title, { color: colors.text }]}>Nouvelle prestation</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.body}>
        <Text style={[styles.section, { color: colors.text2 }]}>TYPE DE PRESTATION</Text>
        <View style={styles.typeRow}>
          {(['menage', 'check_in', 'check_out'] as PrestationType[]).map((t) => {
            const active = prestationType === t;
            const c = colors[prestationTypeColorKey(t)];
            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeChip,
                  { borderColor: active ? c : colors.border, backgroundColor: active ? c + '20' : colors.surface },
                ]}
                onPress={() => setPrestationType(t)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ color: active ? c : colors.text2, fontWeight: FontWeight.semibold, fontSize: FontSize.sm }}>
                  {prestationTypeLabel(t)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.section, { color: colors.text2 }]}>LOGEMENT</Text>
        <TouchableOpacity
          style={[
            styles.optionRow,
            {
              backgroundColor: colors.surface,
              borderColor: logementId ? colors.primary : colors.border,
              borderWidth: logementId ? 2 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
            },
          ]}
          onPress={() => setLogementPickerOpen(true)}
          activeOpacity={0.7}
        >
          <Building2 size={IconSize.sm} color={colors.text2} />
          <Text
            style={{
              flex: 1,
              color: logementId ? colors.text : colors.mutedText,
              fontWeight: logementId ? FontWeight.semibold : FontWeight.regular,
            }}
          >
            {logementId
              ? (logements?.data ?? []).find((l) => l.id === logementId)?.name ?? 'Logement sélectionné'
              : 'Choisir un logement…'}
          </Text>
          <ChevronRight size={IconSize.sm} color={colors.text2} />
        </TouchableOpacity>

        <Text style={[styles.section, { color: colors.text2 }]}>PLANIFICATION</Text>
        <DatePickerField
          label="Date prévue"
          value={datePrevue}
          onChange={setDatePrevue}
          placeholder="Choisir une date"
        />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TimePickerField
              label="Tranche début"
              value={horairePrevu}
              onChange={setHorairePrevu}
              placeholder="--:--"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TimePickerField
              label="Tranche fin"
              value={horaireFinPrevu}
              onChange={setHoraireFinPrevu}
              placeholder="--:--"
            />
          </View>
        </View>
        {!isCheck ? (
          <DurationPickerField
            label="Durée estimée"
            value={dureeEstimee}
            onChange={setDureeEstimee}
          />
        ) : null}

        {isAdmin ? (
          <>
            <Text style={[styles.section, { color: colors.text2 }]}>TARIFICATION</Text>
            <Text style={[styles.hint, { color: colors.mutedText }]}>
              Le prestataire ne verra que son propre montant.
            </Text>
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

            {!isCheck ? (
              <>
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
          disabled={createMutation.isPending}
        >
          <Save size={IconSize.md} color="#FFFFFF" />
          <Text style={styles.submitText}>
            {createMutation.isPending ? 'Création…' : 'Créer le ménage'}
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScroll>

      <LogementPickerModal
        visible={logementPickerOpen}
        logements={logements?.data ?? []}
        selectedId={logementId}
        onSelect={(id) => {
          setLogementId(id);
          setLogementPickerOpen(false);
        }}
        onClose={() => setLogementPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

interface LogementOption {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
}

/**
 * Bottom-sheet recherchable pour choisir un logement. Sépare le picker du
 * formulaire principal : moins encombré quand il y a beaucoup de logements.
 */
function LogementPickerModal({
  visible,
  logements,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  logements: LogementOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [search, setSearch] = useState('');
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible });

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logements;
    return logements.filter((l) =>
      [l.name, l.address, l.city].filter(Boolean).some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [logements, search]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setSearch('')}
    >
      <View style={pickerStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[pickerStyles.sheet, { backgroundColor: colors.surface }, Shadow.lg, animatedModalStyle]}>
          <View style={pickerStyles.handle}>
            <View style={[pickerStyles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={pickerStyles.header}>
            <Text style={[pickerStyles.title, { color: colors.text }]}>Choisir un logement</Text>
          </View>

          <View
            style={[
              pickerStyles.searchBox,
              { backgroundColor: colors.itemBackground, borderColor: colors.border },
            ]}
          >
            <Search size={16} color={colors.placeholder} />
            <TextInput
              style={[pickerStyles.searchInput, { color: colors.text }]}
              placeholder="Rechercher un logement…"
              placeholderTextColor={colors.placeholder}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={pickerStyles.flatList}
            contentContainerStyle={pickerStyles.list}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
            ListEmptyComponent={
              <Text style={[pickerStyles.empty, { color: colors.mutedText }]}>
                {search ? 'Aucun résultat.' : 'Aucun logement.'}
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={pickerStyles.row}
                  onPress={() => onSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[pickerStyles.avatar, { backgroundColor: colors.primary + '20' }]}
                  >
                    <Building2 size={IconSize.sm} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: isSelected ? colors.primary : colors.text,
                        fontSize: FontSize.md,
                        fontWeight: isSelected ? FontWeight.semibold : FontWeight.medium,
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.address || item.city ? (
                      <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }} numberOfLines={1}>
                        {[item.address, item.city].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
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
  handleBar: { width: 40, height: 4, borderRadius: 2 },
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
  flatList: { flexShrink: 1 },
  list: { paddingBottom: Spacing.sm },
  empty: { fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  section: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginTop: Spacing.md },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  hint: { fontSize: FontSize.xs, marginTop: -Spacing.xs },
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
});
