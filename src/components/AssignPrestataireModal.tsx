import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { Bell, CheckCircle2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDialog } from '@/contexts/DialogContext';
import { useEligiblePrestataires } from '@/api/hooks/useMenages';
import { useMenagePrestataires, useSetMenagePrestataires } from '@/api/hooks/useMenagePrestataires';
import { useRelanceMenage } from '@/api/hooks/useMenageResponses';
import type { EligiblePrestataire } from '@/api/types';
import { formatRelativeFr } from '@/lib/date-fr';
import { useTranslation } from '@/contexts/I18nContext';

interface Props {
  visible: boolean;
  menageId: string;
  onClose: () => void;
}

type GroupKey = 'present' | 'none' | 'absent';

interface Group {
  key: GroupKey;
  title: string;
  color: string;
  data: EligiblePrestataire[];
}

function fullName(p: EligiblePrestataire): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email;
}

function initialsOf(p: EligiblePrestataire): string {
  return [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?';
}

/**
 * Affectation des prestataires à une prestation (admin), partagée entre la
 * fiche et la liste. Les prestataires éligibles sont groupés d'après leur vote
 * Présent/Absent : Disponibles · Sans réponse (relançables) · Indisponibles
 * (sélectionnables quand même, atténués). Le 1er coché est le référent.
 */
export default function AssignPrestataireModal({ visible, menageId, onClose }: Props) {
  const colors = Colors[useColorScheme()];
  const dialog = useDialog();
  const { t, tp } = useTranslation();
  const eligible = useEligiblePrestataires(visible ? menageId : undefined);
  const current = useMenagePrestataires(visible ? menageId : undefined);
  const setPrestas = useSetMenagePrestataires(menageId);
  const relance = useRelanceMenage();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Quand la modal s'ouvre OU quand la data current arrive, on resync l'état
  // local sur la liste actuelle (1er = référent, suit l'ordre serveur).
  useEffect(() => {
    if (!visible) return;
    if (!current.data) return;
    setSelectedIds(current.data.map((c) => c.user_id));
  }, [visible, current.data]);

  const list = useMemo(() => eligible.data ?? [], [eligible.data]);
  const groups = useMemo<Group[]>(() => {
    const present = list.filter((p) => p.response_status === 'present');
    const none = list.filter((p) => !p.response_status);
    const absent = list.filter((p) => p.response_status === 'absent');
    const out: Group[] = [];
    if (present.length) out.push({ key: 'present', title: t('assign.available'), color: colors.green, data: present });
    if (none.length) out.push({ key: 'none', title: t('assign.noResponse'), color: colors.text2, data: none });
    if (absent.length) out.push({ key: 'absent', title: t('assign.unavailable'), color: colors.red, data: absent });
    return out;
  }, [list, colors, t]);
  const relanceCount = list.filter((p) => !p.response_status && p.is_member).length;

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    try {
      await setPrestas.mutateAsync(selectedIds);
      onClose();
    } catch (err) {
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('menageDetail.failed') });
    }
  };

  const handleRelance = async () => {
    try {
      const res = await relance.mutateAsync(menageId);
      void dialog.alert({
        title: t('assign.relanceTitle'),
        message: res.sent > 0 ? tp('assign.relanceSent', res.sent) : t('assign.everyoneAnswered'),
      });
    } catch (err) {
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('assign.relanceFailed') });
    }
  };

  const selected = list.filter((p) => selectedIds.includes(p.id));
  const ctaLabel =
    selected.length === 0
      ? t('common.save')
      : selected.length === 1
        ? t('assign.assignOne', { name: fullName(selected[0]) })
        : t('assign.assignMany', { count: selected.length });

  const subline = (p: EligiblePrestataire): string => {
    const parts: string[] = [];
    if (p.response_status === 'present') parts.push(t('assign.present'));
    else if (p.response_status === 'absent') parts.push(t('assign.absent'));
    else parts.push(t('assign.notAnswered'));
    if (p.responded_at) {
      const rel = formatRelativeFr(p.responded_at);
      if (rel) parts.push(rel);
    }
    parts.push(p.is_member ? t('assign.member') : t('assign.nonMember'));
    return parts.join(' · ');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.modal, { backgroundColor: colors.surface }, Shadow.lg]}>
          <Text style={[styles.title, { color: colors.text }]}>{t('assign.title')}</Text>

          {eligible.isLoading ? (
            <Text style={{ color: colors.mutedText, padding: Spacing.lg }}>{t('common.loading')}</Text>
          ) : list.length === 0 ? (
            <Text style={{ color: colors.mutedText, padding: Spacing.lg }}>{t('assign.empty')}</Text>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 400 }}>
                {groups.map((g) => (
                  <View key={g.key} style={styles.group}>
                    <View style={styles.groupHeader}>
                      <Text style={[styles.groupTitle, { color: g.color }]}>
                        {g.title} ({g.data.length})
                      </Text>
                      {g.key === 'none' && relanceCount > 0 ? (
                        <TouchableOpacity
                          onPress={handleRelance}
                          disabled={relance.isPending}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.relanceLink}
                          accessibilityRole="button"
                          accessibilityLabel={t('assign.relanceA11y', { count: relanceCount })}
                        >
                          <Bell size={12} color={colors.primary} />
                          <Text style={[styles.relanceText, { color: colors.primary }]}>
                            {relance.isPending ? t('menageDetail.sending') : t('assign.relanceButton', { count: relanceCount })}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {g.data.map((p) => {
                      const checked = selectedIds.includes(p.id);
                      const isPrimary = checked && selectedIds[0] === p.id;
                      const avatarColor = g.key === 'present' ? colors.green : g.key === 'absent' ? colors.red : colors.text2;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.row,
                            {
                              borderColor: colors.border,
                              backgroundColor: checked ? colors.primary + '15' : 'transparent',
                              opacity: g.key === 'absent' ? 0.6 : 1,
                            },
                          ]}
                          onPress={() => toggle(p.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked }}
                          accessibilityLabel={`${fullName(p)}, ${subline(p)}`}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              checked ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border },
                            ]}
                          >
                            {checked ? <CheckCircle2 size={14} color="#FFFFFF" /> : null}
                          </View>
                          <View style={[styles.avatar, { backgroundColor: avatarColor + '25' }]}>
                            <Text style={[styles.avatarText, { color: avatarColor }]}>{initialsOf(p)}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                              {fullName(p)}
                            </Text>
                            <Text style={[styles.sub, { color: colors.mutedText }]} numberOfLines={1}>
                              {subline(p)}
                            </Text>
                          </View>
                          {isPrimary ? (
                            <View style={[styles.primaryPill, { backgroundColor: colors.primary + '20' }]}>
                              <Text style={[styles.primaryText, { color: colors.primary }]}>{t('menageDetail.referent')}</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
              <Text style={[styles.hint, { color: colors.mutedText }]}>{t('assign.hint')}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.itemBackground }]} onPress={onClose} accessibilityRole="button">
                  <Text style={{ color: colors.text, fontWeight: FontWeight.medium }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                  disabled={setPrestas.isPending}
                  accessibilityRole="button"
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: FontWeight.semibold }} numberOfLines={1}>
                    {setPrestas.isPending ? '…' : ctaLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { width: '90%', maxWidth: 400, borderRadius: Radius.xl, padding: Spacing.lg },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.md },
  group: { marginBottom: Spacing.sm },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  groupTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  relanceLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  relanceText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderBottomWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  sub: { fontSize: FontSize.xs },
  primaryPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  primaryText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  hint: { fontSize: FontSize.xs, paddingTop: Spacing.sm, paddingHorizontal: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md },
  btnPrimary: { flex: 2, paddingHorizontal: Spacing.sm },
});
