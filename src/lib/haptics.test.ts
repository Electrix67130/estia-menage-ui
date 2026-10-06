import { describe, expect, it, jest } from '@jest/globals';

type HapticsLib = typeof import('./haptics');

/** Recharge `haptics.ts` dans un registre vierge, avec le mock d'expo-haptics fourni. */
function loadWith(factory: () => unknown): HapticsLib {
  let lib!: HapticsLib;
  jest.isolateModules(() => {
    jest.doMock('expo-haptics', factory);
    lib = jest.requireActual<HapticsLib>('./haptics');
  });
  return lib;
}

describe('Retour haptique à chargement paresseux (OTA sur binaire sans le module)', () => {
  it('ne plante pas quand expo-haptics est absent du binaire', () => {
    const lib = loadWith(() => {
      throw new Error("Cannot find native module 'ExpoHaptics'");
    });
    expect(() => lib.ticLeger()).not.toThrow();
    expect(() => lib.ticLeger()).not.toThrow();
  });

  it('déclenche un impact léger quand le module existe', () => {
    const impactAsync = jest.fn(async () => undefined);
    const lib = loadWith(() => ({ impactAsync, ImpactFeedbackStyle: { Light: 'light' } }));
    lib.ticLeger();
    lib.ticLeger();
    expect(impactAsync).toHaveBeenCalledTimes(2);
    expect(impactAsync).toHaveBeenCalledWith('light');
  });

  it('absorbe un refus de l’appareil (impactAsync qui rejette ou qui lève)', async () => {
    const rejecting = loadWith(() => ({
      impactAsync: jest.fn(async () => {
        throw new Error('unsupported');
      }),
      ImpactFeedbackStyle: { Light: 'light' },
    }));
    expect(() => rejecting.ticLeger()).not.toThrow();
    await Promise.resolve();

    const throwing = loadWith(() => ({
      impactAsync: () => {
        throw new Error('sync failure');
      },
      ImpactFeedbackStyle: { Light: 'light' },
    }));
    expect(() => throwing.ticLeger()).not.toThrow();
  });
});
