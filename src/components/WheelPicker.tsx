import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewStyle,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  items: string[];
  /** Index sélectionné. */
  selectedIndex: number;
  /** Callback appelé quand l'utilisateur snap sur un nouvel index. */
  onChange: (index: number) => void;
  /** Hauteur de chaque item (= snap interval). Défaut 40. */
  itemHeight?: number;
  /** Nombre d'items visibles (impair pour avoir un centre). Défaut 5. */
  visibleCount?: number;
  /** Largeur du wheel. Défaut auto/flex. */
  width?: number;
  style?: ViewStyle;
}

/**
 * Wheel picker style iOS — ScrollView vertical avec snap sur chaque item.
 * Item central = sélectionné. Items au-dessus/au-dessous estompés.
 * Pure JS, pas de dépendance native.
 */
const WheelPicker: React.FC<Props> = ({
  items,
  selectedIndex,
  onChange,
  itemHeight = 40,
  visibleCount = 5,
  width,
  style,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const scrollRef = useRef<ScrollView>(null);
  const containerHeight = itemHeight * visibleCount;
  const padding = (containerHeight - itemHeight) / 2;
  const lastReportedIndex = useRef(selectedIndex);

  // Scroll au bon index quand selectedIndex change depuis l'extérieur.
  useEffect(() => {
    if (selectedIndex !== lastReportedIndex.current) {
      scrollRef.current?.scrollTo({ y: selectedIndex * itemHeight, animated: false });
      lastReportedIndex.current = selectedIndex;
    }
  }, [selectedIndex, itemHeight]);

  // Initial scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * itemHeight, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / itemHeight);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== lastReportedIndex.current) {
      lastReportedIndex.current = clamped;
      onChange(clamped);
    }
  };

  return (
    <View style={[{ height: containerHeight, width, position: 'relative' }, style]}>
      {/* Bandes guide haut/bas */}
      <View
        pointerEvents="none"
        style={[
          styles.guide,
          { top: padding, height: itemHeight, borderColor: colors.border },
        ]}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: padding }}
      >
        {items.map((label, i) => {
          const selected = i === lastReportedIndex.current;
          return (
            <View key={`${label}-${i}`} style={{ height: itemHeight, justifyContent: 'center', alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: selected ? FontSize.xl : FontSize.lg,
                  fontWeight: selected ? FontWeight.semibold : FontWeight.medium,
                  color: selected ? colors.text : colors.mutedText,
                }}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  guide: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
});

export default WheelPicker;
