import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';

interface Props {
  menageId?: string;
  logementId?: string;
  readonly?: boolean;
}

/**
 * TeamManager — placeholder.
 * Sera remplacé par un composant LogementMembers en Phase M5 (gestion des membres
 * permanents d'un logement avec rôles manager / prestataire / client_proprietaire
 * et permissions granulaires).
 */
export default function TeamManager(_props: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={{ color: colors.mutedText, textAlign: 'center', padding: Spacing.lg }}>
        {t('teamManager.placeholder')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
