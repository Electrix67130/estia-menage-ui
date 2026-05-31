import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Champ texte pour les codes/secrets : masqué par défaut, bouton oeil à droite
 * pour révéler le contenu. Utilisé pour le code boîte à clef, etc.
 *
 * Volontairement pas basé sur `secureTextEntry` natif (qui désactive l'autofill
 * des password managers — non souhaité ici, c'est juste un masquage visuel).
 * On force `secureTextEntry` quand caché pour bloquer les suggestions iOS, on
 * désactive `autoComplete`/`autoCorrect` pour éviter que l'OS propose des mdp.
 */
interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  readonly?: boolean;
  /** Si fourni, override le style du wrapper (border, bg, etc.) */
  style?: object;
}

const SecretCodeField: React.FC<Props> = ({
  value,
  onChangeText,
  placeholder = 'Code…',
  readonly = false,
  style,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [revealed, setRevealed] = useState(false);

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <TextInput
        style={[styles.input, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        secureTextEntry={!revealed}
        editable={!readonly}
        autoComplete="off"
        autoCorrect={false}
        autoCapitalize="none"
        textContentType="oneTimeCode"
      />
      <TouchableOpacity
        onPress={() => setRevealed((r) => !r)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={revealed ? 'Masquer le code' : 'Révéler le code'}
      >
        {revealed ? (
          <EyeOff size={IconSize.sm} color={colors.text2} />
        ) : (
          <Eye size={IconSize.sm} color={colors.text2} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  input: { flex: 1, fontSize: FontSize.md, paddingVertical: Spacing.xs },
});

export default SecretCodeField;
