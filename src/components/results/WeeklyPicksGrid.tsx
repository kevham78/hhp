'use client'

import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'

interface Game {
  id:           string
  homeTeamCode: string
  awayTeamCode: string
  homeScore:    number | null
  awayScore:    number | null
  winner:       string | null
  gameDay:      string
}

interface PlayerPick {
  pickedTeam:     string
  isCorrect:      boolean | null
  tiebreakerRank: number | null
  autoPicked:     boolean
}

interface Tiebreaker {
  rank:       number
  pickedTeam: string
  isCorrect:  boolean | null
  gameLabel:  string
}

interface SuicidePick {
  team:      string
  isCorrect: boolean | null
}

interface PlayerData {
  userId:     string
  name:       string
  image:      string | null
  picks:      Record<string, PlayerPick>
  tiebreakers: (Tiebreaker | null)[]
  suicide: {
    winner: SuicidePick | null
    loser:  SuicidePick | null
  }
  points:   number
  isWinner: boolean
  isTied:   boolean
}

interface WeekData {
  published:    boolean
  weekId:       string
  weekNumber:   number
  saturdayDate: string
  sundayDate:   string
  games:        Game[]
  players:      PlayerData[]
}

function TeamCell({
  teamCode,
  isCorrect,
  tiebreakerRank,
  autoPicked,
}: {
  teamCode:       string
  isCorrect:      boolean | null
  tiebreakerRank: number | null
  autoPicked:     boolean
}) {
  const bgColor = isCorrect === true
    ? 'bg-green-500/20 border-green-500/40'
    : isCorrect === false
      ? 'bg-red-500/20 border-red-500/40'
      : 'bg-hhp-navy border-hhp-navy-light'

  return (
    <div className={`relative flex flex-col items-center justify-center
                     p-1.5 rounded-lg border ${bgColor} min-w-[56px]`}>
      <img
        src={`https://assets.nhle.com/logos/nhl/svg/${teamCode}_dark.svg`}
        alt={teamCode}
        className="w-6 h-6 object-contain"
        onError={e => (e.currentTarget.style.display = 'none')}
      />
      <span className="text-white text-xs font-bold mt-0.5">{teamCode}</span>

      {/* Tiebreaker badge */}
      {tiebreakerRank && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full
                         bg-hhp-gold text-hhp-navy text-xs font-black
                         flex items-center justify-center leading-none">
          {tiebreakerRank}
        </span>
      )}

      {/* Auto-picked indicator */}
      {autoPicked && (
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2
                         text-xs text-white/30" title="Auto-picked">
          auto
        </span>
      )}
    </div>
  )
}

export default function WeeklyPicksGrid({ weekId }: { weekId: string }) {
  const [data,    setData]    = useState<WeekData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/picks/week?weekId=${weekId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setData(json)
      } catch (err: any) {
        setError(err.message || 'Failed to load picks')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [weekId])

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

  if (!data?.published) {
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

  const satGames = data.games.filter(g => g.gameDay === 'SATURDAY')
  const sunGames = data.games.filter(g => g.gameDay === 'SUNDAY')

  return (
    <div className="space-y-6">

      {/* Week header */}
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">
          Week {data.weekNumber}
        </p>
        <div className="flex items-center gap-2">
          <span className="status-pill status-pill-green">
            {data.players.length} players
          </span>
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="hhp-card overflow-x-auto">
        <table className="w-full min-w-max">

          {/* Player headers */}
          <thead>
            <tr>
              <th className="text-left text-white/30 text-xs font-semibold
                             uppercase tracking-widest pb-3 pr-4 min-w-[140px]">
                Game
              </th>
              {data.players.map(player => (
                <th key={player.userId}
                    className="text-center pb-3 px-2 min-w-[72px]">
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
                    <span className={`text-xs font-bold ${
                      player.isWinner ? 'text-hhp-gold' : 'text-white/70'
                    }`}>
                      {player.name}
                      {player.isWinner && ' 🏆'}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-hhp-navy-light/30">

            {/* Saturday games */}
            {satGames.length > 0 && (
              <tr>
                <td colSpan={data.players.length + 1}
                    className="py-2 text-hhp-gold text-xs font-bold
                               uppercase tracking-widest">
                  Saturday
                </td>
              </tr>
            )}

            {satGames.map(game => (
              <tr key={game.id}>
                {/* Game label */}
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-1.5">
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
                    {game.winner && (
                      <span className="text-white/30 text-xs ml-1">
                        {game.awayScore}–{game.homeScore}
                      </span>
                    )}
                  </div>
                </td>

                {/* Each player's pick */}
                {data.players.map(player => {
                  const pick = player.picks[game.id]
                  return (
                    <td key={player.userId} className="py-2 px-2 text-center">
                      {pick ? (
                        <div className="flex justify-center">
                          <TeamCell
                            teamCode={pick.pickedTeam}
                            isCorrect={pick.isCorrect}
                            tiebreakerRank={pick.tiebreakerRank}
                            autoPicked={pick.autoPicked}
                          />
                        </div>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}

            {/* Sunday games */}
            {sunGames.length > 0 && (
              <tr>
                <td colSpan={data.players.length + 1}
                    className="py-2 text-hhp-gold text-xs font-bold
                               uppercase tracking-widest">
                  Sunday
                </td>
              </tr>
            )}

            {sunGames.map(game => (
              <tr key={game.id}>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-1.5">
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
                    {game.winner && (
                      <span className="text-white/30 text-xs ml-1">
                        {game.awayScore}–{game.homeScore}
                      </span>
                    )}
                  </div>
                </td>
                {data.players.map(player => {
                  const pick = player.picks[game.id]
                  return (
                    <td key={player.userId} className="py-2 px-2 text-center">
                      {pick ? (
                        <div className="flex justify-center">
                          <TeamCell
                            teamCode={pick.pickedTeam}
                            isCorrect={pick.isCorrect}
                            tiebreakerRank={pick.tiebreakerRank}
                            autoPicked={pick.autoPicked}
                          />
                        </div>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}

            {/* Tiebreakers section */}
            <tr>
              <td colSpan={data.players.length + 1}
                  className="py-2 text-hhp-gold text-xs font-bold
                             uppercase tracking-widest">
                Tiebreakers
              </td>
            </tr>

            {[0, 1, 2].map(rankIdx => (
              <tr key={rankIdx}>
                <td className="py-2 pr-4">
                  <span className="inline-flex items-center justify-center
                                   w-5 h-5 rounded-full bg-hhp-gold
                                   text-hhp-navy text-xs font-black">
                    {rankIdx + 1}
                  </span>
                </td>
                {data.players.map(player => {
                  const tb = player.tiebreakers[rankIdx]
                  return (
                    <td key={player.userId} className="py-2 px-2 text-center">
                      {tb ? (
                        <div className="flex justify-center">
                          <TeamCell
                            teamCode={tb.pickedTeam}
                            isCorrect={tb.isCorrect}
                            tiebreakerRank={null}
                            autoPicked={false}
                          />
                        </div>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}

            {/* Suicide section */}
            <tr>
              <td colSpan={data.players.length + 1}
                  className="py-2 text-hhp-gold text-xs font-bold
                             uppercase tracking-widest">
                Suicide Pools
              </td>
            </tr>

            {/* Winner suicide */}
            <tr>
              <td className="py-2 pr-4">
                <span className="text-green-400 text-xs font-semibold">🏆 Winner</span>
              </td>
              {data.players.map(player => {
                const pick = player.suicide.winner
                return (
                  <td key={player.userId} className="py-2 px-2 text-center">
                    {pick ? (
                      <div className="flex justify-center">
                        <TeamCell
                          teamCode={pick.team}
                          isCorrect={pick.isCorrect}
                          tiebreakerRank={null}
                          autoPicked={false}
                        />
                      </div>
                    ) : (
                      <span className="text-white/20 text-xs">—</span>
                    )}
                  </td>
                )
              })}
            </tr>

            {/* Loser suicide */}
            <tr>
              <td className="py-2 pr-4">
                <span className="text-red-400 text-xs font-semibold">💀 Loser</span>
              </td>
              {data.players.map(player => {
                const pick = player.suicide.loser
                return (
                  <td key={player.userId} className="py-2 px-2 text-center">
                    {pick ? (
                      <div className="flex justify-center">
                        <TeamCell
                          teamCode={pick.team}
                          isCorrect={pick.isCorrect}
                          tiebreakerRank={null}
                          autoPicked={false}
                        />
                      </div>
                    ) : (
                      <span className="text-white/20 text-xs">—</span>
                    )}
                  </td>
                )
              })}
            </tr>

            {/* Points totals */}
            <tr className="border-t-2 border-hhp-gold/20">
              <td className="py-3 pr-4">
                <span className="text-white font-bold text-sm">Points</span>
              </td>
              {data.players.map(player => (
                <td key={player.userId} className="py-3 px-2 text-center">
                  <span className={`font-black text-lg ${
                    player.isWinner ? 'text-hhp-gold' : 'text-white'
                  }`}>
                    {player.points}
                  </span>
                </td>
              ))}
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  )
}