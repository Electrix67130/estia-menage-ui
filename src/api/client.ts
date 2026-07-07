import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3010';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'local-dev-api-key';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// --------------- Sonde de connectivité (offline) ---------------

/**
 * Teste si l'API est joignable. N'importe quelle réponse HTTP (même 401/404)
 * signifie que le réseau est up → true. Seule une erreur réseau (fetch throw)
 * ou un timeout de 4 s donne false. Pur JS → livrable en OTA.
 */
export async function probeApi(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// --------------- Token management ---------------

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

// --------------- Error class ---------------

export class ApiError extends Error {
  statusCode: number;
  error: string;
  details: string | string[];

  constructor(statusCode: number, error: string, details: string | string[]) {
    super(typeof details === 'string' ? details : details.join(', '));
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
  }
}

// --------------- Rate-limit (429) backoff ---------------

export const MAX_429_RETRIES = 3;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Délai d'attente sur une réponse 429 (rate-limit) : respecte l'en-tête
 * `Retry-After` (en secondes) renvoyé par l'API, sinon backoff exponentiel
 * plafonné (1s, 2s, 4s…).
 */
export function retryDelayMs(response: Response, attempt: number): number {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds) && seconds >= 0) return seconds * 1000;
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

// --------------- Token refresh ---------------

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new ApiError(401, 'Unauthorized', 'No refresh token');

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        await clearTokens();
        throw new ApiError(401, 'Unauthorized', 'Refresh token expired');
      }

      const data = await response.json();
      await setTokens(data.access_token, data.refresh_token);
      return data.access_token as string;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// --------------- Fetch wrapper ---------------

interface FetchOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, headers: extraHeaders = {} } = options;

  const headers: Record<string, string> = {
    'x-api-key': API_KEY,
    ...extraHeaders,
  };

  // For write methods, always include a valid JSON body (even {}) to avoid server errors
  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  const effectiveBody = body ?? (isWriteMethod ? {} : undefined);
  if (effectiveBody !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const requestInit: RequestInit = {
    method,
    headers,
    body: effectiveBody !== undefined ? JSON.stringify(effectiveBody) : undefined,
  };

  let response = await fetch(`${API_URL}${endpoint}`, requestInit);

  // Retry sur 429 (rate-limit) : on attend (Retry-After ou backoff) puis on
  // retente, pour absorber les pics d'envoi groupé sans faire échouer la requête.
  for (let attempt = 0; response.status === 429 && attempt < MAX_429_RETRIES; attempt++) {
    await sleep(retryDelayMs(response, attempt));
    response = await fetch(`${API_URL}${endpoint}`, requestInit);
  }

  // Auto-refresh on 401
  if (response.status === 401 && auth) {
    try {
      const newToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: effectiveBody !== undefined ? JSON.stringify(effectiveBody) : undefined,
      });
    } catch {
      throw new ApiError(401, 'Unauthorized', 'Session expired');
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new ApiError(data.statusCode || response.status, data.error || 'Error', data.message || 'Unknown error');
  }

  return data as T;
}
