/**
 * Distance haversine entre deux points GPS, en mètres. Sert à vérifier que la
 * photo de pointage a bien été prise près du logement.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // rayon terrestre en mètres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Format humain : "120 m" ou "1.4 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Seuil au-delà duquel on considère le pointage suspect (presta pas sur place). */
export const POINTAGE_DISTANCE_WARN_M = 200;
