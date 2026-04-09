// NHL API Client
// Base URL: https://api-web.nhle.com/v1
// No API key required — this is the same API the NHL website uses

const NHL_API = 'https://api-web.nhle.com/v1'

// ─────────────────────────────────────────────
// Types matching the NHL API response shape
// ─────────────────────────────────────────────

export type NHLGameFromAPI = {
  id:           number
  gameType:     number  // 2 = regular season, 3 = playoffs
  gameState:    string  // 'FUT', 'PRE', 'LIVE', 'OFF', 'FINAL'
  startTimeUTC: string
  awayTeam: {
    abbrev:     string
    name:       { default: string }
    logo:       string
    score?:     number
  }
  homeTeam: {
    abbrev:     string
    name:       { default: string }
    logo:       string
    score?:     number
  }
}

export type WeekendGames = {
  saturday: NHLGameFromAPI[]
  sunday:   NHLGameFromAPI[]
}

export type TeamStanding = {
  teamAbbrev:      { default: string }
  teamName:        { default: string }
  teamLogo:        string
  wins:            number
  losses:          number
  otLosses:        number
  points:          number
  gamesPlayed:     number
  l10Wins:         number
  l10Losses:       number
  l10OtLosses:     number
  streakCode:      string  // 'W' or 'L'
  streakCount:     number
  divisionName:    string
  conferenceName:  string
}

// ─────────────────────────────────────────────
// Helper: format date as YYYY-MM-DD
// ─────────────────────────────────────────────

export function formatDate(date: Date): string {
  const year  = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day   = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ─────────────────────────────────────────────
// Get the upcoming Saturday and Sunday dates
// from any given date
// ─────────────────────────────────────────────

export function getUpcomingWeekend(): { saturday: Date; sunday: Date } {
  const now       = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  let daysUntilSat: number

  if (dayOfWeek === 6) {
    // Today is Saturday
    daysUntilSat = 0
  } else if (dayOfWeek === 0) {
    // Today is Sunday — show this weekend still
    daysUntilSat = -1
  } else {
    // Mon–Fri — find next Saturday
    daysUntilSat = 6 - dayOfWeek
  }

  const saturday = new Date(now)
  saturday.setDate(now.getDate() + daysUntilSat)
  saturday.setHours(0, 0, 0, 0)

  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + (dayOfWeek === 0 ? 0 : 1))

  return { saturday, sunday }
}

// ─────────────────────────────────────────────
// Fetch games for a specific date
// ─────────────────────────────────────────────

async function getGamesForDate(date: Date): Promise<NHLGameFromAPI[]> {
  const dateStr = formatDate(date)

  try {
    const res = await fetch(`${NHL_API}/schedule/${dateStr}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!res.ok) {
      console.error(`NHL API error for ${dateStr}:`, res.status)
      return []
    }

    const data = await res.json()

    // The API returns a gameWeek array — find the entry matching our date
    const dayEntry = data.gameWeek?.find(
      (day: any) => day.date === dateStr
    )

    if (!dayEntry) return []

    // Filter to regular season games only (gameType === 2)
    return (dayEntry.games || []).filter(
      (g: NHLGameFromAPI) => g.gameType === 2
    )
  } catch (err) {
    console.error(`Failed to fetch NHL schedule for ${dateStr}:`, err)
    return []
  }
}

// ─────────────────────────────────────────────
// Fetch both Saturday and Sunday games
// ─────────────────────────────────────────────

export async function getWeekendGames(): Promise<WeekendGames> {
  const { saturday, sunday } = getUpcomingWeekend()

  const [satGames, sunGames] = await Promise.all([
    getGamesForDate(saturday),
    getGamesForDate(sunday),
  ])

  return {
    saturday: satGames,
    sunday:   sunGames,
  }
}

// ─────────────────────────────────────────────
// Fetch current standings
// ─────────────────────────────────────────────

export async function getStandings(): Promise<TeamStanding[]> {
  try {
    const today = formatDate(new Date())
    const res   = await fetch(`${NHL_API}/standings/${today}`, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const data = await res.json()
    return data.standings || []
  } catch (err) {
    console.error('Failed to fetch NHL standings:', err)
    return []
  }
}

// ─────────────────────────────────────────────
// Get team logo URL
// ─────────────────────────────────────────────

export function getTeamLogoUrl(teamCode: string): string {
  return `https://assets.nhle.com/logos/nhl/svg/${teamCode}_dark.svg`
}

// ─────────────────────────────────────────────
// Get last 10 record string for a team
// from standings data
// ─────────────────────────────────────────────

export function getLast10Record(standing: TeamStanding): string {
  const { l10Wins, l10Losses, l10OtLosses } = standing
  return `${l10Wins}-${l10Losses}-${l10OtLosses}`
}

// ─────────────────────────────────────────────
// Get streak string e.g. "W3" or "L2"
// ─────────────────────────────────────────────

export function getStreakString(standing: TeamStanding): string {
  return `${standing.streakCode}${standing.streakCount}`
}

export function getGameLabel(game: NHLGameFromAPI, pickedTeam: string): string {
  if (typeof window === 'undefined') return pickedTeam

  const day = new Date(game.startTimeUTC).toLocaleDateString(undefined, {
    weekday: 'short',
  })

  const opponent = game.awayTeam.abbrev === pickedTeam
    ? game.homeTeam.abbrev
    : game.awayTeam.abbrev

  const isHome = game.homeTeam.abbrev === pickedTeam

  return `${day} ${isHome ? 'vs' : '@'} ${opponent}`
}