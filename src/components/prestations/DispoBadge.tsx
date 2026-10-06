import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Clock, X } from 'lucide-react-native';
import type { Colors } from '@/constants/Colors';
import { FontSize, FontWeight, Radius } from '@/constants/Layout';
import type { Menage } from '@/api/types';
import { useTranslation } from '@/contexts/I18nContext';
import { translate, translatePlural } from '@/i18n/runtime';

type DispoCounts = Pick<Menage, 'present_count' | 'absent_count' | 'member_prestataire_count'>;

/** État de disponibilité d'une prestation non affectée, d'après les votes. */
export type DispoState = 'available' | 'unavailable' | 'no_response';

export function dispoState(m: DispoCounts): DispoState {
  if ((m.present_count ?? 0) > 0) return 'available';
  if ((m.absent_count ?? 0) > 0) return 'unavailable';
  return 'no_response';
}

/** Texte secondaire à côté du badge (« 3 absents », « 4 membres »). */
export function dispoSecondaryLabel(m: DispoCounts): string | null {
  const state = dispoState(m);
  if (state === 'available') return null;
  if (state === 'unavailable') return translatePlural('dispo.absentCount', m.absent_count ?? 0);
  const n = m.member_prestataire_count ?? 0;
  if (n === 0) return translate('dispo.noPrestataireMember');
  return translatePlural('dispo.memberCount', n);
}

interface Props {
  menage: DispoCounts;
  colors: typeof Colors.light;
}

/**
 * « Qui est dispo ? » — badge admin sur une prestation sans prestataire :
 *   vert  « 2 dispos »          (au moins un vote Présent)
 *   rouge « Personne de dispo » (que des Absent)
 *   gris  « Aucune réponse »    (personne n'a voté)
 */
const DispoBadge: React.FC<Props> = ({ menage, colors }) => {
  const { t, tp } = useTranslation();
  const state = dispoState(menage);
  const secondary = dispoSecondaryLabel(menage);

  let bg: string;
  let fg: string;
  let icon: React.ReactNode;
  let label: string;
  if (state === 'available') {
    const n = menage.present_count ?? 0;
    bg = colors.green + '18';
    fg = colors.green;
    icon = <Check size={11} color={fg} strokeWidth={3} />;
    label = tp('dispo.availableCount', n);
  } else if (state === 'unavailable') {
    bg = colors.red + '15';
    fg = colors.red;
    icon = <X size={11} color={fg} strokeWidth={3} />;
    label = t('dispo.nobodyAvailable');
  } else {
    bg = colors.itemBackground;
    fg = colors.text2;
    icon = <Clock size={11} color={fg} />;
    label = t('dispo.noResponse');
  }

  return (
    <View style={styles.row} accessibilityLabel={secondary ? `${label}, ${secondary}` : label}>
      <View style={[styles.pill, { backgroundColor: bg }]}>
        {icon}
        <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
      </View>
      {secondary ? (
        <Text style={[styles.secondary, { color: colors.text2 }]} numberOfLines={1}>
          {secondary}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  pillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  secondary: { fontSize: FontSize.xs, flexShrink: 1 },
});

export default React.memo(DispoBadge);
