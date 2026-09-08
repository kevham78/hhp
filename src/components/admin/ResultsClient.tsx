'use client'

import { useState } from 'react'
import { CheckCircle, Clock, AlertCircle, Trophy, Users } from 'lucide-react'

interface Game {
  id:           string
  homeTeamCode: string
  awayTeamCode: string
  gameDay:      string
  nhlGameId:    string
}

interface ResultsClientProps {
  weekId: string
  games:  Game[]
}

export default function ResultsClient({ weekId, games }: ResultsClientProps) {
  const [preview,     setPreview]     = useState<any>(null)
  const [loading,     setLoading]     = useState(false)
  const [confirming,  setConfirming]  = useState(false)
  const [confirmed,   setConfirmed]   = useState(false)
  const [error,       setError]       = useState('')

  async function handlePreview() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/admin/results', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'preview', weekId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!preview?.allFinal) return
    setConfirming(true)
    setError('')
    try {
      const res  = await fetch('/api/admin/results', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'confirm', weekId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setConfirmed(true)
    } catch (err: any) {
      setError(err.message || 'Failed to confirm results')
    } finally {
      setConfirming(false)
    }
  }

  if (confirmed) {
    return (
      <div className="hhp-card text-center py-16">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-xl font-bold text-white mb-2">Results Published!</h2>
        <p className="text-white/40 text-sm">
          Standings and payments have been updated.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Games summary */}
      <div className="hhp-card">
        <h2 className="text-white font-bold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-hhp-gold" />
          This Week's Games ({games.length})
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {['SATURDAY', 'SUNDAY'].map(day => {
            const dayGames = games.filter(g => g.gameDay === day)
            return (
              <div key={day}>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">
                  {day}
                </p>
                <div className="space-y-1">
                  {dayGames.map(g => (
                    <div key={g.id} className="flex items-center gap-1.5 text-sm">
                      <img
                        src={`https://assets.nhle.com/logos/nhl/svg/${g.awayTeamCode}_dark.svg`}
                        className="w-4 h-4 object-contain"
                        alt={g.awayTeamCode}
                      />
                      <span className="text-white/60">{g.awayTeamCode}</span>
                      <span className="text-white/20">@</span>
                      <img
                        src={`https://assets.nhle.com/logos/nhl/svg/${g.homeTeamCode}_dark.svg`}
                        className="w-4 h-4 object-contain"
                        alt={g.homeTeamCode}
                      />
                      <span className="text-white/60">{g.homeTeamCode}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Preview button */}
      {!preview && (
        <button
          onClick={handlePreview}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-hhp-gold text-hhp-navy font-bold
                     hover:bg-hhp-gold-light disabled:opacity-50 transition-colors"
        >
          {loading ? 'Fetching scores from NHL...' : '🏒 Fetch Results & Preview'}
        </button>
      )}

      {/* Preview results */}
      {preview && (
        <div className="space-y-6">

          {/* Status banner */}
          {preview.anyLive && (
            <div className="p-3 rounded-lg bg-yellow-500/15 border border-yellow-500/30
                            text-sm text-yellow-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Some games are still in progress. Confirm only when all games are final.
            </div>
          )}

          {/* Game results */}
          <div className="hhp-card">
            <h2 className="text-white font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Game Results
            </h2>
            <div className="space-y-2">
              {preview.gameResults.map((game: any) => (
                <div
                  key={game.gameId}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-hhp-navy border border-hhp-navy-light"
                >
                  {/* Away team */}
                  <div className={`flex items-center gap-1.5 flex-1 ${
                    game.winner === game.awayTeamCode ? 'text-white font-bold' : 'text-white/40'
                  }`}>
                    <img
                      src={`https://assets.nhle.com/logos/nhl/svg/${game.awayTeamCode}_dark.svg`}
                      className="w-5 h-5 object-contain"
                      alt={game.awayTeamCode}
                    />
                    {game.awayTeamCode}
                  </div>

                  {/* Score */}
                  <div className="text-center flex-shrink-0">
                    {game.isFinal ? (
                      <span className="text-white font-black">
                        {game.awayScore} – {game.homeScore}
                      </span>
                    ) : game.isLive ? (
                      <span className="text-yellow-400 text-xs font-bold animate-pulse">LIVE</span>
                    ) : (
                      <span className="text-white/30 text-xs">TBD</span>
                    )}
                    {game.isFinal && (
                      <p className="text-white/30 text-xs">FINAL</p>
                    )}
                  </div>

                  {/* Home team */}
                  <div className={`flex items-center gap-1.5 flex-1 justify-end ${
                    game.winner === game.homeTeamCode ? 'text-white font-bold' : 'text-white/40'
                  }`}>
                    {game.homeTeamCode}
                    <img
                      src={`https://assets.nhle.com/logos/nhl/svg/${game.homeTeamCode}_dark.svg`}
                      className="w-5 h-5 object-contain"
                      alt={game.homeTeamCode}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Player standings */}
          <div className="hhp-card">
            <h2 className="text-white font-bold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-hhp-gold" />
              Player Results
            </h2>
            <div className="space-y-2">
              {preview.playerResults.map((player: any, i: number) => {
                const isWinner = preview.weeklyWinner?.userId === player.userId ||
                  (preview.isSplit && preview.splitPlayers.some((p: any) => p.userId === player.userId))
                return (
                  <div
                    key={player.userId}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isWinner
                        ? 'border-hhp-gold/40 bg-hhp-gold/5'
                        : 'border-hhp-navy-light bg-hhp-navy'
                    }`}
                  >
                    <span className="text-white/30 text-sm w-5 text-center">{i + 1}</span>
                    <span className={`flex-1 font-semibold ${isWinner ? 'text-hhp-gold' : 'text-white'}`}>
                      {player.name}
                      {isWinner && <span className="ml-2 text-xs">🏆</span>}
                    </span>
                    <span className="text-white font-black">{player.points} pts</span>

                    {/* Suicide picks */}
                    <div className="flex gap-1.5">
                      {player.suicideWinner && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          player.suicideWinner.correct === true
                            ? 'bg-green-500/20 text-green-400'
                            : player.suicideWinner.correct === false
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-white/10 text-white/40'
                        }`}>
                          W: {player.suicideWinner.team}
                        </span>
                      )}
                      {player.suicideLoser && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          player.suicideLoser.correct === true
                            ? 'bg-green-500/20 text-green-400'
                            : player.suicideLoser.correct === false
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-white/10 text-white/40'
                        }`}>
                          L: {player.suicideLoser.team}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Winner summary */}
          <div className="hhp-card hhp-gold-border">
            <h2 className="text-hhp-gold font-bold mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Weekly Winner
            </h2>
            {preview.isSplit ? (
              <div>
                <p className="text-white font-bold">
                  Split pot — {preview.splitPlayers.map((p: any) => p.name).join(', ')}
                </p>
                <p className="text-white/50 text-sm mt-1">
                  Each receives ${preview.prizes.weeklyPrize.toFixed(2)}
                </p>
              </div>
            ) : preview.weeklyWinner ? (
              <div>
                <p className="text-white font-bold text-lg">{preview.weeklyWinner.name}</p>
                <p className="text-white/50 text-sm mt-1">
                  {preview.topPoints} correct picks · Wins ${preview.prizes.weeklyPrize.toFixed(2)}
                </p>
              </div>
            ) : (
              <p className="text-white/40 text-sm">Calculating...</p>
            )}

            <div className="mt-4 pt-4 border-t border-hhp-navy-light grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/40 text-xs">Monthly pot</p>
                <p className="text-white font-bold">+${preview.prizes.monthlyPot.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Suicide pools</p>
                <p className="text-white font-bold">
                  +${(preview.prizes.suicideWinner + preview.prizes.suicideLoser).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Refresh or confirm */}
          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="flex-1 py-3 rounded-lg border border-hhp-navy-light text-white/60
                         hover:text-white hover:border-hhp-gold/40 disabled:opacity-40
                         transition-colors font-semibold"
            >
              {loading ? 'Refreshing...' : '🔄 Refresh Scores'}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!preview.allFinal || confirming}
              className="flex-1 py-3 rounded-lg bg-hhp-red hover:bg-hhp-red-dark
                         text-white font-bold disabled:opacity-40 transition-colors"
            >
              {confirming
                ? 'Publishing...'
                : !preview.allFinal
                  ? '⏳ Waiting for final scores'
                  : '✅ Confirm & Publish Results'}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}