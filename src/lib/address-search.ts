/**
 * Recherche de villes et d'adresses sur les bases officielles des pays où
 * l'app est distribuée :
 *   - France     : geo.api.gouv.fr (communes) + api-adresse.data.gouv.fr (BAN)
 *   - Suisse     : api3.geo.admin.ch SearchServer (communes gg25 + adresses)
 *   - Luxembourg : map.geoportail.lu fulltextsearch + apiv3.geoportail.lu geocode
 *   - Belgique   : photon.komoot.io (OpenStreetMap) — pas de base nationale unique,
 *                  une par région ; instance publique à usage modéré (requêtes débouncées)
 * Toutes publiques, gratuites, sans clé, CORS ouvert.
 */

import { haversineMeters } from './geo-distance';

export type AddressCountry = 'FR' | 'CH' | 'LU' | 'BE';

export interface CitySuggestion {
  country: AddressCountry;
  name: string;
  /** FR : code INSEE · CH : numéro OFS de la commune · LU : id geoportail · BE : id OSM */
  cityCode: string;
  /** Vide hors France : le code postal y dépend de la rue, il vient de l'adresse choisie. */
  postalCode: string;
  department: string;
  latitude: number;
  longitude: number;
  label: string;
}

export interface AddressSuggestion {
  name: string;
  label: string;
  street: string;
  housenumber?: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

const FLAGS: Record<AddressCountry, string> = { FR: '🇫🇷', CH: '🇨🇭', LU: '🇱🇺', BE: '🇧🇪' };

export function countryFlag(country: AddressCountry): string {
  return FLAGS[country];
}

const CITY_LIMIT = 8;
/**
 * Luxembourg : les quartiers (Kirchberg, Gare…) ont pour localité postale « Luxembourg ».
 * Belgique : OSM rattache souvent l'adresse à la section (« Ixelles ») plutôt qu'à la commune.
 */
const NEARBY_M = 3000;
const FOREIGN_CITY_QUOTA = 3;

// ── Parsing (pur, testé) ────────────────────────────────────────────────

interface FrCommune {
  nom: string;
  code: string;
  codesPostaux: string[];
  departement?: { code: string; nom: string };
  centre?: { coordinates: [number, number] };
}

export function parseFrCities(data: FrCommune[]): CitySuggestion[] {
  const results: CitySuggestion[] = [];
  for (const city of data) {
    const [lng, lat] = city.centre?.coordinates ?? [0, 0];
    for (const cp of city.codesPostaux) {
      results.push({
        country: 'FR',
        name: city.nom,
        cityCode: city.code,
        postalCode: cp,
        department: city.departement?.nom ?? '',
        latitude: lat,
        longitude: lng,
        label: `${city.nom} (${cp})`,
      });
    }
  }
  return results;
}

interface BanFeature {
  properties: {
    label: string;
    housenumber?: string;
    street?: string;
    name: string;
    postcode: string;
    city: string;
  };
  geometry: { coordinates: [number, number] };
}

export function parseBanAddresses(features: BanFeature[]): AddressSuggestion[] {
  return features.map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    return {
      name: f.properties.name,
      label: f.properties.label,
      street: f.properties.street || f.properties.name,
      housenumber: f.properties.housenumber,
      city: f.properties.city,
      postalCode: f.properties.postcode,
      latitude: lat,
      longitude: lng,
    };
  });
}

interface ChResult {
  attrs: { label: string; detail: string; featureId: string; lat: number; lon: number; num?: number };
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim();

export function parseChCities(results: ChResult[]): CitySuggestion[] {
  const seen = new Set<string>();
  const out: CitySuggestion[] = [];
  for (const { attrs } of results) {
    // Une commune bilingue sort deux fois (« Genève (GE) » / « Genf (GE) ») : on garde la première.
    if (seen.has(attrs.featureId)) continue;
    seen.add(attrs.featureId);
    const m = stripTags(attrs.label).match(/^(.*?)\s*\(([A-Z]{2})\)$/);
    const name = m ? m[1] : stripTags(attrs.label);
    out.push({
      country: 'CH',
      name,
      cityCode: attrs.featureId,
      postalCode: '',
      department: m ? m[2] : '',
      latitude: attrs.lat,
      longitude: attrs.lon,
      label: name,
    });
  }
  return out;
}

/** « Rue du Rhône 12 <b>1204 Genève</b> », limité à la commune choisie (numéro OFS dans `detail`). */
export function parseChAddresses(results: ChResult[], cityCode: string): AddressSuggestion[] {
  const out: AddressSuggestion[] = [];
  for (const { attrs } of results) {
    if (!` ${attrs.detail} `.includes(` ${cityCode} `)) continue;
    const m = attrs.label.match(/^(.*?)\s*<b>\s*(\d{4})\s+(.*?)\s*<\/b>/);
    if (!m) continue;
    const name = stripTags(m[1]);
    out.push({
      name,
      label: `${name}, ${m[2]} ${m[3]}`,
      street: name,
      housenumber: attrs.num ? String(attrs.num) : undefined,
      city: m[3],
      postalCode: m[2],
      latitude: attrs.lat,
      longitude: attrs.lon,
    });
  }
  return out;
}

interface LuFeature {
  id: string;
  bbox: number[] | Record<string, never>;
  geometry: { type: string; coordinates: unknown };
  properties: { label: string; layer_name: string };
}

function luCenter(f: LuFeature): [number, number] {
  if (Array.isArray(f.bbox) && f.bbox.length === 4) {
    const [minX, minY, maxX, maxY] = f.bbox;
    return [(minX + maxX) / 2, (minY + maxY) / 2];
  }
  if (f.geometry.type === 'Point') return f.geometry.coordinates as [number, number];
  return [0, 0];
}

/** « Esch-sur-Alzette (Esch-Uelzecht) » → nom officiel sans la variante luxembourgeoise. */
export function luBaseName(label: string): string {
  return label.replace(/\s*\([^()]*\)\s*$/, '').trim();
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Mots d'un texte, sans accents ni ponctuation (« Saint-Gilles » → saint, gilles). */
const words = (s: string) => normalize(s).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * La rue contient-elle les mots tapés ? Le dernier peut être en cours de frappe (préfixe) ;
 * les numéros et le nom de la ville, ajoutés à la requête, sont ignorés.
 */
export function streetMatchesQuery(street: string, query: string, cityName: string): boolean {
  const cityWords = new Set(words(cityName));
  const wanted = words(query).filter((w) => !/^\d/.test(w) && !cityWords.has(w));
  const have = words(street);
  return wanted.every((w, i) =>
    i === wanted.length - 1 ? have.some((h) => h.startsWith(w)) : have.includes(w),
  );
}

export function parseLuCities(features: LuFeature[]): CitySuggestion[] {
  return features.map((f) => {
    const [lng, lat] = luCenter(f);
    const name = luBaseName(f.properties.label);
    return {
      country: 'LU' as const,
      name,
      cityCode: f.id,
      postalCode: '',
      department: '',
      latitude: lat,
      longitude: lng,
      label: f.properties.label,
    };
  });
}

/**
 * Une adresse appartient à la ville choisie si sa localité porte son nom, ou si elle est
 * tout près (un quartier ou une section n'est pas toujours la localité de l'adresse).
 */
function inCity(locality: string, lat: number, lng: number, city: CitySuggestion): boolean {
  return (
    normalize(locality) === normalize(city.name) ||
    haversineMeters(lat, lng, city.latitude, city.longitude) <= NEARBY_M
  );
}

/** Les adresses de la localité elle-même passent devant celles des alentours. */
function sameLocalityFirst(addresses: AddressSuggestion[], city: CitySuggestion): AddressSuggestion[] {
  const same = (a: AddressSuggestion) => (normalize(a.city) === normalize(city.name) ? 0 : 1);
  return [...addresses].sort((a, b) => same(a) - same(b));
}

/** « 126, Rue de Luxembourg, L-4221 Esch-sur-Alzette », limité à la ville choisie. */
export function parseLuAddresses(features: LuFeature[], city: CitySuggestion): AddressSuggestion[] {
  const out: AddressSuggestion[] = [];
  for (const f of features) {
    const m = f.properties.label.match(/^(.*),\s*L-(\d{4})\s+(.*)$/);
    if (!m) continue;
    const [lng, lat] = luCenter(f);
    if (!inCity(m[3], lat, lng, city)) continue;
    out.push({
      name: m[1],
      label: f.properties.label,
      street: m[1].replace(/^[^,]*,\s*/, ''),
      housenumber: m[1].split(',')[0].trim(),
      city: m[3],
      postalCode: `L-${m[2]}`,
      latitude: lat,
      longitude: lng,
    });
  }
  return sameLocalityFirst(out, city);
}

interface LuGeocodeResult {
  accuracy: number;
  geomlonlat: { coordinates: [number, number] };
  AddressDetails: { postnumber: string | null; street: string | null; zip: string | null; locality: string };
}

/** Géocodeur exact : seul un bâtiment trouvé (accuracy 8) est retenu. */
export function parseLuGeocode(results: LuGeocodeResult[], city: CitySuggestion): AddressSuggestion[] {
  const out: AddressSuggestion[] = [];
  for (const r of results) {
    const d = r.AddressDetails;
    if (r.accuracy < 8 || !d.street || !d.postnumber || !d.zip) continue;
    const [lng, lat] = r.geomlonlat.coordinates;
    if (!inCity(d.locality, lat, lng, city)) continue;
    const name = `${d.postnumber}, ${d.street}`;
    out.push({
      name,
      label: `${name}, L-${d.zip} ${d.locality}`,
      street: d.street,
      housenumber: d.postnumber,
      city: d.locality,
      postalCode: `L-${d.zip}`,
      latitude: lat,
      longitude: lng,
    });
  }
  return out;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id: number;
    countrycode?: string;
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
    county?: string;
  };
}

export function parsePhotonCities(features: PhotonFeature[]): CitySuggestion[] {
  const seen = new Set<string>();
  const out: CitySuggestion[] = [];
  for (const f of features) {
    const p = f.properties;
    if (p.countrycode !== 'BE' || !p.name || seen.has(normalize(p.name))) continue;
    seen.add(normalize(p.name));
    const [lng, lat] = f.geometry.coordinates;
    out.push({
      country: 'BE',
      name: p.name,
      cityCode: String(p.osm_id),
      postalCode: '',
      department: p.county ?? '',
      latitude: lat,
      longitude: lng,
      label: p.name,
    });
  }
  return out;
}

/** Adresses belges au format postal belge (« Rue Neuve 12 »), limitées à la ville choisie. */
export function parsePhotonAddresses(
  features: PhotonFeature[],
  city: CitySuggestion,
  query: string,
): AddressSuggestion[] {
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const p = f.properties;
    // Une rue seule (pas de numéro trouvé) a son nom dans `name`, une adresse dans `street`.
    const street = p.type === 'street' ? p.name : p.street;
    // Un commerce porte aussi une adresse : on garde rue + numéro, sans son enseigne.
    if (p.countrycode !== 'BE' || !street || (p.type === 'house' && !p.housenumber)) continue;
    // Photon complète au numéro près : « rue Saint-Gilles 30 » ramène tous les « 30 » de la ville.
    if (!streetMatchesQuery(street, query, city.name)) continue;
    const [lng, lat] = f.geometry.coordinates;
    if (!inCity(p.city ?? '', lat, lng, city)) continue;
    const name = p.housenumber ? `${street} ${p.housenumber}` : street;
    const label = [name, [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({
      name,
      label,
      street,
      housenumber: p.housenumber,
      city: p.city ?? city.name,
      postalCode: p.postcode ?? '',
      latitude: lat,
      longitude: lng,
    });
  }
  return sameLocalityFirst(out, city);
}

/**
 * France d'abord, mais quelques places sont gardées aux villes étrangères trouvées
 * (au plus 3 pour l'ensemble, une par pays avant d'en donner une deuxième) ; une ville au nom exact de la saisie passe en tête (« Luxembourg » avant
 * « Bouy-Luxembourg »).
 */
export function mergeCities(query: string, fr: CitySuggestion[], ...foreign: CitySuggestion[][]): CitySuggestion[] {
  const exact = (c: CitySuggestion) => (normalize(c.name) === normalize(query) ? 0 : 1);
  // Les recherches suisse et luxembourgeoise sont floues (« Bruxelles » → Saint-Prex) :
  // une ville étrangère doit contenir le texte saisi.
  const typed = words(query).join(' ');
  const relevant = (c: CitySuggestion) =>
    words(c.name).join(' ').includes(typed) || words(c.label).join(' ').includes(typed);
  // Les villes au nom exact d'abord, puis tour à tour un pays après l'autre.
  const queues = foreign.map((list) => list.filter(relevant).sort((a, b) => exact(a) - exact(b)));
  const foreignKept: CitySuggestion[] = [];
  for (let round = 0; foreignKept.length < FOREIGN_CITY_QUOTA && queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      if (q[round] && foreignKept.length < FOREIGN_CITY_QUOTA) foreignKept.push(q[round]);
    }
  }
  const frKept = fr.slice(0, CITY_LIMIT - foreignKept.length);
  return [...frKept, ...foreignKept].sort((a, b) => exact(a) - exact(b)).slice(0, CITY_LIMIT);
}

// ── Appels réseau ───────────────────────────────────────────────────────

const CH_SEARCH = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const LU_SEARCH = 'https://map.geoportail.lu/fulltextsearch';
const LU_GEOCODE = 'https://apiv3.geoportail.lu/geocode/search';
const PHOTON = 'https://photon.komoot.io/api/';
/** Rectangle englobant la Belgique : Photon y concentre ses résultats. */
const BE_BBOX = '2.5,49.45,6.45,51.55';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Une source en panne ne prive pas l'utilisateur des deux autres. */
const orEmpty = <T>(p: Promise<T[]>): Promise<T[]> => p.catch(() => []);

export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const q = encodeURIComponent(query);
  const [fr, ch, lu, be] = await Promise.all([
    orEmpty(
      getJson<FrCommune[]>(
        `https://geo.api.gouv.fr/communes?nom=${q}&fields=nom,code,codesPostaux,departement,population,centre&boost=population&limit=8`,
      ).then(parseFrCities),
    ),
    orEmpty(
      getJson<{ results: ChResult[] }>(
        `${CH_SEARCH}?type=locations&origins=gg25&sr=4326&limit=6&searchText=${q}`,
      ).then((d) => parseChCities(d.results ?? [])),
    ),
    orEmpty(
      getJson<{ features: LuFeature[] }>(`${LU_SEARCH}?layer=Localit%C3%A9&limit=4&query=${q}`).then((d) =>
        parseLuCities(d.features ?? []),
      ),
    ),
    orEmpty(
      getJson<{ features: PhotonFeature[] }>(
        `${PHOTON}?layer=city&lang=fr&limit=8&bbox=${BE_BBOX}&q=${q}`,
      ).then((d) => parsePhotonCities(d.features ?? [])),
    ),
  ]);
  return mergeCities(query, fr, ch, lu, be);
}

async function searchFrAddresses(query: string, cityCode: string): Promise<AddressSuggestion[]> {
  const ban = (type: string) =>
    getJson<{ features: BanFeature[] }>(
      `https://api-adresse.data.gouv.fr/search/?${new URLSearchParams({ q: query, citycode: cityCode, limit: '8', type })}`,
    ).then((d) => parseBanAddresses(d.features ?? []));
  const results = await ban('housenumber');
  // Aucun numéro trouvé : on propose au moins la rue.
  return results.length > 0 ? results : ban('street');
}

async function searchChAddresses(query: string, city: CitySuggestion): Promise<AddressSuggestion[]> {
  const q = encodeURIComponent(`${query} ${city.name}`);
  const d = await getJson<{ results: ChResult[] }>(
    `${CH_SEARCH}?type=locations&origins=address&sr=4326&limit=15&searchText=${q}`,
  );
  return parseChAddresses(d.results ?? [], city.cityCode);
}

async function searchLuAddresses(query: string, city: CitySuggestion): Promise<AddressSuggestion[]> {
  const q = encodeURIComponent(`${query} ${city.name}`);
  // L'autocomplétion classe mal les numéros (« 12 rue… » sort 127, 126…) :
  // le géocodeur exact place le bon bâtiment en tête quand il le trouve.
  const [exact, fuzzy] = await Promise.all([
    orEmpty(
      getJson<{ results: LuGeocodeResult[] }>(`${LU_GEOCODE}?queryString=${q}`).then((d) =>
        parseLuGeocode(d.results ?? [], city),
      ),
    ),
    orEmpty(
      getJson<{ features: LuFeature[] }>(`${LU_SEARCH}?layer=Adresse&limit=10&query=${q}`).then((d) =>
        parseLuAddresses(d.features ?? [], city),
      ),
    ),
  ]);
  const seen = new Set(exact.map((a) => normalize(a.label)));
  return [...exact, ...fuzzy.filter((a) => !seen.has(normalize(a.label)))];
}

async function searchBeAddresses(query: string, city: CitySuggestion): Promise<AddressSuggestion[]> {
  const photon = async (text: string) => {
    const q = encodeURIComponent(`${text} ${city.name}`);
    const d = await getJson<{ features: PhotonFeature[] }>(
      `${PHOTON}?layer=house&layer=street&lang=fr&limit=15&bbox=${BE_BBOX}&q=${q}`,
    );
    return parsePhotonAddresses(d.features ?? [], city, query);
  };
  const results = await photon(query);
  // Numéro absent d'OpenStreetMap : on propose au moins la rue, comme pour la France.
  const withoutNumbers = query.replace(/\b\d+\w*\b/g, ' ').replace(/\s+/g, ' ').trim();
  return results.length > 0 || withoutNumbers === query.trim() ? results : photon(withoutNumbers);
}

export function searchAddresses(query: string, city: CitySuggestion): Promise<AddressSuggestion[]> {
  switch (city.country) {
    case 'CH':
      return searchChAddresses(query, city);
    case 'LU':
      return searchLuAddresses(query, city);
    case 'BE':
      return searchBeAddresses(query, city);
    default:
      return searchFrAddresses(query, city.cityCode);
  }
}
