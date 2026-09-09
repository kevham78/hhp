'use client'

import { useState, useEffect } from 'react'
import { Trophy, Calendar } from 'lucide-react'
import Link from 'next/link'

interface WeeklyResult {
  weekId:     string
  weekNumber: number
  satDate:    string
  points:     number
  isWinner:   boolean
  isTied:     boolean
}

interface PlayerStanding {
  userId:        string
  name:          string
  image:         string | null
  totalPoints:   number
  weeklyWins:    number
  monthlyWins:   number
  weeklyResults: WeeklyResult[]
}

interface WeekHistory {
  weekId:      string
  weekNumber:  number
  satDate:     string
  sunDate:     string
  topPoints:   number
  winnerNames: string[]
  isSplit:     boolean
}

interface StandingsData {
  seasonName:  string
  standings:   PlayerStanding[]
  weekHistory: WeekHistory[]
  totalWeeks:  number
}

export default function StandingsClient() {
  const [data,    setData]    = useState<StandingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [view,    setView]    = useState<'standings' | 'history'>('standings')

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/standings')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setData(json)
      } catch (err: any) {
        setError(err.message || 'Failed to load standings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="hhp-card text-center py-12">
        <p className="text-white/40">Loading standings...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400">
        {error}
      </div>
    )
  }

  if (!data) return null

  const noWeeks = data.totalWeeks === 0

  return (
    <div className="space-y-6">

      {/* Season badge */}
      <div className="flex items-center gap-3">
        <span className="px-3 py-1 rounded-full bg-hhp-gold/15 text-hhp-gold
                         text-sm font-bold border border-hhp-gold/20">
          {data.seasonName} Season
        </span>
        <span className="text-white/30 text-sm">
          {data.totalWeeks} week{data.totalWeeks !== 1 ? 's' : ''} completed
        </span>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('standings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                      font-semibold transition-colors ${
            view === 'standings'
              ? 'bg-hhp-gold/15 text-hhp-gold border border-hhp-gold/20'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Season Standings
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                      font-semibold transition-colors ${
            view === 'history'
              ? 'bg-hhp-gold/15 text-hhp-gold border border-hhp-gold/20'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Week by Week
        </button>
      </div>

      {/* ── SEASON STANDINGS ─────────────────── */}
      {view === 'standings' && (
        <div className="hhp-card">
          {noWeeks ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🏒</p>
              <p className="text-white font-bold">Season hasn't started yet</p>
              <p className="text-white/40 text-sm mt-1">
                Standings will appear after the first week is completed.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="flex items-center gap-3 pb-3 border-b
                              border-hhp-navy-light text-white/30 text-xs
                              font-semibold uppercase tracking-widest">
                <span className="w-6">#</span>
                <span className="flex-1">Player</span>
                <span className="w-16 text-center">Points</span>
                <span className="w-16 text-center">Wins</span>
                <span className="w-20 text-center">Monthly W</span>
              </div>

              {data.standings.map((player, i) => {
                const isFirst = i === 0
                return (
                  <div
                    key={player.userId}
                    className={`flex items-center gap-3 py-3 border-b
                                border-hhp-navy-light/30 last:border-0 ${
                      isFirst ? 'relative' : ''
                    }`}
                  >
                    {/* Rank */}
                    <div className={`w-6 text-center flex-shrink-0 ${
                      i === 0 ? 'text-hhp-gold font-black' :
                      i === 1 ? 'text-white/60 font-bold' :
                      i === 2 ? 'text-amber-600 font-bold' :
                                'text-white/30'
                    }`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </div>

                    {/* Avatar + name */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-hhp-navy-light
                                      border border-hhp-gold/30 flex-shrink-0
                                      flex items-center justify-center">
                        {player.image ? (
                          <img
                            src={player.image}
                            alt={player.name ?? ''}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-hhp-gold text-xs font-bold">
                            {player.name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className={`font-semibold text-sm truncate ${
                        isFirst ? 'text-hhp-gold' : 'text-white'
                      }`}>
                        {player.name}
                      </span>
                    </div>

                    {/* Points */}
                    <div className="w-16 text-center flex-shrink-0">
                      <span className={`font-black text-lg ${
                        isFirst ? 'text-hhp-gold' : 'text-white'
                      }`}>
                        {player.totalPoints}
                      </span>
                    </div>

                    {/* Weekly wins */}
                    <div className="w-16 text-center flex-shrink-0">
                      <span className="text-white/70 font-semibold text-sm">
                        {player.weeklyWins}
                      </span>
                    </div>

                    {/* Monthly wins */}
                    <div className="w-20 text-center flex-shrink-0">
                      <span className="text-white/70 font-semibold text-sm">
                        {player.monthlyWins}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── WEEK BY WEEK HISTORY ─────────────── */}
      {view === 'history' && (
        <div className="space-y-3">
          {noWeeks ? (
            <div className="hhp-card text-center py-12">
              <p className="text-4xl mb-3">📅</p>
              <p className="text-white font-bold">No completed weeks yet</p>
              <p className="text-white/40 text-sm mt-1">
                History will appear after the first week is completed.
              </p>
            </div>
          ) : (
            data.weekHistory.map(week => {
              const satDate = new Date(week.satDate + 'T12:00:00Z')
                .toLocaleDateString(undefined, {
                  month: 'short',
                  day:   'numeric',
                })

              return (
                <div key={week.weekId} className="hhp-card">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-bold text-sm">
                        Week {week.weekNumber}
                      </p>
                      <p className="text-white/30 text-xs">{satDate}</p>
                    </div>
                    <Link
                      href={`/results/week?weekId=${week.weekId}`}
                      className="text-xs text-hhp-gold/70 hover:text-hhp-gold
                                 transition-colors"
                    >
                      View picks →
                    </Link>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Winner */}
                    <div className="flex-1">
                      <p className="text-white/40 text-xs mb-1">
                        {week.isSplit ? 'Winners (split)' : 'Winner'}
                      </p>
                      <p className="text-hhp-gold font-bold text-sm">
                        {week.winnerNames.join(' & ') || '—'}
                      </p>
                    </div>

                    {/* Top points */}
                    <div className="text-right">
                      <p className="text-white/40 text-xs mb-1">Top score</p>
                      <p className="text-white font-black text-lg">
                        {week.topPoints}
                      </p>
                    </div>
                  </div>

                  {/* Player points bar */}
                  <div className="mt-3 space-y-1.5">
                    {data.standings.map(player => {
                      const wr = player.weeklyResults.find(
                        r => r.weekId === week.weekId
                      )
                      if (!wr) return null
                      const pct = week.topPoints > 0
                        ? (wr.points / week.topPoints) * 100
                        : 0

                      return (
                        <div key={player.userId}
                             className="flex items-center gap-2">
                          <span className="text-white/50 text-xs w-16 truncate">
                            {player.name}
                          </span>
                          <div className="flex-1 h-2 bg-hhp-navy rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                wr.isWinner
                                  ? 'bg-hhp-gold'
                                  : 'bg-hhp-navy-light'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold w-6 text-right ${
                            wr.isWinner ? 'text-hhp-gold' : 'text-white/50'
                          }`}>
                            {wr.points}
                          </span>
                          {wr.isWinner && (
                            <span className="text-xs">🏆</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}