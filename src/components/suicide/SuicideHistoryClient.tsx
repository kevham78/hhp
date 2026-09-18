'use client'

import { useState, useEffect } from 'react'
import { Skull, Trophy } from 'lucide-react'

interface WeekPick {
  team:      string
  isCorrect: boolean | null
}

interface PlayerRow {
  userId:           string
  name:             string
  image:            string | null
  winnerEliminated: boolean
  winnerStrikes:    number
  loserEliminated:  boolean
  loserStrikes:     number
  picks: Record<string, { winner: WeekPick | null; loser: WeekPick | null }>
}

interface SuicideData {
  weeks:   { weekId: string; weekNumber: number }[]
  players: PlayerRow[]
  pots:    { winner: number; loser: number }
}

function PickCell({ pick }: { pick: WeekPick | null }) {
  if (!pick) return <span className="text-white/20 text-xs">—</span>

  const bgColor = pick.isCorrect === true
    ? 'bg-green-500/20 border-green-500/40'
    : pick.isCorrect === false
      ? 'bg-red-500/20 border-red-500/40'
      : 'bg-hhp-navy border-hhp-navy-light'

  return (
    <div className={`flex flex-col items-center justify-center p-1.5 rounded-lg
                     border ${bgColor} min-w-[52px]`}>
      <img
        src={`https://assets.nhle.com/logos/nhl/svg/${pick.team}_dark.svg`}
        alt={pick.team}
        className="w-5 h-5 object-contain"
        onError={e => (e.currentTarget.style.display = 'none')}
      />
      <span className="text-white text-xs font-bold mt-0.5">{pick.team}</span>
    </div>
  )
}

function PoolTable({
  title, icon: Icon, iconColor, pot, players, weeks, poolKey, eliminatedKey, strikesKey,
}: {
  title:         string
  icon:          any
  iconColor:     string
  pot:           number
  players:       PlayerRow[]
  weeks:         { weekId: string; weekNumber: number }[]
  poolKey:       'winner' | 'loser'
  eliminatedKey: 'winnerEliminated' | 'loserEliminated'
  strikesKey:    'winnerStrikes' | 'loserStrikes'
}) {
  // Alive players first, then eliminated — alphabetical within each group
  const sorted = [...players].sort((a, b) => {
    if (a[eliminatedKey] !== b[eliminatedKey]) return a[eliminatedKey] ? 1 : -1
    return (a.name ?? '').localeCompare(b.name ?? '')
  })

  return (
    <div className="hhp-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          {title}
        </h2>
        <span className="status-pill status-pill-green">Pot: ${pot.toFixed(2)}</span>
      </div>

      {weeks.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-8">
          No picks revealed yet — check back after the first week's deadline.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr>
                <th className="text-left text-white/30 text-xs font-semibold
                               uppercase tracking-widest pb-3 pr-4 min-w-[120px]">
                  Player
                </th>
                {weeks.map(w => (
                  <th key={w.weekId}
                      className="text-center text-white/30 text-xs font-semibold pb-3 px-2 min-w-[64px]">
                    Wk {w.weekNumber}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hhp-navy-light/30">
              {sorted.map(player => {
                const eliminated = player[eliminatedKey]
                const strikes    = player[strikesKey]
                return (
                  <tr key={player.userId} className={eliminated ? 'opacity-40' : ''}>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-semibold">{player.name}</span>
                        {eliminated ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                            Out
                          </span>
                        ) : strikes > 0 ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
                            {strikes} strike{strikes > 1 ? 's' : ''}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {weeks.map(w => (
                      <td key={w.weekId} className="py-2 px-2 text-center">
                        <div className="flex justify-center">
                          <PickCell pick={player.picks[w.weekId]?.[poolKey] ?? null} />
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function SuicideHistoryClient() {
  const [data,    setData]    = useState<SuicideData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/suicide')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setData(json)
      } catch (err: any) {
        setError(err.message || 'Failed to load suicide pool history')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="hhp-card text-center py-12">
        <p className="text-white/40">Loading suicide pool...</p>
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

  return (
    <div className="space-y-6">
      <PoolTable
        title="Winner Pool" icon={Trophy} iconColor="text-green-400"
        pot={data.pots.winner} players={data.players} weeks={data.weeks}
        poolKey="winner" eliminatedKey="winnerEliminated" strikesKey="winnerStrikes"
      />
      <PoolTable
        title="Loser Pool" icon={Skull} iconColor="text-red-400"
        pot={data.pots.loser} players={data.players} weeks={data.weeks}
        poolKey="loser" eliminatedKey="loserEliminated" strikesKey="loserStrikes"
      />
    </div>
  )
}
