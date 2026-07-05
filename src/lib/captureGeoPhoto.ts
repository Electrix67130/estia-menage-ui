import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { optimizeImage } from '@/utils/optimizeImage';
import { uploadFile } from '@/api/upload';

export interface GeoPhotoResult {
  /** URI locale de la photo (pas encore uploadée) — voir `uploadGeoPhoto`. */
  localUri: string;
  width: number;
  height: number;
  lat: number;
  lng: number;
}

export class GeoPhotoError extends Error {
  /** 'camera-denied' | 'location-denied' | 'cancelled' | 'location-failed' */
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Prend une photo via la caméra ET capture la position GPS au même moment.
 * Sert de preuve de présence sur place pour le pointage arrivée/départ.
 *
 * Throw une `GeoPhotoError` typée si une permission est refusée, si le user
 * annule, ou si le GPS échoue — l'appelant affiche le message adapté.
 */
export async function captureGeoPhoto(): Promise<GeoPhotoResult> {
  const camPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (!camPerm.granted) {
    throw new GeoPhotoError('camera-denied', 'Autorise la caméra dans les réglages pour pointer.');
  }
  const locPerm = await Location.requestForegroundPermissionsAsync();
  if (!locPerm.granted) {
    throw new GeoPhotoError(
      'location-denied',
      'Autorise la localisation : la position est requise pour prouver ta présence.',
    );
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets[0]) {
    throw new GeoPhotoError('cancelled', 'Photo annulée.');
  }

  // GPS au moment de la prise. High accuracy pour un point fiable.
  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    throw new GeoPhotoError('location-failed', 'Impossible de récupérer la position GPS. Réessaie en extérieur.');
  }

  const asset = result.assets[0];

  // On NE fait PAS l'optimisation/upload ici : ça bloquerait l'affichage de la
  // modale de déclaration. L'appelant lance `uploadGeoPhoto` en arrière-plan.
  return {
    localUri: asset.uri,
    width: asset.width,
    height: asset.height,
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

/**
 * Optimise puis uploade une photo de pointage capturée par `captureGeoPhoto`.
 * À lancer en tâche de fond pendant que le presta remplit la déclaration ;
 * `await` le résultat au moment de soumettre.
 */
export async function uploadGeoPhoto(
  localUri: string,
  width: number,
  height: number,
): Promise<string> {
  const optimized = await optimizeImage(localUri, width, height);
  const uploaded = await uploadFile(optimized.uri, `pointage-${Date.now()}.jpg`, optimized.mimeType);
  return uploaded.url;
}
