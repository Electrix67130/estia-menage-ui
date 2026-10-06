import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import { Timer } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import WheelPicker from './WheelPicker';
import { useTranslation } from '@/contexts/I18nContext';
import { translate } from '@/i18n/runtime';

interface Props {
  label: string;
  /** Durée en minutes sous forme de string (vide = pas définie). */
  value: string;
  onChange: (minutes: string) => void;
  /** Pas en minutes. Défaut 5. */
  minuteStep?: number;
  /** Heures maximales. Défaut 8. */
  maxHours?: number;
}

function formatLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hUnit = translate('common.hoursShort');
  if (h === 0) return `${m} ${translate('common.minutesShort')}`;
  if (m === 0) return `${h} ${hUnit}`;
  return `${h} ${hUnit} ${String(m).padStart(2, '0')}`;
}

const DurationPickerField: React.FC<Props> = ({
  label,
  value,
  onChange,
  minuteStep = 5,
  maxHours = 8,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const hourItems = useMemo(
    () => Array.from({ length: maxHours + 1 }, (_, i) => String(i)),
    [maxHours],
  );
  const minuteItems = useMemo(() => {
    const n = Math.floor(60 / minuteStep);
    return Array.from({ length: n }, (_, i) => String(i * minuteStep).padStart(2, '0'));
  }, [minuteStep]);

  const numericValue = value ? parseInt(value, 10) : null;
  const initialH = numericValue !== null ? Math.floor(numericValue / 60) : 1;
  const initialMVal = numericValue !== null ? numericValue % 60 : 0;
  const initialMIdx = Math.min(minuteItems.length - 1, Math.round(initialMVal / minuteStep));

  const [hIdx, setHIdx] = useState(initialH);
  const [mIdx, setMIdx] = useState(initialMIdx);

  const openPicker = () => {
    setHIdx(initialH);
    setMIdx(initialMIdx);
    setOpen(true);
  };

  return (
    <View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.field, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.fieldText, { color: numericValue !== null ? colors.text : colors.placeholder }]}>
          {numericValue !== null ? formatLabel(numericValue) : t('picker.notSet')}
        </Text>
        <Timer size={IconSize.md} color={colors.mutedText} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.modal, { backgroundColor: colors.surface }, Shadow.lg]}>
            <Text style={[styles.title, { color: colors.text }]}>{t('menage.fields.dureeEstimee')}</Text>
            <View style={styles.wheelsRow}>
              <View style={styles.col}>
                <WheelPicker items={hourItems} selectedIndex={hIdx} onChange={setHIdx} width={70} />
                <Text style={[styles.unit, { color: colors.mutedText }]}>{t('common.hoursShort')}</Text>
              </View>
              <View style={styles.col}>
                <WheelPicker items={minuteItems} selectedIndex={mIdx} onChange={setMIdx} width={70} />
                <Text style={[styles.unit, { color: colors.mutedText }]}>{t('common.minutesShort')}</Text>
              </View>
            </View>
            <View style={styles.footer}>
              {numericValue !== null ? (
                <TouchableOpacity
                  onPress={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  style={[styles.btn, { backgroundColor: colors.itemBackground }]}
                >
                  <Text style={{ color: colors.text, fontWeight: FontWeight.medium }}>{t('picker.clear')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => {
                  const total = parseInt(hourItems[hIdx], 10) * 60 + parseInt(minuteItems[mIdx], 10);
                  onChange(String(total));
                  setOpen(false);
                }}
                style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: FontWeight.semibold }}>{t('common.validate')}</Text>
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
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  fieldText: { fontSize: FontSize.base },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { width: '90%', maxWidth: 360, borderRadius: Radius.xl, padding: Spacing.lg },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.md, textAlign: 'center' },
  wheelsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
  col: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  unit: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  footer: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  btn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, alignItems: 'center' },
});

export default DurationPickerField;
