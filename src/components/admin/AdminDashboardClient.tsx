'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Users, Trophy, DollarSign, Settings,
  AlertTriangle, CheckCircle, Clock,
  ChevronRight, Shield
} from 'lucide-react'

interface AdminDashboardProps {
  season:       { id: string; name: string; isActive: boolean } | null
  allSeasons:   { id: string; name: string; isActive: boolean }[]
  currentWeek:  {
    id:         string
    weekNumber: number
    deadline:   string
    gamesCount: number
  } | null
  players:          { id: string; name: string }[]
  submittedUserIds: string[]
  seasonStats: {
    userId:      string
    name:        string
    totalPoints: number
    weeklyWins:  number
  }[]
  monthlyPot:          number
  suicidePots:         { winner: number; loser: number }
  lastCompletedWeekId: string | null
  settings:            { weeklyDues: number; weeklyPrize: number } | null
}

export default function AdminDashboardClient({
  season,
  allSeasons,
  currentWeek,
  players,
  submittedUserIds,
  seasonStats,
  monthlyPot,
  suicidePots,
  lastCompletedWeekId,
  settings,
}: AdminDashboardProps) {

  const [showStartConfirm, setShowStartConfirm]   = useState(false)
  const [selectedSeason,   setSelectedSeason]     = useState(
    allSeasons.find(s => !s.isActive)?.id ?? allSeasons[0]?.id ?? ''
  )
  const [starting,  setStarting]  = useState(false)
  const [seasonMsg, setSeasonMsg] = useState('')

  const submittedCount = submittedUserIds.length
  const totalPlayers   = players.length
  const pendingPlayers = players.filter(p => !submittedUserIds.includes(p.id))
  const allPicked      = submittedCount === totalPlayers && totalPlayers > 0

  const deadline     = currentWeek ? new Date(currentWeek.deadline) : null
  const now          = new Date()
  const hoursLeft    = deadline
    ? Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60))
    : null
  const isUrgent     = hoursLeft !== null && hoursLeft < 24
  const isPastDeadline = deadline ? now > deadline : false

  async function handleStartSeason() {
    setStarting(true)
    setSeasonMsg('')
    try {
      const res  = await fetch('/api/admin/season', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'start', seasonId: selectedSeason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSeasonMsg('Season started! Refreshing...')
      setShowStartConfirm(false)
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      setSeasonMsg(err.message || 'Failed to start season')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* ── NO ACTIVE SEASON ─────────────────── */}
      {!season && (
        <div className="hhp-card hhp-gold-border space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-hhp-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-bold">No active season</p>
              <p className="text-white/50 text-sm mt-1">
                Start a season to allow players to make picks.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <select
              value={selectedSeason}
              onChange={e => setSelectedSeason(e.target.value)}
              className="flex-1 bg-hhp-navy border border-hhp-navy-light rounded-lg
                         px-3 py-2 text-white text-sm focus:outline-none
                         focus:border-hhp-gold/50 transition-colors"
            >
              {allSeasons.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {!showStartConfirm ? (
              <button
                onClick={() => setShowStartConfirm(true)}
                className="px-4 py-2 rounded-lg bg-hhp-red hover:bg-hhp-red-dark
                           text-white font-bold text-sm transition-colors"
              >
                Start Season
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleStartSeason}
                  disabled={starting}
                  className="px-4 py-2 rounded-lg bg-hhp-red hover:bg-hhp-red-dark
                             text-white font-bold text-sm disabled:opacity-50
                             transition-colors"
                >
                  {starting ? 'Starting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowStartConfirm(false)}
                  className="px-4 py-2 rounded-lg border border-hhp-navy-light
                             text-white/60 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {seasonMsg && (
            <p className="text-sm text-green-400">{seasonMsg}</p>
          )}
        </div>
      )}

      {/* ── CURRENT WEEK STATUS ──────────────── */}
      {season && (
        <div className="hhp-card">
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-hhp-gold" />
            {currentWeek
              ? `Week ${currentWeek.weekNumber} — Pick Status`
              : 'No Open Week'}
          </h2>

          {!currentWeek ? (
            <div className="text-center py-6">
              <p className="text-white/40 text-sm">
                {lastCompletedWeekId
                  ? 'All weeks complete. New week opens Monday.'
                  : 'Season is active. Waiting for first weekend.'}
              </p>
              {lastCompletedWeekId && (
                <Link
                  href={`/results/week?weekId=${lastCompletedWeekId}`}
                  className="inline-flex items-center gap-1 mt-3 text-hhp-gold
                             text-sm hover:text-hhp-gold-light transition-colors"
                >
                  View last week's results
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">
                    {submittedCount} of {totalPlayers} submitted
                  </span>
                  {allPicked ? (
                    <span className="flex items-center gap-1 text-green-400 text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      All picks in!
                    </span>
                  ) : (
                    <span className={`text-xs ${
                      isUrgent ? 'text-red-400' : 'text-white/40'
                    }`}>
                      {isPastDeadline
                        ? 'Deadline passed'
                        : hoursLeft !== null
                          ? `${Math.floor(hoursLeft)}h remaining`
                          : ''}
                    </span>
                  )}
                </div>
                <div className="h-2 bg-hhp-navy rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      allPicked ? 'bg-green-500' : 'bg-hhp-gold'
                    }`}
                    style={{
                      width: totalPlayers > 0
                        ? `${(submittedCount / totalPlayers) * 100}%`
                        : '0%'
                    }}
                  />
                </div>
              </div>

              {/* Pending players */}
              {pendingPlayers.length > 0 && (
                <div>
                  <p className="text-white/40 text-xs mb-2">Still pending:</p>
                  <div className="flex flex-wrap gap-2">
                    {pendingPlayers.map(p => (
                      <span key={p.id}
                            className="px-2.5 py-1 rounded-full bg-yellow-500/10
                                       border border-yellow-500/20 text-yellow-400
                                       text-xs font-medium">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="flex gap-2 pt-2">
                {isPastDeadline && (
                  <Link
                    href="/admin/results"
                    className="flex-1 py-2 rounded-lg bg-hhp-gold text-hhp-navy
                               font-bold text-sm text-center hover:bg-hhp-gold-light
                               transition-colors"
                  >
                    Review Results →
                  </Link>
                )}
                {allPicked && !isPastDeadline && (
                  <Link
                    href={`/results/week?weekId=${currentWeek.id}`}
                    className="flex-1 py-2 rounded-lg bg-hhp-navy-light text-white
                               font-bold text-sm text-center hover:bg-hhp-navy
                               transition-colors border border-hhp-navy-light"
                  >
                    View Picks Grid →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── POTS SUMMARY ─────────────────────── */}
      {season && (
        <div className="grid grid-cols-3 gap-3">
          <div className="hhp-card text-center">
            <p className="text-white/40 text-xs mb-1">Monthly Pot</p>
            <p className="text-hhp-gold font-black text-lg">
              ${monthlyPot.toFixed(2)}
            </p>
          </div>
          <div className="hhp-card text-center">
            <p className="text-white/40 text-xs mb-1">Suicide W</p>
            <p className="text-green-400 font-black text-lg">
              ${suicidePots.winner.toFixed(2)}
            </p>
          </div>
          <div className="hhp-card text-center">
            <p className="text-white/40 text-xs mb-1">Suicide L</p>
            <p className="text-red-400 font-black text-lg">
              ${suicidePots.loser.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* ── MINI STANDINGS ───────────────────── */}
      {season && seasonStats.length > 0 && (
        <div className="hhp-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-hhp-gold" />
              Season Standings
            </h2>
            <Link
              href="/standings"
              className="text-hhp-gold/60 text-xs hover:text-hhp-gold
                         transition-colors"
            >
              Full standings →
            </Link>
          </div>
          <div className="space-y-2">
            {seasonStats.map((stat, i) => (
              <div key={stat.userId}
                   className="flex items-center gap-3 py-1.5">
                <span className="text-white/30 text-sm w-5 text-center">
                  {i + 1}
                </span>
                <span className="text-white text-sm flex-1">{stat.name}</span>
                <span className="text-white font-black">{stat.totalPoints}</span>
                <span className="text-white/30 text-xs">pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── QUICK LINKS ──────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            href:  '/admin/players',
            label: 'Players',
            sub:   `${players.length} active`,
            icon:  Users,
            color: 'text-blue-400',
          },
          {
            href:  '/admin/results',
            label: 'Results',
            sub:   'Confirm this week',
            icon:  Trophy,
            color: 'text-hhp-gold',
          },
          {
            href:  '/payments',
            label: 'Payments',
            sub:   'Track dues & wins',
            icon:  DollarSign,
            color: 'text-green-400',
          },
          {
            href:  '/admin/settings',
            label: 'Settings',
            sub:   'Configure pool rules',
            icon:  Settings,
            color: 'text-white/60',
          },
        ].map(({ href, label, sub, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="hhp-card flex items-center gap-3 hover:border-hhp-gold/30
                       transition-colors group"
          >
            <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm group-hover:text-hhp-gold
                            transition-colors">
                {label}
              </p>
              <p className="text-white/30 text-xs truncate">{sub}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 ml-auto flex-shrink-0
                                     group-hover:text-hhp-gold/50 transition-colors" />
          </Link>
        ))}
      </div>

    </div>
  )
}