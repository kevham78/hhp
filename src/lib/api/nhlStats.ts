import { getCurrentNHLSeasonCode, formatSeasonLabel } from './nhl'

const NHL_API = 'https://api-web.nhle.com/v1'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type TeamStandingInfo = {
  teamCode:        string
  teamName:        string
  conferenceName:  string
  conferenceRank:  number
  divisionName:    string
  divisionRank:    number
  wins:            number
  losses:          number
  otLosses:        number
  points:          number
  gamesPlayed:     number
  last10:          string   // e.g. "7-2-1"
  streak:          string   // e.g. "W3"
}

export type HeadToHeadGame = {
  date:       string
  homeTeam:   string
  awayTeam:   string
  homeScore:  number
  awayScore:  number
  winner:     string
}

export type GameStats = {
  homeTeam:    TeamStandingInfo
  awayTeam:    TeamStandingInfo
  headToHead:  HeadToHeadGame[]
  seasonLabel: string  // e.g. "2026-27"
}

function emptyStanding(teamCode: string): TeamStandingInfo {
  return {
    teamCode,
    teamName:       teamCode,
    conferenceName: '',
    conferenceRank: 0,
    divisionName:   '',
    divisionRank:   0,
    wins:           0,
    losses:         0,
    otLosses:       0,
    points:         0,
    gamesPlayed:    0,
    last10:         '0-0-0',
    streak:         '-',
  }
}

// ─────────────────────────────────────────────
// Fetch official standings and find a specific team
//
// Only populated for regular-season games — the NHL's /standings
// endpoint returns an empty list during the preseason.
// ─────────────────────────────────────────────

async function fetchStandings(): Promise<any[]> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const res   = await fetch(`${NHL_API}/standings/${today}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.standings ?? []
  } catch {
    return []
  }
}

function extractTeamStanding(standings: any[], teamCode: string): TeamStandingInfo | null {
  const s = standings.find(
    (t: any) => t.teamAbbrev?.default === teamCode
  )
  if (!s) return null

  return {
    teamCode:       teamCode,
    teamName:       s.teamName?.default ?? teamCode,
    conferenceName: s.conferenceName ?? '',
    conferenceRank: s.conferenceSequence ?? 0,
    divisionName:   s.divisionName ?? '',
    divisionRank:   s.divisionSequence ?? 0,
    wins:           s.wins ?? 0,
    losses:         s.losses ?? 0,
    otLosses:       s.otLosses ?? 0,
    points:         s.points ?? 0,
    gamesPlayed:    s.gamesPlayed ?? 0,
    last10:         `${s.l10Wins ?? 0}-${s.l10Losses ?? 0}-${s.l10OtLosses ?? 0}`,
    streak:         `${s.streakCode ?? ''}${s.streakCount ?? ''}`,
  }
}

// ─────────────────────────────────────────────
// Compute a team's record directly from its season
// schedule, for game types the /standings endpoint
// doesn't cover (preseason), or as a fallback early
// in the regular season before standings populate.
// ─────────────────────────────────────────────

async function computeRecordFromSchedule(
  teamCode:   string,
  seasonCode: string,
  gameType:   number
): Promise<TeamStandingInfo> {
  try {
    const res = await fetch(`${NHL_API}/club-schedule-season/${teamCode}/${seasonCode}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return emptyStanding(teamCode)

    const data = await res.json()
    const games: any[] = (data.games ?? [])
      .filter((g: any) => g.gameType === gameType && g.gameState === 'OFF')
      .sort((a: any, b: any) => a.gameDate.localeCompare(b.gameDate))

    const results: ('W' | 'L' | 'OTL')[] = []
    let wins = 0, losses = 0, otLosses = 0

    for (const g of games) {
      const isHome   = g.homeTeam?.abbrev === teamCode
      const ownScore = isHome ? g.homeTeam?.score ?? 0 : g.awayTeam?.score ?? 0
      const oppScore = isHome ? g.awayTeam?.score ?? 0 : g.homeTeam?.score ?? 0
      const wentToOT = g.gameOutcome?.lastPeriodType && g.gameOutcome.lastPeriodType !== 'REG'

      if (ownScore > oppScore) {
        wins++
        results.push('W')
      } else if (wentToOT) {
        otLosses++
        results.push('OTL')
      } else {
        losses++
        results.push('L')
      }
    }

    const gamesPlayed = wins + losses + otLosses
    const last10       = results.slice(-10)
    const last10Wins     = last10.filter(r => r === 'W').length
    const last10Losses   = last10.filter(r => r === 'L').length
    const last10OtLosses = last10.filter(r => r === 'OTL').length

    // Streak: consecutive same result (W or not-W) counting back from
    // the most recent game.
    let streakCode  = ''
    let streakCount = 0
    for (let i = results.length - 1; i >= 0; i--) {
      const code = results[i] === 'W' ? 'W' : 'L'
      if (streakCode === '') {
        streakCode  = code
        streakCount = 1
      } else if (code === streakCode) {
        streakCount++
      } else {
        break
      }
    }

    return {
      teamCode,
      teamName:       teamCode,
      conferenceName: '',
      conferenceRank: 0,
      divisionName:   '',
      divisionRank:   0,
      wins,
      losses,
      otLosses,
      points:      wins * 2 + otLosses,
      gamesPlayed,
      last10:      `${last10Wins}-${last10Losses}-${last10OtLosses}`,
      streak:      gamesPlayed === 0 ? '-' : `${streakCode}${streakCount}`,
    }
  } catch {
    return emptyStanding(teamCode)
  }
}

// ─────────────────────────────────────────────
// Fetch head-to-head games this season
// Uses the home team's schedule and filters
// for games against the away team
// ─────────────────────────────────────────────

async function fetchHeadToHead(
  homeCode:   string,
  awayCode:   string,
  seasonCode: string
): Promise<HeadToHeadGame[]> {
  try {
    const res = await fetch(
      `${NHL_API}/club-schedule-season/${homeCode}/${seasonCode}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    const games: any[] = data.games ?? []

    // Filter for completed regular-season games between these two teams
    return games
      .filter((g: any) => {
        const isFinished = g.gameState === 'OFF' || g.gameState === 'FINAL'
        const isRegular  = g.gameType === 2
        const isMatch    = (
          (g.homeTeam?.abbrev === homeCode && g.awayTeam?.abbrev === awayCode) ||
          (g.homeTeam?.abbrev === awayCode && g.awayTeam?.abbrev === homeCode)
        )
        return isFinished && isRegular && isMatch
      })
      .map((g: any) => {
        const homeScore = g.homeTeam?.score ?? 0
        const awayScore = g.awayTeam?.score ?? 0
        const winner    = homeScore > awayScore
          ? g.homeTeam?.abbrev
          : g.awayTeam?.abbrev
        return {
          date:      g.gameDate ?? '',
          homeTeam:  g.homeTeam?.abbrev ?? '',
          awayTeam:  g.awayTeam?.abbrev ?? '',
          homeScore,
          awayScore,
          winner,
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date)) // most recent first
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────
// Main export — fetch all stats for a matchup
//
// gameType: 1 = preseason, 2 = regular season (default). Preseason
// games have no official standings, so their records are computed
// directly from each team's schedule. Regular-season games use the
// official standings, falling back to a schedule computation if a
// team isn't in the standings yet (e.g. the first days of the season).
// ─────────────────────────────────────────────

export async function getGameStats(
  homeCode: string,
  awayCode: string,
  gameType: number = 2
): Promise<GameStats | null> {
  const seasonCode  = getCurrentNHLSeasonCode()
  const seasonLabel = formatSeasonLabel(seasonCode)

  const headToHead = await fetchHeadToHead(homeCode, awayCode, seasonCode)

  if (gameType === 1) {
    const [homeTeam, awayTeam] = await Promise.all([
      computeRecordFromSchedule(homeCode, seasonCode, 1),
      computeRecordFromSchedule(awayCode, seasonCode, 1),
    ])
    return { homeTeam, awayTeam, headToHead, seasonLabel }
  }

  const standings = await fetchStandings()
  let homeTeam = extractTeamStanding(standings, homeCode)
  let awayTeam = extractTeamStanding(standings, awayCode)

  if (!homeTeam || !awayTeam) {
    const [fallbackHome, fallbackAway] = await Promise.all([
      computeRecordFromSchedule(homeCode, seasonCode, 2),
      computeRecordFromSchedule(awayCode, seasonCode, 2),
    ])
    homeTeam = homeTeam ?? fallbackHome
    awayTeam = awayTeam ?? fallbackAway
  }

  return { homeTeam, awayTeam, headToHead, seasonLabel }
}
