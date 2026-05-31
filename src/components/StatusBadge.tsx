import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';
import type { MenageStatus } from '@/api/types';

const STATUS_KEYS: Record<MenageStatus, TranslationKeys> = {
  a_venir: 'menage.statusUpcoming',
  en_cours: 'menage.statusInProgress',
  termine: 'menage.statusCompleted',
  valide: 'menage.statusUpcoming',
  annule: 'menage.statusUpcoming',
};

const STATUS_LABELS: Record<MenageStatus, string> = {
  a_venir: 'À venir',
  en_cours: 'En cours',
  termine: 'À valider',
  valide: 'Validé',
  annule: 'Annulé',
};

interface Props {
  status: MenageStatus;
}

const StatusBadge: React.FC<Props> = ({ status }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const colorMap: Record<MenageStatus, string> = {
    a_venir: colors.statusAVenir,
    en_cours: colors.statusEnCours,
    termine: colors.statusTermine,
    valide: colors.statusValide,
    annule: colors.mutedText,
  };

  const badgeColor = colorMap[status];

  // Icône distinctive pour termine (à valider) / valide afin de bien marquer
  // visuellement la différence avec les autres statuts.
  const Icon = status === 'termine' ? ClipboardCheck : status === 'valide' ? CheckCircle2 : null;

  return (
    <View style={[styles.badge, { backgroundColor: badgeColor + '20', borderColor: badgeColor }]}>
      {Icon ? (
        <Icon size={11} color={badgeColor} />
      ) : (
        <View style={[styles.dot, { backgroundColor: badgeColor }]} />
      )}
      <Text style={[styles.text, { color: badgeColor }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});

export default React.memo(StatusBadge);
