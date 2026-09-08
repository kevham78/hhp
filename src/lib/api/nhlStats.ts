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
}

// ─────────────────────────────────────────────
// Fetch standings and find a specific team
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
// Fetch head-to-head games this season
// Uses the home team's schedule and filters
// for games against the away team
// ─────────────────────────────────────────────

async function fetchHeadToHead(
  homeCode: string,
  awayCode: string
): Promise<HeadToHeadGame[]> {
  try {
    const res = await fetch(
      `${NHL_API}/club-schedule-season/${homeCode}/20252026`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    const games: any[] = data.games ?? []

    // Filter for completed games between these two teams
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
// ─────────────────────────────────────────────

export async function getGameStats(
  homeCode: string,
  awayCode: string
): Promise<GameStats | null> {
  const [standings, headToHead] = await Promise.all([
    fetchStandings(),
    fetchHeadToHead(homeCode, awayCode),
  ])

  const homeTeam = extractTeamStanding(standings, homeCode)
  const awayTeam = extractTeamStanding(standings, awayCode)

  // If no standings yet, return placeholder data
  if (!homeTeam || !awayTeam) {
    const placeholder = (code: string): TeamStandingInfo => ({
      teamCode:       code,
      teamName:       code,
      conferenceName: 'TBD',
      conferenceRank: 0,
      divisionName:   'TBD',
      divisionRank:   0,
      wins:           0,
      losses:         0,
      otLosses:       0,
      points:         0,
      gamesPlayed:    0,
      last10:         '0-0-0',
      streak:         '-',
    })

    return {
      homeTeam:   placeholder(homeCode),
      awayTeam:   placeholder(awayCode),
      headToHead,
    }
  }

  return { homeTeam, awayTeam, headToHead }
}