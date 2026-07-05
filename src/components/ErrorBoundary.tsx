import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';

/**
 * Capture les erreurs de rendu React d'une sous-arborescence pour éviter que
 * toute l'app crashe/se ferme. Affiche le message d'erreur (utile pour
 * diagnostiquer en prod, faute de reporting d'erreurs) + un bouton Réessayer.
 *
 * Note : ne capture QUE les erreurs de rendu React (pas les crashs natifs ni
 * les erreurs asynchrones).
 */
interface Props {
  children: React.ReactNode;
  /** Libellé de la zone (ex. « les photos ») pour le message. */
  label?: string;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Trace en console (visible dans les logs EAS/Metro) pour diagnostic.
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      const colors = Colors.light;
      return (
        <ScrollView contentContainerStyle={styles.wrap}>
          <Text style={[styles.title, { color: colors.text }]}>
            Impossible d&apos;afficher {this.props.label ?? 'cette section'}
          </Text>
          <Text style={[styles.msg, { color: colors.text2 }]}>
            {this.state.error.message || String(this.state.error)}
          </Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={this.reset}>
            <Text style={styles.btnText}>Réessayer</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { padding: Spacing.lg, gap: Spacing.md, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, textAlign: 'center' },
  msg: { fontSize: FontSize.sm, textAlign: 'center' },
  btn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill },
  btnText: { color: '#FFFFFF', fontWeight: FontWeight.semibold },
});
