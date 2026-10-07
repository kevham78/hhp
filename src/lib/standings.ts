// Season ranking, shared by the Standings page and the admin dashboard.
// Rank by money won, then weekly wins, then monthly wins, then points.
// Players equal on all four share the rank, and the next rank is
// skipped (1, 2, 2, 4).

type Rankable = {
  name:        string | null
  moneyWon:    number
  weeklyWins:  number
  monthlyWins: number
  totalPoints: number
}

const compare = (a: Rankable, b: Rankable) =>
  b.moneyWon - a.moneyWon || b.weeklyWins - a.weeklyWins
  || b.monthlyWins - a.monthlyWins || b.totalPoints - a.totalPoints

export function rankPlayers<T extends Rankable>(players: T[]): (T & { rank: number; isTied: boolean })[] {
  const sorted = [...players].sort((a, b) => compare(a, b) || (a.name ?? '').localeCompare(b.name ?? ''))
  return sorted.map((player, i) => ({
    ...player,
    rank:   sorted.findIndex(p => compare(p, player) === 0) + 1,
    isTied: sorted.some((p, j) => j !== i && compare(p, player) === 0),
  }))
}

// $30, $7.50
export const formatMoney = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`
