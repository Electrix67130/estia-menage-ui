import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Linking } from 'react-native';
import { ContactLinkError, openEmail, openMaps, openPhone } from './contact-links';
import { translate } from '@/i18n/runtime';

const canOpen = Linking.canOpenURL as jest.MockedFunction<typeof Linking.canOpenURL>;
const open = Linking.openURL as jest.MockedFunction<typeof Linking.openURL>;

beforeEach(() => {
  canOpen.mockReset().mockResolvedValue(true);
  open.mockReset().mockResolvedValue(undefined);
});

describe('openPhone', () => {
  it('nettoie espaces, points, parenthèses et tirets pour un tel: valide', async () => {
    await openPhone('+33 (0)6 12.34-56 78');
    expect(open).toHaveBeenCalledWith('tel:+33061234-5678'.replace('-', ''));
  });

  it('ne fait rien sans numéro', async () => {
    await openPhone(null);
    await openPhone('');
    expect(open).not.toHaveBeenCalled();
  });

  it('erreur typée si l’appareil ne sait pas appeler', async () => {
    canOpen.mockResolvedValue(false);
    await expect(openPhone('0612345678')).rejects.toBeInstanceOf(ContactLinkError);
    await expect(openPhone('0612345678')).rejects.toThrow(translate('contactLinks.callFailed'));
  });
});

describe('openEmail', () => {
  it('mailto: avec sujet encodé', async () => {
    await openEmail('a@b.fr', 'Ménage du 5 oct');
    expect(open).toHaveBeenCalledWith(`mailto:a@b.fr?subject=${encodeURIComponent('Ménage du 5 oct')}`);
  });

  it('sans sujet, pas de query string', async () => {
    await openEmail('a@b.fr');
    expect(open).toHaveBeenCalledWith('mailto:a@b.fr');
  });
});

describe('openMaps (iOS sous Jest)', () => {
  it('ouvre Plans natif quand il est disponible', async () => {
    await openMaps('1 rue de la Paix, Paris');
    expect(open).toHaveBeenCalledWith(`maps://?daddr=${encodeURIComponent('1 rue de la Paix, Paris')}`);
  });

  it('repli Google Maps web sinon', async () => {
    canOpen.mockResolvedValue(false);
    await openMaps('Nice');
    expect(open).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=Nice');
  });

  it('erreur typée si l’ouverture échoue', async () => {
    open.mockRejectedValue(new Error('boom'));
    await expect(openMaps('Nice')).rejects.toThrow(translate('contactLinks.routeFailed'));
  });
});
