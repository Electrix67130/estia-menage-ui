import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  PanResponder,
  Pressable,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Circle,
} from 'react-native-svg';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { Spacing, FontSize, FontWeight, Radius, IconSize, Shadow } from '@/constants/Layout';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#D97706', '#65A30D', '#0891B2',
] as const;

const SV_WIDTH = 280;
const SV_HEIGHT = 180;
const HUE_HEIGHT = 16;

type HSV = { h: number; s: number; v: number };

function hexToHsv(hex: string): HSV {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

function hsvToHex({ h, s, v }: HSV): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const isHex = (s: string | null | undefined): s is string =>
  !!s && /^#[0-9a-fA-F]{6}$/.test(s);

interface Props {
  label?: string;
  value: string | null;
  onChange: (color: string | null) => void;
}

const ColorPicker: React.FC<Props> = ({ label = 'Couleur', value, onChange }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const hueGradId = `hueG_${id}`;
  const darkGradId = `darkG_${id}`;
  const rainbowGradId = `rainbowG_${id}`;

  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>(() =>
    isHex(value) ? hexToHsv(value) : { h: 30, s: 1, v: 0.85 },
  );
  const [hexInput, setHexInput] = useState<string>(value ?? '');

  useEffect(() => {
    if (isHex(value)) {
      setHsv(hexToHsv(value));
      setHexInput(value);
    } else {
      setHexInput('');
    }
  }, [value]);

  const currentHex = useMemo(() => hsvToHex(hsv), [hsv]);
  const hueColor = useMemo(() => hsvToHex({ h: hsv.h, s: 1, v: 1 }), [hsv.h]);

  // Refs pour récupérer la position de chaque zone (page-relative) sans
  // dépendre de `locationX/Y` qui devient peu fiable hors de la zone d'origine.
  const svLayout = useRef({ x: 0, y: 0 });
  const hueLayout = useRef({ x: 0, y: 0 });
  const svViewRef = useRef<View>(null);
  const hueViewRef = useRef<View>(null);
  // Mirror state dans un ref pour que les handlers PanResponder voient toujours
  // la dernière valeur (sinon closure stale).
  const hsvRef = useRef(hsv);
  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  const measureSv = () => {
    svViewRef.current?.measureInWindow((x, y) => {
      svLayout.current = { x, y };
    });
  };
  const measureHue = () => {
    hueViewRef.current?.measureInWindow((x, y) => {
      hueLayout.current = { x, y };
    });
  };

  const updateSv = (pageX: number, pageY: number) => {
    const localX = Math.max(0, Math.min(SV_WIDTH, pageX - svLayout.current.x));
    const localY = Math.max(0, Math.min(SV_HEIGHT, pageY - svLayout.current.y));
    const next: HSV = {
      h: hsvRef.current.h,
      s: localX / SV_WIDTH,
      v: 1 - localY / SV_HEIGHT,
    };
    const hex = hsvToHex(next);
    setHsv(next);
    setHexInput(hex);
    onChange(hex);
  };

  const updateHue = (pageX: number) => {
    const localX = Math.max(0, Math.min(SV_WIDTH, pageX - hueLayout.current.x));
    const next: HSV = {
      h: (localX / SV_WIDTH) * 360,
      s: hsvRef.current.s,
      v: hsvRef.current.v,
    };
    const hex = hsvToHex(next);
    setHsv(next);
    setHexInput(hex);
    onChange(hex);
  };

  const svPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        measureSv();
        updateSv(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderMove: (e) => updateSv(e.nativeEvent.pageX, e.nativeEvent.pageY),
    }),
  ).current;

  const huePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        measureHue();
        updateHue(e.nativeEvent.pageX);
      },
      onPanResponderMove: (e) => updateHue(e.nativeEvent.pageX),
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.text2 }]}>{label}</Text> : null}

      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.triggerSwatch,
            {
              backgroundColor: value ?? 'transparent',
              borderColor: value ? value : colors.border,
            },
          ]}
        />
        <Text style={[styles.triggerHex, { color: colors.text }]}>
          {value ?? 'Aucune couleur'}
        </Text>
        <ChevronDown size={14} color={colors.text2} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.popover, { backgroundColor: colors.surface }, Shadow.lg]}
          >
            <View style={styles.popoverHeader}>
              <Text style={[styles.popoverTitle, { color: colors.text }]}>Choisir une couleur</Text>
            </View>

            {/* Zone Saturation × Valeur */}
            <View
              ref={svViewRef}
              onLayout={measureSv}
              {...svPan.panHandlers}
              style={[styles.svBox, { borderColor: colors.border }]}
            >
              <Svg width={SV_WIDTH} height={SV_HEIGHT}>
                <Defs>
                  <SvgLinearGradient id={hueGradId} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#FFFFFF" />
                    <Stop offset="1" stopColor={hueColor} />
                  </SvgLinearGradient>
                  <SvgLinearGradient id={darkGradId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                    <Stop offset="1" stopColor="#000000" stopOpacity="1" />
                  </SvgLinearGradient>
                </Defs>
                <Rect width={SV_WIDTH} height={SV_HEIGHT} fill={`url(#${hueGradId})`} />
                <Rect width={SV_WIDTH} height={SV_HEIGHT} fill={`url(#${darkGradId})`} />
                <Circle
                  cx={hsv.s * SV_WIDTH}
                  cy={(1 - hsv.v) * SV_HEIGHT}
                  r={9}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  fill={currentHex}
                />
              </Svg>
            </View>

            {/* Slider Hue */}
            <View
              ref={hueViewRef}
              onLayout={measureHue}
              {...huePan.panHandlers}
              style={styles.hueBox}
            >
              <Svg width={SV_WIDTH} height={HUE_HEIGHT}>
                <Defs>
                  <SvgLinearGradient id={rainbowGradId} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#FF0000" />
                    <Stop offset="0.17" stopColor="#FFFF00" />
                    <Stop offset="0.33" stopColor="#00FF00" />
                    <Stop offset="0.5" stopColor="#00FFFF" />
                    <Stop offset="0.67" stopColor="#0000FF" />
                    <Stop offset="0.83" stopColor="#FF00FF" />
                    <Stop offset="1" stopColor="#FF0000" />
                  </SvgLinearGradient>
                </Defs>
                <Rect
                  width={SV_WIDTH}
                  height={HUE_HEIGHT}
                  rx={HUE_HEIGHT / 2}
                  fill={`url(#${rainbowGradId})`}
                />
                <Circle
                  cx={(hsv.h / 360) * SV_WIDTH}
                  cy={HUE_HEIGHT / 2}
                  r={9}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  fill={hueColor}
                />
              </Svg>
            </View>

            {/* Aperçu + champ hex */}
            <View style={styles.previewRow}>
              <View
                style={[
                  styles.previewSwatch,
                  { backgroundColor: currentHex, borderColor: colors.border },
                ]}
              />
              <TextInput
                value={hexInput}
                onChangeText={(t) => {
                  const upper = t.toUpperCase();
                  setHexInput(upper);
                  const candidate = upper.startsWith('#') ? upper : `#${upper}`;
                  if (/^#[0-9A-F]{6}$/.test(candidate)) {
                    const parsed = hexToHsv(candidate);
                    setHsv(parsed);
                    onChange(candidate);
                  }
                }}
                placeholder="#D97706"
                placeholderTextColor={colors.placeholder}
                maxLength={7}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[
                  styles.hexInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground },
                ]}
              />
              {value ? (
                <TouchableOpacity
                  onPress={() => {
                    onChange(null);
                    setHexInput('');
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={[styles.clearText, { color: colors.text2 }]}>Effacer</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Palette d'accès rapide */}
            <View style={styles.paletteRow}>
              {PALETTE.map((c) => {
                const selected = value?.toLowerCase() === c.toLowerCase();
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.paletteSwatch,
                      {
                        backgroundColor: c,
                        borderColor: selected ? colors.text : 'transparent',
                        borderWidth: selected ? 2 : 0,
                      },
                    ]}
                    onPress={() => {
                      setHsv(hexToHsv(c));
                      setHexInput(c);
                      onChange(c);
                    }}
                  >
                    {selected ? <Check size={12} color="#FFFFFF" /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.doneText}>OK</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  triggerSwatch: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  triggerHex: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    fontFamily: 'monospace',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  popover: {
    width: SV_WIDTH + Spacing.lg * 2,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popoverTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  svBox: {
    width: SV_WIDTH,
    height: SV_HEIGHT,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  hueBox: { width: SV_WIDTH, height: HUE_HEIGHT },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewSwatch: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  hexInput: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    letterSpacing: 1,
  },
  clearText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  paletteSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  doneText: { color: '#FFFFFF', fontWeight: FontWeight.bold, fontSize: FontSize.md },
});

export const LOGEMENT_COLORS = PALETTE;

export default React.memo(ColorPicker);
