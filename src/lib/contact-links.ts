import { Linking, Platform } from 'react-native';

/**
 * Erreur typée pour les échecs d'ouverture d'app native (tel:, mailto:, maps:).
 * Les composants qui appellent ces helpers doivent catcher et router vers
 * `useDialog().alert(...)` — on n'utilise plus `Alert.alert` natif côté app
 * (cf. règle `.claude/03-components.md`).
 */
export class ContactLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContactLinkError';
  }
}

/**
 * Lance l'app téléphone vers un numéro donné.
 * Nettoie les espaces/parenthèses/tirets pour générer un `tel:` valide.
 */
export async function openPhone(phone: string | null | undefined): Promise<void> {
  if (!phone) return;
  const cleaned = phone.replace(/[\s.()\-]/g, '');
  const url = `tel:${cleaned}`;
  await safeOpen(url, "Impossible de lancer l'appel");
}

/**
 * Ouvre l'app email avec destinataire pré-rempli.
 */
export async function openEmail(email: string | null | undefined, subject?: string): Promise<void> {
  if (!email) return;
  const qs = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  const url = `mailto:${email}${qs}`;
  await safeOpen(url, "Impossible d'ouvrir l'email");
}

/**
 * Ouvre Plans/Google Maps en mode itinéraire vers l'adresse.
 * Sur iOS : `maps://?daddr=...` (Plans natif), fallback Google web.
 * Sur Android : `geo:0,0?q=...` (intent natif), fallback Google web.
 */
export async function openMaps(address: string | null | undefined): Promise<void> {
  if (!address) return;
  const encoded = encodeURIComponent(address);
  const native =
    Platform.OS === 'ios' ? `maps://?daddr=${encoded}` : `geo:0,0?q=${encoded}`;
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  const canNative = await Linking.canOpenURL(native).catch(() => false);
  try {
    await Linking.openURL(canNative ? native : fallback);
  } catch {
    throw new ContactLinkError("Impossible de lancer l'itinéraire");
  }
}

async function safeOpen(url: string, errorMsg: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      throw new ContactLinkError(errorMsg);
    }
    await Linking.openURL(url);
  } catch (err) {
    if (err instanceof ContactLinkError) throw err;
    throw new ContactLinkError(errorMsg);
  }
}
