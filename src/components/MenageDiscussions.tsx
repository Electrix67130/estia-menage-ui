import React from 'react';
import CommentThread from './CommentThread';

export type DiscussionSubTab = 'messages';

interface Props {
  menageId: string;
  canManageSteps?: boolean;
  canToggleSteps?: boolean;
  canViewSteps?: boolean;
  canViewComments: boolean;
  readonly?: boolean;
  onInputFocus?: () => void;
  subTab?: DiscussionSubTab;
  onSubTabChange?: (tab: DiscussionSubTab) => void;
}

/**
 * Vue messages d'un menage (sera renommé Menage en M2).
 * La gestion des étapes (steps) est désormais dans un onglet séparé "Check Ménage"
 * (cf. menage-check côté API). Ce composant ne montre donc que le flux de messages.
 */
export default function MenageDiscussions({ menageId, canViewComments, readonly, onInputFocus }: Props) {
  if (!canViewComments) return null;
  return <CommentThread menageId={menageId} readonly={readonly} onInputFocus={onInputFocus} />;
}
