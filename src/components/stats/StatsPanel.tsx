'use client'

import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { GameStats, TeamStandingInfo } from '@/lib/api/nhlStats'

interface StatsPanelProps {
  homeCode: string
  awayCode: string
  onClose:  () => void
}

// ─────────────────────────────────────────────
// Streak indicator
// ─────────────────────────────────────────────

function StreakBadge({ streak }: { streak: string }) {
  const isWin  = streak.startsWith('W')
  const isLoss = streak.startsWith('L')
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
      isWin  ? 'bg-green-500/20 text-green-400' :
      isLoss ? 'bg-red-500/20 text-red-400' :
               'bg-white/10 text-white/50'
    }`}>
      {isWin  ? <TrendingUp  className="w-3 h-3" /> :
       isLoss ? <TrendingDown className="w-3 h-3" /> :
                <Minus className="w-3 h-3" />}
      {streak}
    </span>
  )
}

// ─────────────────────────────────────────────
// Single team stats column
// ─────────────────────────────────────────────

function TeamStats({ team, isHome }: { team: TeamStandingInfo; isHome: boolean }) {
  return (
    <div className={`flex-1 ${isHome ? 'text-right' : 'text-left'}`}>
      {/* Team logo + code */}
      <div className={`flex items-center gap-2 mb-3 ${isHome ? 'flex-row-reverse' : 'flex-row'}`}>
        <img
          src={`https://assets.nhle.com/logos/nhl/svg/${team.teamCode}_dark.svg`}
          alt={team.teamCode}
          className="w-10 h-10 object-contain"
          onError={e => (e.currentTarget.style.display = 'none')}
        />
        <div className={isHome ? 'text-right' : 'text-left'}>
          <p className="text-white font-black text-lg">{team.teamCode}</p>
          <p className="text-white/40 text-xs">{isHome ? 'Home' : 'Away'}</p>
        </div>
      </div>

      {/* Record */}
      <div className="mb-3">
        <p className="text-hhp-gold font-black text-xl">
          {team.wins}-{team.losses}-{team.otLosses}
        </p>
        <p className="text-white/40 text-xs">{team.points} pts · {team.gamesPlayed} GP</p>
      </div>

      {/* Conference + Division rank */}
      <div className="space-y-1 mb-3">
        <div className={`flex items-center gap-1.5 ${isHome ? 'justify-end' : 'justify-start'}`}>
          <span className="text-white/40 text-xs">{team.conferenceName}</span>
          <span className="text-white text-xs font-bold">#{team.conferenceRank}</span>
        </div>
        <div className={`flex items-center gap-1.5 ${isHome ? 'justify-end' : 'justify-start'}`}>
          <span className="text-white/40 text-xs">{team.divisionName}</span>
          <span className="text-white text-xs font-bold">#{team.divisionRank}</span>
        </div>
      </div>

      {/* Last 10 + streak */}
      <div className="space-y-1.5">
        <div className={`flex items-center gap-2 ${isHome ? 'justify-end' : 'justify-start'}`}>
          <span className="text-white/40 text-xs">L10</span>
          <span className="text-white text-xs font-bold">{team.last10}</span>
        </div>
        <div className={`flex items-center gap-2 ${isHome ? 'justify-end' : 'justify-start'}`}>
          <span className="text-white/40 text-xs">Streak</span>
          <StreakBadge streak={team.streak} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────

export default function StatsPanel({ homeCode, awayCode, onClose }: StatsPanelProps) {
  const [stats,   setStats]   = useState<GameStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res  = await fetch(`/api/stats?home=${homeCode}&away=${awayCode}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setStats(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [homeCode, awayCode])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-hhp-navy-mid
                      border-l border-hhp-navy-light z-50 overflow-y-auto
                      animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-hhp-navy-light sticky top-0 bg-hhp-navy-mid">
          <div>
            <p className="text-white font-bold">{awayCode} @ {homeCode}</p>
            <p className="text-white/40 text-xs">Matchup Stats</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-white/30 text-sm">Loading stats...</div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-sm text-red-400">
              {error}
            </div>
          )}

          {stats && (
            <>
              {/* Team stats side by side */}
              <div>
                <p className="text-white/30 text-xs uppercase tracking-widest mb-3 text-center">
                  Season Stats
                </p>
                <div className="flex gap-4 items-start">
                  <TeamStats team={stats.awayTeam} isHome={false} />

                  {/* VS divider */}
                  <div className="flex flex-col items-center gap-1 pt-3 flex-shrink-0">
                    <span className="text-white/20 text-xs font-bold">VS</span>
                    <div className="w-px h-32 bg-hhp-navy-light" />
                  </div>

                  <TeamStats team={stats.homeTeam} isHome={true} />
                </div>
              </div>

              {/* Head to head */}
              <div>
                <p className="text-white/30 text-xs uppercase tracking-widest mb-3 text-center">
                  Head to Head — 2025-26
                </p>

                {stats.headToHead.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-4">
                    No meetings this season yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stats.headToHead.map((game, i) => {
                      const awayWon = game.winner === game.awayTeam
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2.5 rounded-lg bg-hhp-navy border border-hhp-navy-light text-sm"
                        >
                          {/* Date */}
                          <span className="text-white/30 text-xs w-20 flex-shrink-0">
                            {new Date(game.date + 'T12:00:00Z').toLocaleDateString(undefined, {
                              month: 'short',
                              day:   'numeric',
                            })}
                          </span>

                          {/* Away team */}
                          <span className={`font-bold flex-1 ${awayWon ? 'text-white' : 'text-white/40'}`}>
                            {game.awayTeam}
                          </span>

                          {/* Score */}
                          <span className="text-white font-black text-sm flex-shrink-0">
                            {game.awayScore} – {game.homeScore}
                          </span>

                          {/* Home team */}
                          <span className={`font-bold flex-1 text-right ${!awayWon ? 'text-white' : 'text-white/40'}`}>
                            {game.homeTeam}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}