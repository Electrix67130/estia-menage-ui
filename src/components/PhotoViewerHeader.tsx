import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/contexts/I18nContext';

const HIT_SLOP = { top: 16, left: 16, bottom: 16, right: 16 };

/**
 * En-tête de la visionneuse plein écran (`react-native-image-viewing`).
 * Celui de la librairie se cale avec le `SafeAreaView` de React Native, qui
 * n'agit que sur iOS : sur Android, la croix se collait à la barre d'état.
 */
export default function PhotoViewerHeader({ onRequestClose }: { onRequestClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingRight: insets.right + 12 }]}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onRequestClose}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#00000077',
  },
  closeText: {
    lineHeight: 22,
    fontSize: 19,
    textAlign: 'center',
    color: '#FFF',
    includeFontPadding: false,
  },
});
