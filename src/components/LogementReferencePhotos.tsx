import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import ImageView from 'react-native-image-viewing';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLogementPhotos } from '@/api/hooks/usePhotos';
import { useLogementRooms } from '@/api/hooks/useLogementRooms';

/**
 * Photos de référence du logement sur le détail d'une prestation : à quoi
 * chaque pièce doit ressembler une fois le ménage fait.
 *
 * Ce sont les photos de pièces du paramétrage du logement (`/photos` liées à
 * `logement_room_id`), en **lecture seule** — le prestataire les consulte, il
 * ne les modifie pas. Groupées par pièce, tap → visionneuse plein écran.
 */
interface Props {
  logementId: string;
}

const THUMB = 96;

const LogementReferencePhotos: React.FC<Props> = ({ logementId }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const photos = useLogementPhotos(logementId);
  const rooms = useLogementRooms(logementId);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const all = useMemo(() => photos.data?.data ?? [], [photos.data]);

  // Groupé par pièce, dans l'ordre des pièces du logement ; les photos sans
  // pièce (photos du logement en général) forment un dernier groupe.
  const groups = useMemo(() => {
    const byRoom = new Map<string, typeof all>();
    for (const p of all) {
      const key = p.logement_room_id ?? '__none__';
      if (!byRoom.has(key)) byRoom.set(key, []);
      byRoom.get(key)!.push(p);
    }
    const result: { id: string; label: string; photos: typeof all }[] = [];
    for (const r of rooms.data ?? []) {
      const list = byRoom.get(r.id);
      if (list?.length) result.push({ id: r.id, label: r.name, photos: list });
    }
    const orphans = byRoom.get('__none__');
    if (orphans?.length) result.push({ id: '__none__', label: 'Logement', photos: orphans });
    return result;
  }, [all, rooms.data]);

  // Ordre à plat = ordre d'affichage, pour que la visionneuse ouvre la bonne photo.
  const flat = useMemo(() => groups.flatMap((g) => g.photos), [groups]);
  const sources = useMemo(() => flat.map((p) => ({ uri: p.url })), [flat]);

  if (groups.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text2 }]}>PHOTOS DU LOGEMENT</Text>
      <Text style={[styles.subtitle, { color: colors.mutedText }]}>
        À quoi le logement doit ressembler une fois le ménage terminé.
      </Text>

      {groups.map((group) => (
        <View key={group.id} style={{ gap: Spacing.xs }}>
          <Text style={[styles.roomLabel, { color: colors.text }]}>
            {group.label} · {group.photos.length}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {group.photos.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setViewerIndex(flat.findIndex((f) => f.id === p.id))}
                activeOpacity={0.8}
                accessibilityRole="image"
                accessibilityLabel={`Photo de référence — ${group.label}`}
              >
                <Image
                  source={{ uri: p.thumbnail_url || p.url }}
                  style={[styles.thumb, { backgroundColor: colors.itemBackground }]}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ))}

      <ImageView
        images={sources}
        imageIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onRequestClose={() => setViewerIndex(null)}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  title: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 0.5 },
  subtitle: { fontSize: FontSize.xs, marginTop: -Spacing.xs },
  roomLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  row: { gap: Spacing.xs, paddingRight: Spacing.lg },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radius.sm },
});

export default LogementReferencePhotos;
