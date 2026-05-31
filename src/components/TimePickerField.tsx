import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import { Clock } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import WheelPicker from './WheelPicker';

interface Props {
  label: string;
  /** Format "HH:MM" (24h). Vide = pas d'horaire. */
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  /** Pas en minutes. Défaut 5. */
  minuteStep?: number;
}

const TimePickerField: React.FC<Props> = ({
  label,
  value,
  onChange,
  placeholder = 'Sélectionner un horaire',
  minuteStep = 5,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [open, setOpen] = useState(false);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), []);
  const minutes = useMemo(() => {
    const n = Math.floor(60 / minuteStep);
    return Array.from({ length: n }, (_, i) => String(i * minuteStep).padStart(2, '0'));
  }, [minuteStep]);

  const parsed = value && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : '09:00';
  const initialH = parseInt(parsed.split(':')[0], 10);
  const initialM = parseInt(parsed.split(':')[1], 10);
  const initialMIdx = Math.min(minutes.length - 1, Math.round(initialM / minuteStep));

  const [hIdx, setHIdx] = useState(initialH);
  const [mIdx, setMIdx] = useState(initialMIdx);

  const openPicker = () => {
    setHIdx(initialH);
    setMIdx(initialMIdx);
    setOpen(true);
  };

  const display = value ? value.slice(0, 5) : '';

  return (
    <View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.field, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={[styles.fieldText, { color: display ? colors.text : colors.placeholder }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {display || placeholder}
        </Text>
        <Clock size={IconSize.md} color={colors.mutedText} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.modal, { backgroundColor: colors.surface }, Shadow.lg]}>
            <Text style={[styles.title, { color: colors.text }]}>Choisis un horaire</Text>
            <View style={styles.wheelsRow}>
              <WheelPicker items={hours} selectedIndex={hIdx} onChange={setHIdx} width={80} />
              <Text style={[styles.colon, { color: colors.text }]}>:</Text>
              <WheelPicker items={minutes} selectedIndex={mIdx} onChange={setMIdx} width={80} />
            </View>
            <View style={styles.footer}>
              {value ? (
                <TouchableOpacity
                  onPress={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  style={[styles.btn, { backgroundColor: colors.itemBackground }]}
                >
                  <Text style={{ color: colors.text, fontWeight: FontWeight.medium }}>Effacer</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => {
                  onChange(`${hours[hIdx]}:${minutes[mIdx]}`);
                  setOpen(false);
                }}
                style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: FontWeight.semibold }}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: Spacing.md },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  fieldText: { flex: 1, fontSize: FontSize.base },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { width: '90%', maxWidth: 360, borderRadius: Radius.xl, padding: Spacing.lg },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.md, textAlign: 'center' },
  wheelsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  colon: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  footer: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  btn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, alignItems: 'center' },
});

export default TimePickerField;
