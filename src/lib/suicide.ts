// Wrong (or missed) picks that knock a player out of each suicide pool.
// Plain constants so client components (My Picks, Help) can share them.
export const STRIKES_TO_ELIMINATE = {
  WINNER: 2,
  LOSER:  1,
} as const
