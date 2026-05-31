import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '@/constants/Colors';
import { FontSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLogements } from '@/api/hooks/useLogements';
import type { Logement } from '@/api/types';

/**
 * Vue carte des **logements** de l'org. On affiche un marker par logement
 * géocodé (avec lat/lng), peu importe s'il a des ménages ou non.
 *
 * Tap sur un marker → onLogementPress(id) — typiquement navigation vers la
 * page du logement.
 */
interface MappableLogement {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  /** Conservé pour rétrocompat avec l'appelant existant — non utilisé. */
  menages?: unknown[];
  /** Callback au tap sur un marker. Par défaut, on garde l'ancien `onMenagePress` */
  onLogementPress?: (id: string) => void;
  /** @deprecated : conservé pour rétrocompat. Si présent, utilisé comme fallback. */
  onMenagePress?: (id: string) => void;
}

const MenageMap: React.FC<Props> = ({ onLogementPress, onMenagePress }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const logementsQuery = useLogements({ limit: 500 });

  const handlePress = onLogementPress ?? onMenagePress;

  const mappable = useMemo<MappableLogement[]>(() => {
    const out: MappableLogement[] = [];
    for (const l of logementsQuery.data?.data ?? ([] as Logement[])) {
      if (l.latitude === null || l.longitude === null) continue;
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push({
        id: l.id,
        name: l.name,
        address: [l.address, l.city].filter(Boolean).join(', '),
        lat,
        lng,
      });
    }
    return out;
  }, [logementsQuery.data]);

  const center = useMemo(() => {
    if (mappable.length === 0) return { lat: 46.6, lng: 2.3, zoom: 6 };
    const lats = mappable.map((m) => m.lat);
    const lngs = mappable.map((m) => m.lng);
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const spread = Math.max(
      Math.max(...lats) - Math.min(...lats),
      Math.max(...lngs) - Math.min(...lngs),
    );
    const zoom = spread < 0.05 ? 14 : spread < 0.5 ? 11 : spread < 2 ? 9 : spread < 5 ? 7 : 6;
    return { lat, lng, zoom };
  }, [mappable]);

  const markersJs = useMemo(() => {
    const color = '#D97706'; // primary brand color
    return mappable
      .map((m) => {
        const esc = (s: string) =>
          s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
        const name = esc(m.name);
        const addr = esc(m.address);
        const firstLetter = (m.name.trim()[0] || '?').toUpperCase();
        return `
          (function(){
            var icon = L.divIcon({
              className: '',
              html: '<div style="background:${color};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${firstLetter}</div>',
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            });
            L.marker([${m.lat}, ${m.lng}], {icon: icon})
              .addTo(map)
              .bindPopup('<div style="font-family:-apple-system,sans-serif;min-width:180px;"><b>${name}</b><br/><span style="color:#78716C;font-size:12px;">${addr}</span><br/><button onclick="window.ReactNativeWebView.postMessage(\\'${m.id}\\')" style="margin-top:6px;background:${color};color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;width:100%;">Ouvrir le logement →</button></div>');
          })();
        `;
      })
      .join('\n');
  }, [mappable]);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        #map { width: 100vw; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${center.lat}, ${center.lng}], ${center.zoom});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(map);
        ${markersJs}
      </script>
    </body>
    </html>
  `;

  if (logementsQuery.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (mappable.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>
          Aucun logement avec des coordonnées GPS.
        </Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ html }}
      style={styles.map}
      onMessage={(event) => {
        const id = event.nativeEvent.data;
        if (id && handlePress) handlePress(id);
      }}
    />
  );
};

const styles = StyleSheet.create({
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: FontSize.lg, textAlign: 'center' },
});

export default React.memo(MenageMap);
