import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Star, Camera, ImagePlus, X, AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useDialog } from '@/contexts/DialogContext';

export interface ArrivalDeclaration {
  rating: number;
  hasDegradation: boolean;
  note: string;
  assets: ImagePicker.ImagePickerAsset[];
}

/**
 * Étape post-photo d'arrivée : note des voyageurs (1-5, obligatoire) + déclaration
 * d'une dégradation (oui/non). Si dégradation : description + ≥1 photo obligatoires.
 */
export default function ArrivalDeclarationModal({
  visible,
  submitting,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (decl: ArrivalDeclaration) => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [hasDegradation, setHasDegradation] = useState(false);
  const [note, setNote] = useState('');
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  // Erreur affichée INLINE dans la feuille : une alerte (dialog/native) déclenchée
  // par-dessus ce Modal reste invisible sur iOS (Modals imbriqués) → l'utilisateur
  // avait l'impression que « Démarrer le ménage » ne faisait rien.
  const [error, setError] = useState('');
  const animatedModalStyle = useKeyboardAwareModalStyle({ visible });

  const reset = () => {
    setRating(0);
    setHasDegradation(false);
    setNote('');
    setAssets([]);
    setError('');
  };

  const pickPhoto = async (useCamera: boolean) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      void dialog.alert({ title: 'Accès refusé', message: 'Autorise l’accès dans les réglages.' });
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true });
    if (!result.canceled) {
      setAssets((prev) => [...prev, ...result.assets]);
      setError('');
    }
  };

  const handleSubmit = () => {
    if (rating < 1) {
      setError('Note les voyageurs (1 à 5 étoiles) avant de démarrer.');
      return;
    }
    if (hasDegradation) {
      if (!note.trim()) {
        setError('Décris la dégradation constatée.');
        return;
      }
      if (assets.length === 0) {
        setError('Ajoute au moins une photo de la dégradation.');
        return;
      }
    }
    setError('');
    onSubmit({ rating, hasDegradation, note: note.trim(), assets });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={submitting ? undefined : onClose}
      onShow={reset}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onClose} />
        <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.xl }, Shadow.lg, animatedModalStyle]}>
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: colors.text }]}>Arrivée sur place</Text>

            <Text style={[styles.label, { color: colors.text2 }]}>NOTE DES VOYAGEURS</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => { setRating(n); setError(''); }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`}
                >
                  <Star
                    size={34}
                    color={n <= rating ? '#F5A623' : colors.border}
                    fill={n <= rating ? '#F5A623' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.degradationRow,
                { backgroundColor: colors.itemBackground, borderColor: hasDegradation ? colors.red : colors.border },
              ]}
              onPress={() => { setHasDegradation((v) => !v); setError(''); }}
              activeOpacity={0.7}
            >
              <AlertTriangle size={IconSize.md} color={hasDegradation ? colors.red : colors.text2} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.medium }}>
                  Dégradation constatée
                </Text>
                <Text style={{ color: colors.mutedText, fontSize: FontSize.xs, marginTop: 2 }}>
                  Coche si le logement présente des dommages à ton arrivée.
                </Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  hasDegradation
                    ? { backgroundColor: colors.red, borderColor: colors.red }
                    : { borderColor: colors.border },
                ]}
              >
                {hasDegradation ? <X size={14} color="#FFFFFF" /> : null}
              </View>
            </TouchableOpacity>

            {hasDegradation ? (
              <>
                <Text style={[styles.label, { color: colors.text2 }]}>DESCRIPTION</Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground, minHeight: 70, textAlignVertical: 'top' },
                  ]}
                  value={note}
                  onChangeText={(t) => { setNote(t); setError(''); }}
                  placeholder="Ex : tache sur le canapé, vaisselle cassée…"
                  placeholderTextColor={colors.placeholder}
                  multiline
                />

                <Text style={[styles.label, { color: colors.text2 }]}>PHOTOS DE LA DÉGRADATION</Text>
                <View style={styles.photosRow}>
                  {assets.map((a, i) => (
                    <View key={`${a.uri}-${i}`} style={styles.thumbWrap}>
                      <Image source={{ uri: a.uri }} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => setAssets((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.photoBtns}>
                  <TouchableOpacity
                    style={[styles.photoBtn, { borderColor: colors.primary }]}
                    onPress={() => pickPhoto(true)}
                  >
                    <Camera size={IconSize.sm} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.medium }}>Caméra</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.photoBtn, { borderColor: colors.primary }]}
                    onPress={() => pickPhoto(false)}
                  >
                    <ImagePlus size={IconSize.sm} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.medium }}>Galerie</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {error ? (
              <Text style={{ color: colors.red, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.md }}>
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[styles.submit, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>Démarrer le ménage</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  handle: { alignItems: 'center', paddingBottom: Spacing.sm },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.md },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.sm },
  starsRow: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center', paddingVertical: Spacing.sm },
  degradationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  checkbox: { width: 22, height: 22, borderRadius: Radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: Radius.sm },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.xl,
  },
  submitText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
});
