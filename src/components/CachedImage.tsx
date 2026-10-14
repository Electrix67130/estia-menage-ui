import React from 'react';
import type { StyleProp, ImageStyle } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';
import { imageCacheKey } from '@/lib/imageCache';

/**
 * Image distante avec cache **disque** persistant (build 1.0.1).
 *
 * `expo-image` garde l'image sur le disque (`memory-disk`) et la retrouve par
 * son nom de fichier (`imageCacheKey`), pas par son URL : une photo vue une fois
 * reste disponible après la rotation du jeton signé, et hors ligne. Avant, le
 * petit cache par défaut d'iOS se vidait sous pression mémoire, et l'URL qui
 * changeait chaque jour forçait un nouveau téléchargement.
 *
 * Réservé aux images **distantes** : une URI locale (photo qu'on vient de
 * prendre) passe aussi, simplement sans clé partagée.
 */
interface Props {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  /** Équivalent de `resizeMode` : `cover` (défaut) ou `contain` pour le plein écran. */
  contentFit?: ImageContentFit;
  accessibilityLabel?: string;
}

const CachedImage: React.FC<Props> = ({ uri, style, contentFit = 'cover', accessibilityLabel }) => {
  if (!uri) return null;
  return (
    <Image
      source={{ uri, cacheKey: imageCacheKey(uri) }}
      cachePolicy="memory-disk"
      contentFit={contentFit}
      // Fondu court : l'image en cache apparaît sans clignoter, celle qui arrive du réseau sans à-coup.
      transition={150}
      style={style}
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
    />
  );
};

export default CachedImage;
