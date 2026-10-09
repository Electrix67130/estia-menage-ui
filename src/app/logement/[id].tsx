import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useDialog } from '@/contexts/DialogContext';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Trash2, MapPin, Camera, Plus, DoorOpen, Image as ImageIcon, Trash, RotateCcw } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLogement, useDeleteLogement, useUpdateLogement, useUnarchiveLogement } from '@/api/hooks/useLogements';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';
import { useLogementMembers } from '@/api/hooks/useLogementMembers';
import { useAuth } from '@/contexts/AuthContext';
import SheetHandle from '@/components/SheetHandle';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import CheckTemplateEditor from '@/components/CheckTemplateEditor';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import LogementMembersSection from '@/components/LogementMembersSection';
import LogementNotificationSection from '@/components/LogementNotificationSection';
import LogementInfoForm from '@/components/LogementInfoForm';
import LogementClientSection from '@/components/LogementClientSection';
import LogementExternalCalendarsSection from '@/components/LogementExternalCalendarsSection';
import LogementEquipementsSection from '@/components/LogementEquipementsSection';
import LogementCodesSection from '@/components/LogementCodesSection';
import LogementOptionsSection from '@/components/LogementOptionsSection';
import ImageView from 'react-native-image-viewing';
import { useLogementPhotos } from '@/api/hooks/usePhotos';
import { openMaps } from '@/lib/contact-links';
import { formatQtyUnit } from '@/lib/unit-fr';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';
import {
  useLogementRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  type LogementRoom,
  type RoomKind,
} from '@/api/hooks/useLogementRooms';
import {
  useLogementConsommables,
  useCreateConsommable,
  useUpdateConsommable,
  useDeleteConsommable,
  useSetConsommableStock,
  type ConsommableLine,
} from '@/api/hooks/useConsommables';

/** Types de pièce sélectionnables (piscine/jacuzzi gérés via les équipements du logement). */
const ROOM_KINDS: { value: RoomKind; labelKey: TranslationKeys }[] = [
  { value: 'chambre', labelKey: 'logement.roomKind.chambre' },
  { value: 'salle_de_bain', labelKey: 'logement.roomKind.salle_de_bain' },
  { value: 'wc', labelKey: 'logement.roomKind.wc' },
  { value: 'cuisine', labelKey: 'logement.roomKind.cuisine' },
  { value: 'salon', labelKey: 'logement.roomKind.salon' },
  { value: 'salle_a_manger', labelKey: 'logement.roomKind.salle_a_manger' },
  { value: 'bureau', labelKey: 'logement.roomKind.bureau' },
  { value: 'entree', labelKey: 'logement.roomKind.entree' },
  { value: 'couloir', labelKey: 'logement.roomKind.couloir' },
  { value: 'exterieur', labelKey: 'logement.roomKind.exterieur' },
  { value: 'cave', labelKey: 'logement.roomKind.cave' },
  { value: 'buanderie', labelKey: 'logement.roomKind.buanderie' },
  { value: 'autre', labelKey: 'logement.roomKind.autre' },
];

export default function LogementDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, tp } = useTranslation();
  const { data: logement, isLoading } = useLogement(id);
  const deleteMutation = useDeleteLogement();
  const unarchiveMutation = useUnarchiveLogement();
  const updateMutation = useUpdateLogement();
  const [coverUploading, setCoverUploading] = useState(false);

  const handlePickCover = async () => {
    if (!logement) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setCoverUploading(true);
    try {
      const asset = result.assets[0];
      const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
      const uploaded = await uploadFile(
        optimized.uri,
        `logement-cover-${logement.id}.jpg`,
        'image/jpeg',
      );
      await updateMutation.mutateAsync({
        id: logement.id,
        body: {
          cover_photo_url: uploaded.url,
          cover_photo_thumbnail_url: uploaded.thumbnail_url ?? uploaded.url,
        },
      });
    } catch (err) {
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('logement.uploadFailed') });
    } finally {
      setCoverUploading(false);
    }
  };
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const dialog = useDialog();

  // Modal création/édition d'une pièce. `null` = fermé, '' = création,
  // sinon room en cours d'édition.
  const [roomModal, setRoomModal] = useState<{ mode: 'create' } | { mode: 'edit'; room: LogementRoom } | null>(null);

  // Récupère mes permissions sur ce logement (si je suis membre).
  // Admin = voit tout, sans dépendre d'une row membre. Sinon, on lit les flags
  // de ma row pour décider quelles sections afficher.
  const members = useLogementMembers(id);
  const myMember = useMemo(
    () => (user ? (members.data?.data ?? []).find((m) => m.user_id === user.id) : undefined),
    [members.data, user],
  );
  const canViewPrestataires = isAdmin || !!myMember?.can_view_prestataires;
  const canViewClients = isAdmin || !!myMember?.can_view_clients;

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: t('logement.archiveConfirmTitle'),
      message: t('logement.archiveConfirmBody'),
      confirmLabel: t('menage.archive'),
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await deleteMutation.mutateAsync(id!);
      const n = res?.archived_menages ?? 0;
      void dialog.alert({
        title: t('logement.archivedTitle'),
        message: n > 0 ? tp('logement.archivedWithMenages', n) : t('logement.archivedBody'),
      });
      router.back();
    } catch (err) {
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('logement.archiveFailed'),
      });
    }
  };

  const handleUnarchive = async () => {
    const ok = await dialog.confirm({
      title: t('logement.unarchiveConfirmTitle'),
      message: t('logement.unarchiveConfirmBody'),
      confirmLabel: t('logement.restore'),
    });
    if (!ok) return;
    try {
      const res = await unarchiveMutation.mutateAsync(id!);
      const n = res?.unarchived_menages ?? 0;
      void dialog.alert({
        title: t('logement.restoredTitle'),
        message: n > 0 ? tp('logement.restoredWithMenages', n) : t('logement.restoredBody'),
      });
    } catch (err) {
      void dialog.alert({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('logement.unarchiveFailed'),
      });
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

  if (!logement) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loading}>
          <Text style={{ color: colors.mutedText }}>{t('logement.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {logement.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
          {isAdmin ? (
            logement.archived_at ? (
              <TouchableOpacity
                onPress={handleUnarchive}
                accessibilityLabel={t('logement.restoreA11y')}
                style={[styles.headerCta, { backgroundColor: colors.primary }]}
                disabled={unarchiveMutation.isPending}
              >
                <RotateCcw size={IconSize.sm} color="#FFFFFF" />
                <Text style={styles.headerCtaText}>{t('logement.restore')}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => router.push(`/menage/create?logement_id=${id}`)}
                  accessibilityLabel={t('menage.create')}
                  style={[styles.headerCta, { backgroundColor: colors.primary }]}
                >
                  <Plus size={IconSize.sm} color="#FFFFFF" />
                  <Text style={styles.headerCtaText}>{t('prestationType.menage')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} accessibilityLabel={t('menage.archive')}>
                  <Trash2 size={IconSize.md} color={colors.red} />
                </TouchableOpacity>
              </>
            )
          ) : null}
        </View>
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.body}>
        {logement.cover_photo_url || isAdmin ? (
          <TouchableOpacity
            style={[styles.cover, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
            onPress={isAdmin ? handlePickCover : undefined}
            disabled={!isAdmin || coverUploading}
            activeOpacity={isAdmin ? 0.7 : 1}
          >
            {logement.cover_photo_url ? (
              <Image source={{ uri: logement.cover_photo_url }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Camera size={IconSize.xl} color={colors.text2} />
                <Text style={{ color: colors.text2, fontSize: FontSize.sm }}>
                  {t('logement.addCoverPhoto')}
                </Text>
              </View>
            )}
            {coverUploading ? (
              <View style={styles.coverOverlay}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
            {isAdmin && logement.cover_photo_url && !coverUploading ? (
              <View style={[styles.coverEditBadge, { backgroundColor: colors.primary }]}>
                <Camera size={IconSize.sm} color="#FFFFFF" />
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}

        {logement.address || logement.city ? (
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() =>
              openMaps(
                [logement.address, [logement.postal_code, logement.city].filter(Boolean).join(' ')]
                  .filter(Boolean)
                  .join(', '),
              )
            }
            activeOpacity={0.7}
          >
            <MapPin size={IconSize.md} color={colors.primary} />
            <Text style={[styles.address, { color: colors.text }]}>
              {[logement.address, [logement.postal_code, logement.city].filter(Boolean).join(' ')]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {isAdmin ? <LogementInfoForm logementId={logement.id} /> : null}

        {!logement.archived_at ? <LogementNotificationSection logementId={logement.id} /> : null}

        <Text style={[styles.section, { color: colors.text2 }]}>{t('logement.rooms.section').toUpperCase()}</Text>
        <RoomsSection
          logementId={logement.id}
          isAdmin={isAdmin}
          onAdd={() => setRoomModal({ mode: 'create' })}
          onEdit={(room) => setRoomModal({ mode: 'edit', room })}
        />

        <LogementEquipementsSection logementId={logement.id} isAdmin={isAdmin} />

        <LogementOptionsSection logementId={logement.id} isAdmin={isAdmin} />

        {isAdmin ? (
          <>
            <Text style={[styles.section, { color: colors.text2 }]}>{t('consommables.section').toUpperCase()}</Text>
            <ConsommablesSection logementId={logement.id} />
          </>
        ) : null}

        {/* Codes d'accès : édition admin, lecture pour les membres du logement. */}
        {isAdmin || myMember ? (
          <LogementCodesSection logementId={logement.id} isAdmin={isAdmin} />
        ) : null}

        {!isAdmin && logement.notes ? (
          <>
            <Text style={[styles.section, { color: colors.text2 }]}>{t('logement.sectionNotes').toUpperCase()}</Text>
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>{logement.notes}</Text>
            </View>
          </>
        ) : null}

        {canViewClients && !isAdmin ? (
          <LogementClientSection
            logementId={logement.id}
            currentClientId={logement.client_id}
            isAdmin={isAdmin}
          />
        ) : null}

        {canViewPrestataires ? (
          <LogementMembersSection logementId={logement.id} isAdmin={isAdmin} role="prestataire" />
        ) : null}

        <Text style={[styles.section, { color: colors.text2 }]}>{t('logement.sectionChecklist').toUpperCase()}</Text>
        <CheckTemplateEditor logementId={logement.id} isAdmin={isAdmin} />

        {isAdmin ? <LogementExternalCalendarsSection logementId={logement.id} /> : null}
      </KeyboardAwareScroll>

      {isAdmin && roomModal ? (
        <RoomEditModal
          logementId={logement.id}
          room={roomModal.mode === 'edit' ? roomModal.room : null}
          onClose={() => setRoomModal(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * Liste les pièces du logement sous forme de cartes (photo de couverture +
 * nom). Tap sur une carte (admin) ouvre l'édition. Un bouton "+ Ajouter une
 * pièce" est affiché aux admins.
 */
function RoomsSection({
  logementId,
  isAdmin,
  onAdd,
  onEdit,
}: {
  logementId: string;
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (room: LogementRoom) => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const rooms = useLogementRooms(logementId);
  const list = rooms.data ?? [];

  // Photos de galerie du logement (ajoutées côté dashboard), groupées par pièce.
  const photos = useLogementPhotos(logementId);
  const photosByRoom = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of photos.data?.data ?? []) {
      if (!p.logement_room_id) continue;
      const arr = map.get(p.logement_room_id) ?? [];
      arr.push(p.url);
      map.set(p.logement_room_id, arr);
    }
    return map;
  }, [photos.data]);

  // Visionneuse plein écran : liste d'URLs + index courant.
  const [viewer, setViewer] = React.useState<{ urls: string[]; index: number } | null>(null);

  if (rooms.isLoading) {
    return (
      <View
        style={[styles.roomsEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      {list.length === 0 ? (
        <View
          style={[styles.roomsEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={{ color: colors.mutedText, textAlign: 'center' }}>
            {isAdmin ? t('logement.roomsEmptyAdmin') : t('logement.roomsEmpty')}
          </Text>
        </View>
      ) : (
        <View style={styles.roomsGrid}>
          {list.map((room) => {
            // Toutes les photos de la pièce : couverture (photo_url) + galerie.
            const gallery = photosByRoom.get(room.id) ?? [];
            const urls = [room.photo_url, ...gallery].filter(Boolean) as string[];
            const thumb = urls[0] ?? null;
            // Admin → éditeur ; sinon → visionneuse (si photos).
            const onPress = isAdmin
              ? () => onEdit(room)
              : urls.length
                ? () => setViewer({ urls, index: 0 })
                : undefined;
            return (
              <TouchableOpacity
                key={room.id}
                style={[styles.roomCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={onPress}
                disabled={!onPress}
                activeOpacity={onPress ? 0.7 : 1}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.roomThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.roomThumb, styles.roomThumbPlaceholder, { backgroundColor: colors.itemBackground }]}>
                    <DoorOpen size={IconSize.lg} color={colors.text2} />
                  </View>
                )}
                {urls.length > 1 ? (
                  <View style={styles.roomPhotoCount}>
                    <ImageIcon size={11} color="#FFFFFF" />
                    <Text style={styles.roomPhotoCountText}>{urls.length}</Text>
                  </View>
                ) : null}
                <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>
                  {room.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isAdmin ? (
        <TouchableOpacity
          style={[styles.addRoomBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('logement.addRoom')}
        >
          <Plus size={IconSize.sm} color={colors.primary} />
          <Text style={[styles.addRoomText, { color: colors.primary }]}>{t('logement.addRoom')}</Text>
        </TouchableOpacity>
      ) : null}

      <ImageView
        images={viewer ? viewer.urls.map((uri) => ({ uri })) : []}
        imageIndex={viewer?.index ?? 0}
        visible={!!viewer}
        onRequestClose={() => setViewer(null)}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
      />
    </View>
  );
}

/**
 * Modal bottom-sheet de création / édition d'une pièce : nom libre + photo de
 * couverture optionnelle (sélection depuis la galerie, optimisation, upload).
 */
function RoomEditModal({
  logementId,
  room,
  onClose,
}: {
  logementId: string;
  room: LogementRoom | null;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { t } = useTranslation();
  const createRoom = useCreateRoom(logementId);
  const updateRoom = useUpdateRoom(logementId);
  const deleteRoom = useDeleteRoom(logementId);

  const [kind, setKind] = useState<RoomKind | ''>(room?.kind ?? '');
  const [name, setName] = useState(room?.name ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(room?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);

  const modalStyle = useKeyboardAwareModalStyle({ visible: true });
  const swipe = useSwipeToClose(onClose, true);

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
      const uploaded = await uploadFile(
        optimized.uri,
        `room-${room?.id ?? Date.now()}.jpg`,
        'image/jpeg',
      );
      setPhotoUrl(uploaded.url);
    } catch (err) {
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('logement.uploadFailed') });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!kind) {
      void dialog.alert({ title: t('logement.roomTypeRequiredTitle'), message: t('logement.roomTypeRequiredBody') });
      return;
    }
    if (kind === 'autre' && !name.trim()) {
      void dialog.alert({ title: t('logement.roomNameRequiredTitle'), message: t('logement.roomNameRequiredBody') });
      return;
    }
    // On retire un éventuel token de signature (`?t=...`) de l'URL avant de la
    // persister : `photoUrl` peut venir de `room.photo_url` déjà signé (si on
    // édite sans changer la photo). Stocker l'URL propre évite le double-signage.
    const cleanPhotoUrl = photoUrl ? photoUrl.split('?')[0] : photoUrl;
    // Le nom n'est envoyé que pour « autre » ; sinon l'API le génère depuis le type.
    const body = { kind, name: kind === 'autre' ? name.trim() : undefined, photo_url: cleanPhotoUrl };
    try {
      if (room) {
        await updateRoom.mutateAsync({ id: room.id, body });
      } else {
        await createRoom.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('common.saveFailed') });
    }
  };

  const handleDelete = async () => {
    if (!room) return;
    const ok = await dialog.confirm({
      title: t('logement.deleteRoomTitle'),
      message: t('logement.deleteRoomBody', { name: room.name }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteRoom.mutateAsync(room.id);
      onClose();
    } catch (err) {
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('common.deleteFailed') });
    }
  };

  const saving = createRoom.isPending || updateRoom.isPending;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.modal,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
            modalStyle,
            swipe.animatedStyle,
          ]}
        >
          <SheetHandle gesture={swipe.gesture} />
          <Text style={[styles.modalTitle, { color: colors.text, marginBottom: Spacing.sm }]}>
            {room ? t('logement.editRoom') : t('logement.newRoom')}
          </Text>

          <Text style={[styles.modalLabel, { color: colors.text2 }]}>{t('logement.roomType')}</Text>
          <View style={styles.kindWrap}>
            {ROOM_KINDS.map((k) => {
              const active = kind === k.value;
              return (
                <TouchableOpacity
                  key={k.value}
                  style={[
                    styles.kindChip,
                    { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.itemBackground },
                  ]}
                  onPress={() => setKind(k.value)}
                  accessibilityRole="button"
                  accessibilityLabel={t('logement.roomTypeA11y', { type: t(k.labelKey) })}
                >
                  <Text style={{ color: active ? '#FFFFFF' : colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium }}>
                    {t(k.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {kind === 'autre' ? (
            <>
              <Text style={[styles.modalLabel, { color: colors.text2 }]}>{t('logement.roomName')}</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground }]}
                value={name}
                onChangeText={setName}
                placeholder={t('logement.roomNamePlaceholder')}
                placeholderTextColor={colors.placeholder}
              />
            </>
          ) : null}

          <Text style={[styles.modalLabel, { color: colors.text2 }]}>{t('logement.coverPhoto')}</Text>
          <TouchableOpacity
            style={[styles.coverPicker, { borderColor: colors.border, backgroundColor: colors.itemBackground }]}
            onPress={handlePickPhoto}
            disabled={uploading}
            activeOpacity={0.7}
          >
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.coverPreview} resizeMode="cover" />
            ) : (
              <View style={styles.coverPickerPlaceholder}>
                <ImageIcon size={IconSize.lg} color={colors.text2} />
                <Text style={{ color: colors.text2, fontSize: FontSize.sm }}>{t('logement.choosePhoto')}</Text>
              </View>
            )}
            {uploading ? (
              <View style={styles.coverPickerOverlay}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </TouchableOpacity>
          {photoUrl && !uploading ? (
            <TouchableOpacity onPress={() => setPhotoUrl(null)} accessibilityLabel={t('logement.removePhoto')}>
              <Text style={{ color: colors.red, fontSize: FontSize.sm, textAlign: 'center' }}>{t('logement.removePhoto')}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.modalSubmit, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving || uploading}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.modalSubmitText}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>

          {room ? (
            <TouchableOpacity
              style={[styles.modalDelete, { borderColor: colors.red }]}
              onPress={handleDelete}
              disabled={deleteRoom.isPending}
            >
              <Trash size={IconSize.sm} color={colors.red} />
              <Text style={{ color: colors.red, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
                {t('logement.deleteRoom')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ConsommablesSection({ logementId }: { logementId: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { data, isLoading } = useLogementConsommables(logementId);
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; item: ConsommableLine } | null>(null);
  const list = data ?? [];

  if (isLoading) {
    return (
      <View style={[styles.roomsEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      {list.map((c) => {
        const badge =
          c.qty === null
            ? { text: t('consommables.neverCounted'), color: colors.text2 }
            : c.needs_restock
              ? { text: t('consommables.restock', { qty: formatQtyUnit(c.qty, c.unit) }), color: colors.red }
              : { text: formatQtyUnit(c.qty, c.unit), color: colors.primary };
        return (
          <TouchableOpacity
            key={c.logement_consommable_id}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setModal({ mode: 'edit', item: c })}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.medium }}>{c.label}</Text>
              <Text style={{ color: colors.text2, fontSize: FontSize.sm }}>
                {t('consommables.threshold', { qty: formatQtyUnit(c.seuil_alerte, c.unit) })}
              </Text>
            </View>
            <Text style={{ color: badge.color, fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>{badge.text}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        style={[styles.addRoomBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
        onPress={() => setModal({ mode: 'create' })}
      >
        <Plus size={IconSize.sm} color={colors.primary} />
        <Text style={[styles.addRoomText, { color: colors.primary }]}>{t('consommables.add')}</Text>
      </TouchableOpacity>

      {modal ? (
        <ConsommableEditModal
          logementId={logementId}
          item={modal.mode === 'edit' ? modal.item : null}
          onClose={() => setModal(null)}
        />
      ) : null}
    </View>
  );
}

function ConsommableEditModal({
  logementId,
  item,
  onClose,
}: {
  logementId: string;
  item: ConsommableLine | null;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { t } = useTranslation();
  const create = useCreateConsommable(logementId);
  const update = useUpdateConsommable(logementId);
  const remove = useDeleteConsommable(logementId);
  const setStock = useSetConsommableStock(logementId);

  const [label, setLabel] = useState(item?.label ?? '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [seuil, setSeuil] = useState(String(item?.seuil_alerte ?? 1));
  const [qty, setQty] = useState(item && item.qty !== null ? String(item.qty) : '');

  const modalStyle = useKeyboardAwareModalStyle({ visible: true });
  const swipe = useSwipeToClose(onClose, true);

  const saving = create.isPending || update.isPending || setStock.isPending;

  const handleSave = async () => {
    if (!label.trim()) {
      void dialog.alert({ title: t('consommables.nameRequiredTitle'), message: t('consommables.nameRequiredBody') });
      return;
    }
    const seuilNum = parseInt(seuil, 10);
    if (Number.isNaN(seuilNum) || seuilNum < 0) {
      void dialog.alert({ title: t('consommables.thresholdInvalidTitle'), message: t('consommables.thresholdInvalidBody') });
      return;
    }
    const body = { label: label.trim(), unit: unit.trim() || null, seuil_alerte: seuilNum };
    try {
      if (item) {
        await update.mutateAsync({ id: item.logement_consommable_id, body });
        // Stock : maj seulement si la valeur a changé et est valide.
        const original = item.qty === null ? '' : String(item.qty);
        if (qty.trim() !== original) {
          const qtyNum = parseInt(qty, 10);
          if (!Number.isNaN(qtyNum) && qtyNum >= 0) {
            await setStock.mutateAsync({ id: item.logement_consommable_id, qty: qtyNum });
          }
        }
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('common.saveFailed') });
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    const ok = await dialog.confirm({
      title: t('consommables.deleteTitle'),
      message: t('consommables.deleteBody', { name: item.label }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(item.logement_consommable_id);
      onClose();
    } catch (err) {
      void dialog.alert({ title: t('common.error'), message: err instanceof Error ? err.message : t('common.deleteFailed') });
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.modal,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
            modalStyle,
            swipe.animatedStyle,
          ]}
        >
          <SheetHandle gesture={swipe.gesture} />
          <Text style={[styles.modalTitle, { color: colors.text, marginBottom: Spacing.sm }]}>
            {item ? t('consommables.edit') : t('consommables.new')}
          </Text>

          <Text style={[styles.modalLabel, { color: colors.text2 }]}>{t('consommables.name')}</Text>
          <TextInput
            style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground }]}
            value={label}
            onChangeText={setLabel}
            placeholder={t('consommables.namePlaceholder')}
            placeholderTextColor={colors.placeholder}
          />

          <Text style={[styles.modalLabel, { color: colors.text2 }]}>{t('consommables.unit')}</Text>
          <TextInput
            style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground }]}
            value={unit}
            onChangeText={setUnit}
            placeholder={t('consommables.unitPlaceholder')}
            placeholderTextColor={colors.placeholder}
          />

          <Text style={[styles.modalLabel, { color: colors.text2 }]}>{t('consommables.alertThreshold')}</Text>
          <TextInput
            style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground }]}
            value={seuil}
            onChangeText={setSeuil}
            placeholder="1"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
          />

          {item ? (
            <>
              <Text style={[styles.modalLabel, { color: colors.text2 }]}>{t('consommables.currentStock')}</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground }]}
                value={qty}
                onChangeText={setQty}
                placeholder={item.qty === null ? t('consommables.initStock') : '0'}
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
              />
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.modalSubmit, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalSubmitText}>{t('common.save')}</Text>}
          </TouchableOpacity>

          {item ? (
            <TouchableOpacity
              style={[styles.modalDelete, { borderColor: colors.red }]}
              onPress={handleDelete}
              disabled={remove.isPending}
            >
              <Trash size={IconSize.sm} color={colors.red} />
              <Text style={{ color: colors.red, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
                {t('consommables.delete')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  address: { flex: 1, fontSize: FontSize.md },
  section: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginTop: Spacing.md },
  roomsEmpty: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  roomCard: {
    width: '48%',
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  kindWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  kindChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, borderWidth: 1 },
  roomThumb: { width: '100%', aspectRatio: 16 / 9 },
  roomThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  roomPhotoCount: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  roomPhotoCountText: { fontSize: 10, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  roomName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, paddingHorizontal: Spacing.sm },
  addRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addRoomText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  modalLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginTop: Spacing.sm },
  modalInput: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, fontSize: FontSize.md },
  coverPicker: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  coverPreview: { width: '100%', height: '100%' },
  coverPickerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  coverPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  modalSubmitText: { color: '#FFFFFF', fontWeight: FontWeight.semibold, fontSize: FontSize.md },
  modalDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEditBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  headerCtaText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
