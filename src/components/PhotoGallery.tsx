import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet, Dimensions, RefreshControl, Modal, ScrollView } from 'react-native';
import { Camera, ImagePlus, Trash2, Share2, X } from 'lucide-react-native';
import ImageView from 'react-native-image-viewing';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePhotos, useLogementPhotos, useCreatePhoto, useDeletePhoto } from '@/api/hooks/usePhotos';
import { useMenageCheck } from '@/api/hooks/useMenageCheck';
import { SECTION_ICONS } from '@/components/MenageCheckList';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';
import { shareFile } from '@/utils/shareFile';
import { getSignedFileUrl } from '@/api/fileAccess';
import type { Photo } from '@/api/types';
import { formatDateFr } from '@/lib/date-fr';
import { useDialog } from '@/contexts/DialogContext';

const COLUMN_COUNT = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_GAP = Spacing.xs;
const ITEM_SIZE = (SCREEN_WIDTH - Spacing.lg * 2 - ITEM_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

interface Props {
  /** Photos d'un ménage. Mutuellement exclusif avec logementId. */
  menageId?: string;
  /** Photos d'un logement (fiche logement). Mutuellement exclusif avec menageId. */
  logementId?: string;
  /** Optionnel : filtrer/rattacher aux photos d'une pièce du logement (1 seule pièce). */
  logementRoomId?: string;
  /**
   * Mode "multi-pièces" : la galerie agrège les photos de plusieurs pièces du
   * même kind (ex : toutes les chambres). L'admin a UN seul bouton d'upload ;
   * au tap on demande à quelle pièce attacher la photo via une modal.
   * Mutuellement exclusif avec `logementRoomId`.
   */
  rooms?: { id: string; name: string }[];
  readonly?: boolean;
  /** Si true, rend les photos en grille statique (View map) au lieu d'une FlatList — à utiliser quand le composant est imbriqué dans une ScrollView parente. */
  nested?: boolean;
}

const PhotoGallery: React.FC<Props> = ({ menageId, logementId, logementRoomId, rooms, readonly, nested }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const dialog = useDialog();

  const menagePhotos = usePhotos(menageId);
  // En mode multi-rooms, on fetch toutes les photos du logement (sans filter
  // par room_id) puis on filtre côté client aux rooms du kind.
  const isMultiRooms = !!rooms && rooms.length > 0;
  const logementPhotos = useLogementPhotos(logementId, isMultiRooms ? undefined : logementRoomId);
  const { data: rawData, isLoading, refetch, isRefetching } = menageId ? menagePhotos : logementPhotos;
  const data = useMemo(() => {
    if (!isMultiRooms || !rawData) return rawData;
    const allowed = new Set(rooms!.map((r) => r.id));
    return {
      ...rawData,
      data: rawData.data.filter((p) => p.logement_room_id && allowed.has(p.logement_room_id)),
    };
  }, [isMultiRooms, rooms, rawData]);

  // Mode ménage : pièces = sections de la checklist. Le sélecteur sert à la
  // fois de filtre d'affichage et de cible d'upload (section_id).
  const { data: checkTree } = useMenageCheck(menageId);
  const sections = useMemo(() => checkTree ?? [], [checkTree]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const [roomPickerOpen, setRoomPickerOpen] = useState<null | 'camera' | 'gallery'>(null);
  const createMutation = useCreatePhoto();
  const deleteMutation = useDeletePhoto();
  const [selectedPhoto, setSelectedPhoto] = useState<(Photo & { first_name: string; last_name: string }) | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  const pickImage = useCallback(async (useCamera: boolean, roomIdOverride?: string) => {
    try {
      // iOS : launchCameraAsync requiert AUSSI MediaLibrary pour sauvegarder la photo.
      if (useCamera) {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
          void dialog.alert({ title: 'Caméra refusée', message: 'Autorise la caméra dans les réglages.' });
          return;
        }
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
          void dialog.alert({ title: 'Galerie refusée', message: 'Autorise l\'accès aux photos dans les réglages.' });
          return;
        }
      } else {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
          void dialog.alert({ title: 'Galerie refusée', message: 'Autorise l\'accès aux photos dans les réglages.' });
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
        const fileName = `photo-${Date.now()}.jpg`;
        const uploaded = await uploadFile(optimized.uri, fileName, optimized.mimeType);
        await createMutation.mutateAsync({
          menage_id: menageId,
          // Rattache la photo à la pièce sélectionnée (section de checklist).
          // « Toutes » (null) => photo non classée.
          section_id: menageId ? (selectedSectionId ?? undefined) : undefined,
          logement_id: menageId ? undefined : logementId,
          logement_room_id: menageId
            ? undefined
            : (roomIdOverride ?? logementRoomId),
          url: uploaded.url,
          file_size: uploaded.file_size,
          mime_type: uploaded.mime_type,
          taken_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      void dialog.alert({ title: 'Erreur', message: err instanceof Error ? err.message : 'Échec' });
    }
  }, [menageId, logementId, logementRoomId, selectedSectionId, createMutation, dialog]);

  /**
   * Entrée d'upload : en mode multi-rooms, on ouvre d'abord la modal "quelle
   * pièce ?", puis on lance la caméra/galerie une fois la pièce choisie.
   * Sinon (mode single room / menage), on lance directement.
   */
  const handleAdd = useCallback(
    (useCamera: boolean) => {
      if (isMultiRooms) {
        setRoomPickerOpen(useCamera ? 'camera' : 'gallery');
        return;
      }
      void pickImage(useCamera);
    },
    [isMultiRooms, pickImage],
  );

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id);
    if (selectedPhoto?.id === id) setSelectedPhoto(null);
  }, [deleteMutation, selectedPhoto]);

  const renderItem = useCallback(
    ({ item }: { item: Photo & { first_name: string; last_name: string } }) => (
      <View style={[styles.photoItem, { backgroundColor: colors.itemBackground }]}>
        <TouchableOpacity
          onPress={() => setSelectedPhoto(item)}
          onLongPress={() => setSelectedPhoto(item)}
          delayLongPress={200}
          activeOpacity={0.8}
          accessibilityRole="image"
          accessibilityLabel={item.caption || 'Photo de menage'}
        >
          <Image source={{ uri: item.thumbnail_url || item.url }} style={styles.photoImage} />
          {/* Horodatage de prise, incrusté en bas de la vignette */}
          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeText} numberOfLines={1}>
              {formatDateFr(item.taken_at, 'dayShortTime')}
            </Text>
          </View>
        </TouchableOpacity>
        {!readonly && (
          <TouchableOpacity
            style={styles.deleteIcon}
            onPress={() => handleDelete(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Supprimer la photo"
          >
            <View style={styles.deleteIconBg}>
              <Trash2 size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    ),
    [colors, handleDelete],
  );

  // Sélecteur de pièce (mode ménage uniquement) : « Toutes » + une chip par section.
  const sectionChips = menageId && sections.length > 0 ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      {[{ id: null as string | null, label: 'Toutes', icon: '' }, ...sections.map((s) => ({
        id: s.id as string | null,
        label: s.section_label,
        icon: SECTION_ICONS[s.section_type] || '•',
      }))].map((chip) => {
        const active = selectedSectionId === chip.id;
        return (
          <TouchableOpacity
            key={chip.id ?? '__all__'}
            style={[
              styles.chip,
              { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.itemBackground },
            ]}
            onPress={() => setSelectedSectionId(chip.id)}
            accessibilityRole="button"
            accessibilityLabel={`Filtrer : ${chip.label}`}
          >
            <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.text }]}>
              {chip.icon ? `${chip.icon} ` : ''}{chip.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  ) : null;

  const renderHeader = () => (
    <View>
      {sectionChips}
      {!readonly && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => handleAdd(true)}
            accessibilityRole="button"
            accessibilityLabel="Prendre une photo"
          >
            <Camera size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>Caméra</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => handleAdd(false)}
            accessibilityRole="button"
            accessibilityLabel="Choisir une photo"
          >
            <ImagePlus size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>Galerie</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const allPhotos = data?.data ?? [];

  // Mode ménage : regroupement par pièce (sections de checklist).
  // - une section précise sélectionnée => grille plate filtrée
  // - « Toutes » => groupes (1 par section ayant des photos) + « Non classées »
  const groups = useMemo(() => {
    if (!menageId) return [];
    const bySection = new Map<string, typeof allPhotos>();
    for (const p of allPhotos) {
      const key = p.section_id ?? '__none__';
      if (!bySection.has(key)) bySection.set(key, []);
      bySection.get(key)!.push(p);
    }
    const result = sections
      .filter((s) => bySection.has(s.id))
      .map((s) => ({
        id: s.id,
        label: s.section_label,
        icon: SECTION_ICONS[s.section_type] || '•',
        photos: bySection.get(s.id)!,
      }));
    if (bySection.has('__none__')) {
      result.push({ id: '__none__', label: 'Non classées', icon: '📷', photos: bySection.get('__none__')! });
    }
    return result;
  }, [menageId, sections, allPhotos]);

  const grouped = !!menageId && selectedSectionId === null && groups.length > 0;

  // Photos affichées (et ordre) selon le mode : groupé (aplati), filtré, ou plat.
  const photos = useMemo(() => {
    if (grouped) return groups.flatMap((g) => g.photos);
    if (menageId && selectedSectionId) return allPhotos.filter((p) => p.section_id === selectedSectionId);
    return allPhotos;
  }, [grouped, groups, menageId, selectedSectionId, allPhotos]);

  const imageSources = useMemo(() => photos.map((p) => ({ uri: p.url })), [photos]);

  // Detail overlay — tap the image to open fullscreen with zoom
  if (selectedPhoto) {
    return (
      <View style={styles.container}>
        <View style={[styles.overlay, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={styles.closeIcon}
            onPress={() => setSelectedPhoto(null)}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={IconSize.lg} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.fullImageWrapper}
            onPress={() => {
              const idx = photos.findIndex((p) => p.id === selectedPhoto.id);
              setFullscreenIndex(idx >= 0 ? idx : 0);
            }}
            accessibilityRole="image"
            accessibilityLabel="Agrandir la photo"
          >
            <Image source={{ uri: selectedPhoto.url }} style={styles.fullImage} resizeMode="contain" />
          </TouchableOpacity>
          <View style={[styles.photoInfo, { backgroundColor: colors.surface }, Shadow.md]}>
            <Text style={[styles.photoAuthor, { color: colors.text }]}>
              {selectedPhoto.first_name} {selectedPhoto.last_name}
            </Text>
            {selectedPhoto.caption && (
              <Text style={[styles.photoCaption, { color: colors.text2 }]}>{selectedPhoto.caption}</Text>
            )}
            <Text style={[styles.photoDate, { color: colors.mutedText }]}>
              {formatDateFr(selectedPhoto.taken_at, 'datetime')}
            </Text>
          </View>
          <View style={styles.detailActions}>
            <TouchableOpacity
              style={[styles.detailBtn, { backgroundColor: colors.primary }]}
              onPress={async () => {
                const name = `photo-${selectedPhoto.id}.jpg`;
                try {
                  const signedUrl = await getSignedFileUrl(selectedPhoto.url);
                  await shareFile(signedUrl, name, selectedPhoto.mime_type || 'image/jpeg');
                } catch { /* silent */ }
              }}
              accessibilityRole="button"
              accessibilityLabel="Partager ou télécharger la photo"
            >
              <Share2 size={IconSize.md} color="#FFFFFF" />
              <Text style={styles.detailBtnText}>Partager</Text>
            </TouchableOpacity>
            {!readonly && <TouchableOpacity
              style={[styles.detailBtn, { backgroundColor: colors.red }]}
              onPress={() => handleDelete(selectedPhoto.id)}
              accessibilityRole="button"
              accessibilityLabel="Supprimer la photo"
            >
              <Trash2 size={IconSize.md} color="#FFFFFF" />
              <Text style={styles.detailBtnText}>Supprimer</Text>
            </TouchableOpacity>}
          </View>
        </View>

        {/* Fullscreen zoom viewer */}
        <ImageView
          images={imageSources}
          imageIndex={fullscreenIndex ?? 0}
          visible={fullscreenIndex !== null}
          onRequestClose={() => setFullscreenIndex(null)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
        />
      </View>
    );
  }

  const items = photos;

  // Rendu d'un groupe de pièce : titre (icône + label + compteur) puis grille statique.
  const renderGroup = useCallback(
    (group: { id: string; label: string; icon: string; photos: typeof allPhotos }) => (
      <View key={group.id} style={styles.group}>
        <Text style={[styles.groupTitle, { color: colors.text2 }]}>
          {group.icon} {group.label} · {group.photos.length}
        </Text>
        <View style={styles.gridWrap}>
          {group.photos.map((item) => (
            <View key={item.id} style={styles.gridCell}>
              {renderItem({ item })}
            </View>
          ))}
        </View>
      </View>
    ),
    [colors, renderItem],
  );

  const roomPickerModal = isMultiRooms && rooms ? (
    <Modal
      visible={!!roomPickerOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setRoomPickerOpen(null)}
    >
      <View style={roomPickerStyles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setRoomPickerOpen(null)}
        />
        <View style={[roomPickerStyles.sheet, { backgroundColor: colors.surface }]}>
          <View style={roomPickerStyles.handle}>
            <View style={[roomPickerStyles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <Text style={[roomPickerStyles.title, { color: colors.text }]}>
            À quelle pièce ?
          </Text>
          <Text style={[roomPickerStyles.subtitle, { color: colors.text2 }]}>
            La photo sera attachée à la pièce choisie.
          </Text>
          {rooms.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[
                roomPickerStyles.option,
                { backgroundColor: colors.itemBackground, borderColor: colors.border },
              ]}
              onPress={() => {
                const useCamera = roomPickerOpen === 'camera';
                setRoomPickerOpen(null);
                // Petit délai pour laisser le modal se fermer (iOS ne peut pas
                // chaîner immédiatement modal → ImagePicker natif).
                setTimeout(() => {
                  void pickImage(useCamera, r.id);
                }, 250);
              }}
            >
              <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.medium }}>
                {r.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[roomPickerStyles.cancel, { borderColor: colors.border }]}
            onPress={() => setRoomPickerOpen(null)}
          >
            <Text style={{ color: colors.text2, fontSize: FontSize.md, fontWeight: FontWeight.medium }}>
              Annuler
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ) : null;

  if (nested) {
    // Rendu statique en grille — évite l'erreur "VirtualizedList nested in ScrollView"
    return (
      <View style={[styles.container, styles.nestedList]}>
        {renderHeader()}
        {items.length === 0 ? (
          !isLoading ? (
            <Text style={[styles.empty, { color: colors.mutedText }]}>
              Aucune photo. Utilisez la caméra ou la galerie.
            </Text>
          ) : null
        ) : grouped ? (
          groups.map((g) => renderGroup(g))
        ) : (
          <View style={styles.gridWrap}>
            {items.map((item) => (
              <View key={item.id} style={styles.gridCell}>
                {renderItem({ item })}
              </View>
            ))}
          </View>
        )}
        {roomPickerModal}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {grouped ? (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          renderItem={({ item: g }) => renderGroup(g)}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            !isLoading ? (
              <Text style={[styles.empty, { color: colors.mutedText }]}>Aucune photo. Utilisez la caméra ou la galerie.</Text>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={COLUMN_COUNT}
          columnWrapperStyle={styles.row}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            !isLoading ? (
              <Text style={[styles.empty, { color: colors.mutedText }]}>Aucune photo. Utilisez la caméra ou la galerie.</Text>
            ) : null
          }
        />
      )}
      {roomPickerModal}
    </View>
  );
};

const roomPickerStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  handle: { alignItems: 'center', paddingBottom: Spacing.sm },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  subtitle: { fontSize: FontSize.sm, marginBottom: Spacing.sm },
  option: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  cancel: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg },
  nestedList: { flex: undefined },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -ITEM_GAP / 2,
  },
  gridCell: {
    width: `${100 / COLUMN_COUNT}%`,
    paddingHorizontal: ITEM_GAP / 2,
    marginBottom: ITEM_GAP,
  },
  chipsRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.md },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  group: { marginBottom: Spacing.lg },
  groupTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 44,
    borderRadius: Radius.md,
  },
  actionText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  row: { gap: ITEM_GAP, marginBottom: ITEM_GAP },
  photoItem: { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: Radius.sm, overflow: 'hidden', position: 'relative' },
  photoImage: { width: '100%', height: '100%' },
  timeBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  timeBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: FontWeight.medium },
  deleteIcon: { position: 'absolute', top: 4, right: 4 },
  deleteIconBg: {
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontSize: FontSize.base, textAlign: 'center', paddingTop: Spacing.xxxl },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  closeIcon: { position: 'absolute', top: Spacing.md, right: Spacing.md, padding: Spacing.sm, zIndex: 10 },
  fullImageWrapper: { width: '100%', height: '55%' },
  fullImage: { width: '100%', height: '100%' },
  photoInfo: { padding: Spacing.lg, borderRadius: Radius.lg, marginTop: Spacing.lg, width: '100%' },
  photoAuthor: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  photoCaption: { fontSize: FontSize.base, marginTop: Spacing.xs },
  photoDate: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  detailActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg, width: '100%' },
  detailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 44,
    borderRadius: Radius.md,
  },
  detailBtnText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.medium },

  // Fullscreen viewer footer
  viewerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewerInfo: { flex: 1 },
  viewerAuthor: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  viewerDate: { color: '#E7E5E4', fontSize: FontSize.sm, marginTop: 2 },
  viewerCaption: { color: '#E7E5E4', fontSize: FontSize.sm, marginTop: Spacing.xs },
  viewerActions: { flexDirection: 'row', gap: Spacing.sm },
  viewerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PhotoGallery;
