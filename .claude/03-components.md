# Composants — Patterns

## Structure standard

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  title: string;
  onPress?: () => void;
}

const MyComponent: React.FC<Props> = ({ title, onPress }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: Spacing.lg },
  title: { fontSize: FontSize.lg },
});

export default MyComponent;
```

## Regles

- Props typees avec `interface` (pas inline)
- StyleSheet en bas du fichier
- Pas de style inline sauf pour les couleurs dynamiques
- `SafeAreaView` pour tous les screens
- `KeyboardAvoidingView` pour les formulaires
- `FlatList` pour les listes longues (pas `ScrollView` + `.map()`)

## Reutiliser l'existant — TOUJOURS verifier avant de creer

Avant d'ecrire un nouveau composant (modal, input, picker, bottom-sheet, etc.) :

1. **Cherche dans `src/components/` et `src/hooks/`** un composant/hook qui fait deja le job.
2. **Reutilise-le** plutot que d'en recreer un.

### Patterns deja en place a reutiliser

- **Modal/bottom-sheet avec input** : utiliser `useKeyboardAwareModalStyle` + `Animated.View` (voir `LogementMembersSection.tsx`, `TeamManager.tsx`). Sans ce hook, le clavier recouvre l'input — c'est le bug classique. Pattern :
  ```tsx
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible });
  // ...
  <Animated.View style={[sheetStyles.sheet, animatedModalStyle]}>
    {/* TextInput + contenu */}
  </Animated.View>
  ```
- **Padding bas d'une bottom-sheet avec clavier** : NE PAS utiliser `padding: Spacing.lg` qui applique aussi un padding en bas — ça cree un gap visible entre le bas de la modal et le haut du clavier. Toujours separer :
  ```tsx
  sheet: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,   // ou Spacing.lg
    paddingBottom: 0,         // ou Spacing.sm max — JAMAIS Spacing.lg
  }
  ```
  Le `useKeyboardAwareModalStyle` colle deja la modal au haut du clavier ; un padding bas important re-creerait le gap qu'on a supprime. La FlatList interne peut absorber un peu de padding via `contentContainerStyle: { paddingBottom: Spacing.sm }` si necessaire.
- **Input dans un ScrollView/FlatList** : utiliser `AutoScrollInput` + `KeyboardAwareScroll` (auto-scroll vers l'input focus).
- **ActionSheet (liste d'actions courte sans recherche)** : `ActionSheet` component.
- **Picker avec recherche** : modal bottom-sheet + `TextInput` + `FlatList` + `useKeyboardAwareModalStyle`.
- **Champ date / heure / duree** : `DatePickerField`, `TimePickerField`, `DurationPickerField`.
- **Recherche ville / adresse** : `CityAutocomplete`.
- **Filtres chips** : `FilterChips`.

Si le pattern n'existe pas, **factorise-le** dans `src/components/` au lieu d'inliner.

## Interdiction : `Alert.alert` natif

**Ne jamais utiliser `Alert.alert` de `react-native`.** Toujours passer par le provider de l'app :

```tsx
import { useDialog } from '@/contexts/DialogContext';

const { confirm, alert } = useDialog();

// Info / erreur simple :
void alert({ title: 'Erreur', message: 'Échec de la mise à jour' });

// Confirm destructif :
const ok = await confirm({
  title: 'Supprimer ?',
  message: 'Action irréversible.',
  confirmLabel: 'Supprimer',
  destructive: true,
});
if (ok) {
  // ...
}
```

Pourquoi : sur iOS, `Alert.alert` ne se compose pas par-dessus une `<Modal>` ouverte (l'alerte est avalée ou bloquée derrière). En plus, le natif n'est pas thémable et casse le design system. Le `DialogProvider` (`src/contexts/DialogContext.tsx`) résout les deux problèmes.

Cas particulier des libs (hors composants React) : impossible d'appeler `useDialog()` depuis une fonction utilitaire pure (ex: `src/lib/contact-links.ts`). Dans ce cas, **throw une erreur typée** (ex: `ContactLinkError`) et laisse le composant appelant la catcher et la router vers `dialog.alert(...)`.
