import * as Updates from 'expo-updates';
import type { Locale } from '@/i18n/translations';
import type { CreateFeedbackInput } from '@/api/hooks/useFeedback';

/**
 * Contexte technique joint à tout envoi vers `POST /feedbacks` (bug,
 * suggestion ou signalement). Sans lui un bug mobile est irreproductible :
 * la version installée dit si un correctif est bien arrivé chez l'utilisateur,
 * l'écran dit où ça s'est passé.
 */
export function feedbackContext(
  locale: Locale,
  screen?: string,
): Pick<CreateFeedbackInput, 'platform' | 'app_version' | 'screen' | 'locale'> {
  return {
    platform: 'mobile',
    app_version: Updates.runtimeVersion ?? undefined,
    screen,
    locale,
  };
}
