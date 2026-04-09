'use client'

import { NHLGameFromAPI } from '@/lib/api/nhl'
import { getGameLabel } from '@/lib/api/nhl'


interface PickedWinner {
  gameId: string
  team:   string
  game:   NHLGameFromAPI
}

interface TiebreakerPanelProps {
  pickedWinners: PickedWinner[]
  tiebreakers:   Record<string, number>
  onSelect:      (gameId: string, rank: number) => void
  isLocked:      boolean
}

const RANKS = [
  { rank: 1, label: '1st', color: 'bg-yellow-400 text-black' },
  { rank: 2, label: '2nd', color: 'bg-gray-300 text-black' },
  { rank: 3, label: '3rd', color: 'bg-amber-600 text-white' },
]

export default function TiebreakerPanel({
  pickedWinners, tiebreakers, onSelect, isLocked
}: TiebreakerPanelProps) {
  return (
    <div className="hhp-card space-y-3">
      <p className="text-white/40 text-xs">
        Click a rank button next to each of your 3 most confident picks.
        You must select exactly one 1st, one 2nd, and one 3rd.
      </p>

      {pickedWinners.map(({ gameId, team, game }) => {
        const currentRank = tiebreakers[gameId]

        return (
          <div key={gameId} className="flex items-center gap-3 py-2 border-b border-hhp-navy-light last:border-0">
            {/* Team */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <img
                src={`https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`}
                alt={team}
                className="w-6 h-6 object-contain flex-shrink-0"
                onError={e => (e.currentTarget.style.display = 'none')}
              />
              <span className="text-white font-semibold text-sm">{team}</span>
<span className="text-white/30 text-xs truncate">
  {typeof window !== 'undefined' ? getGameLabel(game, team) : ''}
</span>
            </div>

            {/* Rank buttons */}
            <div className="flex gap-1.5 flex-shrink-0">
              {RANKS.map(({ rank, label, color }) => {
                const isSelected = currentRank === rank
                const isUsed     = Object.values(tiebreakers).includes(rank) && !isSelected
                return (
                  <button
                    key={rank}
                    onClick={() => !isLocked && onSelect(gameId, rank)}
                    disabled={isLocked || (isUsed && !isSelected)}
                    className={`w-9 h-7 rounded text-xs font-black transition-all ${
                      isSelected
                        ? color
                        : isUsed
                          ? 'bg-white/5 text-white/20 cursor-not-allowed'
                          : 'bg-hhp-navy-light text-white/50 hover:text-white hover:bg-hhp-navy-light/80'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}