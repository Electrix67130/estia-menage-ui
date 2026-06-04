import React, { ReactNode } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';

/**
 * Lightbox photo standardisée : utilisée partout dans l'app pour ouvrir une image
 * en grand. Garantit la même UX (overlay sombre, bouton X en haut à droite,
 * fermeture par back hardware Android).
 *
 * Pour ajouter des métadonnées (timestamp, géo, actions), passer un `footer`.
 */
export default function PhotoLightbox({
  visible,
  onClose,
  photoUrl,
  title,
  subtitle,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  photoUrl: string | null;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <X size={IconSize.lg} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.image} resizeMode="contain" />
        ) : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.sm, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { flex: 1, width: '100%', borderRadius: Radius.md },
  footer: { gap: Spacing.sm },
});
