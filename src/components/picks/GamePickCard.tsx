'use client'

import { useState, useEffect } from 'react'
import { NHLGameFromAPI } from '@/lib/api/nhl'

interface GamePickCardProps {
  game:         NHLGameFromAPI
  selectedTeam: string | null
  onPick:       (gameId: string, teamCode: string) => void
  isLocked:     boolean
}

export default function GamePickCard({ game, selectedTeam, onPick, isLocked }: GamePickCardProps) {
  const gameId   = String(game.id)
  const awayCode = game.awayTeam.abbrev
  const homeCode = game.homeTeam.abbrev
  const [gameTime, setGameTime] = useState('')

  useEffect(() => {
    setGameTime(new Date(game.startTimeUTC).toLocaleTimeString(undefined, {
      hour:   'numeric',
      minute: '2-digit',
    }))
  }, [game.startTimeUTC])

  function btnClass(teamCode: string) {
    const selected = selectedTeam === teamCode
    if (isLocked && selected)
      return 'flex items-center gap-1.5 px-3 py-1 rounded-lg border border-hhp-gold/40 bg-hhp-gold/10 text-hhp-gold text-sm font-bold cursor-default flex-1'
    if (isLocked)
      return 'flex items-center gap-1.5 px-3 py-1 rounded-lg border border-hhp-navy-light text-white/25 text-sm font-semibold cursor-default flex-1'
    if (selected)
      return 'flex items-center gap-1.5 px-3 py-1 rounded-lg border-2 border-hhp-gold bg-hhp-gold/10 text-hhp-gold text-sm font-bold flex-1'
    return 'flex items-center gap-1.5 px-3 py-1 rounded-lg border border-hhp-navy-light text-white/60 text-sm font-semibold hover:text-white hover:border-hhp-gold/40 transition-colors flex-1'
  }

  return (
    <div className="flex items-center gap-2 py-1 border-b border-hhp-navy-light/30 last:border-0">

      {/* Time */}
      <span className="text-white/30 text-xs w-14 flex-shrink-0 text-right">
        {gameTime}
      </span>

      {/* Away team */}
      <button
        onClick={() => !isLocked && onPick(gameId, awayCode)}
        className={btnClass(awayCode)}
      >
        <img
          src={`https://assets.nhle.com/logos/nhl/svg/${awayCode}_dark.svg`}
          alt={awayCode}
          className="w-5 h-5 object-contain flex-shrink-0"
          onError={e => (e.currentTarget.style.display = 'none')}
        />
        <span className="truncate">{awayCode}</span>
      </button>

      {/* @ */}
      <span className="text-white/20 text-xs flex-shrink-0">@</span>

      {/* Home team */}
      <button
        onClick={() => !isLocked && onPick(gameId, homeCode)}
        className={btnClass(homeCode)}
      >
        <img
          src={`https://assets.nhle.com/logos/nhl/svg/${homeCode}_dark.svg`}
          alt={homeCode}
          className="w-5 h-5 object-contain flex-shrink-0"
          onError={e => (e.currentTarget.style.display = 'none')}
        />
        <span className="truncate">{homeCode}</span>
      </button>

    </div>
  )
}