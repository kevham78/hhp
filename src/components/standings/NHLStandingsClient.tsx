'use client'

import { useState, useEffect } from 'react'

interface Team {
  teamAbbrev:         { default: string }
  teamName:           { default: string }
  teamLogo:           string
  wins:               number
  losses:             number
  otLosses:           number
  points:             number
  pointPctg:          number
  gamesPlayed:        number
  goalFor:            number
  goalAgainst:        number
  goalDifferential:   number
  l10Wins:            number
  l10Losses:          number
  l10OtLosses:        number
  streakCode:         string
  streakCount:        number
  divisionName:       string
  divisionSequence:   number
  conferenceName:     string
  conferenceSequence: number
  leagueSequence:     number
}

const DIVISIONS = [
  { conference: 'Eastern', division: 'Atlantic' },
  { conference: 'Eastern', division: 'Metropolitan' },
  { conference: 'Western', division: 'Central' },
  { conference: 'Western', division: 'Pacific' },
]

function StreakCell({ code, count }: { code: string; count: number }) {
  if (!code) return <span className="text-white/30">—</span>
  const color = code === 'W' ? 'text-green-400' : code === 'L' ? 'text-red-400' : 'text-white/50'
  return <span className={`font-bold ${color}`}>{code}{count}</span>
}

function StandingsTable({ teams, showDivRank }: { teams: Team[]; showDivRank?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-hhp-navy-light">
            <th className="text-left text-white/30 text-xs font-semibold uppercase tracking-widest py-2 pr-3">#</th>
            <th className="text-left text-white/30 text-xs font-semibold uppercase tracking-widest py-2 pr-4 min-w-[160px]">Team</th>
            <th className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest py-2 px-2">GP</th>
            <th className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest py-2 px-2">W</th>
            <th className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest py-2 px-2">L</th>
            <th className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest py-2 px-2">OTL</th>
            <th className="text-center text-hhp-gold text-xs font-bold uppercase tracking-widest py-2 px-2">PTS</th>
            <th className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest py-2 px-2">P%</th>
            <th className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest py-2 px-2">GF</th>
            <th className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest py-2 px-2">GA</th>
            <th className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest py-2 px-2">DIFF</th>
            <th className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest py-2 px-2">L10</th>
            <th className="text-center text-white/30 text-xs font-semibold uppercase tracking-widest py-2 px-2">Strk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hhp-navy-light/30">
          {teams.map((team, i) => (
            <tr key={team.teamAbbrev.default} className="hover:bg-white/5 transition-colors">
              <td className="py-2 pr-3 text-white/40">{showDivRank ? team.divisionSequence : i + 1}</td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <img
                    src={team.teamLogo}
                    alt={team.teamAbbrev.default}
                    className="w-6 h-6 object-contain flex-shrink-0"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                  <span className="text-white font-semibold truncate">{team.teamName.default}</span>
                </div>
              </td>
              <td className="text-center py-2 px-2 text-white/70">{team.gamesPlayed}</td>
              <td className="text-center py-2 px-2 text-white/70">{team.wins}</td>
              <td className="text-center py-2 px-2 text-white/70">{team.losses}</td>
              <td className="text-center py-2 px-2 text-white/70">{team.otLosses}</td>
              <td className="text-center py-2 px-2 text-hhp-gold font-black">{team.points}</td>
              <td className="text-center py-2 px-2 text-white/50">{team.pointPctg.toFixed(3)}</td>
              <td className="text-center py-2 px-2 text-white/50">{team.goalFor}</td>
              <td className="text-center py-2 px-2 text-white/50">{team.goalAgainst}</td>
              <td className={`text-center py-2 px-2 font-semibold ${
                team.goalDifferential > 0 ? 'text-green-400' : team.goalDifferential < 0 ? 'text-red-400' : 'text-white/50'
              }`}>
                {team.goalDifferential > 0 ? '+' : ''}{team.goalDifferential}
              </td>
              <td className="text-center py-2 px-2 text-white/50">
                {team.l10Wins}-{team.l10Losses}-{team.l10OtLosses}
              </td>
              <td className="text-center py-2 px-2">
                <StreakCell code={team.streakCode} count={team.streakCount} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function NHLStandingsClient() {
  const [teams,   setTeams]   = useState<Team[]>([])
  const [tab,     setTab]     = useState<'division' | 'overall'>('division')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/nhl-standings')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setTeams(json.teams)
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

  if (teams.length === 0) {
    return (
      <div className="hhp-card text-center py-16">
        <p className="text-4xl mb-4">🏒</p>
        <p className="text-white font-bold text-lg">No standings yet</p>
        <p className="text-white/40 text-sm mt-2">
          NHL standings aren't published until the regular season begins.
        </p>
      </div>
    )
  }

  const conferences = [...new Set(DIVISIONS.map(d => d.conference))]

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('division')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            tab === 'division'
              ? 'bg-hhp-gold text-hhp-navy'
              : 'bg-hhp-navy-mid text-white/60 hover:text-white'
          }`}
        >
          By Division
        </button>
        <button
          onClick={() => setTab('overall')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            tab === 'overall'
              ? 'bg-hhp-gold text-hhp-navy'
              : 'bg-hhp-navy-mid text-white/60 hover:text-white'
          }`}
        >
          Overall
        </button>
      </div>

      {tab === 'division' ? (
        <div className="space-y-6">
          {conferences.map(conference => (
            <div key={conference} className="space-y-4">
              <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">
                {conference} Conference
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {DIVISIONS.filter(d => d.conference === conference).map(({ division }) => {
                  const divTeams = teams
                    .filter(t => t.divisionName === division)
                    .sort((a, b) => a.divisionSequence - b.divisionSequence)
                  return (
                    <div key={division} className="hhp-card">
                      <h3 className="text-hhp-gold font-bold mb-3">{division}</h3>
                      {divTeams.length === 0 ? (
                        <p className="text-white/30 text-sm">No data</p>
                      ) : (
                        <StandingsTable teams={divTeams} showDivRank />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="hhp-card">
          <StandingsTable teams={teams} />
        </div>
      )}
    </div>
  )
}
