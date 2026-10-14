import { describe, expect, it } from '@jest/globals';
import { imageCacheKey } from './imageCache';

describe('clé de cache des images', () => {
  it('nos fichiers signés : le nom de fichier, quel que soit le jeton', () => {
    const lundi = imageCacheKey('https://api.estia-clean-connect.fr/files/abc123.jpg?token=lundi&exp=1');
    const mardi = imageCacheKey('https://api.estia-clean-connect.fr/files/abc123.jpg?token=mardi&exp=2');
    expect(lundi).toBe('estia-file:abc123.jpg');
    expect(mardi).toBe(lundi);
  });

  it('la miniature et l’original restent deux entrées distinctes', () => {
    expect(imageCacheKey('https://api.test/files/abc123_thumb.jpg?token=x')).not.toBe(
      imageCacheKey('https://api.test/files/abc123.jpg?token=x'),
    );
  });

  it('une autre URL distante : sans sa query', () => {
    expect(imageCacheKey('https://cdn.test/a/b.png?sig=1')).toBe('https://cdn.test/a/b.png');
  });

  it('une image locale ou absente n’a pas de clé partagée', () => {
    expect(imageCacheKey('file:///tmp/photo.jpg')).toBeUndefined();
    expect(imageCacheKey(null)).toBeUndefined();
    expect(imageCacheKey('')).toBeUndefined();
  });
});
