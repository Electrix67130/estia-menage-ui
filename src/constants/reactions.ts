/** Les réactions possibles sur un message : la même liste fermée que l'API. */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
