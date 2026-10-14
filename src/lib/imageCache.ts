/**
 * Clé de cache des images (build 1.0.1, `expo-image`).
 *
 * L'API signe chaque URL de fichier d'un jeton qui tourne (24 h pour avatars et
 * couvertures, 1 h pour les photos d'intervention) : `/files/<nom>?token=…`.
 * Pour un cache indexé sur l'URL, chaque rotation est une image nouvelle, donc
 * tout se re-télécharge. Le **nom de fichier**, lui, ne change jamais (un
 * fichier uploadé est immuable) : c'est la clé.
 *
 * - `/files/<nom>` (nos fichiers signés) → `estia-file:<nom>` ;
 * - autre URL http(s) → l'URL sans sa query (une CDN signée garde son chemin) ;
 * - URI locale (`file://`, `data:`…) ou vide → pas de clé : rien à partager.
 */
export function imageCacheKey(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined;
  if (!/^https?:\/\//i.test(uri)) return undefined;
  const [withoutQuery] = uri.split(/[?#]/);
  const match = withoutQuery.match(/\/files\/([^/]+)$/);
  if (match) return `estia-file:${decodeURIComponent(match[1])}`;
  return withoutQuery;
}
