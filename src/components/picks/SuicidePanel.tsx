'use client'

import { useState, useEffect } from 'react'
import { NHLGameFromAPI, getGameLabel } from '@/lib/api/nhl'
import { STRIKES_TO_ELIMINATE } from '@/lib/suicide'

interface PickedTeam {
  gameId: string
  team:   string
  game:   NHLGameFromAPI
}

interface TeamButtonProps {
  team:          string
  game:          NHLGameFromAPI
  isSelected:    boolean
  isDisabled:    boolean
  isUsedBefore:  boolean
  selectedClass: string
  disabledClass: string
  defaultClass:  string
  checkColor:    string
  onClick:       () => void
}

interface SuicidePanelProps {
  pickedWinners:     PickedTeam[]
  pickedLosers:      PickedTeam[]
  suicide:           { winner: string | null; loser: string | null }
  winnerSuicideTeam: string | null
  loserSuicideTeam:  string | null
  winnerTeamsUsed:   string[]
  loserTeamsUsed:    string[]
  inWinnerPool:      boolean
  inLoserPool:       boolean
  winnerStrikes:     number
  onSelect:          (type: 'winner' | 'loser', gameId: string) => void
  isLocked:          boolean
}

function TeamButton({
  team,
  game,
  isSelected,
  isDisabled,
  isUsedBefore,
  selectedClass,
  disabledClass,
  defaultClass,
  checkColor,
  onClick,
}: TeamButtonProps) {
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
        isSelected ? selectedClass :
        isDisabled ? (isUsedBefore
          ? 'border-white/10 text-white/15 cursor-not-allowed line-through'
          : disabledClass)
        : defaultClass
      }`}
    >
      <img
        src={`https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`}
        alt={team}
        className="w-5 h-5 object-contain shrink-0"
        onError={e => (e.currentTarget.style.display = 'none')}
      />
      <div className="flex flex-col items-start min-w-0">
        <span className="font-semibold leading-tight">{team}</span>
        <span className="text-xs opacity-50 leading-tight">{label}</span>
      </div>
      {isUsedBefore && (
        <span className="ml-auto text-xs opacity-40 shrink-0">used</span>
      )}
      {isSelected && (
        <span className={`ml-auto shrink-0 ${checkColor}`}>✓</span>
      )}
    </button>
  )
}

export default function SuicidePanel({
  pickedWinners,
  pickedLosers,
  suicide,
  winnerSuicideTeam,
  loserSuicideTeam,
  winnerTeamsUsed,
  loserTeamsUsed,
  inWinnerPool,
  inLoserPool,
  winnerStrikes,
  onSelect,
  isLocked,
}: SuicidePanelProps) {
  const onLastStrike = winnerStrikes === STRIKES_TO_ELIMINATE.WINNER - 1

  return (
    <div className="hhp-card space-y-4">
      <p className="text-white/40 text-xs">
        {inWinnerPool && <>
          Select one team you're most confident will{' '}
          <span className="text-green-400 font-semibold">win</span>
        </>}
        {inWinnerPool && inLoserPool && ' and one team'}
        {!inWinnerPool && 'Select one team'}
        {inLoserPool && <>
          {' '}you're most confident will{' '}
          <span className="text-red-400 font-semibold">lose</span>
        </>}.
        You cannot pick the same team twice across the season.
      </p>

      {/* A pool the player is out of gets no pick */}
      {(!inWinnerPool || !inLoserPool) && (
        <p className="text-white/40 text-xs">
          You're out of the {inWinnerPool ? 'Loser' : 'Winner'} Pool, so there's no{' '}
          {inWinnerPool ? 'loser' : 'winner'} pick for you this week.
        </p>
      )}
      {inWinnerPool && onLastStrike && (
        <p className="text-yellow-400 text-xs">
          ⚠️ You have {winnerStrikes} strike{winnerStrikes > 1 ? 's' : ''} in the Winner Pool —
          one more wrong pick and you're out.
        </p>
      )}

      <div className={`grid gap-4 ${inWinnerPool && inLoserPool ? 'grid-cols-2' : 'grid-cols-1'}`}>

        {/* Winner suicide */}
        {inWinnerPool && (
        <div>
          <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-2">
            🏆 Winner Pick
          </p>
          <div className="space-y-1.5">
            {pickedWinners.map(({ gameId, team, game }) => {
              const isSelected   = suicide.winner === gameId
              const isUsedBefore = winnerTeamsUsed.includes(team)
              const isDisabled   = isLocked || loserSuicideTeam === team || isUsedBefore
              return (
                <TeamButton
                  key={`winner-${gameId}`}
                  team={team}
                  game={game}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  isUsedBefore={isUsedBefore}
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
        )}

        {/* Loser suicide */}
        {inLoserPool && (
        <div>
          <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2">
            💀 Loser Pick
          </p>
          <div className="space-y-1.5">
            {pickedLosers.map(({ gameId, team, game }) => {
              const isSelected   = suicide.loser === gameId
              const isUsedBefore = loserTeamsUsed.includes(team)
              const isDisabled   = isLocked || winnerSuicideTeam === team || isUsedBefore
              return (
                <TeamButton
                  key={`loser-${gameId}`}
                  team={team}
                  game={game}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  isUsedBefore={isUsedBefore}
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
        )}

      </div>
    </div>
  )
}