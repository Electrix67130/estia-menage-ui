import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Linking,
  Pressable} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MessageSquare,
  Camera,
  ListChecks,
  Home,
  Play,
  Square,
  CheckCircle2,
  Clock,
  X,
  Euro,
  Pencil,
  Trash2,
  RefreshCw,
  MapPin,
  Lock,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import { GestureDetector } from 'react-native-gesture-handler';
import SheetHandle from '@/components/SheetHandle';
import { menageHooks, useArrival, useDeparture, useValidateReport, useArchiveMenage, useEligiblePrestataires, useUpdateMenage } from '@/api/hooks/useMenages';
import { useMenagePrestataires, useSetMenagePrestataires } from '@/api/hooks/useMenagePrestataires';
import {
  useMenageResponses,
  useOverrideMenageResponse,
  type MenageResponse,
} from '@/api/hooks/useMenageResponses';
import { useCreateRescheduleRequest } from '@/api/hooks/useReschedule';
import { useLogement } from '@/api/hooks/useLogements';
import { useMarkTabViewed, useUnreadCounts } from '@/api/hooks/useMenageViews';
import {
  useMenageConsommables,
  useSetMenageConsommables,
  type ConsommableLine,
} from '@/api/hooks/useConsommables';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import PhotoGallery from '@/components/PhotoGallery';
import PhotoLightbox from '@/components/PhotoLightbox';
import DatePickerField from '@/components/DatePickerField';
import MenageDiscussions from '@/components/MenageDiscussions';
import MenageCheckList from '@/components/MenageCheckList';
import { formatDateFr } from '@/lib/date-fr';
import { useDialog } from '@/contexts/DialogContext';
import TimePickerField from '@/components/TimePickerField';
import { captureGeoPhoto, GeoPhotoError } from '@/lib/captureGeoPhoto';
import { haversineMeters, formatDistance, POINTAGE_DISTANCE_WARN_M } from '@/lib/geo-distance';
import type { Menage, Logement } from '@/api/types';

const TABS = [
  { key: 'check', label: 'Check', icon: ListChecks },
  { key: 'photos', label: 'Photos', icon: Camera },
  { key: 'comments', label: 'Discussion', icon: MessageSquare },
  { key: 'logement', label: 'Logement', icon: Home },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function MenageDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: menage, isLoading } = menageHooks.useById(id);
  const { data: logement } = useLogement(menage?.logement_id);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isPrestataire = menage?.prestataire_user_id === user?.id;
  const dialog = useDialog();

  const arrivalMutation = useArrival();
  const departureMutation = useDeparture();
  const validateMutation = useValidateReport();
  const rescheduleMutation = useCreateRescheduleRequest();
  const archiveMutation = useArchiveMenage();
  const updateMutation = useUpdateMenage();

  const [activeTab, setActiveTab] = useState<TabKey>('check');
  const [showValidateModal, setShowValidateModal] = useState(false);

  // Marque l'onglet ouvert comme lu → vide la pastille de non-lus correspondante
  // (la discussion `comments` est marquée par CommentThread lui-même).
  const markTab = useMarkTabViewed();
  useEffect(() => {
    if (!id) return;
    if (activeTab === 'photos') markTab.mutate({ menage_id: id, tab: 'photos' });
    else if (activeTab === 'check') markTab.mutate({ menage_id: id, tab: 'comments_steps' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  // Non-lus par onglet → petite pastille pour montrer d'où vient la notif.
  const unreadCounts = useUnreadCounts(id).data;
  const unreadForTab = (key: TabKey): number => {
    if (!unreadCounts) return 0;
    if (key === 'comments') return unreadCounts.comments;
    if (key === 'photos') return unreadCounts.photos;
    if (key === 'check') return unreadCounts.comments_steps;
    return 0;
  };
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [overridePrice, setOverridePrice] = useState('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [showPointageModal, setShowPointageModal] = useState(false);
  const [showConsommables, setShowConsommables] = useState(false);
  const consommables = useMenageConsommables(id);
  const hasConsommables = (consommables.data?.length ?? 0) > 0;
  const validateModalStyle = useKeyboardAwareModalStyle({ visible: showValidateModal });
  const rescheduleModalStyle = useKeyboardAwareModalStyle({ visible: showRescheduleModal });
  const validateSwipe = useSwipeToClose(() => setShowValidateModal(false), showValidateModal);
  const rescheduleSwipe = useSwipeToClose(() => setShowRescheduleModal(false), showRescheduleModal);

  const handleForceComplete = async () => {
    const ok = await dialog.confirm({
      title: 'Marquer terminé ?',
      message:
        "Le ménage passera en \"terminé\". Les heures d'arrivée/départ manquantes seront remplies avec l'heure actuelle.",
      confirmLabel: 'Marquer terminé',
    });
    if (!ok || !menage) return;
    const now = new Date().toISOString();
    try {
      await updateMutation.mutateAsync({
        id: id!,
        body: {
          status: 'termine',
          arrived_at: menage.arrived_at ?? now,
          departed_at: menage.departed_at ?? now,
        },
      });
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Échec',
      });
    }
  };

  const runPointage = async (
    kind: 'arrival' | 'departure',
    mutateAsync: (p: { id: string; photo_url: string; lat: number; lng: number }) => Promise<unknown>,
  ) => {
    const ok = await dialog.confirm({
      title: kind === 'arrival' ? "Pointer l'arrivée ?" : 'Pointer le départ ?',
      message:
        'Une photo géolocalisée va être prise pour confirmer ta présence sur place. ' +
        (kind === 'arrival' ? 'Le statut passera à "en cours".' : 'Le statut passera à "terminé".'),
      confirmLabel: 'Prendre la photo',
    });
    if (!ok) return false;
    // iOS ne présente pas deux modals natifs en même temps : on attend que la
    // modal de confirmation soit totalement fermée avant d'ouvrir la caméra,
    // sinon `launchCameraAsync` échoue silencieusement. 650ms = marge sûre même
    // au 2e pointage (départ) où l'animation peut être plus lente.
    await new Promise((r) => setTimeout(r, 650));
    try {
      const { photoUrl, lat, lng } = await captureGeoPhoto();
      await mutateAsync({ id: id!, photo_url: photoUrl, lat, lng });
      return true;
    } catch (err) {
      if (err instanceof GeoPhotoError) {
        if (err.code === 'cancelled') return false;
        void dialog.alert({ title: 'Pointage impossible', message: err.message });
        return false;
      }
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Échec du pointage',
      });
      return false;
    }
  };

  const handleArrival = () => runPointage('arrival', arrivalMutation.mutateAsync);
  const handleDeparture = async () => {
    const ok = await runPointage('departure', departureMutation.mutateAsync);
    // Après le pointage de fin, on invite le presta à relever les consommables.
    if (ok && hasConsommables) {
      await new Promise((r) => setTimeout(r, 400));
      setShowConsommables(true);
    }
  };

  const handleValidate = async () => {
    // Pas de dialog.confirm ici : on est déjà DANS la modal de validation
    // (empiler 2 modals RN ne s'affiche pas sur iOS). Le bouton "Valider" de
    // la modal est la confirmation.
    const price = overridePrice.trim() ? parseFloat(overridePrice) : undefined;
    try {
      await validateMutation.mutateAsync({ id: id!, price });
      setShowValidateModal(false);
      setOverridePrice('');
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Validation impossible' });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!menage) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loading}>
          <Text style={{ color: colors.mutedText }}>Ménage introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const date = formatDateFr(menage.date_prevue, 'weekday');

  const canArrive = isPrestataire && menage.status === 'a_venir';
  const canDepart = isPrestataire && menage.status === 'en_cours';
  const canValidate = isAdmin && menage.status === 'termine';
  // Demande de changement : tout presta qui voit ce ménage (la liste presta
  // filtre déjà les ménages assignés à quelqu'un d'autre, donc s'il est ici
  // c'est qu'il y a accès — référent, multi-affecté, ou membre du logement).
  const canRequestReschedule = user?.role === 'prestataire' && menage.status === 'a_venir';
  // L'admin peut forcer la complétion (cas presta qui oublie de pointer) et
  // éditer manuellement les heures d'arrivée/départ.
  const canForceComplete = isAdmin && (menage.status === 'a_venir' || menage.status === 'en_cours');
  const canEditPointage = isAdmin && menage.status !== 'valide';
  // Un ménage terminé ou validé : on ne change plus le prestataire affecté.
  const isFinished = menage.status === 'termine' || menage.status === 'valide';

  const handleSubmitReschedule = () => {
    if (!proposedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      void dialog.alert({ title: 'Date invalide', message: 'Format attendu : AAAA-MM-JJ' });
      return;
    }
    rescheduleMutation.mutate(
      {
        menage_id: id!,
        proposed_date: proposedDate,
        proposed_time: proposedTime || undefined,
        reason: rescheduleReason || undefined,
      },
      {
        onSuccess: () => {
          setShowRescheduleModal(false);
          setProposedDate('');
          setProposedTime('');
          setRescheduleReason('');
          void dialog.alert({ title: 'Demande envoyée', message: 'L\'administrateur sera notifié.' });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Erreur';
          void dialog.alert({ title: 'Erreur', message: msg });
        },
      },
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {logement?.name || 'Ménage'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <Text style={[styles.dateText, { color: colors.text2 }]}>{date}</Text>
            {menage.date_locked ? (
              isAdmin ? (
                <TouchableOpacity
                  style={[styles.lockPill, { backgroundColor: colors.statusEnCours + '25' }]}
                  onPress={async () => {
                    const ok = await dialog.confirm({
                      title: 'Déverrouiller la date ?',
                      message: 'La prochaine synchronisation iCal pourra écraser cette date.',
                      confirmLabel: 'Déverrouiller',
                    });
                    if (!ok) return;
                    await updateMutation.mutateAsync({
                      id: menage.id,
                      body: { date_locked: false },
                    });
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Date verrouillée — toucher pour déverrouiller"
                >
                  <Lock size={14} color={colors.statusEnCours} />
                  <Text style={[styles.lockText, { color: colors.statusEnCours }]}>Verrouillée</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.lockPill, { backgroundColor: colors.statusEnCours + '25' }]}>
                  <Lock size={14} color={colors.statusEnCours} />
                  <Text style={[styles.lockText, { color: colors.statusEnCours }]}>Verrouillée</Text>
                </View>
              )
            ) : null}
          </View>
        </View>
        {isAdmin ? (
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => router.push(`/menage/edit/${menage.id}`)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Modifier"
            >
              <Pencil size={IconSize.md} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const ok = await dialog.confirm({
                  title: 'Supprimer ce ménage ?',
                  message: 'Action irréversible (photos, checklist, commentaires perdus).',
                  confirmLabel: 'Supprimer',
                  destructive: true,
                });
                if (!ok) return;
                try {
                  await archiveMutation.mutateAsync(menage.id);
                  router.back();
                } catch (err) {
                  void dialog.alert({
                    title: 'Erreur',
                    message: err instanceof Error ? err.message : 'Échec',
                  });
                }
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Supprimer"
            >
              <Trash2 size={IconSize.md} color={colors.red} />
            </TouchableOpacity>
          </View>
        ) : (
          <StatusBadge status={menage.status} />
        )}
      </View>
      {isAdmin ? (
        <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, alignItems: 'flex-end' }}>
          <StatusBadge status={menage.status} />
        </View>
      ) : null}

      {/* Prestataire */}
      <View
        style={[
          styles.prestataireBlock,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.prestataireLabel, { color: colors.text2 }]}>PRESTATAIRE</Text>
          {menage.prestataire_user_id ? (
            <Text style={[styles.prestataireName, { color: colors.text }]}>
              {[menage.prestataire_first_name, menage.prestataire_last_name]
                .filter(Boolean)
                .join(' ') || 'Affecté'}
            </Text>
          ) : (
            <View style={styles.prestataireUnassignedBadge}>
              <Text style={styles.prestataireUnassignedText}>NON ASSIGNÉ</Text>
            </View>
          )}
        </View>
        {isAdmin && !isFinished ? (
          <TouchableOpacity
            style={[styles.assignBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowAssignModal(true)}
            accessibilityLabel="Affecter un prestataire"
          >
            <Text style={styles.assignBtnText}>
              {menage.prestataire_user_id ? 'Changer' : 'Affecter'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isAdmin && !isFinished ? <ResponsesSection menageId={menage.id} colors={colors} /> : null}

      {/* Action buttons */}
      <View style={styles.actions}>
        {canArrive ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handleArrival}
            disabled={arrivalMutation.isPending}
          >
            <Play size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>Pointer l&apos;arrivée</Text>
          </TouchableOpacity>
        ) : null}
        {canDepart ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.statusTermine }]}
            onPress={handleDeparture}
            disabled={departureMutation.isPending}
          >
            <Square size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>Pointer le départ</Text>
          </TouchableOpacity>
        ) : null}
        {hasConsommables && (isPrestataire || isAdmin) ? (
          <TouchableOpacity
            style={[styles.actionBtnOutline, { borderColor: colors.border }]}
            onPress={() => setShowConsommables(true)}
          >
            <PackageCheck size={IconSize.md} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Relevé des consommables
            </Text>
          </TouchableOpacity>
        ) : null}
        {canRequestReschedule ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.statusEnCours }]}
            onPress={() => {
              // Pré-remplit le calendrier sur la date actuelle du ménage et
              // l'heure de début, pour partir directement du créneau prévu.
              setProposedDate(menage.date_prevue.slice(0, 10));
              setProposedTime(menage.horaire_prevu ? menage.horaire_prevu.slice(0, 5) : '');
              setShowRescheduleModal(true);
            }}
          >
            <Clock size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>Demander un changement</Text>
          </TouchableOpacity>
        ) : null}
        {canValidate ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.statusValide }]}
            onPress={() => setShowValidateModal(true)}
          >
            <CheckCircle2 size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>Valider le rapport</Text>
          </TouchableOpacity>
        ) : null}
        {canForceComplete ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.statusTermine }]}
            onPress={handleForceComplete}
            disabled={updateMutation.isPending}
          >
            <CheckCircle2 size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>Marquer terminé</Text>
          </TouchableOpacity>
        ) : null}
        {canEditPointage ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.itemBackground }]}
            onPress={() => setShowPointageModal(true)}
          >
            <Clock size={IconSize.md} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Modifier les pointages</Text>
          </TouchableOpacity>
        ) : null}
        {menage.arrived_at ? (
          <View style={[styles.timestamp, { backgroundColor: colors.itemBackground }]}>
            <Clock size={14} color={colors.text2} />
            <Text style={[styles.timestampText, { color: colors.text2 }]}>
              Arrivée {formatDateFr(menage.arrived_at, 'time')}
            </Text>
          </View>
        ) : null}
        {menage.departed_at ? (
          <View style={[styles.timestamp, { backgroundColor: colors.itemBackground }]}>
            <Clock size={14} color={colors.text2} />
            <Text style={[styles.timestampText, { color: colors.text2 }]}>
              Départ {formatDateFr(menage.departed_at, 'time')}
            </Text>
          </View>
        ) : null}
      </View>

      {isAdmin && (menage.arrival_photo_url || menage.departure_photo_url) ? (
        <PointageProofSection menage={menage} logement={logement} colors={colors} />
      ) : null}

      <BedsSection menage={menage} colors={colors} />

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const TabIcon = tab.icon;
          const unread = unreadForTab(tab.key);
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <View>
                <TabIcon size={IconSize.md} color={isActive ? colors.primary : colors.text2} />
                {unread > 0 && !isActive ? (
                  <View style={[styles.tabUnreadDot, { backgroundColor: colors.red, borderColor: colors.surface }]} />
                ) : null}
              </View>
              <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.text2 }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'check' && <MenageCheckList menageId={id!} readonly={menage.status === 'valide'} />}
        {activeTab === 'photos' && <PhotoGallery menageId={id!} readonly={menage.status === 'valide'} />}
        {activeTab === 'comments' && (
          <MenageDiscussions
            menageId={id!}
            canViewComments={true}
            readonly={menage.status === 'valide'}
          />
        )}
        {activeTab === 'logement' && (
          <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
            {logement ? (
              <>
                <Text style={[styles.section, { color: colors.text2 }]}>LOGEMENT</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.logementName, { color: colors.text }]}>{logement.name}</Text>
                  {logement.address || logement.city ? (
                    <Text style={[styles.logementAddr, { color: colors.text2 }]}>
                      {[logement.address, logement.city].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm, flexWrap: 'wrap' }}>
                    {logement.n_bedrooms > 0 ? <Text style={{ color: colors.text2 }}>🛏️ {logement.n_bedrooms}</Text> : null}
                    {logement.n_bathrooms > 0 ? <Text style={{ color: colors.text2 }}>🚿 {logement.n_bathrooms}</Text> : null}
                    {logement.n_wc > 0 ? <Text style={{ color: colors.text2 }}>🚽 {logement.n_wc}</Text> : null}
                    {logement.n_kitchens > 0 ? <Text style={{ color: colors.text2 }}>🍳 {logement.n_kitchens}</Text> : null}
                    {logement.n_living_rooms > 0 ? <Text style={{ color: colors.text2 }}>🛋️ {logement.n_living_rooms}</Text> : null}
                  </View>
                  {logement.notes ? (
                    <Text style={[styles.logementNotes, { color: colors.text2 }]}>{logement.notes}</Text>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.viewLogementBtn, { borderColor: colors.primary }]}
                    onPress={() => router.push(`/logement/${logement.id}`)}
                  >
                    <Text style={{ color: colors.primary, fontWeight: FontWeight.semibold }}>
                      Voir le logement
                    </Text>
                  </TouchableOpacity>
                </View>

                {menage.prix_prevu != null ? (
                  <>
                    <Text style={[styles.section, { color: colors.text2 }]}>PRIX</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                        <Euro size={IconSize.md} color={colors.text2} />
                        <Text style={{ color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.semibold }}>
                          {menage.prix_prevu} €
                        </Text>
                        {menage.validated_price != null ? (
                          <Text style={{ color: colors.statusValide, fontSize: FontSize.md }}>
                            → {menage.validated_price} € (validé)
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </>
                ) : null}
              </>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </ScrollView>
        )}
      </View>

      {/* Validation modal */}
      <Modal
        visible={showValidateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowValidateModal(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowValidateModal(false)} />
            <Animated.View
              style={[
                styles.modal,
                { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
                validateModalStyle,
                validateSwipe.animatedStyle,
              ]}
            >
              <SheetHandle gesture={validateSwipe.gesture} />
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: Spacing.sm }]}>Valider le rapport</Text>
            <Text style={{ color: colors.text2, marginBottom: Spacing.sm }}>
              Prix prévu : {menage.prix_prevu ?? '—'} €
            </Text>
            <Text style={[styles.label, { color: colors.text2 }]}>
              Prix final (laisser vide pour garder le prix prévu)
            </Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground }]}
              value={overridePrice}
              onChangeText={setOverridePrice}
              placeholder={String(menage.prix_prevu ?? '')}
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={[styles.submit, { backgroundColor: colors.statusValide }]}
              onPress={handleValidate}
              disabled={validateMutation.isPending}
            >
              <CheckCircle2 size={IconSize.md} color="#FFFFFF" />
              <Text style={styles.submitText}>
                {validateMutation.isPending ? 'Validation…' : 'Valider'}
              </Text>
            </TouchableOpacity>
            </Animated.View>
        </View>
      </Modal>

      {/* Reschedule modal */}
      <Modal
        visible={showRescheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowRescheduleModal(false)} />
            <Animated.View
              style={[
                styles.modal,
                { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
                rescheduleModalStyle,
                rescheduleSwipe.animatedStyle,
              ]}
            >
              <SheetHandle gesture={rescheduleSwipe.gesture} />
              <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: Spacing.xs }]}>
                Demander un changement
              </Text>
              <Text style={{ color: colors.text2, marginBottom: Spacing.sm }}>
                Date actuelle : {formatDateFr(menage.date_prevue.slice(0, 10), 'long')}
              </Text>
              <DatePickerField
                label="Nouvelle date"
                value={proposedDate}
                onChange={setProposedDate}
                placeholder="Choisir une date"
              />
              <TimePickerField
                label="Heure (optionnel)"
                value={proposedTime}
                onChange={setProposedTime}
                placeholder="--:--"
              />
              <Text
                style={{
                  color: colors.text2,
                  fontSize: FontSize.base,
                  fontWeight: FontWeight.medium,
                  marginTop: Spacing.md,
                }}
              >
                Motif (optionnel)
              </Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground, height: 80 }]}
                value={rescheduleReason}
                onChangeText={setRescheduleReason}
                placeholder="Imprévu personnel…"
                placeholderTextColor={colors.placeholder}
                multiline
              />
              <TouchableOpacity
                style={[styles.submit, { backgroundColor: colors.statusEnCours, marginTop: Spacing.md }]}
                onPress={handleSubmitReschedule}
                disabled={rescheduleMutation.isPending}
              >
                <Clock size={IconSize.md} color="#FFFFFF" />
                <Text style={styles.submitText}>
                  {rescheduleMutation.isPending ? 'Envoi…' : 'Envoyer la demande'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
            </Animated.View>
        </View>
      </Modal>

      <AssignPrestataireModal
        visible={showAssignModal}
        menageId={menage.id}
        onClose={() => setShowAssignModal(false)}
      />

      <PointageModal
        visible={showPointageModal}
        menage={menage}
        onClose={() => setShowPointageModal(false)}
      />

      <ConsommablesReleveModal
        visible={showConsommables}
        menageId={menage.id}
        onClose={() => setShowConsommables(false)}
      />
    </SafeAreaView>
  );
}

/**
 * Relevé des consommables au pointage de fin : le presta saisit la quantité
 * restante de chaque consommable (0 = rupture). La quantité est obligatoire.
 */
function ConsommablesReleveModal({
  visible,
  menageId,
  onClose,
}: {
  visible: boolean;
  menageId: string;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const consommables = useMenageConsommables(visible ? menageId : undefined);
  const setReleve = useSetMenageConsommables(menageId);
  const [qty, setQty] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible || !consommables.data) return;
    const init: Record<string, string> = {};
    for (const c of consommables.data) {
      init[c.logement_consommable_id] = c.qty === null ? '' : String(c.qty);
    }
    setQty(init);
  }, [visible, consommables.data]);

  const lines = consommables.data ?? [];

  const handleSave = async () => {
    const items: { logement_consommable_id: string; qty: number }[] = [];
    for (const c of lines) {
      const raw = (qty[c.logement_consommable_id] ?? '').trim();
      const n = parseInt(raw, 10);
      if (raw === '' || Number.isNaN(n) || n < 0) {
        void dialog.alert({
          title: 'Quantité manquante',
          message: `Indique la quantité restante pour « ${c.label} » (0 s'il n'en reste plus).`,
        });
        return;
      }
      items.push({ logement_consommable_id: c.logement_consommable_id, qty: n });
    }
    try {
      await setReleve.mutateAsync(items);
      onClose();
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Échec de l’enregistrement',
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.consoSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.consoHeader}>
            <Text style={[styles.consoTitle, { color: colors.text }]}>Relevé des consommables</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.consoSub, { color: colors.text2 }]}>
            Indique la quantité restante de chaque consommable (0 = rupture).
          </Text>

          {consommables.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.lg }} />
          ) : lines.length === 0 ? (
            <Text style={{ color: colors.mutedText, paddingVertical: Spacing.md }}>
              Aucun consommable pour ce logement.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 380 }}>
              {lines.map((c: ConsommableLine) => {
                const val = qty[c.logement_consommable_id] ?? '';
                const n = parseInt(val, 10);
                const low = val.trim() !== '' && !Number.isNaN(n) && n <= c.seuil_alerte;
                return (
                  <View key={c.logement_consommable_id} style={[styles.consoRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: FontWeight.semibold }}>{c.label}</Text>
                      <Text style={{ color: colors.text2, fontSize: FontSize.xs }}>
                        Seuil : {c.seuil_alerte}
                        {c.unit ? ` ${c.unit}` : ''}
                      </Text>
                    </View>
                    {low ? (
                      <AlertTriangle size={16} color={colors.red} style={{ marginRight: 6 }} />
                    ) : null}
                    <TextInput
                      style={[
                        styles.consoInput,
                        { color: colors.text, borderColor: low ? colors.red : colors.border },
                      ]}
                      keyboardType="number-pad"
                      value={val}
                      onChangeText={(t) =>
                        setQty((prev) => ({ ...prev, [c.logement_consommable_id]: t.replace(/[^0-9]/g, '') }))
                      }
                      placeholder="0"
                      placeholderTextColor={colors.mutedText}
                    />
                    {c.unit ? (
                      <Text style={{ color: colors.text2, fontSize: FontSize.xs, width: 56 }} numberOfLines={1}>
                        {c.unit}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {lines.length > 0 ? (
            <TouchableOpacity
              style={[styles.consoSaveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={setReleve.isPending}
            >
              <Text style={styles.actionText}>
                {setReleve.isPending ? 'Enregistrement…' : 'Enregistrer le relevé'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Modal admin pour saisir/corriger manuellement les heures d'arrivée et de
 * départ d'un ménage (cas prestataire qui a oublié de pointer). Sauve via
 * PATCH { arrived_at, departed_at }. Vider un champ remet le timestamp à null.
 */
function PointageModal({
  visible,
  menage,
  onClose,
}: {
  visible: boolean;
  menage: { id: string; date_prevue: string; arrived_at: string | null; departed_at: string | null };
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const updateMutation = useUpdateMenage();

  // Heures HH:MM dérivées des timestamps existants (sur la date du ménage).
  const toTime = (iso: string | null) => (iso ? formatDateFr(iso, 'time') : '');
  const [arrivalTime, setArrivalTime] = useState(toTime(menage.arrived_at));
  const [departureTime, setDepartureTime] = useState(toTime(menage.departed_at));

  useEffect(() => {
    if (!visible) return;
    setArrivalTime(toTime(menage.arrived_at));
    setDepartureTime(toTime(menage.departed_at));
  }, [visible, menage.arrived_at, menage.departed_at]);

  // Combine la date du ménage + une heure HH:MM en ISO. Vide → null.
  const toIso = (time: string): string | null => {
    if (!time.match(/^\d{2}:\d{2}$/)) return null;
    const day = menage.date_prevue.slice(0, 10);
    return new Date(`${day}T${time}:00`).toISOString();
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: menage.id,
        body: {
          arrived_at: arrivalTime ? toIso(arrivalTime) : null,
          departed_at: departureTime ? toIso(departureTime) : null,
        },
      });
      onClose();
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={assignStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[assignStyles.modal, { backgroundColor: colors.surface }, Shadow.lg]}>
          <Text style={[assignStyles.title, { color: colors.text }]}>Pointages (admin)</Text>
          <Text style={{ color: colors.text2, fontSize: FontSize.sm, marginBottom: Spacing.md }}>
            Corrige les heures si le prestataire a oublié de pointer.
          </Text>
          <View style={{ gap: Spacing.md }}>
            <TimePickerField
              label="Heure d'arrivée"
              value={arrivalTime}
              onChange={setArrivalTime}
              placeholder="--:--"
            />
            <TimePickerField
              label="Heure de départ"
              value={departureTime}
              onChange={setDepartureTime}
              placeholder="--:--"
            />
          </View>
          <View style={assignStyles.actions}>
            <TouchableOpacity
              style={[assignStyles.btn, { backgroundColor: colors.itemBackground }]}
              onPress={onClose}
            >
              <Text style={{ color: colors.text, fontWeight: FontWeight.medium }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[assignStyles.btn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={updateMutation.isPending}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: FontWeight.semibold }}>
                {updateMutation.isPending ? '…' : 'Enregistrer'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Preuve de présence : photos géolocalisées prises au pointage arrivée/départ,
 * avec la distance au logement. Un badge rouge alerte si la photo a été prise
 * trop loin du logement (presta peut-être pas vraiment sur place).
 */
interface ProofView {
  label: string;
  photoUrl: string;
  lat: number | null;
  lng: number | null;
  at: string | null;
  distance: number | null;
}

function BedsSection({
  menage,
  colors,
}: {
  menage: Menage;
  colors: typeof Colors.light;
}) {
  const { t } = useTranslation();
  const total =
    (menage.n_lit_simple ?? 0) +
    (menage.n_lit_double ?? 0) +
    (menage.n_canape_lit ?? 0) +
    (menage.n_lit_appoint ?? 0);
  if (total === 0) return null;
  const items: { value: number; label: string }[] = [
    { value: menage.n_lit_simple ?? 0, label: t('beds.simple') },
    { value: menage.n_lit_double ?? 0, label: t('beds.double') },
    { value: menage.n_canape_lit ?? 0, label: t('beds.sofa') },
    { value: menage.n_lit_appoint ?? 0, label: t('beds.extra') },
  ];
  return (
    <View style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm }}>
      <Text style={{ color: colors.text2, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginBottom: Spacing.xs, letterSpacing: 0.5 }}>
        {t('beds.section').toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        {items.map((it) => (
          <View
            key={it.label}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 8,
              paddingVertical: Spacing.sm,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.bold }}>
              {it.value}
            </Text>
            <Text style={{ color: colors.text2, fontSize: 11, marginTop: 2, textAlign: 'center' }}>
              {it.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PointageProofSection({
  menage,
  logement,
  colors,
}: {
  menage: Menage;
  logement: Logement | undefined;
  colors: typeof Colors.light;
}) {
  const [lightbox, setLightbox] = useState<ProofView | null>(null);
  const logLat = logement?.latitude != null ? Number(logement.latitude) : null;
  const logLng = logement?.longitude != null ? Number(logement.longitude) : null;

  const buildProof = (
    label: string,
    photoUrl: string | null | undefined,
    lat: number | string | null | undefined,
    lng: number | string | null | undefined,
    at: string | null,
  ): ProofView | null => {
    if (!photoUrl) return null;
    const pLat = lat != null ? Number(lat) : null;
    const pLng = lng != null ? Number(lng) : null;
    const distance =
      logLat != null && logLng != null && pLat != null && pLng != null
        ? haversineMeters(logLat, logLng, pLat, pLng)
        : null;
    return { label, photoUrl, lat: pLat, lng: pLng, at, distance };
  };

  const renderProof = (proof: ProofView | null) => {
    if (!proof) return null;
    const tooFar = proof.distance != null && proof.distance > POINTAGE_DISTANCE_WARN_M;
    return (
      <View style={{ flex: 1 }}>
        <Text style={[proofStyles.label, { color: colors.text2 }]}>
          {proof.label}
          {proof.at ? ` · ${formatDateFr(proof.at, 'time')}` : ''}
        </Text>
        <TouchableOpacity activeOpacity={0.85} onPress={() => setLightbox(proof)}>
          <Image source={{ uri: proof.photoUrl }} style={[proofStyles.photo, { borderColor: colors.border }]} />
        </TouchableOpacity>
        {proof.distance != null ? (
          <View
            style={[
              proofStyles.distanceBadge,
              { backgroundColor: (tooFar ? colors.red : colors.green) + '20' },
            ]}
          >
            <Text
              style={{
                color: tooFar ? colors.red : colors.green,
                fontSize: FontSize.xs,
                fontWeight: FontWeight.semibold,
              }}
            >
              {tooFar ? '⚠ ' : '✓ '}
              {formatDistance(proof.distance)} du logement
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.mutedText, fontSize: FontSize.xs, marginTop: 4 }}>
            Distance indisponible
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={proofStyles.wrap}>
      <Text style={[proofStyles.title, { color: colors.text2 }]}>PREUVE DE PRÉSENCE</Text>
      <View style={proofStyles.row}>
        {renderProof(buildProof('Arrivée', menage.arrival_photo_url, menage.arrival_lat, menage.arrival_lng, menage.arrived_at))}
        {renderProof(buildProof('Départ', menage.departure_photo_url, menage.departure_lat, menage.departure_lng, menage.departed_at))}
      </View>

      <PhotoLightbox
        visible={!!lightbox}
        onClose={() => setLightbox(null)}
        photoUrl={lightbox?.photoUrl ?? null}
        title={lightbox?.label}
        subtitle={lightbox?.at ? formatDateFr(lightbox.at, 'time') : undefined}
        footer={
          lightbox?.lat != null && lightbox?.lng != null ? (
            <TouchableOpacity
              style={proofStyles.mapBtn}
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${lightbox.lat},${lightbox.lng}`,
                )
              }
            >
              <MapPin size={IconSize.sm} color="#FFFFFF" />
              <Text style={proofStyles.mapBtnText}>
                Voir sur la carte
                {lightbox.distance != null ? ` · ${formatDistance(lightbox.distance)} du logement` : ''}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

/**
 * Section "Réponses prestataires" sur la page detail d'un ménage (admin only).
 *
 * Affiche qui a voté "Présent" / "Absent" pour pouvoir affecter directement
 * un présent en un tap (toggle dans la liste actuelle des affectés).
 */
function ResponsesSection({
  menageId,
  colors,
}: {
  menageId: string;
  colors: typeof Colors.light;
}) {
  const dialog = useDialog();
  const responses = useMenageResponses(menageId);
  const assigned = useMenagePrestataires(menageId);
  const setPrestas = useSetMenagePrestataires(menageId);
  const flipResponse = useOverrideMenageResponse(menageId);

  const data = responses.data ?? [];
  const presents = data.filter((r) => r.status === 'present');
  const absents = data.filter((r) => r.status === 'absent');
  const assignedIds = new Set((assigned.data ?? []).map((a) => a.user_id));

  const togglePresta = async (userId: string, kind: 'present' | 'absent') => {
    const current = (assigned.data ?? []).map((a) => a.user_id);
    const isCurrentlyAssigned = current.includes(userId);
    // Garde-fou : si l'admin affecte un presta qui a voté indispo, on confirme.
    // (Retirer ne demande rien — on ne veut pas friction sur l'annulation.)
    if (!isCurrentlyAssigned && kind === 'absent') {
      const ok = await dialog.confirm({
        title: 'Affecter quand même ?',
        message: 'Ce prestataire a voté indisponible. Souhaites-tu l\'affecter malgré tout ?',
        confirmLabel: 'Affecter',
      });
      if (!ok) return;
    }
    const next = isCurrentlyAssigned
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    try {
      await setPrestas.mutateAsync(next);
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Échec',
      });
    }
  };

  const flipStatus = async (userId: string, currentStatus: 'present' | 'absent') => {
    const next = currentStatus === 'present' ? 'absent' : 'present';
    const label = next === 'present' ? 'disponible' : 'indisponible';
    const ok = await dialog.confirm({
      title: `Marquer ${label} ?`,
      message: 'Cette action change la réponse du prestataire à sa place.',
      confirmLabel: 'Confirmer',
    });
    if (!ok) return;
    try {
      await flipResponse.mutateAsync({ userId, status: next });
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Échec',
      });
    }
  };

  if (responses.isLoading) return null;
  if (presents.length === 0 && absents.length === 0) return null;

  const GREEN = colors.green;
  const RED = colors.red;

  const renderRow = (
    r: MenageResponse,
    kind: 'present' | 'absent',
  ) => {
    const isPresent = kind === 'present';
    const color = isPresent ? GREEN : RED;
    const isAssigned = assignedIds.has(r.user_id);
    const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || '—';
    const initial = (r.first_name?.[0] ?? r.email?.[0] ?? '?').toUpperCase();
    return (
      <View
        key={r.id}
        style={[
          responsesStyles.row,
          {
            backgroundColor: isAssigned ? `${color}15` : colors.surface,
            borderColor: isAssigned ? color : colors.border,
          },
        ]}
      >
        <View style={[responsesStyles.avatar, { backgroundColor: color }]}>
          <Text style={responsesStyles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
            {name}
          </Text>
          {r.email ? (
            <Text style={{ color: colors.mutedText, fontSize: FontSize.xs }}>{r.email}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={responsesStyles.flipBtn}
          onPress={() => flipStatus(r.user_id, kind)}
          disabled={flipResponse.isPending}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={isPresent ? 'Marquer indisponible' : 'Marquer disponible'}
        >
          <RefreshCw size={16} color={colors.text2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            responsesStyles.affectBtn,
            isAssigned
              ? { backgroundColor: colors.itemBackground, borderColor: colors.border }
              : { backgroundColor: color, borderColor: color },
          ]}
          onPress={() => togglePresta(r.user_id, kind)}
          disabled={setPrestas.isPending}
        >
          <Text
            style={{
              color: isAssigned ? colors.text : '#FFFFFF',
              fontSize: FontSize.xs,
              fontWeight: FontWeight.semibold,
            }}
          >
            {isAssigned ? 'Retirer' : 'Affecter'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={responsesStyles.wrap}>
      <Text style={[responsesStyles.title, { color: colors.text2 }]}>RÉPONSES PRESTATAIRES</Text>

      {presents.length > 0 ? (
        <View style={{ gap: Spacing.xs }}>
          <Text style={[responsesStyles.subLabel, { color: GREEN }]}>
            Disponibles ({presents.length})
          </Text>
          {presents.map((p) => renderRow(p, 'present'))}
        </View>
      ) : null}

      {absents.length > 0 ? (
        <View style={{ gap: Spacing.xs, marginTop: presents.length > 0 ? Spacing.sm : 0 }}>
          <Text style={[responsesStyles.subLabel, { color: RED }]}>
            Indisponibles ({absents.length})
          </Text>
          {absents.map((a) => renderRow(a, 'absent'))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Picker multi-select : l'admin peut cocher plusieurs prestataires pour un
 * ménage. Le 1er coché devient le référent (`menage.prestataire_user_id`).
 * Synchronise via PUT /menages/:id/prestataires (full-replace).
 */
function AssignPrestataireModal({
  visible,
  menageId,
  onClose,
}: {
  visible: boolean;
  menageId: string;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();
  const eligible = useEligiblePrestataires(visible ? menageId : undefined);
  const current = useMenagePrestataires(visible ? menageId : undefined);
  const setPrestas = useSetMenagePrestataires(menageId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Quand la modal s'ouvre OU quand la data current arrive, on resync l'état
  // local sur la liste actuelle (1er = référent, suit l'ordre serveur).
  useEffect(() => {
    if (!visible) return;
    if (!current.data) return;
    setSelectedIds(current.data.map((c) => c.user_id));
  }, [visible, current.data]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    try {
      await setPrestas.mutateAsync(selectedIds);
      onClose();
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={assignStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[assignStyles.modal, { backgroundColor: colors.surface }, Shadow.lg]}>
          <Text style={[assignStyles.title, { color: colors.text }]}>Affecter des prestataires</Text>

          {eligible.isLoading ? (
            <Text style={{ color: colors.mutedText, padding: Spacing.lg }}>Chargement…</Text>
          ) : (eligible.data ?? []).length === 0 ? (
            <Text style={{ color: colors.mutedText, padding: Spacing.lg }}>
              Aucun prestataire dans ce logement. Ajoute d&apos;abord un membre prestataire au logement.
            </Text>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 360 }}>
                {(eligible.data ?? []).map((p) => {
                  const checked = selectedIds.includes(p.id);
                  const isPrimary = checked && selectedIds[0] === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        assignStyles.row,
                        {
                          borderColor: colors.border,
                          backgroundColor: checked ? colors.primary + '15' : 'transparent',
                        },
                      ]}
                      onPress={() => toggle(p.id)}
                    >
                      <View
                        style={[
                          assignStyles.checkbox,
                          checked
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { borderColor: colors.border },
                        ]}
                      >
                        {checked ? <CheckCircle2 size={14} color="#FFFFFF" /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}
                        >
                          {p.first_name} {p.last_name}
                        </Text>
                        {p.email ? (
                          <Text style={{ color: colors.mutedText, fontSize: FontSize.sm }}>{p.email}</Text>
                        ) : null}
                      </View>
                      {!p.is_member ? (
                        <View style={[assignStyles.primaryPill, { backgroundColor: colors.statusEnCours + '25' }]}>
                          <Text style={{ color: colors.statusEnCours, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
                            Ponctuel
                          </Text>
                        </View>
                      ) : null}
                      {isPrimary ? (
                        <View
                          style={[
                            assignStyles.primaryPill,
                            { backgroundColor: colors.primary + '20' },
                          ]}
                        >
                          <Text
                            style={{
                              color: colors.primary,
                              fontSize: FontSize.xs,
                              fontWeight: FontWeight.semibold,
                            }}
                          >
                            Référent
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={[assignStyles.hint, { color: colors.mutedText }]}>
                Le 1er coché est le référent. Les prestataires « Ponctuel » ne sont pas membres du
                logement : ils ne reçoivent que ce ménage (remplacement).
              </Text>
              <View style={assignStyles.actions}>
                <TouchableOpacity
                  style={[assignStyles.btn, { backgroundColor: colors.itemBackground }]}
                  onPress={onClose}
                >
                  <Text style={{ color: colors.text, fontWeight: FontWeight.medium }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[assignStyles.btn, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                  disabled={setPrestas.isPending}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: FontWeight.semibold }}>
                    {setPrestas.isPending ? '…' : 'Enregistrer'}
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

const proofStyles = StyleSheet.create({
  wrap: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm },
  title: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginBottom: 4 },
  photo: { width: '100%', height: 140, borderRadius: Radius.md, borderWidth: 1 },
  distanceBadge: {
    marginTop: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  mapBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});

const responsesStyles = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  subLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  affectBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  flipBtn: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
});

const assignStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { width: '90%', maxWidth: 400, borderRadius: Radius.xl, padding: Spacing.lg },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
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
  primaryPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  hint: { fontSize: FontSize.xs, paddingTop: Spacing.sm, paddingHorizontal: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  dateText: { fontSize: FontSize.sm, textTransform: 'capitalize' },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  lockText: { fontSize: 11, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.4 },
  prestataireBlock: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prestataireLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
  },
  prestataireName: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  assignBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  assignBtnText: { color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  prestataireUnassignedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  prestataireUnassignedText: {
    color: '#9A3412',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  actionText: { color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  consoSheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  consoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  consoTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  consoSub: { fontSize: FontSize.sm, marginBottom: Spacing.sm },
  consoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  consoInput: {
    width: 64,
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.md,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  consoSaveBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
  },
  timestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  timestampText: { fontSize: FontSize.xs },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.sm },
  tabLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  tabUnreadDot: {
    position: 'absolute',
    top: -3,
    right: -5,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  section: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  card: { padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.xs },
  logementName: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  logementAddr: { fontSize: FontSize.sm },
  logementNotes: { fontSize: FontSize.sm, marginTop: Spacing.sm, fontStyle: 'italic' as const },
  viewLogementBtn: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  input: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, fontSize: FontSize.md },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  submitText: { color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.md },
});
