import { getAccessToken, MAX_429_RETRIES, retryDelayMs, sleep } from './client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'change-me-in-production';

interface UploadResult {
  url: string;
  original_name: string;
  file_size: number;
  mime_type: string;
}

// File d'attente : sérialise les uploads pour qu'une rafale de taps (galerie /
// appareil photo) ne déclenche pas plusieurs envois concurrents, ce qui sature
// le rate-limit. Les uploads s'enchaînent un par un.
let uploadChain: Promise<unknown> = Promise.resolve();

async function doUpload(fileUri: string, fileName: string, mimeType?: string): Promise<UploadResult> {
  const token = await getAccessToken();

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType || 'application/octet-stream',
  } as unknown as Blob);

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  };

  let response = await fetch(`${API_URL}/upload`, requestInit);

  // Retry sur 429 (rate-limit) : on attend (Retry-After ou backoff) puis on
  // retente, pour absorber les pics sans faire échouer l'upload.
  for (let attempt = 0; response.status === 429 && attempt < MAX_429_RETRIES; attempt++) {
    await sleep(retryDelayMs(response, attempt));
    response = await fetch(`${API_URL}/upload`, requestInit);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Upload failed');
  }

  return response.json();
}

/**
 * Upload a file to the API server.
 * Returns a public URL that can be stored in the database.
 * Les appels sont sérialisés (un seul upload à la fois) pour ménager le rate-limit.
 */
export async function uploadFile(fileUri: string, fileName: string, mimeType?: string): Promise<UploadResult> {
  const run = uploadChain.then(
    () => doUpload(fileUri, fileName, mimeType),
    () => doUpload(fileUri, fileName, mimeType),
  );
  // La chaîne continue quel que soit le résultat (succès ou échec) du maillon courant.
  uploadChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
