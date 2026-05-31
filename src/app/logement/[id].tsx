import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useDialog } from '@/contexts/DialogContext';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Pencil, Trash2, Bed, Bath, Toilet, Utensils, Sofa, TreePine, MapPin, Camera, Plus } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLogement, useDeleteLogement, useUpdateLogement } from '@/api/hooks/useLogements';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';
import { useLogementMembers } from '@/api/hooks/useLogementMembers';
import { useLogementPhotos } from '@/api/hooks/usePhotos';
import SecretCodeField from '@/components/SecretCodeField';
import { useAuth } from '@/contexts/AuthContext';
import PhotoGallery from '@/components/PhotoGallery';
import CheckTemplateEditor from '@/components/CheckTemplateEditor';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import LogementMembersSection from '@/components/LogementMembersSection';
import LogementClientSection from '@/components/LogementClientSection';
import LogementExternalCalendarsSection from '@/components/LogementExternalCalendarsSection';
import { openMaps } from '@/lib/contact-links';
import { useLogementRooms, type LogementRoom } from '@/api/hooks/useLogementRooms';

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

  // Quelle "boîte de pièces" est ouverte (chambre / salle_de_bain / wc / ...).
  // Une seule à la fois — tap pour basculer.
  const [expandedKind, setExpandedKind] = useState<string | null>(null);

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

  const stats: { icon: typeof Bed; label: string; value: number; kind: string }[] = [
    { icon: Bed, label: 'Chambres', value: logement.n_bedrooms, kind: 'chambre' },
    { icon: Bath, label: 'Salles de bain', value: logement.n_bathrooms, kind: 'salle_de_bain' },
    { icon: Toilet, label: 'WC', value: logement.n_wc, kind: 'wc' },
    { icon: Utensils, label: 'Cuisines', value: logement.n_kitchens, kind: 'cuisine' },
    { icon: Sofa, label: 'Salons', value: logement.n_living_rooms, kind: 'salon' },
    { icon: TreePine, label: 'Extérieurs', value: logement.n_exterior_spaces, kind: 'exterieur' },
  ];

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
        <View style={styles.statsGrid}>
          {stats.map((s) => {
            const active = expandedKind === s.kind;
            const disabled = s.value === 0;
            return (
              <TouchableOpacity
                key={s.label}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: active ? colors.primary + '15' : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: disabled ? 0.5 : 1,
                  },
                ]}
                disabled={disabled}
                onPress={() => setExpandedKind(active ? null : s.kind)}
                activeOpacity={0.7}
              >
                <s.icon size={IconSize.md} color={active ? colors.primary : colors.text2} />
                <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.text2 }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {logement.has_basement || logement.has_laundry ? (
          <View style={styles.flagsRow}>
            {logement.has_basement ? (
              <TouchableOpacity
                style={[
                  styles.flag,
                  {
                    backgroundColor:
                      expandedKind === 'cave' ? colors.primary + '15' : colors.itemBackground,
                    borderWidth: 1,
                    borderColor: expandedKind === 'cave' ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => setExpandedKind(expandedKind === 'cave' ? null : 'cave')}
              >
                <Text style={{ color: colors.text, fontSize: FontSize.sm }}>Cave</Text>
              </TouchableOpacity>
            ) : null}
            {logement.has_laundry ? (
              <TouchableOpacity
                style={[
                  styles.flag,
                  {
                    backgroundColor:
                      expandedKind === 'buanderie' ? colors.primary + '15' : colors.itemBackground,
                    borderWidth: 1,
                    borderColor: expandedKind === 'buanderie' ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() =>
                  setExpandedKind(expandedKind === 'buanderie' ? null : 'buanderie')
                }
              >
                <Text style={{ color: colors.text, fontSize: FontSize.sm }}>Buanderie</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {expandedKind ? (
          <Animated.View
            key={expandedKind}
            entering={FadeInDown.duration(220)}
            exiting={FadeOutUp.duration(140)}
          >
            <ExpandedRoomKind logementId={logement.id} kind={expandedKind} isAdmin={isAdmin} />
          </Animated.View>
        ) : null}

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
    </SafeAreaView>
  );
}

/**
 * Affiche les pièces d'un kind donné (chambre, salle_de_bain, etc.) avec
 * leur photos. Si une seule pièce de ce kind existe (ex : "Salon" unique),
 * on l'affiche direct sans titre redondant. Sinon on liste "Chambre 1",
 * "Chambre 2"... avec leur galerie en dessous.
 *
 * Pour un presta (read-only), si une pièce n'a pas de photos, on affiche
 * un simple "Aucune photo" — pas la galerie vide (qui inviterait à uploader
 * alors qu'il n'a pas le droit).
 */
function ExpandedRoomKind({
  logementId,
  kind,
  isAdmin,
}: {
  logementId: string;
  kind: string;
  isAdmin: boolean;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const rooms = useLogementRooms(logementId);
  const list = (rooms.data ?? []).filter((r: LogementRoom) => r.kind === kind);

  if (list.length === 0) {
    return (
      <View
        style={[
          styles.expandedEmpty,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={{ color: colors.mutedText, textAlign: 'center' }}>Aucune pièce.</Text>
      </View>
    );
  }

  // Si UNE seule pièce du kind → galerie simple, pas besoin de demander quelle pièce.
  // Sinon, mode multi-rooms : 1 seul bouton, modal "quelle pièce" avant l'upload.
  if (list.length === 1) {
    const r = list[0];
    return (
      <View style={styles.expandedBlock}>
        {isAdmin ? (
          <View style={styles.photosWrapper}>
            <PhotoGallery
              logementId={logementId}
              logementRoomId={r.id}
              readonly={false}
              nested
            />
          </View>
        ) : (
          <PrestaPhotosView logementId={logementId} roomId={r.id} />
        )}
      </View>
    );
  }

  // Multi-rooms : galerie unifiée qui demande "quelle pièce ?" à l'upload.
  return (
    <View style={styles.expandedBlock}>
      {isAdmin ? (
        <View style={styles.photosWrapper}>
          <PhotoGallery
            logementId={logementId}
            rooms={list.map((r) => ({ id: r.id, name: r.name }))}
            readonly={false}
            nested
          />
        </View>
      ) : (
        <PrestaPhotosMultiView logementId={logementId} roomIds={list.map((r) => r.id)} />
      )}
    </View>
  );
}

/**
 * Vue read-only des photos pour un prestataire en mode multi-rooms : agrège
 * les photos de toutes les rooms du kind, sans bouton d'ajout.
 */
function PrestaPhotosMultiView({ logementId, roomIds }: { logementId: string; roomIds: string[] }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const photos = useLogementPhotos(logementId);
  if (photos.isLoading) {
    return (
      <View
        style={[
          styles.expandedEmpty,
          { backgroundColor: colors.surface, borderColor: colors.border, marginTop: Spacing.sm },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const filtered = (photos.data?.data ?? []).filter(
    (p) => p.logement_room_id && roomIds.includes(p.logement_room_id),
  );
  if (filtered.length === 0) {
    return (
      <View
        style={[
          styles.expandedEmpty,
          { backgroundColor: colors.surface, borderColor: colors.border, marginTop: Spacing.sm },
        ]}
      >
        <Text style={{ color: colors.mutedText, textAlign: 'center' }}>Aucune photo.</Text>
      </View>
    );
  }
  // On laisse la PhotoGallery gérer le rendu (en mode multi-rooms + readonly).
  return (
    <View style={styles.photosWrapper}>
      <PhotoGallery
        logementId={logementId}
        rooms={roomIds.map((id) => ({ id, name: id }))}
        readonly
        nested
      />
    </View>
  );
}

/**
 * Vue read-only des photos d'une pièce pour un prestataire : galerie si
 * photos, sinon texte "Aucune photo".
 */
function PrestaPhotosView({ logementId, roomId }: { logementId: string; roomId: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const photos = useLogementPhotos(logementId, roomId);
  if (photos.isLoading) {
    // Placeholder stable pendant le chargement pour éviter le "flicker"
    // (return null laissait un blanc d'une frame avant le rendu final).
    return (
      <View
        style={[
          styles.expandedEmpty,
          { backgroundColor: colors.surface, borderColor: colors.border, marginTop: Spacing.sm },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!photos.data?.data || photos.data.data.length === 0) {
    return (
      <View
        style={[
          styles.expandedEmpty,
          { backgroundColor: colors.surface, borderColor: colors.border, marginTop: Spacing.sm },
        ]}
      >
        <Text style={{ color: colors.mutedText, textAlign: 'center' }}>Aucune photo.</Text>
      </View>
    );
  }
  return (
    <View style={styles.photosWrapper}>
      <PhotoGallery logementId={logementId} logementRoomId={roomId} readonly nested />
    </View>
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    width: '31%',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, textAlign: 'center' },
  flagsRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  flag: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  photosWrapper: { minHeight: 120 },
  roomPhotosBlock: { marginTop: Spacing.sm, gap: Spacing.sm },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  roomHeader: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  roomName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  roomKind: { fontSize: FontSize.xs, textTransform: 'capitalize' },
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
  expandedBlock: { gap: Spacing.sm, marginTop: Spacing.sm },
  expandedEmpty: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
});
