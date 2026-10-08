import { describe, expect, it } from '@jest/globals';
import {
  CitySuggestion,
  luBaseName,
  mergeCities,
  parseChAddresses,
  parseChCities,
  parseLuAddresses,
  parseLuGeocode,
  parsePhotonAddresses,
  parsePhotonCities,
  streetMatchesQuery,
} from './address-search';

// Extraits de vraies réponses (08/10/2026).
const chCommunes = [
  { attrs: { label: '<b>Genève (GE)</b>', detail: 'geneve ge', featureId: '6621', lat: 46.2045, lon: 6.1424 } },
  { attrs: { label: '<b>Genf (GE)</b>', detail: 'genf ge', featureId: '6621', lat: 46.2045, lon: 6.1424 } },
  { attrs: { label: '<b>Genthod (GE)</b>', detail: 'genthod ge', featureId: '6622', lat: 46.2637, lon: 6.1635 } },
];

const chAddresses = [
  {
    attrs: {
      label: 'Rue du Rhône 12 <b>1204 Genève</b>',
      detail: 'rue du rhone 12 1204 geneve 6621 geneve ch ge',
      featureId: '2037304_6', lat: 46.2045, lon: 6.1453, num: 12,
    },
  },
  {
    attrs: {
      label: 'Rue du Rhône 3 <b>1260 Nyon</b>',
      detail: 'rue du rhone 3 1260 nyon 5724 nyon ch vd',
      featureId: '1_0', lat: 46.38, lon: 6.24, num: 3,
    },
  },
];

const luAddress = (label: string) => ({
  id: '1', bbox: {}, geometry: { type: 'Point', coordinates: [5.988, 49.504] },
  properties: { label, layer_name: 'Adresse' },
});

const city = (
  country: CitySuggestion['country'],
  name: string,
  latitude = 0,
  longitude = 0,
): CitySuggestion => ({
  country, name, cityCode: name, postalCode: '', department: '', latitude, longitude, label: name,
});

const esch = city('LU', 'Esch-sur-Alzette', 49.4958, 5.9806);

describe('Recherche d’adresse — Suisse', () => {
  it('une commune bilingue ne sort qu’une fois, avec son canton', () => {
    const cities = parseChCities(chCommunes);
    expect(cities.map((c) => c.name)).toEqual(['Genève', 'Genthod']);
    expect(cities[0]).toMatchObject({ country: 'CH', cityCode: '6621', department: 'GE', postalCode: '' });
  });

  it('les adresses sont limitées à la commune choisie et portent leur code postal', () => {
    const addresses = parseChAddresses(chAddresses, '6621');
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatchObject({ name: 'Rue du Rhône 12', postalCode: '1204', city: 'Genève' });
  });
});

describe('Recherche d’adresse — Luxembourg', () => {
  it('le nom de localité perd sa variante luxembourgeoise', () => {
    expect(luBaseName('Esch-sur-Alzette (Esch-Uelzecht)')).toBe('Esch-sur-Alzette');
    expect(luBaseName('Eschweiler (Wiltz) (Eschweiler)')).toBe('Eschweiler (Wiltz)');
  });

  it('les adresses sont limitées à la localité et gardent le préfixe L-', () => {
    const addresses = parseLuAddresses(
      [
        luAddress('126, Rue de Luxembourg, L-4221 Esch-sur-Alzette'),
        {
          ...luAddress('12, Rue de Luxembourg, L-7540 Rollingen'),
          geometry: { type: 'Point', coordinates: [6.1155, 49.7409] },
        },
      ],
      esch,
    );
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatchObject({
      name: '126, Rue de Luxembourg', street: 'Rue de Luxembourg', housenumber: '126', postalCode: 'L-4221',
    });
  });

  it('un quartier de Luxembourg-Ville trouve les adresses de localité postale « Luxembourg »', () => {
    const kirchberg = city('LU', 'Kirchberg', 49.6297, 6.1617);
    const kennedy = {
      ...luAddress('44, Avenue John F. Kennedy, L-1855 Luxembourg'),
      geometry: { type: 'Point', coordinates: [6.1605, 49.6303] },
    };
    expect(parseLuAddresses([kennedy], kirchberg)).toHaveLength(1);
  });

  it('le géocodeur exact ne retient qu’un bâtiment trouvé', () => {
    const details = (postnumber: string) => ({
      postnumber, street: 'Rue de Luxembourg', zip: '4220', locality: 'Esch-sur-Alzette',
    });
    const addresses = parseLuGeocode(
      [
        { accuracy: 8, geomlonlat: { coordinates: [5.9857, 49.4967] }, AddressDetails: details('12') },
        { accuracy: 6, geomlonlat: { coordinates: [5.98, 49.49] }, AddressDetails: details('') },
      ],
      { ...esch, name: 'esch-sur-alzette' },
    );
    expect(addresses).toEqual([
      expect.objectContaining({ name: '12, Rue de Luxembourg', postalCode: 'L-4220', latitude: 49.4967 }),
    ]);
  });
});

describe('Fusion des villes des trois pays', () => {
  it('la France ne masque pas les villes étrangères', () => {
    const fr = Array.from({ length: 10 }, (_, i) => city('FR', `Mont ${i}`));
    const merged = mergeCities('Mont', fr, [city('CH', 'Montreux')], [city('LU', 'Montenach')], [city('BE', 'Mons-Montignies')]);
    expect(merged).toHaveLength(8);
    expect(merged.slice(-3).map((c) => c.country)).toEqual(['CH', 'LU', 'BE']);
  });

  it('une ville étrangère sans rapport avec la saisie est écartée', () => {
    const merged = mergeCities('Bruxelles', [], [city('CH', 'Saint-Prex')], [], [city('BE', 'Bruxelles')]);
    expect(merged.map((c) => c.name)).toEqual(['Bruxelles']);
  });

  it('sans résultat étranger, la France prend toute la liste', () => {
    const fr = Array.from({ length: 10 }, (_, i) => city('FR', `Paris ${i}`));
    expect(mergeCities('Paris', fr, [], [])).toHaveLength(8);
  });

  it('la ville au nom exact passe en tête, quel que soit son pays', () => {
    const merged = mergeCities('Luxembourg', [city('FR', 'Bouy-Luxembourg')], [], [
      city('LU', 'Luxembourg-Gare'),
      city('LU', 'Luxembourg'),
    ]);
    expect(merged[0]).toMatchObject({ country: 'LU', name: 'Luxembourg' });
  });
});

describe('Recherche d’adresse — Belgique (Photon)', () => {
  const photon = (properties: Record<string, unknown>, coordinates: [number, number] = [5.5736, 50.6451]) => ({
    geometry: { coordinates },
    properties: { osm_id: 1, countrycode: 'BE', ...properties },
  });
  const liege = city('BE', 'Liège', 50.6451, 5.5736);

  it('les villes hors de Belgique sont écartées (la bbox déborde sur la France)', () => {
    const cities = parsePhotonCities([
      photon({ type: 'city', name: 'Bruxelles' }),
      photon({ type: 'city', name: 'Bruay-la-Buissière', countrycode: 'FR' }),
    ]);
    expect(cities.map((c) => [c.country, c.name])).toEqual([['BE', 'Bruxelles']]);
  });

  it('une rue avec d’autres mots que la saisie est écartée, même au bon numéro', () => {
    const addresses = parsePhotonAddresses(
      [
        photon({ type: 'house', name: 'Fleurs Cécile', housenumber: '30', street: 'Rue Saint-Gilles', postcode: '4000', city: 'Liège' }),
        photon({ type: 'house', housenumber: '30', street: 'Rue Gustave Thiriart', postcode: '4000', city: 'Liège' }),
      ],
      liege,
      'rue saint-gilles 30',
    );
    expect(addresses).toEqual([
      expect.objectContaining({ name: 'Rue Saint-Gilles 30', postalCode: '4000', label: 'Rue Saint-Gilles 30, 4000 Liège' }),
    ]);
  });

  it('une rue seule (sans numéro trouvé) est proposée', () => {
    const addresses = parsePhotonAddresses(
      [photon({ type: 'street', name: 'Rue Saint-Gilles', postcode: '4000', city: 'Liège' })],
      liege,
      'rue saint-gil',
    );
    expect(addresses[0]).toMatchObject({ name: 'Rue Saint-Gilles', housenumber: undefined });
  });

  it('le dernier mot peut être en cours de frappe ; numéros et ville ignorés', () => {
    expect(streetMatchesQuery('Avenue Louise', 'avenue lou', 'Bruxelles')).toBe(true);
    expect(streetMatchesQuery('Avenue Louise', '54 avenue louise bruxelles', 'Bruxelles')).toBe(true);
    expect(streetMatchesQuery('Rue Neuve', 'avenue louise', 'Bruxelles')).toBe(false);
  });
});
