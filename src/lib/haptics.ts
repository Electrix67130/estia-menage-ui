/**
 * Retour haptique optionnel.
 *
 * `expo-haptics` est un module **natif**. Un bundle livré par OTA peut tourner
 * sur un binaire plus ancien qui ne l'embarque pas : c'est arrivé entre le build
 * TestFlight du 2 juillet et l'ajout du paquet le 21 juillet.
 *
 * Un `import` statique ne survit pas à cette situation — le paquet appelle
 * `requireNativeModule('ExpoHaptics')` au chargement du module, donc l'écran
 * plante AVANT que le moindre `try/catch` autour de l'appel ne serve à quelque
 * chose. D'où le chargement paresseux ci-dessous : on tente une fois, et si le
 * module manque on s'en passe définitivement. Un tic haptique n'est jamais
 * essentiel ; faire planter le calendrier pour lui, si.
 */
type ModuleHaptics = typeof import('expo-haptics');

// `undefined` = pas encore tenté · `null` = absent de ce binaire.
let charge: ModuleHaptics | null | undefined;

function obtenir(): ModuleHaptics | null {
  if (charge !== undefined) return charge;
  try {
    // require() et non import() : la résolution doit être tentée à l'exécution,
    // dans ce try, et non hissée en tête de module par le bundler.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    charge = require('expo-haptics') as ModuleHaptics;
  } catch {
    charge = null;
  }
  return charge;
}

/** Tic léger, comme le pull-to-refresh natif. Sans effet si le module manque. */
export function ticLeger(): void {
  const haptics = obtenir();
  if (!haptics) return;
  try {
    void haptics.impactAsync(haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    /* le module existe mais l'appareil refuse : sans conséquence */
  }
}
