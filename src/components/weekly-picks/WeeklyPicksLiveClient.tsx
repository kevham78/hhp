'use client'

import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'

interface GameResult {
  gameId:       string
  homeTeamCode: string
  awayTeamCode: string
  gameDay:      string
  gameTime:     string
  homeScore:    number | null
  awayScore:    number | null
  winner:       string | null
  isFinal:      boolean
  isLive:       boolean
}

interface PickDetail {
  gameId:         string
  homeTeamCode:   string
  awayTeamCode:   string
  homeScore:      number | null
  awayScore:      number | null
  winner:         string | null
  isFinal:        boolean
  isLive:         boolean
  pickedTeam:     string | null
  correct:        boolean | null
  tiebreakerRank: number | null
  autoPicked:     boolean
}

interface PlayerResult {
  userId:   string
  name:     string
  image:    string | null
  points:   number
  pickDetails: PickDetail[]
  suicideWinner: { team: string; correct: boolean | null } | null
  suicideLoser:  { team: string; correct: boolean | null } | null
}

interface WeeklyPicksData {
  published:    boolean
  weekId?:      string
  weekNumber?:  number
  gameResults?: GameResult[]
  playerResults?: PlayerResult[]
  allFinal?:    boolean
  anyLive?:     boolean
}

function TeamCell({ detail }: { detail: PickDetail | undefined }) {
  if (!detail || !detail.pickedTeam) {
    return <span className="text-white/20 text-xs">—</span>
  }

  const bgColor = detail.correct === true
    ? 'bg-green-500/20 border-green-500/40'
    : detail.correct === false
      ? 'bg-red-500/20 border-red-500/40'
      : 'bg-hhp-navy border-hhp-navy-light'

  return (
    <div className={`relative flex flex-col items-center justify-center
                     p-1.5 rounded-lg border ${bgColor} min-w-[56px]`}>
      <img
        src={`https://assets.nhle.com/logos/nhl/svg/${detail.pickedTeam}_dark.svg`}
        alt={detail.pickedTeam}
        className="w-6 h-6 object-contain"
        onError={e => (e.currentTarget.style.display = 'none')}
      />
      <span className="text-white text-xs font-bold mt-0.5">{detail.pickedTeam}</span>

      {detail.tiebreakerRank && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full
                         bg-hhp-gold text-hhp-navy text-xs font-black
                         flex items-center justify-center leading-none">
          {detail.tiebreakerRank}
        </span>
      )}
      {detail.autoPicked && (
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2
                         text-xs text-white/30" title="Auto-picked">
          auto
        </span>
      )}
    </div>
  )
}

function formatGameTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour:     'numeric',
    minute:   '2-digit',
    timeZone: 'America/New_York',
  })
}

function GameRow({ game, players }: { game: GameResult; players: PlayerResult[] }) {
  return (
    <tr>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 text-xs w-12 flex-shrink-0">
            {formatGameTime(game.gameTime)}
          </span>
          <img
            src={`https://assets.nhle.com/logos/nhl/svg/${game.awayTeamCode}_dark.svg`}
            className="w-4 h-4 object-contain"
            alt={game.awayTeamCode}
          />
          <span className="text-white/50 text-xs">{game.awayTeamCode}</span>
          <span className="text-white/20 text-xs">@</span>
          <img
            src={`https://assets.nhle.com/logos/nhl/svg/${game.homeTeamCode}_dark.svg`}
            className="w-4 h-4 object-contain"
            alt={game.homeTeamCode}
          />
          <span className="text-white/50 text-xs">{game.homeTeamCode}</span>
          {game.isFinal && (
            <span className="text-white/40 text-xs ml-1 font-semibold">
              FINAL {game.awayScore}–{game.homeScore}
            </span>
          )}
          {game.isLive && !game.isFinal && (
            <span className="text-red-400 text-xs ml-1 font-bold animate-pulse">
              LIVE {game.awayScore}–{game.homeScore}
            </span>
          )}
        </div>
      </td>
      {players.map(player => (
        <td key={player.userId} className="py-2 px-2 text-center">
          <div className="flex justify-center">
            <TeamCell detail={player.pickDetails.find(d => d.gameId === game.gameId)} />
          </div>
        </td>
      ))}
    </tr>
  )
}

export default function WeeklyPicksLiveClient() {
  const [data,    setData]    = useState<WeeklyPicksData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/weekly-picks')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setData(json)
      } catch (err: any) {
        setError(err.message || 'Failed to load weekly picks')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="hhp-card text-center py-12">
        <p className="text-white/40">Loading picks...</p>
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

  if (!data?.published || !data.gameResults || !data.playerResults) {
    return (
      <div className="hhp-card text-center py-16">
        <p className="text-4xl mb-4">⏳</p>
        <p className="text-white font-bold text-lg">Picks not yet revealed</p>
        <p className="text-white/40 text-sm mt-2">
          Check back after the Friday 2pm deadline.
        </p>
      </div>
    )
  }

  const { gameResults, playerResults } = data
  const satGames = gameResults.filter(g => g.gameDay === 'SATURDAY')
  const sunGames = gameResults.filter(g => g.gameDay === 'SUNDAY')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">Week {data.weekNumber}</p>
        <div className="flex items-center gap-2">
          {data.anyLive && (
            <span className="status-pill bg-red-500/15 text-red-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Live
            </span>
          )}
          <span className="status-pill status-pill-green">
            {playerResults.length} players
          </span>
        </div>
      </div>

      <div className="hhp-card overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr>
              <th className="text-left text-white/30 text-xs font-semibold
                             uppercase tracking-widest pb-3 pr-4 min-w-[140px]">
                Game
              </th>
              {playerResults.map(player => (
                <th key={player.userId} className="text-center pb-3 px-2 min-w-[72px]">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-full bg-hhp-navy-light
                                    border border-hhp-gold/30
                                    flex items-center justify-center">
                      {player.image ? (
                        <img
                          src={player.image}
                          alt={player.name ?? ''}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-hhp-gold text-xs font-bold">
                          {player.name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-white/70">
                      {player.name}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hhp-navy-light/30">
            {satGames.length > 0 && (
              <tr>
                <td colSpan={playerResults.length + 1}
                    className="py-2 text-hhp-gold text-xs font-bold uppercase tracking-widest">
                  Saturday
                </td>
              </tr>
            )}
            {satGames.map(game => (
              <GameRow key={game.gameId} game={game} players={playerResults} />
            ))}

            {sunGames.length > 0 && (
              <tr>
                <td colSpan={playerResults.length + 1}
                    className="py-2 text-hhp-gold text-xs font-bold uppercase tracking-widest">
                  Sunday
                </td>
              </tr>
            )}
            {sunGames.map(game => (
              <GameRow key={game.gameId} game={game} players={playerResults} />
            ))}

            {/* Suicide pools */}
            <tr>
              <td colSpan={playerResults.length + 1}
                  className="py-2 text-hhp-gold text-xs font-bold uppercase tracking-widest">
                Suicide Pools
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <span className="text-green-400 text-xs font-semibold">🏆 Winner</span>
              </td>
              {playerResults.map(player => (
                <td key={player.userId} className="py-2 px-2 text-center">
                  {player.suicideWinner ? (
                    <div className="flex justify-center">
                      <TeamCell detail={{
                        gameId: '', homeTeamCode: '', awayTeamCode: '',
                        homeScore: null, awayScore: null, winner: null,
                        isFinal: false, isLive: false, tiebreakerRank: null,
                        autoPicked: false,
                        pickedTeam: player.suicideWinner.team,
                        correct:    player.suicideWinner.correct,
                      }} />
                    </div>
                  ) : (
                    <span className="text-white/20 text-xs">—</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <span className="text-red-400 text-xs font-semibold">💀 Loser</span>
              </td>
              {playerResults.map(player => (
                <td key={player.userId} className="py-2 px-2 text-center">
                  {player.suicideLoser ? (
                    <div className="flex justify-center">
                      <TeamCell detail={{
                        gameId: '', homeTeamCode: '', awayTeamCode: '',
                        homeScore: null, awayScore: null, winner: null,
                        isFinal: false, isLive: false, tiebreakerRank: null,
                        autoPicked: false,
                        pickedTeam: player.suicideLoser.team,
                        correct:    player.suicideLoser.correct,
                      }} />
                    </div>
                  ) : (
                    <span className="text-white/20 text-xs">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Points */}
            <tr className="border-t-2 border-hhp-gold/20">
              <td className="py-3 pr-4">
                <span className="text-white font-bold text-sm flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-hhp-gold" /> Points
                </span>
              </td>
              {playerResults.map(player => (
                <td key={player.userId} className="py-3 px-2 text-center">
                  <span className="font-black text-lg text-white">{player.points}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {!data.allFinal && (
        <p className="text-white/30 text-xs text-center">
          Scores update as games finish — full results once the weekend wraps up.
        </p>
      )}
    </div>
  )
}
