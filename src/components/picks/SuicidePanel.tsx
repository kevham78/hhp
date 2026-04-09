'use client'

import { useState, useEffect } from 'react'
import { NHLGameFromAPI, getGameLabel } from '@/lib/api/nhl'

interface PickedTeam {
  gameId: string
  team:   string
  game:   NHLGameFromAPI
}

interface SuicidePanelProps {
  pickedWinners:     PickedTeam[]
  pickedLosers:      PickedTeam[]
  suicide:           { winner: string | null; loser: string | null }
  winnerSuicideTeam: string | null
  loserSuicideTeam:  string | null
  onSelect:          (type: 'winner' | 'loser', gameId: string) => void
  isLocked:          boolean
}

function TeamButton({
  team,
  game,
  isSelected,
  isDisabled,
  selectedClass,
  disabledClass,
  defaultClass,
  checkColor,
  onClick,
}: {
  team:          string
  game:          NHLGameFromAPI
  isSelected:    boolean
  isDisabled:    boolean
  selectedClass: string
  disabledClass: string
  defaultClass:  string
  checkColor:    string
  onClick:       () => void
}) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    setLabel(getGameLabel(game, team))
  }, [game, team])

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border
                  text-sm font-semibold transition-all ${
        isSelected ? selectedClass : isDisabled ? disabledClass : defaultClass
      }`}
    >
      <img
        src={`https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`}
        alt={team}
        className="w-5 h-5 object-contain flex-shrink-0"
        onError={e => (e.currentTarget.style.display = 'none')}
      />
      <div className="flex flex-col items-start min-w-0">
        <span className="font-semibold leading-tight">{team}</span>
        <span className="text-xs opacity-50 leading-tight">{label}</span>
      </div>
      {isSelected && <span className={`ml-auto flex-shrink-0 ${checkColor}`}>✓</span>}
    </button>
  )
}
export default function SuicidePanel({
  pickedWinners,
  pickedLosers,
  suicide,
  winnerSuicideTeam,
  loserSuicideTeam,
  onSelect,
  isLocked,
}: SuicidePanelProps) {
  return (
    <div className="hhp-card space-y-4">
      <p className="text-white/40 text-xs">
        Select one team you're most confident will{' '}
        <span className="text-green-400 font-semibold">win</span> and one team
        you're most confident will{' '}
        <span className="text-red-400 font-semibold">lose</span>.
        You cannot pick the same team twice across the season.
      </p>

      <div className="grid grid-cols-2 gap-4">

        {/* Winner suicide */}
        <div>
          <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-2">
            🏆 Winner Pick
          </p>
          <div className="space-y-1.5">
            {pickedWinners.map(({ gameId, team, game }) => {
  const isSelected = suicide.winner === gameId
  const isDisabled = isLocked || loserSuicideTeam === team
  return (
    <TeamButton
      key={`winner-${gameId}`}
      team={team}
      game={game}
      isSelected={isSelected}
      isDisabled={isDisabled}
      selectedClass="border-green-500 bg-green-500/15 text-green-400"
      disabledClass="border-hhp-navy-light text-white/20 cursor-not-allowed"
      defaultClass="border-hhp-navy-light text-white/60 hover:text-white hover:border-green-500/40"
      checkColor="text-green-400"
      onClick={() => !isDisabled && onSelect('winner', gameId)}
    />
  )
})}
          </div>
        </div>

        {/* Loser suicide */}
        <div>
          <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2">
            💀 Loser Pick
          </p>
          <div className="space-y-1.5">
            {pickedLosers.map(({ gameId, team, game }) => {
  const isSelected = suicide.loser === gameId
  const isDisabled = isLocked || winnerSuicideTeam === team
  return (
    <TeamButton
      key={`loser-${gameId}`}
      team={team}
      game={game}
      isSelected={isSelected}
      isDisabled={isDisabled}
      selectedClass="border-red-500 bg-red-500/15 text-red-400"
      disabledClass="border-hhp-navy-light text-white/20 cursor-not-allowed"
      defaultClass="border-hhp-navy-light text-white/60 hover:text-white hover:border-red-500/40"
      checkColor="text-red-400"
      onClick={() => !isDisabled && onSelect('loser', gameId)}
    />
  )
})}
          </div>
        </div>

      </div>
    </div>
  )
}