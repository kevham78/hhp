'use client'

import { useState, useEffect } from 'react'
import { NHLGameFromAPI } from '@/lib/api/nhl'
import GamePickCard from './GamePickCard'
import PhaseBanner from './PhaseBanner'
import TiebreakerPanel from './TiebreakerPanel'
import SuicidePanel from './SuicidePanel'
import StatsPanel from '@/components/stats/StatsPanel'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────




export type PicksState = {
  picks:       Record<string, string>
  tiebreakers: Record<string, number>
  suicide: {
    winner: string | null  // now stores gameId, not teamCode
    loser:  string | null  // now stores gameId, not teamCode
  }
}

interface PicksClientProps {
  saturdayGames:    NHLGameFromAPI[]
  sundayGames:      NHLGameFromAPI[]
  saturdayDate:     string
  sundayDate:       string
  weekId:           string
  deadline:         string
  existingPicks:    PicksState
  isOpen:           boolean
  winnerTeamsUsed:  string[]
  loserTeamsUsed:   string[]
}


// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function PicksClient({
  saturdayGames,
  sundayGames,
  saturdayDate,
  sundayDate,
  weekId,
  deadline,
  existingPicks,
  isOpen,
  winnerTeamsUsed,
  loserTeamsUsed,
}: PicksClientProps) {

  const [state, setState] = useState<PicksState>(existingPicks)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [formattedDeadline, setFormattedDeadline] = useState('')
  const [formattedSatDate, setFormattedSatDate] = useState('')
  const [formattedSunDate, setFormattedSunDate] = useState('')
  const [statsGame, setStatsGame] = useState<{ home: string; away: string } | null>(null)

function handleOpenStats(homeCode: string, awayCode: string) {
  setStatsGame({ home: homeCode, away: awayCode })
}

  useEffect(() => {
    setFormattedDeadline(new Date(deadline).toLocaleString(undefined, {
      weekday:      'long',
      month:        'short',
      day:          'numeric',
      hour:         'numeric',
      minute:       '2-digit',
      timeZoneName: 'short',
    }))
  }, [deadline])

  useEffect(() => {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
    timeZone: 'UTC', // prevent timezone shift on date-only strings
  }
  setFormattedSatDate(new Date(saturdayDate + 'T12:00:00Z').toLocaleDateString(undefined, opts))
  setFormattedSunDate(new Date(sundayDate   + 'T12:00:00Z').toLocaleDateString(undefined, opts))
}, [saturdayDate, sundayDate])

const allGames    = [...saturdayGames, ...sundayGames]
  const totalGames  = allGames.length
  const pickedCount = Object.keys(state.picks).length
  const allPicked = pickedCount === totalGames && totalGames > 0

  // Winners picked this week (for tiebreaker selection)
  const pickedWinners = Object.entries(state.picks).map(([gameId, team]) => ({
    gameId,
    team,
    game: allGames.find(g => String(g.id) === gameId)!,
  })).filter(p => p.game)

  // Losers — the team NOT picked in each game (for loser suicide pool)
  const pickedLosers = Object.entries(state.picks).map(([gameId, pickedTeam]) => {
    const game = allGames.find(g => String(g.id) === gameId)
    if (!game) return null
    const losingTeam = game.awayTeam.abbrev === pickedTeam
      ? game.homeTeam.abbrev
      : game.awayTeam.abbrev
    return { gameId, team: losingTeam, game }
  }).filter(Boolean) as { gameId: string; team: string; game: NHLGameFromAPI }[]

  // The actual team selected for winner suicide (look up by gameId)
const winnerSuicideTeam = state.suicide.winner
  ? state.picks[state.suicide.winner] ?? null
  : null

// The actual team selected for loser suicide
const loserSuicideTeam = state.suicide.loser
  ? pickedLosers.find(l => l.gameId === state.suicide.loser)?.team ?? null
  : null

  const tiebreakerCount = Object.keys(state.tiebreakers).length
  const allTiebreakers  = tiebreakerCount === 3

const hasSuicideWinner = !!state.suicide.winner
const hasSuicideLoser  = !!state.suicide.loser
const allSuicide       = hasSuicideWinner && hasSuicideLoser

  const canSubmit = allPicked && allTiebreakers && allSuicide

  // ── Pick a team ────────────────────────────
function handlePick(gameId: string, teamCode: string) {
  if (!isOpen) return

  setState(prev => {
    // If the pick didn't actually change, do nothing
    if (prev.picks[gameId] === teamCode) return prev

    // Pick changed — clear ALL Phase 2 and 3 selections
    return {
      picks:       { ...prev.picks, [gameId]: teamCode },
      tiebreakers: {},
      suicide:     { winner: null, loser: null },
    }
  })
}

  // ── Set tiebreaker rank ────────────────────
  function handleTiebreaker(gameId: string, rank: number) {
    if (!isOpen) return

    setState(prev => {
      const newTiebreakers = { ...prev.tiebreakers }

      // Remove existing pick with this rank
      for (const [gId, r] of Object.entries(newTiebreakers)) {
        if (r === rank && gId !== gameId) delete newTiebreakers[gId]
      }

      // Toggle off if same pick clicked again
      if (newTiebreakers[gameId] === rank) {
        delete newTiebreakers[gameId]
      } else {
        newTiebreakers[gameId] = rank
      }

      return { ...prev, tiebreakers: newTiebreakers }
    })
  }

  // ── Set suicide pick ───────────────────────
function handleSuicide(type: 'winner' | 'loser', gameId: string) {
  if (!isOpen) return
  setState(prev => ({
    ...prev,
    suicide: {
      ...prev.suicide,
      [type]: prev.suicide[type] === gameId ? null : gameId,
    },
  }))
}

// ── Random picks (DEV ONLY) ────────────────
function handleRandomPicks() {
  const newPicks: Record<string, string> = {}

  for (const game of allGames) {
    const gameId   = String(game.id)
    const useHome  = Math.random() > 0.5
    newPicks[gameId] = useHome ? game.homeTeam.abbrev : game.awayTeam.abbrev
  }

  setState({
    picks:       newPicks,
    tiebreakers: {},
    suicide:     { winner: null, loser: null },
  })
}

  // ── Save draft ─────────────────────────────
  async function handleSaveDraft() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/picks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...state, isDraft: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ text: 'Draft saved!', type: 'success' })
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to save draft.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // ── Submit picks ───────────────────────────
  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/picks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...state, isDraft: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ text: '✅ Picks submitted successfully!', type: 'success' })
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to submit picks.', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wide">My Picks 🏒</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {isOpen
              ? `Deadline: ${formattedDeadline}`
              : '⚠️ Picks are locked for this week'}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`status-pill ${allPicked ? 'status-pill-green' : 'status-pill-muted'}`}>
            {pickedCount}/{totalGames} picked
          </span>
          <span className={`status-pill ${allTiebreakers ? 'status-pill-green' : 'status-pill-muted'}`}>
            {tiebreakerCount}/3 tiebreakers
          </span>
          <span className={`status-pill ${allSuicide ? 'status-pill-green' : 'status-pill-muted'}`}>
            Suicide {allSuicide ? '✓' : '○'}
          </span>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-500/15 border border-green-500/30 text-green-400'
            : 'bg-red-500/15 border border-red-500/30 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* ── PHASE 1: PICKS ─────────────────── */}
      <PhaseBanner
        phase={1}
        title="Pick Your Winners"
        subtitle="Select the winner for every game this weekend"
        complete={allPicked}
      />
{/* DEV ONLY: Random picks button */}
{process.env.NODE_ENV === 'development' && isOpen && (
  <button
    onClick={handleRandomPicks}
    className="w-full py-2 rounded-lg border border-dashed border-yellow-500/40
               text-yellow-500/70 text-xs font-mono hover:border-yellow-500/70
               hover:text-yellow-500 transition-colors"
  >
    🎲 Random Picks (Dev Only)
  </button>
)}
      {/* Saturday */}
<div className="hhp-card space-y-0">
  <h2 className="text-hhp-gold font-bold text-xs uppercase tracking-widest mb-3">
    🗓 {formattedSatDate}
  </h2>
  {saturdayGames.map(game => (
    <GamePickCard
      key={game.id}
      game={game}
      selectedTeam={state.picks[String(game.id)] ?? null}
      onPick={handlePick}
      onInfo={handleOpenStats}
      isLocked={!isOpen}
    />
  ))}
</div>

{/* Sunday */}
<div className="hhp-card space-y-0">
  <h2 className="text-hhp-gold font-bold text-xs uppercase tracking-widest mb-3">
    🗓 {formattedSunDate}
  </h2>
  {sundayGames.map(game => (
    <GamePickCard
      key={game.id}
      game={game}
      selectedTeam={state.picks[String(game.id)] ?? null}
      onPick={handlePick}
      onInfo={handleOpenStats}
      isLocked={!isOpen}
    />
  ))}
</div>

      {/* ── PHASE 2: TIEBREAKERS ───────────── */}
      {allPicked && (
        <>
          <PhaseBanner
            phase={2}
            title="Tiebreaker Picks"
            subtitle="Select your 3 most confident picks, ranked 1st, 2nd, 3rd"
            complete={allTiebreakers}
          />
          <TiebreakerPanel
            pickedWinners={pickedWinners}
            tiebreakers={state.tiebreakers}
            onSelect={handleTiebreaker}
            isLocked={!isOpen}
          />
        </>
      )}

      {/* ── PHASE 3: SUICIDE ──────────────── */}
      {allPicked && allTiebreakers && (
        <>
          <PhaseBanner
            phase={3}
            title="Suicide Pool Picks"
            subtitle="Pick one team to win and one team to lose — choose wisely, no repeats allowed!"
            complete={allSuicide}
          />
          <SuicidePanel
  pickedWinners={pickedWinners}
  pickedLosers={pickedLosers}
  suicide={state.suicide}
  winnerSuicideTeam={winnerSuicideTeam}
  loserSuicideTeam={loserSuicideTeam}
  winnerTeamsUsed={winnerTeamsUsed}
  loserTeamsUsed={loserTeamsUsed}
  onSelect={handleSuicide}
  isLocked={!isOpen}
/>
        </>
      )}

      {/* ── ACTION BUTTONS ────────────────── */}
      {isOpen && (
        <div className="flex gap-3 pt-4 border-t border-hhp-navy-light sticky bottom-0 bg-hhp-navy py-4">
          <button
            onClick={handleSaveDraft}
            disabled={saving || pickedCount === 0}
            className="flex-1 py-3 rounded-lg border border-hhp-gold/30 text-hhp-gold font-bold
                       hover:bg-hhp-gold/10 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex-1 py-3 rounded-lg bg-hhp-red hover:bg-hhp-red-dark
                       text-white font-bold disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Picks'}
          </button>
        </div>
      )}
      {statsGame && (
  <StatsPanel
    homeCode={statsGame.home}
    awayCode={statsGame.away}
    onClose={() => setStatsGame(null)}
  />
)}
    </div>
  )
}