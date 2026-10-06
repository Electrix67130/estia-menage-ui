import { afterEach, describe, expect, it } from '@jest/globals';
import {
  menageLogementLabel,
  menagePrestataireLabel,
  menageSourceLabel,
  prestationTypeColorKey,
  prestationTypeLabel,
} from './types';
import { setCurrentLocale, translate } from '@/i18n/runtime';

afterEach(() => setCurrentLocale('fr'));

describe('Types de prestation — libellé et couleur', () => {
  it('Ménage / Check-in / Check-out, ménage par défaut', () => {
    expect(prestationTypeLabel('menage')).toBe('Ménage');
    expect(prestationTypeLabel('check_in')).toBe('Check-in');
    expect(prestationTypeLabel('check_out')).toBe('Check-out');
    expect(prestationTypeLabel(null)).toBe('Ménage');
    expect(prestationTypeLabel(undefined)).toBe('Ménage');
  });

  it('couleurs : ménage = bleu (primary), check-in = vert, check-out = rouge', () => {
    expect(prestationTypeColorKey('menage')).toBe('primary');
    expect(prestationTypeColorKey('check_in')).toBe('statusValide');
    expect(prestationTypeColorKey('check_out')).toBe('red');
    expect(prestationTypeColorKey(undefined)).toBe('primary');
  });

  it('suit la langue courante', () => {
    setCurrentLocale('en');
    expect(prestationTypeLabel('menage')).toBe(translate('prestationType.menage', undefined, 'en'));
  });
});

describe('Source d’une prestation (badge)', () => {
  it('manuelle sans source externe', () => {
    expect(menageSourceLabel(null)).toBe(translate('source.manual'));
    expect(menageSourceLabel(undefined)).toBe('Manuelle');
  });

  it('noms propres des plateformes connues, non traduits', () => {
    expect(menageSourceLabel('cal_airbnb')).toBe('Airbnb');
    expect(menageSourceLabel('cal_booking')).toBe('Booking');
    expect(menageSourceLabel('cal_vrbo')).toBe('Vrbo');
    expect(menageSourceLabel('cal_ical')).toBe('iCal');
  });

  it('un channel manager inconnu est « Externe »', () => {
    expect(menageSourceLabel('cal_passpass')).toBe(translate('source.external'));
  });
});

describe('Libellés prestataire / logement', () => {
  it('« Non assigné » sans prestataire, sinon prénom + nom', () => {
    expect(menagePrestataireLabel({ prestataire_user_id: null })).toBe(translate('common.unassigned'));
    expect(
      menagePrestataireLabel({ prestataire_user_id: 'u1', prestataire_first_name: 'Marie', prestataire_last_name: 'Dupont' }),
    ).toBe('Marie Dupont');
    expect(menagePrestataireLabel({ prestataire_user_id: 'u1', prestataire_first_name: 'Marie' })).toBe('Marie');
    expect(menagePrestataireLabel({ prestataire_user_id: 'u1' })).toBe('—');
  });

  it('nom du logement, sinon adresse + ville, sinon « Logement inconnu »', () => {
    expect(menageLogementLabel({ logement_name: 'Villa Azur', logement_address: '1 rue X' })).toBe('Villa Azur');
    expect(menageLogementLabel({ logement_address: '1 rue X', logement_city: 'Nice' })).toBe('1 rue X Nice');
    expect(menageLogementLabel({ logement_city: 'Nice' })).toBe('Nice');
    expect(menageLogementLabel({})).toBe(translate('menage.unknownLogement'));
  });
});
