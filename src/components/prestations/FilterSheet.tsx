import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import FilterPickerSheet, { type FilterOption } from '@/components/FilterPickerSheet';
import SheetHandle from '@/components/SheetHandle';
import { prestationTypeColorKey, type MenageAvailability, type PrestationType } from '@/api/types';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';

export interface PrestationFilters {
  type: string;
  logement: string;
  presta: string;
  creator: string;
  /** Admin : '' | 'available' | 'unavailable' | 'no_response' (votes Présent/Absent). */
  availability: MenageAvailability | '';
}

export const EMPTY_PRESTATION_FILTERS: PrestationFilters = { type: '', logement: '', presta: '', creator: '', availability: '' };

const AVAILABILITIES: { id: MenageAvailability | ''; label: TranslationKeys; colorKey: 'primary' | 'green' | 'red' | 'text2' }[] = [
  { id: '', label: 'filterSheet.allF', colorKey: 'primary' },
  { id: 'available', label: 'dispo.someoneAvailable', colorKey: 'green' },
  { id: 'unavailable', label: 'dispo.nobodyAvailable', colorKey: 'red' },
  { id: 'no_response', label: 'dispo.noResponse', colorKey: 'text2' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: PrestationFilters;
  onChange: (next: PrestationFilters) => void;
  logementOptions: FilterOption[];
  prestaOptions: FilterOption[];
  creatorOptions: FilterOption[];
  /** Nombre de prestations que la liste affichera avec ces filtres. */
  resultCount: number;
  /** Le filtre prestataire / créateur est réservé à l'admin. */
  isAdmin: boolean;
}

const TYPES: PrestationType[] = ['menage', 'check_in', 'check_out'];

/** Nombre de filtres posés (pour la pastille sur l'icône). */
export function countActiveFilters(f: PrestationFilters): number {
  return [f.type, f.logement, f.presta, f.creator, f.availability].filter(Boolean).length;
}

/**
 * Feuille de filtres (type, logement, prestataire, source) : sort les filtres du
 * chemin de la liste, et annonce combien de prestations elle affichera.
 */
export default function FilterSheet({
  visible,
  onClose,
  filters,
  onChange,
  logementOptions,
  prestaOptions,
  creatorOptions,
  resultCount,
  isAdmin,
}: Props) {
  const colors = Colors[useColorScheme()];
  const { t, tp } = useTranslation();
  const [picker, setPicker] = useState<null | 'logement' | 'presta' | 'creator'>(null);
  const labelOf = (opts: FilterOption[], id: string, all: string) => (id ? opts.find((o) => o.id === id)?.label ?? all : all);
  const isEmpty = countActiveFilters(filters) === 0;

  const row = (label: string, value: string, active: boolean, onPress: () => void) => (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.text2 }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.select, { backgroundColor: colors.itemBackground, borderColor: active ? colors.primary : colors.border }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value}`}
      >
        <Text style={[styles.selectText, { color: active ? colors.text : colors.mutedText, fontWeight: active ? FontWeight.semibold : FontWeight.regular }]} numberOfLines={1}>
          {value}
        </Text>
        <ChevronDown size={16} color={colors.text2} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('filterSheet.closeA11y')} />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <SheetHandle />
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('common.filters')}</Text>
          <TouchableOpacity
            onPress={() => onChange(EMPTY_PRESTATION_FILTERS)}
            disabled={isEmpty}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.reset, { color: isEmpty ? colors.mutedText : colors.primary }]}>{t('common.reset')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.text2 }]}>{t('filterSheet.type')}</Text>
          <View style={styles.typeRow}>
            {[
              { id: '', label: t('common.all'), color: colors.primary },
              ...TYPES.map((ty) => ({ id: ty, label: t(`prestationType.${ty}` as TranslationKeys), color: colors[prestationTypeColorKey(ty)] })),
            ].map((ty) => {
              const active = filters.type === ty.id;
              return (
                <TouchableOpacity
                  key={ty.id || 'all'}
                  style={[
                    styles.typeChip,
                    { backgroundColor: active ? ty.color + '20' : colors.itemBackground, borderColor: active ? ty.color : colors.border },
                  ]}
                  onPress={() => onChange({ ...filters, type: ty.id })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.typeChipText, { color: active ? ty.color : colors.text2 }]}>{ty.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {row(t('filterSheet.logement'), labelOf(logementOptions, filters.logement, t('filterSheet.allLogements')), !!filters.logement, () => setPicker('logement'))}
        {isAdmin ? row(t('menage.fields.prestataire'), labelOf(prestaOptions, filters.presta, t('filterSheet.allPrestataires')), !!filters.presta, () => setPicker('presta')) : null}
        {isAdmin ? row(t('filterSheet.source'), labelOf(creatorOptions, filters.creator, t('filterSheet.allSources')), !!filters.creator, () => setPicker('creator')) : null}

        {isAdmin ? (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.text2 }]}>{t('filterSheet.availability')}</Text>
            <View style={styles.chipWrap}>
              {AVAILABILITIES.map((a) => {
                const active = filters.availability === a.id;
                const color = colors[a.colorKey];
                return (
                  <TouchableOpacity
                    key={a.id || 'all'}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? color + '20' : colors.itemBackground, borderColor: active ? color : colors.border },
                    ]}
                    onPress={() => onChange({ ...filters, availability: a.id })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.typeChipText, { color: active ? color : colors.text2 }]}>{t(a.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.apply, { backgroundColor: colors.primary }]} onPress={onClose} accessibilityRole="button">
          <Text style={styles.applyText}>{tp('filterSheet.showResults', resultCount)}</Text>
        </TouchableOpacity>

        {/* Pickers rendus DANS la feuille (modale imbriquée) pour rester au-dessus. */}
        <FilterPickerSheet
          visible={picker === 'logement'}
          title={t('filterSheet.byLogement')}
          options={logementOptions}
          selectedId={filters.logement}
          onSelect={(id) => {
            onChange({ ...filters, logement: id });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
          searchPlaceholder={t('filterSheet.searchLogement')}
        />
        <FilterPickerSheet
          visible={picker === 'presta'}
          title={t('filterSheet.byPrestataire')}
          options={prestaOptions}
          selectedId={filters.presta}
          onSelect={(id) => {
            onChange({ ...filters, presta: id });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
          searchPlaceholder={t('filterSheet.searchPrestataire')}
        />
        <FilterPickerSheet
          visible={picker === 'creator'}
          title={t('filterSheet.bySource')}
          options={creatorOptions}
          selectedId={filters.creator}
          onSelect={(id) => {
            onChange({ ...filters, creator: id });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
          searchPlaceholder={t('filterSheet.searchSource')}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  sheet: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: Spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  reset: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  field: { gap: 6 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1 },
  typeChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  selectText: { fontSize: FontSize.base, flex: 1 },
  apply: { alignItems: 'center', paddingVertical: 13, borderRadius: Radius.lg, marginTop: Spacing.xs },
  applyText: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
