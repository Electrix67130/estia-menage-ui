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
import { GestureDetector } from 'react-native-gesture-handler';
import { useDialog } from '@/contexts/DialogContext';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Pencil, Trash2, MapPin, Camera, Plus, DoorOpen, Image as ImageIcon, Trash } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLogement, useDeleteLogement, useUpdateLogement } from '@/api/hooks/useLogements';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';
import { useLogementMembers } from '@/api/hooks/useLogementMembers';
import SecretCodeField from '@/components/SecretCodeField';
import { useAuth } from '@/contexts/AuthContext';
import SheetHandle from '@/components/SheetHandle';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import CheckTemplateEditor from '@/components/CheckTemplateEditor';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import LogementMembersSection from '@/components/LogementMembersSection';
import LogementClientSection from '@/components/LogementClientSection';
import LogementExternalCalendarsSection from '@/components/LogementExternalCalendarsSection';
import { openMaps } from '@/lib/contact-links';
import {
  useLogementRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  type LogementRoom,
} from '@/api/hooks/useLogementRooms';

export default function LogementDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: logement, isLoading } = useLogement(id);
  const deleteMutation = useDeleteLogement();
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
        body: { cover_photo_url: uploaded.url },
      });
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Upload impossible' });
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
  const canViewResponsables = isAdmin || !!myMember?.can_view_responsables;
  const canViewClients = isAdmin || !!myMember?.can_view_clients;

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: 'Supprimer le logement ?',
      message: 'Tous les ménages associés seront aussi supprimés.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(id!);
      router.back();
    } catch (err) {
      void dialog.alert({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Suppression impossible',
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
          <Text style={{ color: colors.mutedText }}>Logement introuvable</Text>
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
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {logement.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
          {isAdmin ? (
            <>
              <TouchableOpacity
                onPress={() => router.push(`/menage/create?logement_id=${id}`)}
                accessibilityLabel="Nouveau ménage"
                style={[styles.headerCta, { backgroundColor: colors.primary }]}
              >
                <Plus size={IconSize.sm} color="#FFFFFF" />
                <Text style={styles.headerCtaText}>Ménage</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/logement/edit/${id}`)} accessibilityLabel="Éditer">
                <Pencil size={IconSize.md} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} accessibilityLabel="Supprimer">
                <Trash2 size={IconSize.md} color={colors.red} />
              </TouchableOpacity>
            </>
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
                  Ajouter une photo de couverture
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

        <Text style={[styles.section, { color: colors.text2 }]}>PIÈCES</Text>
        <RoomsSection
          logementId={logement.id}
          isAdmin={isAdmin}
          onAdd={() => setRoomModal({ mode: 'create' })}
          onEdit={(room) => setRoomModal({ mode: 'edit', room })}
        />

        {logement.key_safe_code && (isAdmin || !!myMember) ? (
          <>
            <Text style={[styles.section, { color: colors.text2 }]}>CODE BOÎTE À CLEF</Text>
            <SecretCodeField value={logement.key_safe_code} onChangeText={() => {}} readonly />
          </>
        ) : null}

        {logement.notes ? (
          <>
            <Text style={[styles.section, { color: colors.text2 }]}>NOTES</Text>
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>{logement.notes}</Text>
            </View>
          </>
        ) : null}

        {canViewClients ? (
          <LogementClientSection
            logementId={logement.id}
            currentClientId={logement.client_id}
            isAdmin={isAdmin}
          />
        ) : null}

        {canViewResponsables ? (
          <LogementMembersSection logementId={logement.id} isAdmin={isAdmin} role="manager" />
        ) : null}

        {canViewPrestataires ? (
          <LogementMembersSection logementId={logement.id} isAdmin={isAdmin} role="prestataire" />
        ) : null}

        <Text style={[styles.section, { color: colors.text2 }]}>CHECKLIST PERSONNALISÉE</Text>
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
  const rooms = useLogementRooms(logementId);
  const list = rooms.data ?? [];

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
            {isAdmin ? 'Aucune pièce. Ajoute-en une.' : 'Aucune pièce.'}
          </Text>
        </View>
      ) : (
        <View style={styles.roomsGrid}>
          {list.map((room) => (
            <TouchableOpacity
              key={room.id}
              style={[styles.roomCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={isAdmin ? () => onEdit(room) : undefined}
              disabled={!isAdmin}
              activeOpacity={isAdmin ? 0.7 : 1}
            >
              {room.photo_url ? (
                <Image source={{ uri: room.photo_url }} style={styles.roomThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.roomThumb, styles.roomThumbPlaceholder, { backgroundColor: colors.itemBackground }]}>
                  <DoorOpen size={IconSize.lg} color={colors.text2} />
                </View>
              )}
              <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>
                {room.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isAdmin ? (
        <TouchableOpacity
          style={[styles.addRoomBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Ajouter une pièce"
        >
          <Plus size={IconSize.sm} color={colors.primary} />
          <Text style={[styles.addRoomText, { color: colors.primary }]}>Ajouter une pièce</Text>
        </TouchableOpacity>
      ) : null}
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
  const createRoom = useCreateRoom(logementId);
  const updateRoom = useUpdateRoom(logementId);
  const deleteRoom = useDeleteRoom(logementId);

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
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Upload impossible' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      void dialog.alert({ title: 'Nom requis', message: 'Donne un nom à la pièce.' });
      return;
    }
    try {
      if (room) {
        await updateRoom.mutateAsync({ id: room.id, body: { name: name.trim(), photo_url: photoUrl } });
      } else {
        await createRoom.mutateAsync({ name: name.trim(), photo_url: photoUrl });
      }
      onClose();
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Enregistrement impossible' });
    }
  };

  const handleDelete = async () => {
    if (!room) return;
    const ok = await dialog.confirm({
      title: 'Supprimer la pièce ?',
      message: `« ${room.name} » sera supprimée.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteRoom.mutateAsync(room.id);
      onClose();
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Suppression impossible' });
    }
  };

  const saving = createRoom.isPending || updateRoom.isPending;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
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
            {room ? 'Modifier la pièce' : 'Nouvelle pièce'}
          </Text>

          <Text style={[styles.modalLabel, { color: colors.text2 }]}>Nom de la pièce</Text>
          <TextInput
            style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.itemBackground }]}
            value={name}
            onChangeText={setName}
            placeholder="Ex. Chambre parentale"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={[styles.modalLabel, { color: colors.text2 }]}>Photo de couverture</Text>
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
                <Text style={{ color: colors.text2, fontSize: FontSize.sm }}>Choisir une photo</Text>
              </View>
            )}
            {uploading ? (
              <View style={styles.coverPickerOverlay}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </TouchableOpacity>
          {photoUrl && !uploading ? (
            <TouchableOpacity onPress={() => setPhotoUrl(null)} accessibilityLabel="Retirer la photo">
              <Text style={{ color: colors.red, fontSize: FontSize.sm, textAlign: 'center' }}>Retirer la photo</Text>
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
              <Text style={styles.modalSubmitText}>Enregistrer</Text>
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
                Supprimer la pièce
              </Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </View>
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
  roomThumb: { width: '100%', aspectRatio: 16 / 9 },
  roomThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
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
