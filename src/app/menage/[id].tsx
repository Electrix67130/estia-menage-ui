import React, { useEffect, useRef, useState } from 'react';
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
  Switch,
  LayoutAnimation,
  Pressable} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MessageSquare,
  Camera,
  ListChecks,
  Play,
  Square,
  CheckCircle2,
  Clock,
  X,
  Pencil,
  Trash2,
  RefreshCw,
  MapPin,
  Lock,
  PackageCheck,
  AlertTriangle,
  KeyRound,
  Moon,
  CalendarClock,
  Save,
  Star,
  LogIn,
  LogOut,
  Info,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import SheetHandle from '@/components/SheetHandle';
import { useQueryClient } from '@tanstack/react-query';
import { menageHooks, useArrival, useDeparture, useUpdateDeclaration, useValidateReport, useArchiveMenage, useUpdateMenage, findCachedMenage } from '@/api/hooks/useMenages';
import {
  useMenagePrestataires,
  useSetMenagePrestataires,
  useSetMenageReferent,
} from '@/api/hooks/useMenagePrestataires';
import {
  useMenageResponses,
  useOverrideMenageResponse,
  type MenageResponse,
} from '@/api/hooks/useMenageResponses';
import { useCreateRescheduleRequest } from '@/api/hooks/useReschedule';
import { useLogement } from '@/api/hooks/useLogements';
import { useLogementCodes } from '@/api/hooks/useLogementCodes';
import AssignPrestataireModal from '@/components/AssignPrestataireModal';
import MenageEquipementsSection from '@/components/MenageEquipementsSection';
import MenageOptionsSection from '@/components/MenageOptionsSection';
import LogementReferencePhotos from '@/components/LogementReferencePhotos';
import { LazyLoadScope, useLazyScrollHandler } from '@/components/LazyImage';
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
import { openMaps } from '@/lib/contact-links';
import { formatQtyUnit, unitForQty } from '@/lib/unit-fr';
import { useDialog } from '@/contexts/DialogContext';
import TimePickerField from '@/components/TimePickerField';
import DurationPickerField from '@/components/DurationPickerField';
import LabeledField from '@/components/LabeledField';
import AutoScrollInput from '@/components/AutoScrollInput';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import ErrorBoundary from '@/components/ErrorBoundary';
import { captureGeoPhoto, uploadGeoPhoto, GeoPhotoError } from '@/lib/captureGeoPhoto';
import { onlineManager } from '@tanstack/react-query';
import { usePhotos } from '@/api/hooks/usePhotos';
import { enqueuePointage, usePendingPointage } from '@/lib/pointageQueue';
import ArrivalDeclarationModal, { type ArrivalDeclaration } from '@/components/ArrivalDeclarationModal';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';
import { haversineMeters, formatDistance, POINTAGE_DISTANCE_WARN_M } from '@/lib/geo-distance';
import { prestationTypeColorKey } from '@/api/types';
import type { TranslationKeys } from '@/i18n/translations';
import type { Menage, Logement, MenageStatus, UpdateMenageInput, Photo } from '@/api/types';

const TABS = [
  { key: 'infos', label: 'menageDetail.tabInfos', icon: Info },
  { key: 'check', label: 'menageDetail.tabCheck', icon: ListChecks },
  { key: 'photos', label: 'menageDetail.tabPhotos', icon: Camera },
  { key: 'comments', label: 'menageDetail.tabComments', icon: MessageSquare },
] as const satisfies readonly { key: string; label: TranslationKeys; icon: unknown }[];

type TabKey = (typeof TABS)[number]['key'];

/**
 * ScrollView de l'onglet Infos : relaie le scroll au `LazyLoadScope` pour que
 * les vignettes (photos de référence du logement…) ne se chargent qu'en
 * arrivant à l'écran, au lieu de toutes partir à l'ouverture de la fiche.
 */
function InfosScrollView({ children }: { children: React.ReactNode }) {
  const onScroll = useLazyScrollHandler();
  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: Spacing.md, paddingBottom: Spacing.xl }}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={100}
    >
      {children}
    </ScrollView>
  );
}

/** Grille de vignettes pour le récap de validation (dégradations / photos ménage). */
function ReportPhotoGrid({ photos, colors }: { photos: Photo[]; colors: (typeof Colors)['light'] }) {
  return (
    <View style={styles.recapGrid}>
      {photos.map((p) => (
        <Image
          key={p.id}
          source={{ uri: p.thumbnail_url ?? p.url }}
          style={[styles.recapThumb, { borderColor: colors.border }]}
        />
      ))}
    </View>
  );
}

export default function MenageDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, reschedule } = useLocalSearchParams<{ id: string; reschedule?: string }>();
  const queryClient = useQueryClient();
  // Fallback hors ligne : si le détail n'a jamais été fetché, on affiche
  // l'élément déjà connu de la liste en cache le temps de recharger en ligne.
  const { data: menage, isLoading } = menageHooks.useById(id, {
    placeholderData: () => findCachedMenage(queryClient, id),
  });
  const { data: logement } = useLogement(menage?.logement_id);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isPrestataire = menage?.prestataire_user_id === user?.id;
  const dialog = useDialog();
  const { t } = useTranslation();

  const arrivalMutation = useArrival();
  const updateDeclarationMutation = useUpdateDeclaration();
  // Tous les prestataires affectés (multi-presta), pas seulement le référent.
  const assignedPrestas = useMenagePrestataires(id);
  const setReferent = useSetMenageReferent(id);
  const departureMutation = useDeparture();
  const validateMutation = useValidateReport();
  // Photos pour le récap de validation (comme le dashboard : dégradations + ménage).
  const reportPhotos = usePhotos(id);
  const rescheduleMutation = useCreateRescheduleRequest();
  const archiveMutation = useArchiveMenage();

  const [activeTab, setActiveTab] = useState<TabKey>('infos');
  const [showValidateModal, setShowValidateModal] = useState(false);
  // Toute la fiche est en consultation par défaut ; l'admin passe en édition
  // via le crayon (un seul mode édition pour tous les champs).
  const [isEditing, setIsEditing] = useState(false);

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
  const [arrivalProof, setArrivalProof] = useState<{
    lat: number;
    lng: number;
    localUri: string;
    width: number;
    height: number;
    at: string;
  } | null>(null);
  // Pointage en file d'attente hors ligne pour ce ménage (null si aucun).
  const pendingPointage = usePendingPointage(id);
  // Ouverture auto de la modale « changement » quand on arrive depuis un appui
  // long sur une prestation dans la liste (`?reschedule=1`).
  const rescheduleAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (rescheduleAutoOpenedRef.current) return;
    if (reschedule !== '1' || !menage) return;
    if (user?.role !== 'prestataire' || menage.status !== 'a_venir') return;
    rescheduleAutoOpenedRef.current = true;
    setProposedDate(menage.date_prevue.slice(0, 10));
    setProposedTime(menage.horaire_prevu ? menage.horaire_prevu.slice(0, 5) : '');
    setShowRescheduleModal(true);
  }, [reschedule, menage, user]);
  const [showEditDecl, setShowEditDecl] = useState(false);
  const [editDeclSubmitting, setEditDeclSubmitting] = useState(false);
  // Discussion en plein écran quand on tape : on replie tout le haut (header +
  // infos + onglets) pour laisser la place au clavier ; restauré au blur.
  const [chatFullscreen, setChatFullscreen] = useState(false);
  // Upload de la photo d'arrivée lancé en tâche de fond dès la capture, pour ne
  // pas retarder l'affichage de la modale de déclaration. Résolu au submit.
  const arrivalUploadRef = useRef<Promise<{ url?: string; error?: unknown }> | null>(null);
  const [arrivalSubmitting, setArrivalSubmitting] = useState(false);
  const [showConsommables, setShowConsommables] = useState(false);
  const consommables = useMenageConsommables(id);
  const hasConsommables = (consommables.data?.length ?? 0) > 0;
  const validateModalStyle = useKeyboardAwareModalStyle({ visible: showValidateModal });
  const rescheduleModalStyle = useKeyboardAwareModalStyle({ visible: showRescheduleModal });
  const validateSwipe = useSwipeToClose(() => setShowValidateModal(false), showValidateModal);
  const rescheduleSwipe = useSwipeToClose(() => setShowRescheduleModal(false), showRescheduleModal);

  const runPointage = async (
    kind: 'arrival' | 'departure',
    mutateAsync: (p: {
      id: string;
      photo_url: string;
      lat: number;
      lng: number;
      arrived_at?: string;
      departed_at?: string;
    }) => Promise<unknown>,
  ) => {
    const ok = await dialog.confirm({
      title: kind === 'arrival' ? t('pointage.confirmArrivalTitle') : t('pointage.confirmDepartureTitle'),
      message:
        t('pointage.geoPhotoIntro') +
        ' ' +
        (kind === 'arrival' ? t('pointage.statusWillBeInProgress') : t('pointage.statusWillBeDone')),
      confirmLabel: t('pointage.takePhoto'),
    });
    if (!ok) return false;
    // iOS ne présente pas deux modals natifs en même temps : on attend que la
    // modal de confirmation soit totalement fermée avant d'ouvrir la caméra,
    // sinon `launchCameraAsync` échoue silencieusement. 650ms = marge sûre même
    // au 2e pointage (départ) où l'animation peut être plus lente.
    await new Promise((r) => setTimeout(r, 650));
    try {
      const { localUri, width, height, lat, lng } = await captureGeoPhoto();
      const at = new Date().toISOString();
      // Hors ligne : on met en file d'attente (photo copiée en local + heure
      // réelle) et on enverra au retour du réseau. On NE tente PAS l'upload.
      if (!onlineManager.isOnline()) {
        await enqueuePointage({
          menageId: id!,
          kind,
          isCheck: false,
          at,
          lat,
          lng,
          photo: { uri: localUri, width, height },
        });
        void dialog.alert({
          title: t('pointage.offlinePendingTitle'),
          message: kind === 'arrival' ? t('pointage.offlineArrivalQueuedNow') : t('pointage.offlineDepartureQueuedNow'),
        });
        return true;
      }
      const photoUrl = await uploadGeoPhoto(localUri, width, height);
      await mutateAsync({
        id: id!,
        photo_url: photoUrl,
        lat,
        lng,
        ...(kind === 'arrival' ? { arrived_at: at } : { departed_at: at }),
      });
      return true;
    } catch (err) {
      if (err instanceof GeoPhotoError) {
        if (err.code === 'cancelled') return false;
        void dialog.alert({ title: t('pointage.failedTitle'), message: err.message });
        return false;
      }
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('pointage.failed'),
      });
      return false;
    }
  };

  // check-in / check-out : pointage OPTIONNEL, sans photo ni GPS. On confirme
  // simplement puis on POST un body vide (photo/lat/lng omis).
  const isCheckInOut = !!menage && menage.prestation_type !== 'menage';

  // Arrivée : on capture la photo géolocalisée, puis on demande la déclaration
  // (note voyageurs + dégradation) avant de pointer réellement l'arrivée.
  // Pour un check-in/check-out : pas de photo/GPS, juste une confirmation.
  const handleArrival = async () => {
    if (isCheckInOut) {
      const ok = await dialog.confirm({
        title: menage?.prestation_type === 'check_in' ? t('pointage.confirmGuestArrivalTitle') : t('pointage.confirmArrivalTitle'),
        message: t('pointage.statusWillBeInProgress'),
        confirmLabel: t('common.confirm'),
      });
      if (!ok) return;
      if (!onlineManager.isOnline()) {
        await enqueuePointage({
          menageId: id!,
          kind: 'arrival',
          isCheck: true,
          at: new Date().toISOString(),
          lat: null,
          lng: null,
        });
        void dialog.alert({
          title: t('pointage.offlinePendingTitle'),
          message: t('pointage.offlineArrivalQueued'),
        });
        return;
      }
      try {
        await arrivalMutation.mutateAsync({ id: id! });
      } catch (err) {
        void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('pointage.failed') });
      }
      return;
    }
    const ok = await dialog.confirm({
      title: t('pointage.confirmArrivalTitle'),
      message: t('pointage.geoPhotoIntro'),
      confirmLabel: t('pointage.takePhoto'),
    });
    if (!ok) return;
    await new Promise((r) => setTimeout(r, 650));
    try {
      const proof = await captureGeoPhoto();
      const at = new Date().toISOString();
      // Hors ligne : pas d'upload (il échouerait). On garde la preuve locale ;
      // `submitArrival` mettra tout en file d'attente après la déclaration.
      if (onlineManager.isOnline()) {
        // Upload en arrière-plan pendant que le presta remplit la déclaration.
        // On capture succès/erreur dans le then pour éviter tout unhandled reject.
        arrivalUploadRef.current = uploadGeoPhoto(proof.localUri, proof.width, proof.height).then(
          (url) => ({ url }),
          (error) => ({ error }),
        );
      } else {
        arrivalUploadRef.current = null;
      }
      // Modale affichée immédiatement (plus d'attente de l'upload).
      setArrivalProof({
        lat: proof.lat,
        lng: proof.lng,
        localUri: proof.localUri,
        width: proof.width,
        height: proof.height,
        at,
      });
    } catch (err) {
      if (err instanceof GeoPhotoError) {
        if (err.code !== 'cancelled') void dialog.alert({ title: t('pointage.failedTitle'), message: err.message });
        return;
      }
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('pointage.failed') });
    }
  };

  const submitArrival = async (decl: ArrivalDeclaration) => {
    if (!arrivalProof) return;
    setArrivalSubmitting(true);
    try {
      // Hors ligne : on met l'arrivée + la déclaration en file d'attente (photo
      // de preuve + photos de dégradation copiées en local, heure réelle) et on
      // enverra tout au retour du réseau.
      if (!onlineManager.isOnline()) {
        await enqueuePointage({
          menageId: id!,
          kind: 'arrival',
          isCheck: false,
          at: arrivalProof.at,
          lat: arrivalProof.lat,
          lng: arrivalProof.lng,
          photo: {
            uri: arrivalProof.localUri,
            width: arrivalProof.width,
            height: arrivalProof.height,
          },
          declaration: {
            travelerRating: decl.rating,
            hasDegradation: decl.hasDegradation,
            note: decl.hasDegradation ? decl.note : undefined,
            degradationPhotos: decl.hasDegradation
              ? decl.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }))
              : undefined,
          },
        });
        setArrivalProof(null);
        arrivalUploadRef.current = null;
        void dialog.alert({
          title: t('pointage.offlineArrivalPendingTitle'),
          message: t('pointage.offlineArrivalQueuedNow'),
        });
        return;
      }
      // Récupère l'upload lancé en fond à la capture (souvent déjà terminé).
      const up = arrivalUploadRef.current ? await arrivalUploadRef.current : null;
      if (!up || up.error || !up.url) {
        throw up?.error instanceof Error ? up.error : new Error(t('pointage.photoUploadFailed'));
      }
      const photo_url = up.url;
      let degradation_photos: { url: string; file_size?: number; mime_type?: string }[] | undefined;
      if (decl.hasDegradation && decl.assets.length > 0) {
        degradation_photos = [];
        for (const a of decl.assets) {
          const optimized = await optimizeImage(a.uri, a.width, a.height);
          const uploaded = await uploadFile(optimized.uri, `degradation-${Date.now()}.jpg`, optimized.mimeType);
          degradation_photos.push({ url: uploaded.url, file_size: uploaded.file_size, mime_type: uploaded.mime_type });
        }
      }
      await arrivalMutation.mutateAsync({
        id: id!,
        photo_url,
        lat: arrivalProof.lat,
        lng: arrivalProof.lng,
        arrived_at: arrivalProof.at,
        traveler_rating: decl.rating,
        has_degradation: decl.hasDegradation,
        degradation_note: decl.hasDegradation ? decl.note : undefined,
        degradation_photos,
      });
      setArrivalProof(null);
      arrivalUploadRef.current = null;
    } catch (err) {
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('pointage.failed') });
    } finally {
      setArrivalSubmitting(false);
    }
  };
  const submitEditDeclaration = async (decl: ArrivalDeclaration) => {
    setEditDeclSubmitting(true);
    try {
      let degradation_photos: { url: string; file_size?: number; mime_type?: string }[] | undefined;
      if (decl.hasDegradation && decl.assets.length > 0) {
        degradation_photos = [];
        for (const a of decl.assets) {
          const optimized = await optimizeImage(a.uri, a.width, a.height);
          const uploaded = await uploadFile(optimized.uri, `degradation-${Date.now()}.jpg`, optimized.mimeType);
          degradation_photos.push({ url: uploaded.url, file_size: uploaded.file_size, mime_type: uploaded.mime_type });
        }
      }
      await updateDeclarationMutation.mutateAsync({
        id: id!,
        traveler_rating: decl.rating,
        has_degradation: decl.hasDegradation,
        degradation_note: decl.hasDegradation ? decl.note : '',
        degradation_photos,
      });
      setShowEditDecl(false);
    } catch (err) {
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('menageDetail.updateFailed') });
    } finally {
      setEditDeclSubmitting(false);
    }
  };

  const handleDeparture = async () => {
    if (isCheckInOut) {
      const ok = await dialog.confirm({
        title: t('pointage.confirmDepartureTitle'),
        message: t('pointage.statusWillBeDone'),
        confirmLabel: t('common.confirm'),
      });
      if (!ok) return;
      if (!onlineManager.isOnline()) {
        await enqueuePointage({
          menageId: id!,
          kind: 'departure',
          isCheck: true,
          at: new Date().toISOString(),
          lat: null,
          lng: null,
        });
        void dialog.alert({
          title: t('pointage.offlinePendingTitle'),
          message: t('pointage.offlineDepartureQueued'),
        });
        return;
      }
      try {
        await departureMutation.mutateAsync({ id: id! });
      } catch (err) {
        void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('pointage.failed') });
      }
      return;
    }
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
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('menageDetail.validateFailed') });
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
          <Text style={{ color: colors.mutedText }}>{t('menage.edit.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const date = formatDateFr(menage.date_prevue, 'weekday');

  // Un pointage en attente d'envoi (hors ligne) masque les boutons : l'action
  // est déjà « prise », on attend juste le réseau.
  const canArrive = isPrestataire && menage.status === 'a_venir' && !pendingPointage;
  const canDepart = isPrestataire && menage.status === 'en_cours' && !pendingPointage;
  const canValidate = isAdmin && menage.status === 'termine';
  // Un ménage terminé ou validé : on ne change plus le prestataire affecté.
  const isFinished = menage.status === 'termine' || menage.status === 'valide';

  const handleSubmitReschedule = () => {
    if (!proposedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      void dialog.alert({ title: t('menageDetail.invalidDateTitle'), message: t('menageDetail.invalidDateFormat') });
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
          void dialog.alert({ title: t('menageDetail.rescheduleSentTitle'), message: t('menageDetail.rescheduleSentBody') });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : t('common.error');
          void dialog.alert({ title: t('common.error'), message: msg });
        },
      },
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      // En plein écran discussion, on retire le safe-area du bas : sinon l'input
      // flotte au-dessus du clavier (gap = insets.bottom).
      edges={chatFullscreen ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      {!chatFullscreen && (
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {logement?.name || t('prestationType.menage')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <Text style={[styles.dateText, { color: colors.text2 }]}>{date}</Text>
            {(() => {
              const typeColor = colors[prestationTypeColorKey(menage.prestation_type)];
              return (
                <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
                  <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                    {t(`prestationType.${menage.prestation_type ?? 'menage'}` as TranslationKeys)}
                  </Text>
                </View>
              );
            })()}
            {menage.date_locked ? (
              <View style={[styles.lockPill, { backgroundColor: colors.statusEnCours + '25' }]}>
                <Lock size={14} color={colors.statusEnCours} />
                <Text style={[styles.lockText, { color: colors.statusEnCours }]}>{t('menageDetail.locked')}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {isAdmin && !isEditing ? (
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={t('common.edit')}
            >
              <Pencil size={IconSize.md} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                // Presta AUTO (sync iCal) → « Retirer » : réversible, ne
                // réapparaîtra plus au pull ; se remet depuis le dashboard (Historique).
                const isAuto = !!menage.external_source;
                const ok = await dialog.confirm(
                  isAuto
                    ? {
                        title: t('menageDetail.removeAutoTitle'),
                        message: t('menageDetail.removeAutoBody'),
                        confirmLabel: t('common.remove'),
                        destructive: true,
                      }
                    : {
                        title: t('menageDetail.deleteTitle'),
                        message: t('menageDetail.deleteBody'),
                        confirmLabel: t('common.delete'),
                        destructive: true,
                      },
                );
                if (!ok) return;
                try {
                  await archiveMutation.mutateAsync(menage.id);
                  router.back();
                } catch (err) {
                  void dialog.alert({
                    title: t('common.error'),
                    message: err instanceof Error ? err.message : t('menageDetail.failed'),
                  });
                }
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={t('menageDetail.removeOrDelete')}
            >
              <Trash2 size={IconSize.md} color={colors.red} />
            </TouchableOpacity>
          </View>
        ) : (
          <StatusBadge status={menage.status} />
        )}
      </View>
      )}

      {isEditing ? (
        <MenageEditForm menage={menage} onClose={() => setIsEditing(false)} />
      ) : (
      <>
      {!chatFullscreen && (
      <>
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
          {(() => {
            const list = assignedPrestas.data ?? [];
            // L'admin peut désigner le référent parmi les prestas affectés (2+).
            const canEditReferent = isAdmin && !isFinished && list.length > 1;

            const handleSetReferent = (userId: string, name: string) => {
              void (async () => {
                const ok = await dialog.confirm({
                  title: t('menageDetail.setReferentTitle'),
                  message: t('menageDetail.setReferentBody', { name }),
                  confirmLabel: t('menageDetail.setReferent'),
                });
                if (!ok) return;
                try {
                  await setReferent.mutateAsync(userId);
                } catch (err) {
                  void dialog.alert({
                    title: t('common.error'),
                    message: err instanceof Error ? err.message : t('menageDetail.updateFailed'),
                  });
                }
              })();
            };

            // Fallback sur le référent si la liste n'est pas encore chargée.
            if (list.length === 0) {
              const fallbackName = menage.prestataire_user_id
                ? [menage.prestataire_first_name, menage.prestataire_last_name]
                    .filter(Boolean)
                    .join(' ') || t('menageDetail.assigned')
                : null;
              return (
                <>
                  <Text style={[styles.prestataireLabel, { color: colors.text2 }]}>
                    {t('menage.fields.prestataire').toUpperCase()}
                  </Text>
                  {fallbackName ? (
                    <Text style={[styles.prestataireName, { color: colors.text }]}>
                      {fallbackName}
                    </Text>
                  ) : (
                    <View style={styles.prestataireUnassignedBadge}>
                      <Text style={styles.prestataireUnassignedText}>{t('common.unassigned').toUpperCase()}</Text>
                    </View>
                  )}
                </>
              );
            }

            return (
              <>
                <Text style={[styles.prestataireLabel, { color: colors.text2 }]}>
                  {(list.length > 1 ? t('menageDetail.providers') : t('menage.fields.prestataire')).toUpperCase()}
                </Text>
                {list.map((p) => {
                  const n = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';
                  return (
                    <View key={p.id} style={styles.prestataireRow}>
                      <Text style={[styles.prestataireName, { color: colors.text }]}>{n}</Text>
                      {p.is_primary ? (
                        <View
                          style={[styles.referentBadge, { backgroundColor: colors.primary + '20' }]}
                        >
                          <Text style={[styles.referentBadgeText, { color: colors.primary }]}>
                            {t('menageDetail.referent')}
                          </Text>
                        </View>
                      ) : canEditReferent ? (
                        <TouchableOpacity
                          onPress={() => handleSetReferent(p.user_id, n)}
                          disabled={setReferent.isPending}
                          style={[styles.referentAction, { borderColor: colors.primary }]}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={[styles.referentActionText, { color: colors.primary }]}>
                            {t('menageDetail.setReferent')}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </>
            );
          })()}
        </View>
        {isAdmin && !isFinished ? (
          <TouchableOpacity
            style={[styles.assignBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowAssignModal(true)}
            accessibilityLabel={t('menageDetail.assignProvider')}
          >
            <Text style={styles.assignBtnText}>
              {menage.prestataire_user_id ? t('menageDetail.change') : t('menageDetail.assign')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isAdmin && !isFinished ? <ResponsesSection menageId={menage.id} colors={colors} /> : null}

      {/* Pointage en attente d'envoi (hors ligne) */}
      {pendingPointage ? (
        <View
          style={[
            styles.pendingPointage,
            {
              backgroundColor: colors.itemBackground,
              borderColor: pendingPointage.status === 'error' ? '#EF4444' : colors.border,
            },
          ]}
        >
          <Text style={[styles.pendingPointageTitle, { color: colors.text }]}>
            {pendingPointage.kind === 'arrival' ? t('pointage.pendingArrivalTitle') : t('pointage.pendingDepartureTitle')}
          </Text>
          <Text style={[styles.pendingPointageSub, { color: colors.mutedText }]}>
            {pendingPointage.status === 'error'
              ? t('pointage.pendingErrorBody')
              : t('pointage.pendingRecordedAt', { datetime: formatDateFr(pendingPointage.at, 'dayShortTime') })}
          </Text>
        </View>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actions}>
        {canArrive ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handleArrival}
            disabled={arrivalMutation.isPending}
          >
            <Play size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>{t('pointage.arrivalButton')}</Text>
          </TouchableOpacity>
        ) : null}
        {canDepart ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.statusTermine }]}
            onPress={handleDeparture}
            disabled={departureMutation.isPending}
          >
            <Square size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>{t('pointage.departureButton')}</Text>
          </TouchableOpacity>
        ) : null}
        {hasConsommables && (isPrestataire || isAdmin) ? (
          <TouchableOpacity
            style={[styles.actionBtnOutline, { borderColor: colors.border }]}
            onPress={() => setShowConsommables(true)}
          >
            <PackageCheck size={IconSize.md} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>
              {t('menageDetail.consumablesReading')}
            </Text>
          </TouchableOpacity>
        ) : null}
        {canValidate ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.statusValide }]}
            onPress={() => setShowValidateModal(true)}
          >
            <CheckCircle2 size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>{t('report.validateButton')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(isCheckInOut ? TABS.filter((tb) => tb.key !== 'photos') : TABS).map((tab) => {
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
                {t(tab.label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      </>
      )}

      {/* Content */}
      <View style={{ flex: 1 }}>
        <ErrorBoundary key={activeTab} label={t('menageDetail.errorBoundaryLabel')}>
        {activeTab === 'infos' && (
          <LazyLoadScope>
          <InfosScrollView>
            {!isCheckInOut && (menage.arrived_at || menage.departed_at) ? (
              <PointageSection menage={menage} colors={colors} />
            ) : null}
            {isAdmin && (menage.arrival_photo_url || menage.departure_photo_url) ? (
              <PointageProofSection menage={menage} logement={logement} colors={colors} />
            ) : null}
            <AccessInfoSection menage={menage} logement={logement} colors={colors} />
            {!isCheckInOut && menage.status !== 'a_venir' ? (
              <DeclarationSection
                menage={menage}
                canEdit={(isPrestataire || isAdmin) && menage.status !== 'valide'}
                onEdit={() => setShowEditDecl(true)}
                colors={colors}
              />
            ) : null}
            <BedsSection menage={menage} colors={colors} isAdmin={isAdmin} />
            {/* Photos de référence du logement : le presta doit savoir à quoi
                ça doit ressembler une fois le ménage fait. */}
            <LogementReferencePhotos logementId={menage.logement_id} />
            <MenageOptionsSection menageId={menage.id} logementId={menage.logement_id} isAdmin={isAdmin} />
            <MenageEquipementsSection
              menageId={menage.id}
              logementId={menage.logement_id}
              isAdmin={isAdmin}
            />
          </InfosScrollView>
          </LazyLoadScope>
        )}
        {activeTab === 'check' && <MenageCheckList menageId={id!} readonly={menage.status === 'valide'} />}
        {activeTab === 'photos' && !isCheckInOut && <PhotoGallery menageId={id!} readonly={menage.status === 'valide'} />}
        {activeTab === 'comments' && (
          <MenageDiscussions
            menageId={id!}
            canViewComments={true}
            readonly={menage.status === 'valide'}
            // La vue va jusqu'en bas de l'écran (safe-area bas retiré en plein
            // écran) → offset 0, sinon le padding = keyboardHeight + offset et
            // l'input flotte au-dessus du clavier (gap = offset).
            keyboardVerticalOffset={0}
            onInputFocus={() => {
              // Preset easeInEaseOut : anime position ET taille (pas juste l'opacité)
              // → le haut se replie et la discussion s'agrandit en glissant.
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setChatFullscreen(true);
            }}
            onInputBlur={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setChatFullscreen(false);
            }}
          />
        )}
        </ErrorBoundary>
      </View>
      </>
      )}

      {/* Validation modal */}
      <Modal
        visible={showValidateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowValidateModal(false)}
      >
        <GestureHandlerRootView style={styles.overlay}>
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
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: Spacing.sm }]}>{t('report.validateButton')}</Text>
            <ScrollView
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ gap: Spacing.md, paddingBottom: Spacing.sm }}
              showsVerticalScrollIndicator={false}
            >
              {(() => {
                const all = reportPhotos.data?.data ?? [];
                const deg = all.filter((p) => p.is_degradation);
                const menagePhotos = all.filter((p) => !p.is_degradation);
                const rating = menage.traveler_rating ?? null;
                return (
                  <View style={{ gap: Spacing.md }}>
                    {/* Note voyageurs */}
                    <View style={styles.recapRow}>
                      <Text style={[styles.recapLabel, { color: colors.text2 }]}>{t('report.travelerRating')}</Text>
                      {rating != null ? (
                        <Text style={{ color: '#F59E0B', fontWeight: FontWeight.semibold }}>
                          {'★'.repeat(rating)}
                          <Text style={{ color: colors.border }}>{'★'.repeat(5 - rating)}</Text>
                          <Text style={{ color: colors.text2 }}>{`  ${rating}/5`}</Text>
                        </Text>
                      ) : (
                        <Text style={{ color: colors.mutedText }}>{t('report.ratingNotProvided')}</Text>
                      )}
                    </View>

                    {/* Dégradations */}
                    <View
                      style={[
                        styles.recapBox,
                        {
                          borderColor: menage.has_degradation ? '#FCA5A5' : colors.border,
                          backgroundColor: menage.has_degradation ? 'rgba(244,63,94,0.08)' : colors.itemBackground,
                        },
                      ]}
                    >
                      <View style={styles.recapBoxHead}>
                        <AlertTriangle size={14} color={menage.has_degradation ? '#E11D48' : colors.text2} />
                        <Text style={[styles.recapBoxTitle, { color: menage.has_degradation ? '#E11D48' : colors.text2 }]}>
                          {menage.has_degradation ? t('report.degradationsCount', { count: deg.length }) : t('report.degradations')}
                        </Text>
                      </View>
                      {menage.has_degradation ? (
                        <>
                          {menage.degradation_note ? (
                            <Text style={{ color: colors.text, marginTop: 4 }}>{menage.degradation_note}</Text>
                          ) : null}
                          {deg.length > 0 ? (
                            <ReportPhotoGrid photos={deg} colors={colors} />
                          ) : (
                            <Text style={{ color: colors.mutedText, marginTop: 4 }}>{t('report.noPhotoAttached')}</Text>
                          )}
                        </>
                      ) : (
                        <Text style={{ color: '#10B981', marginTop: 4 }}>{t('report.noDegradation')}</Text>
                      )}
                    </View>

                    {/* Photos du ménage */}
                    <View style={[styles.recapBox, { borderColor: colors.border, backgroundColor: colors.itemBackground }]}>
                      <Text style={[styles.recapBoxTitle, { color: colors.text2 }]}>
                        {t('report.cleaningPhotos', { count: menagePhotos.length })}
                      </Text>
                      {menagePhotos.length > 0 ? (
                        <ReportPhotoGrid photos={menagePhotos} colors={colors} />
                      ) : (
                        <Text style={{ color: colors.mutedText, marginTop: 4 }}>{t('report.noPhoto')}</Text>
                      )}
                    </View>

                    {/* Prix */}
                    <View>
                      <Text style={{ color: colors.text2, marginBottom: Spacing.sm }}>
                        {t('report.plannedPrice', { price: menage.prix_prevu ?? '—' })}
                      </Text>
                      <Text style={[styles.label, { color: colors.text2 }]}>
                        {t('report.finalPriceLabel')}
                      </Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground }]}
                        value={overridePrice}
                        onChangeText={setOverridePrice}
                        placeholder={String(menage.prix_prevu ?? '')}
                        placeholderTextColor={colors.placeholder}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
            <TouchableOpacity
              style={[styles.submit, { backgroundColor: colors.statusValide }]}
              onPress={handleValidate}
              disabled={validateMutation.isPending}
            >
              <CheckCircle2 size={IconSize.md} color="#FFFFFF" />
              <Text style={styles.submitText}>
                {validateMutation.isPending ? t('report.validating') : t('common.validate')}
              </Text>
            </TouchableOpacity>
            </Animated.View>
        </GestureHandlerRootView>
      </Modal>

      {/* Reschedule modal */}
      <Modal
        visible={showRescheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <GestureHandlerRootView style={styles.overlay}>
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
                {t('menageDetail.rescheduleTitle')}
              </Text>
              <Text style={{ color: colors.text2, marginBottom: Spacing.sm }}>
                {t('menageDetail.currentDate', { date: formatDateFr(menage.date_prevue.slice(0, 10), 'long') })}
              </Text>
              <DatePickerField
                label={t('menageDetail.newDate')}
                value={proposedDate}
                onChange={setProposedDate}
                placeholder={t('menageDetail.pickDate')}
              />
              <TimePickerField
                label={t('menageDetail.timeOptional')}
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
                {t('menageDetail.reasonOptional')}
              </Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground, height: 80 }]}
                value={rescheduleReason}
                onChangeText={setRescheduleReason}
                placeholder={t('menageDetail.reasonPlaceholder')}
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
                  {rescheduleMutation.isPending ? t('menageDetail.sending') : t('menageDetail.sendRequest')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
            </Animated.View>
        </GestureHandlerRootView>
      </Modal>

      <AssignPrestataireModal
        visible={showAssignModal}
        menageId={menage.id}
        onClose={() => setShowAssignModal(false)}
      />

      <ConsommablesReleveModal
        visible={showConsommables}
        menageId={menage.id}
        onClose={() => setShowConsommables(false)}
      />

      <ArrivalDeclarationModal
        visible={!!arrivalProof}
        submitting={arrivalSubmitting}
        onClose={() => setArrivalProof(null)}
        onSubmit={submitArrival}
      />

      <ArrivalDeclarationModal
        visible={showEditDecl}
        submitting={editDeclSubmitting}
        onClose={() => setShowEditDecl(false)}
        onSubmit={submitEditDeclaration}
        initial={{
          rating: menage.traveler_rating ?? 0,
          hasDegradation: !!menage.has_degradation,
          note: menage.degradation_note ?? '',
        }}
        title={t('menageDetail.declarationTitle')}
        submitLabel={t('common.save')}
        requireDegradationPhoto={false}
      />
    </SafeAreaView>
  );
}

const EDIT_STATUSES: { v: MenageStatus; l: TranslationKeys }[] = [
  { v: 'a_venir', l: 'menage.statusUpcoming' },
  { v: 'en_cours', l: 'menage.statusInProgress' },
  { v: 'termine', l: 'menage.statusCompleted' },
  { v: 'annule', l: 'menage.statusCancelled' },
];

function parseMoneyInput(s: string): number | null | 'invalid' {
  if (!s.trim()) return null;
  const n = parseFloat(s.replace(',', '.'));
  if (Number.isNaN(n) || n < 0) return 'invalid';
  return n;
}

function parseCountInput(s: string): number {
  const n = parseInt(s, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

/**
 * Formulaire d'édition unifié de la fiche ménage. Affiché en lieu et place des
 * sections en lecture seule quand l'admin passe en mode édition. Tous les champs
 * sont envoyés en un seul PATCH (Enregistrer) ; Annuler abandonne sans appel réseau.
 */
function MenageEditForm({ menage, onClose }: { menage: Menage; onClose: () => void }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t: tr } = useTranslation();
  const dialog = useDialog();
  const update = useUpdateMenage();

  const [datePrevue, setDatePrevue] = useState(menage.date_prevue.slice(0, 10));
  const [horairePrevu, setHorairePrevu] = useState(menage.horaire_prevu ? menage.horaire_prevu.slice(0, 5) : '');
  const [dureeEstimee, setDureeEstimee] = useState(menage.duree_estimee_min != null ? String(menage.duree_estimee_min) : '');
  const [status, setStatus] = useState<MenageStatus>(menage.status);
  const [clientPriceHt, setClientPriceHt] = useState(menage.client_price_ht != null ? String(menage.client_price_ht) : '');
  const [clientVatRate, setClientVatRate] = useState(menage.client_vat_rate != null ? String(menage.client_vat_rate) : '20');
  const [providerPrice, setProviderPrice] = useState(menage.provider_price != null ? String(menage.provider_price) : '');
  const [laundryIncluded, setLaundryIncluded] = useState(!!menage.laundry_included);
  const [laundryClientPriceHt, setLaundryClientPriceHt] = useState(menage.laundry_client_price_ht != null ? String(menage.laundry_client_price_ht) : '');
  const [laundryProviderPrice, setLaundryProviderPrice] = useState(menage.laundry_provider_price != null ? String(menage.laundry_provider_price) : '');
  const [nLitSimple, setNLitSimple] = useState(String(menage.n_lit_simple ?? 0));
  const [nLitDouble, setNLitDouble] = useState(String(menage.n_lit_double ?? 0));
  const [nCanapeLit, setNCanapeLit] = useState(String(menage.n_canape_lit ?? 0));
  const [nLitAppoint, setNLitAppoint] = useState(String(menage.n_lit_appoint ?? 0));
  const [nLitParapluie, setNLitParapluie] = useState(String(menage.n_lit_parapluie ?? 0));
  const [nTravelers, setNTravelers] = useState(menage.n_travelers != null ? String(menage.n_travelers) : '');
  const toTime = (iso: string | null) => (iso ? formatDateFr(iso, 'time') : '');
  const [arrivalTime, setArrivalTime] = useState(toTime(menage.arrived_at));
  const [departureTime, setDepartureTime] = useState(toTime(menage.departed_at));
  const [dateLocked, setDateLocked] = useState(!!menage.date_locked);
  const [notes, setNotes] = useState(menage.notes_intervention ?? '');

  // Combine la date du ménage + une heure HH:MM en ISO. Vide → null.
  const toIso = (time: string): string | null => {
    if (!time.match(/^\d{2}:\d{2}$/)) return null;
    return new Date(`${datePrevue}T${time}:00`).toISOString();
  };

  const applySuggestion = () => {
    const n = parseCountInput(nTravelers);
    if (n <= 0) return;
    const s = suggestBeds(n);
    setNLitDouble(String(s.n_lit_double));
    setNLitSimple(String(s.n_lit_simple));
    setNCanapeLit(String(s.n_canape_lit));
    setNLitAppoint(String(s.n_lit_appoint));
    setNLitParapluie(String(s.n_lit_parapluie));
  };

  const invalid = (field: string) =>
    void dialog.alert({ title: tr('menageDetail.invalidFieldTitle'), message: tr('menageDetail.invalidFieldBody', { field }) });

  const handleSubmit = async () => {
    if (!datePrevue) {
      void dialog.alert({ title: tr('menage.errors.dateRequired'), message: tr('menageDetail.dateRequiredBody') });
      return;
    }
    const duree = dureeEstimee.trim() ? parseInt(dureeEstimee, 10) : null;
    if (dureeEstimee.trim() && (duree === null || Number.isNaN(duree) || duree < 0)) {
      void dialog.alert({ title: tr('menage.errors.dureeInvalid'), message: tr('menageDetail.durationInvalidBody') });
      return;
    }
    const cPrice = parseMoneyInput(clientPriceHt);
    if (cPrice === 'invalid') return invalid(tr('menage.fields.clientPriceHt'));
    const cVat = parseMoneyInput(clientVatRate);
    if (cVat === 'invalid') return invalid(tr('menage.fields.clientVatRate'));
    const pPrice = parseMoneyInput(providerPrice);
    if (pPrice === 'invalid') return invalid(tr('menage.fields.providerPrice'));
    const lCPrice = parseMoneyInput(laundryClientPriceHt);
    if (lCPrice === 'invalid') return invalid(tr('menage.fields.laundryClientHt'));
    const lPPrice = parseMoneyInput(laundryProviderPrice);
    if (lPPrice === 'invalid') return invalid(tr('menage.fields.laundryProvider'));

    const body: UpdateMenageInput = {
      date_prevue: datePrevue,
      horaire_prevu: horairePrevu || null,
      duree_estimee_min: duree,
      status,
      client_price_ht: cPrice,
      client_vat_rate: cVat,
      provider_price: pPrice,
      laundry_included: laundryIncluded,
      laundry_client_price_ht: laundryIncluded ? lCPrice : null,
      laundry_provider_price: laundryIncluded ? lPPrice : null,
      n_lit_simple: parseCountInput(nLitSimple),
      n_lit_double: parseCountInput(nLitDouble),
      n_canape_lit: parseCountInput(nCanapeLit),
      n_lit_appoint: parseCountInput(nLitAppoint),
      n_lit_parapluie: parseCountInput(nLitParapluie),
      n_travelers: nTravelers.trim() ? parseCountInput(nTravelers) : null,
      arrived_at: arrivalTime ? toIso(arrivalTime) : null,
      departed_at: departureTime ? toIso(departureTime) : null,
      date_locked: dateLocked,
      notes_intervention: notes.trim() || null,
    };

    try {
      await update.mutateAsync({ id: menage.id, body });
      onClose();
    } catch (err) {
      void dialog.alert({ title: tr('common.error'), message: err instanceof Error ? err.message : tr('menageDetail.failed') });
    }
  };

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];
  const statuses = menage.status === 'valide' ? [...EDIT_STATUSES, { v: 'valide' as MenageStatus, l: 'menage.statusValidated' as TranslationKeys }] : EDIT_STATUSES;

  return (
    <KeyboardAwareScroll contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm }}>
      <Text style={[styles.section, { color: colors.text2 }]}>{tr('menage.edit.sectionPlanning').toUpperCase()}</Text>
      <DatePickerField label={tr('menage.fields.datePrevue')} value={datePrevue} onChange={setDatePrevue} />
      <TimePickerField label={tr('menage.fields.horaire')} value={horairePrevu} onChange={setHorairePrevu} />
      <DurationPickerField label={tr('menage.fields.dureeEstimee')} value={dureeEstimee} onChange={setDureeEstimee} />

      <Text style={[styles.section, { color: colors.text2 }]}>{tr('menage.edit.sectionStatus').toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
        {statuses.map((s) => {
          const active = status === s.v;
          return (
            <TouchableOpacity
              key={s.v}
              onPress={() => setStatus(s.v)}
              style={{
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : colors.surface,
              }}
            >
              <Text style={{ color: active ? '#FFFFFF' : colors.text, fontSize: FontSize.sm }}>{tr(s.l)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: FontSize.md, flex: 1 }}>{tr('menageDetail.dateLocked')}</Text>
        <Switch value={dateLocked} onValueChange={setDateLocked} trackColor={{ false: colors.border, true: colors.primary }} />
      </View>

      <Text style={[styles.section, { color: colors.text2 }]}>{tr('menageDetail.sectionPointages').toUpperCase()}</Text>
      <TimePickerField label={tr('menageDetail.arrivalTime')} value={arrivalTime} onChange={setArrivalTime} placeholder="--:--" />
      <TimePickerField label={tr('menageDetail.departureTime')} value={departureTime} onChange={setDepartureTime} placeholder="--:--" />

      <Text style={[styles.section, { color: colors.text2 }]}>{tr('menage.edit.sectionPricing').toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 2 }}>
          <LabeledField label={tr('menage.fields.clientPriceHt')}>
            <AutoScrollInput style={inputStyle} value={clientPriceHt} onChangeText={setClientPriceHt} placeholder={tr('menageDetail.exampleValue', { value: 80 })} placeholderTextColor={colors.placeholder} keyboardType="decimal-pad" />
          </LabeledField>
        </View>
        <View style={{ flex: 1 }}>
          <LabeledField label={tr('menage.fields.clientVatRate')}>
            <AutoScrollInput style={inputStyle} value={clientVatRate} onChangeText={setClientVatRate} placeholder="20" placeholderTextColor={colors.placeholder} keyboardType="decimal-pad" />
          </LabeledField>
        </View>
      </View>
      <LabeledField label={tr('menage.fields.providerPrice')}>
        <AutoScrollInput style={inputStyle} value={providerPrice} onChangeText={setProviderPrice} placeholder={tr('menageDetail.exampleValue', { value: 50 })} placeholderTextColor={colors.placeholder} keyboardType="decimal-pad" />
      </LabeledField>

      <Text style={[styles.section, { color: colors.text2 }]}>{tr('menage.edit.sectionLaundry').toUpperCase()}</Text>
      <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: FontSize.md, flex: 1 }}>{tr('menage.fields.laundryIncluded')}</Text>
        <Switch value={laundryIncluded} onValueChange={setLaundryIncluded} trackColor={{ false: colors.border, true: colors.primary }} />
      </View>
      {laundryIncluded ? (
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <LabeledField label={tr('menage.fields.laundryClientHt')}>
              <AutoScrollInput style={inputStyle} value={laundryClientPriceHt} onChangeText={setLaundryClientPriceHt} placeholder={tr('menageDetail.exampleValue', { value: 15 })} placeholderTextColor={colors.placeholder} keyboardType="decimal-pad" />
            </LabeledField>
          </View>
          <View style={{ flex: 1 }}>
            <LabeledField label={tr('menage.fields.laundryProvider')}>
              <AutoScrollInput style={inputStyle} value={laundryProviderPrice} onChangeText={setLaundryProviderPrice} placeholder={tr('menageDetail.exampleValue', { value: 10 })} placeholderTextColor={colors.placeholder} keyboardType="decimal-pad" />
            </LabeledField>
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md }}>
        <Text style={[styles.section, { color: colors.text2, marginTop: 0 }]}>{tr('beds.section').toUpperCase()}</Text>
        {parseCountInput(nTravelers) > 0 ? (
          <TouchableOpacity
            onPress={applySuggestion}
            style={{ borderWidth: 1, borderColor: colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4 }}
          >
            <Text style={{ color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>{tr('menageDetail.suggest')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <LabeledField label={tr('menageDetail.travelers')}>
        <AutoScrollInput style={inputStyle} value={nTravelers} onChangeText={setNTravelers} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.placeholder} />
      </LabeledField>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <LabeledField label={tr('beds.simple')}>
            <AutoScrollInput style={inputStyle} value={nLitSimple} onChangeText={setNLitSimple} keyboardType="number-pad" />
          </LabeledField>
        </View>
        <View style={{ flex: 1 }}>
          <LabeledField label={tr('beds.double')}>
            <AutoScrollInput style={inputStyle} value={nLitDouble} onChangeText={setNLitDouble} keyboardType="number-pad" />
          </LabeledField>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <LabeledField label={tr('beds.sofa')}>
            <AutoScrollInput style={inputStyle} value={nCanapeLit} onChangeText={setNCanapeLit} keyboardType="number-pad" />
          </LabeledField>
        </View>
        <View style={{ flex: 1 }}>
          <LabeledField label={tr('beds.extra')}>
            <AutoScrollInput style={inputStyle} value={nLitAppoint} onChangeText={setNLitAppoint} keyboardType="number-pad" />
          </LabeledField>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <LabeledField label={tr('beds.crib')}>
            <AutoScrollInput style={inputStyle} value={nLitParapluie} onChangeText={setNLitParapluie} keyboardType="number-pad" />
          </LabeledField>
        </View>
        <View style={{ flex: 1 }} />
      </View>

      <Text style={[styles.section, { color: colors.text2 }]}>{tr('menage.edit.sectionNotes').toUpperCase()}</Text>
      <AutoScrollInput
        style={[...inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
        value={notes}
        onChangeText={setNotes}
        placeholder={tr('menage.fields.notesPlaceholder')}
        placeholderTextColor={colors.placeholder}
        multiline
      />

      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg }}>
        <TouchableOpacity
          style={[styles.submit, { flex: 1, marginTop: 0, backgroundColor: colors.itemBackground }]}
          onPress={onClose}
        >
          <Text style={[styles.submitText, { color: colors.text }]}>{tr('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submit, { flex: 1, marginTop: 0, backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={update.isPending}
        >
          <Save size={IconSize.md} color="#FFFFFF" />
          <Text style={styles.submitText}>{update.isPending ? tr('common.saving') : tr('common.save')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScroll>
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
  const insets = useSafeAreaInsets();
  const modalStyle = useKeyboardAwareModalStyle({ visible });
  const dialog = useDialog();
  const { t } = useTranslation();
  const consommables = useMenageConsommables(visible ? menageId : undefined);
  const setReleve = useSetMenageConsommables(menageId);
  const [qty, setQty] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible || !consommables.data) return;
    const init: Record<string, string> = {};
    for (const c of consommables.data) {
      // Pré-rempli avec le relevé de ce ménage s'il existe, sinon le stock
      // courant (dernier relevé) → le presta ne retape que si ça a bougé.
      const preset = c.qty ?? c.current_qty ?? null;
      init[c.logement_consommable_id] = preset === null ? '' : String(preset);
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
          title: t('menageDetail.qtyMissingTitle'),
          message: t('menageDetail.qtyMissingBody', { label: c.label }),
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
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('common.saveFailed'),
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.consoSheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) }, modalStyle]}>
          <View style={styles.consoHeader}>
            <Text style={[styles.consoTitle, { color: colors.text }]}>{t('menageDetail.consumablesReading')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.consoSub, { color: colors.text2 }]}>
            {t('menageDetail.consumablesIntro')}
          </Text>

          {consommables.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.lg }} />
          ) : lines.length === 0 ? (
            <Text style={{ color: colors.mutedText, paddingVertical: Spacing.md }}>
              {t('menageDetail.noConsumables')}
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 380, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
              {lines.map((c: ConsommableLine) => {
                const val = qty[c.logement_consommable_id] ?? '';
                const n = parseInt(val, 10);
                const low = val.trim() !== '' && !Number.isNaN(n) && n <= c.seuil_alerte;
                return (
                  <View key={c.logement_consommable_id} style={[styles.consoRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: FontWeight.semibold }}>{c.label}</Text>
                      <Text style={{ color: colors.text2, fontSize: FontSize.xs }}>
                        {t('menageDetail.threshold', { value: formatQtyUnit(c.seuil_alerte, c.unit) })}
                      </Text>
                    </View>
                    <View style={styles.consoAlertSlot}>
                      {low ? <AlertTriangle size={16} color={colors.red} /> : null}
                    </View>
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
                    {/* Colonne unité toujours réservée (même vide) pour aligner les inputs. */}
                    <Text style={[styles.consoUnit, { color: colors.text2 }]} numberOfLines={1}>
                      {c.unit ? unitForQty(Number.isNaN(n) ? 0 : n, c.unit) : ''}
                    </Text>
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
                {setReleve.isPending ? t('common.saving') : t('menageDetail.saveReading')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
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

function AccessInfoSection({
  menage,
  logement,
  colors,
}: {
  menage: Menage;
  logement: Logement | undefined;
  colors: typeof Colors.light;
}) {
  const { t, tp } = useTranslation();
  // Codes d'accès du logement (boîte à clés, portail…). Lisibles par le presta
  // affecté même s'il n'est pas membre du logement. `key_safe_code` (legacy,
  // joint au ménage) sert de repli tant que la liste n'a pas répondu.
  const codes = useLogementCodes(menage.logement_id);
  const codeList = codes.data ?? [];
  const legacyCode = logement?.key_safe_code ?? null;
  const hasCodes = codeList.length > 0 || !!legacyCode;
  const nights = menage.stay_nights ?? null;
  const checkin = menage.next_checkin_at ? menage.next_checkin_at.slice(0, 10) : null;
  const sameDay = checkin !== null && checkin === menage.date_prevue.slice(0, 10);
  // Adresse du logement (le presta doit savoir où aller). Tap → Maps. On utilise
  // les champs portés par le ménage (toujours présents, même si le presta n'a pas
  // accès au détail du logement) ; complétés par le code postal si dispo.
  const cityLine = [logement?.postal_code, menage.logement_city ?? logement?.city]
    .filter(Boolean)
    .join(' ');
  const addressParts = [menage.logement_address ?? logement?.address, cityLine].filter(Boolean);
  const addressText = addressParts.join(' · ');
  const addressQuery = addressParts.join(', ');
  if (!addressText && !hasCodes && !nights && !checkin) return null;
  return (
    <View style={[styles.accessCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {addressText ? (
        <TouchableOpacity
          style={styles.accessRow}
          onPress={() => openMaps(addressQuery)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('menageDetail.openRouteTo', { address: addressText })}
        >
          <MapPin size={IconSize.sm} color={colors.primary} />
          <Text style={[styles.accessValue, { color: colors.primary, flex: 1 }]}>{addressText}</Text>
        </TouchableOpacity>
      ) : null}
      {codeList.length > 0
        ? codeList.map((c) => (
            <View key={c.id} style={styles.accessRow}>
              <KeyRound size={IconSize.sm} color={colors.primary} />
              <Text style={[styles.accessLabel, { color: colors.text2 }]}>{c.label}</Text>
              <Text style={[styles.accessValue, { color: colors.text }]}>{c.code}</Text>
            </View>
          ))
        : legacyCode ? (
            <View style={styles.accessRow}>
              <KeyRound size={IconSize.sm} color={colors.primary} />
              <Text style={[styles.accessLabel, { color: colors.text2 }]}>{t('menageDetail.keySafe')}</Text>
              <Text style={[styles.accessValue, { color: colors.text }]}>{legacyCode}</Text>
            </View>
          ) : null}
      {nights ? (
        <View style={styles.accessRow}>
          <Moon size={IconSize.sm} color={colors.text2} />
          <Text style={[styles.accessLabel, { color: colors.text2 }]}>{t('menageDetail.stay')}</Text>
          <Text style={[styles.accessValue, { color: colors.text }]}>
            {tp('menageDetail.nights', nights)}
          </Text>
        </View>
      ) : null}
      {checkin ? (
        <View style={styles.accessRow}>
          <CalendarClock size={IconSize.sm} color={sameDay ? colors.statusEnCours : colors.text2} />
          <Text style={[styles.accessLabel, { color: colors.text2 }]}>{t('menageDetail.nextCheckIn')}</Text>
          <Text style={[styles.accessValue, { color: sameDay ? colors.statusEnCours : colors.text }]}>
            {formatDateFr(checkin, 'dayShort')}{sameDay ? ` · ${t('menageDetail.sameDay')}` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Affichage soigné du pointage arrivée/départ (heures) dans le détail.
 * Lecture seule ; deux colonnes + durée sur place si les deux sont pointés.
 */
function PointageSection({
  menage,
  colors,
}: {
  menage: Menage;
  colors: typeof Colors.light;
}) {
  const { t } = useTranslation();
  const fmt = (iso: string | null) => (iso ? formatDateFr(iso, 'time') : null);
  const arrived = fmt(menage.arrived_at);
  const departed = fmt(menage.departed_at);
  // Durée sur place (si arrivée + départ le même jour renseignés).
  let duration: string | null = null;
  if (menage.arrived_at && menage.departed_at) {
    const mins = Math.round(
      (new Date(menage.departed_at).getTime() - new Date(menage.arrived_at).getTime()) / 60000,
    );
    if (mins > 0) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      duration =
        h > 0
          ? m
            ? t('menageDetail.durationHoursMin', { h, m })
            : t('menageDetail.durationHours', { h })
          : t('menageDetail.durationMin', { m });
    }
  }
  return (
    <View style={[styles.pointageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.pointageRow}>
        <View style={styles.pointageCol}>
          <View style={[styles.pointageIcon, { backgroundColor: colors.statusValide + '20' }]}>
            <LogIn size={IconSize.sm} color={colors.statusValide} />
          </View>
          <View>
            <Text style={[styles.pointageLabel, { color: colors.text2 }]}>{t('pointage.arrival')}</Text>
            <Text style={[styles.pointageValue, { color: arrived ? colors.text : colors.mutedText }]}>
              {arrived ?? t('pointage.notClockedInF')}
            </Text>
          </View>
        </View>
        <View style={[styles.pointageDivider, { backgroundColor: colors.border }]} />
        <View style={styles.pointageCol}>
          <View style={[styles.pointageIcon, { backgroundColor: colors.red + '20' }]}>
            <LogOut size={IconSize.sm} color={colors.red} />
          </View>
          <View>
            <Text style={[styles.pointageLabel, { color: colors.text2 }]}>{t('pointage.departure')}</Text>
            <Text style={[styles.pointageValue, { color: departed ? colors.text : colors.mutedText }]}>
              {departed ?? t('menage.statusNotClockedIn')}
            </Text>
          </View>
        </View>
      </View>
      {duration ? (
        <View style={[styles.pointageDurationRow, { borderTopColor: colors.border }]}>
          <Clock size={13} color={colors.text2} />
          <Text style={[styles.pointageDurationText, { color: colors.text2 }]}>
            {t('pointage.onSiteDuration', { duration })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Déclaration voyageurs (note + dégradation) affichée dans le détail, éditable
 * a posteriori par le prestataire assigné ou un admin (bouton « Modifier »).
 */
function DeclarationSection({
  menage,
  canEdit,
  onEdit,
  colors,
}: {
  menage: Menage;
  canEdit: boolean;
  onEdit: () => void;
  colors: typeof Colors.light;
}) {
  const { t } = useTranslation();
  const rating = menage.traveler_rating ?? 0;
  return (
    <View style={[styles.accessCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.accessRow}>
        <Star size={IconSize.sm} color="#F5A623" />
        <Text style={[styles.accessLabel, { color: colors.text2 }]}>{t('report.travelerRating')}</Text>
        {rating ? (
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={16}
                color="#F5A623"
                fill={n <= rating ? '#F5A623' : 'transparent'}
              />
            ))}
          </View>
        ) : (
          <Text style={[styles.accessValue, { color: colors.mutedText }]}>{t('report.notProvided')}</Text>
        )}
      </View>
      {menage.has_degradation ? (
        <View style={styles.accessRow}>
          <AlertTriangle size={IconSize.sm} color={colors.red} />
          <Text style={[styles.accessLabel, { color: colors.text2 }]}>{t('report.degradation')}</Text>
          <Text
            style={[styles.accessValue, { color: colors.red, flex: 1, textAlign: 'right' }]}
            numberOfLines={2}
          >
            {menage.degradation_note || t('report.reported')}
          </Text>
        </View>
      ) : null}
      {canEdit ? (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2 }}
          onPress={onEdit}
          accessibilityRole="button"
        >
          <Pencil size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>
            {t('report.editDeclaration')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Compo de lits suggérée pour N voyageurs : un double par paire, +1 simple si impair. */
function suggestBeds(travelers: number) {
  const n = Math.max(0, travelers);
  return { n_lit_double: Math.floor(n / 2), n_lit_simple: n % 2, n_canape_lit: 0, n_lit_appoint: 0, n_lit_parapluie: 0 };
}

function BedsSection({
  menage,
  colors,
  isAdmin,
}: {
  menage: Menage;
  colors: typeof Colors.light;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const beds: { field: string; value: number; label: string }[] = [
    { field: 'n_lit_simple', value: menage.n_lit_simple ?? 0, label: t('beds.simple') },
    { field: 'n_lit_double', value: menage.n_lit_double ?? 0, label: t('beds.double') },
    { field: 'n_canape_lit', value: menage.n_canape_lit ?? 0, label: t('beds.sofa') },
    { field: 'n_lit_appoint', value: menage.n_lit_appoint ?? 0, label: t('beds.extra') },
    { field: 'n_lit_parapluie', value: menage.n_lit_parapluie ?? 0, label: t('beds.crib') },
  ];
  const total = beds.reduce((s, b) => s + b.value, 0);
  if (!isAdmin && total === 0 && menage.n_travelers == null) return null;

  return (
    <View style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm }}>
      <View style={{ marginBottom: Spacing.sm }}>
        <Text style={{ color: colors.text2, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 0.5 }}>
          {t('menageDetail.bedsToMake').toUpperCase()}
        </Text>
      </View>

      {/* Voyageurs */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm }}>
        <Text style={{ color: colors.text2, fontSize: FontSize.sm }}>{t('menageDetail.travelersLabel')}</Text>
        <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
          {menage.n_travelers ?? '—'}
        </Text>
      </View>

      {/* 5 types de couchage : on laisse la ligne passer à la ligne plutôt que
          d'écraser les tuiles sur un petit écran. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
        {beds.map((b) => (
          <View
            key={b.field}
            style={{
              flexBasis: '30%',
              flexGrow: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 8,
              paddingVertical: Spacing.sm,
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.bold }}>{b.value}</Text>
            <Text style={{ color: colors.text2, fontSize: 11, marginTop: 2, textAlign: 'center' }}>{b.label}</Text>
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
  const { t } = useTranslation();
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
              {t('pointage.distanceFromProperty', { distance: formatDistance(proof.distance) })}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.mutedText, fontSize: FontSize.xs, marginTop: 4 }}>
            {t('pointage.distanceUnavailable')}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={proofStyles.wrap}>
      <Text style={[proofStyles.title, { color: colors.text2 }]}>{t('pointage.proofTitle').toUpperCase()}</Text>
      <View style={proofStyles.row}>
        {renderProof(buildProof(t('pointage.arrival'), menage.arrival_photo_url, menage.arrival_lat, menage.arrival_lng, menage.arrived_at))}
        {renderProof(buildProof(t('pointage.departure'), menage.departure_photo_url, menage.departure_lat, menage.departure_lng, menage.departed_at))}
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
                {t('pointage.viewOnMap')}
                {lightbox.distance != null
                  ? ` · ${t('pointage.distanceFromProperty', { distance: formatDistance(lightbox.distance) })}`
                  : ''}
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
  const { t } = useTranslation();
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
        title: t('menageDetail.assignAnywayTitle'),
        message: t('menageDetail.assignAnywayBody'),
        confirmLabel: t('menageDetail.assign'),
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
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('menageDetail.failed'),
      });
    }
  };

  const flipStatus = async (userId: string, currentStatus: 'present' | 'absent') => {
    const next = currentStatus === 'present' ? 'absent' : 'present';
    const ok = await dialog.confirm({
      title: next === 'present' ? t('menageDetail.markAvailableTitle') : t('menageDetail.markUnavailableTitle'),
      message: t('menageDetail.flipBody'),
      confirmLabel: t('common.confirm'),
    });
    if (!ok) return;
    try {
      await flipResponse.mutateAsync({ userId, status: next });
    } catch (err) {
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('menageDetail.failed'),
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
          accessibilityLabel={isPresent ? t('menageDetail.markUnavailable') : t('menageDetail.markAvailable')}
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
            {isAssigned ? t('common.remove') : t('menageDetail.assign')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={responsesStyles.wrap}>
      <Text style={[responsesStyles.title, { color: colors.text2 }]}>{t('menageDetail.providerResponses').toUpperCase()}</Text>

      {presents.length > 0 ? (
        <View style={{ gap: Spacing.xs }}>
          <Text style={[responsesStyles.subLabel, { color: GREEN }]}>
            {t('menageDetail.availableCount', { count: presents.length })}
          </Text>
          {presents.map((p) => renderRow(p, 'present'))}
        </View>
      ) : null}

      {absents.length > 0 ? (
        <View style={{ gap: Spacing.xs, marginTop: presents.length > 0 ? Spacing.sm : 0 }}>
          <Text style={[responsesStyles.subLabel, { color: RED }]}>
            {t('menageDetail.unavailableCount', { count: absents.length })}
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
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  typeBadgeText: { fontSize: 11, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
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
  prestataireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  pendingPointage: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 4,
  },
  pendingPointageTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  pendingPointageSub: { fontSize: FontSize.sm },
  recapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  recapLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  recapBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm },
  recapBoxHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recapBoxTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.4 },
  recapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  recapThumb: { width: 72, height: 72, borderRadius: Radius.sm, borderWidth: 1 },
  referentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  referentBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  referentAction: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  referentActionText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
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
  consoAlertSlot: { width: 20, alignItems: 'center' },
  consoUnit: { width: 40, fontSize: FontSize.xs },
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
  accessCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  pointageCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  pointageRow: { flexDirection: 'row', alignItems: 'center' },
  pointageCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pointageIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pointageDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: Spacing.sm },
  pointageLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 0.3 },
  pointageValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginTop: 1 },
  pointageDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pointageDurationText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  accessRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  accessLabel: { fontSize: FontSize.sm, flex: 1 },
  accessValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, letterSpacing: 0.5 },
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
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
