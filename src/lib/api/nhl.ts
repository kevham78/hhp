import { formatInTimeZone } from 'date-fns-tz'

const NHL_API = 'https://api-web.nhle.com/v1'
const EASTERN_TZ = 'America/New_York'

// NHL API gameType: 1 = preseason, 2 = regular season, 3 = playoffs.
// Preseason is included so a short pre-launch test season (using
// preseason weekends) can be run before the real regular season.
const PICKABLE_GAME_TYPES = [1, 2]

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type NHLGameFromAPI = {
  id:           number
  gameType:     number
  gameState:    string
  startTimeUTC: string
  awayTeam: {
    abbrev: string
    name:   { default: string }
    logo:   string
    score?: number
  }
  homeTeam: {
    abbrev: string
    name:   { default: string }
    logo:   string
    score?: number
  }
}

export type WeekendGames = {
  saturday: NHLGameFromAPI[]
  sunday:   NHLGameFromAPI[]
}

export type TeamStanding = {
  teamAbbrev:     { default: string }
  teamName:       { default: string }
  teamLogo:       string
  wins:           number
  losses:         number
  otLosses:       number
  points:         number
  gamesPlayed:    number
  l10Wins:        number
  l10Losses:      number
  l10OtLosses:    number
  streakCode:     string
  streakCount:    number
  divisionName:   string
  conferenceName: string
}

// ─────────────────────────────────────────────
// Eastern Time helpers
//
// node:20-alpine (used in production) ships with full ICU, so real
// IANA timezone conversion via date-fns-tz works reliably — verified
// directly against the image. Everywhere this app needs to know "what
// Eastern calendar date does this UTC instant fall on" (or vice
// versa), it goes through this instead of hand-rolled UTC-offset math,
// which can't precisely track the real DST transition dates.
// ─────────────────────────────────────────────

export function toEasternDateStr(date: Date): string {
  return formatInTimeZone(date, EASTERN_TZ, 'yyyy-MM-dd')
}

// ─────────────────────────────────────────────
// Format date as YYYY-MM-DD
//
// `date` is expected to be a UTC-midnight-normalized "calendar date"
// (as stored on Week.saturdayDate/sundayDate), so this reads it back
// with UTC getters — using local getters here caused the Week's
// stored Saturday to render as "Friday" on any host running in a
// timezone behind UTC (e.g. Eastern), since midnight UTC Saturday is
// still Friday evening local time.
// ─────────────────────────────────────────────

export function formatDate(date: Date): string {
  const year  = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day   = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ─────────────────────────────────────────────
// Get upcoming Saturday and Sunday (as Eastern
// calendar dates, returned as UTC-midnight Dates)
// ─────────────────────────────────────────────

export function getUpcomingWeekend(): { saturday: Date; sunday: Date } {
  // In development, hardcode a known good weekend with NHL games
  if (process.env.NODE_ENV === 'development') {
    return {
      saturday: new Date('2026-10-03T00:00:00Z'),
      sunday:   new Date('2026-10-04T00:00:00Z'),
    }
  }

  // "Today" as an Eastern calendar date, represented as a UTC-midnight
  // Date so downstream code (formatDate, DB storage) can keep treating
  // it as an abstract calendar date via UTC getters.
  const [y, m, d] = toEasternDateStr(new Date()).split('-').map(Number)
  const todayEastern = new Date(Date.UTC(y, m - 1, d))
  const dayOfWeek    = todayEastern.getUTCDay()

  let daysUntilSat: number
  if (dayOfWeek === 6) {
    daysUntilSat = 0
  } else if (dayOfWeek === 0) {
    daysUntilSat = -1
  } else {
    daysUntilSat = 6 - dayOfWeek
  }

  const saturday = new Date(Date.UTC(
    todayEastern.getUTCFullYear(),
    todayEastern.getUTCMonth(),
    todayEastern.getUTCDate() + daysUntilSat,
  ))
  const sunday = new Date(Date.UTC(
    saturday.getUTCFullYear(),
    saturday.getUTCMonth(),
    saturday.getUTCDate() + 1,
  ))

  return { saturday, sunday }
}

// ─────────────────────────────────────────────
// Fetch games for a specific date
// Only returns games that start on that date
// in Eastern time (excludes Friday bleed-over)
// ─────────────────────────────────────────────

async function getGamesForDate(date: Date): Promise<NHLGameFromAPI[]> {
  const dateStr = formatDate(date)
  console.log('[NHL] getGamesForDate called for:', dateStr)

  try {
    const res = await fetch(`${NHL_API}/schedule/${dateStr}`, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      console.error(`NHL API error for ${dateStr}:`, res.status)
      return []
    }

    const data = await res.json()

    const dayEntry = data.gameWeek?.find(
      (day: any) => day.date === dateStr
    )

    if (!dayEntry) return []

    return (dayEntry.games || [])
      .filter((g: NHLGameFromAPI) => PICKABLE_GAME_TYPES.includes(g.gameType))
      .filter((g: NHLGameFromAPI) => toEasternDateStr(new Date(g.startTimeUTC)) === dateStr)
  } catch (err) {
    console.error(`Failed to fetch NHL schedule for ${dateStr}:`, err)
    return []
  }
}

// ─────────────────────────────────────────────
// Fetch both Saturday and Sunday games
// ─────────────────────────────────────────────

export async function getWeekendGames(
  overrideSaturday?: Date,
  overrideSunday?:   Date
): Promise<WeekendGames> {
  const { saturday, sunday } = getUpcomingWeekend()

  const [satGames, sunGames] = await Promise.all([
    getGamesForDate(overrideSaturday ?? saturday),
    getGamesForDate(overrideSunday   ?? sunday),
  ])

  return {
    saturday: satGames,
    sunday:   sunGames,
  }
}

// ─────────────────────────────────────────────
// Fetch scores for a specific date (results)
// ─────────────────────────────────────────────

export type NHLGameResult = {
  nhlGameId:    string
  homeTeamCode: string
  awayTeamCode: string
  homeScore:    number
  awayScore:    number
  gameState:    string
  isLive:       boolean
  isFinal:      boolean
}

async function getResultsForDate(date: Date): Promise<NHLGameResult[]> {
  const dateStr = formatDate(date)
  try {
    const res = await fetch(`${NHL_API}/schedule/${dateStr}`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()

    const dayEntry = data.gameWeek?.find((day: any) => day.date === dateStr)
    if (!dayEntry) return []

    return (dayEntry.games || [])
      .filter((g: any) => PICKABLE_GAME_TYPES.includes(g.gameType))
      .filter((g: any) => {
        return toEasternDateStr(new Date(g.startTimeUTC)) === dateStr
      })
      .map((g: any) => ({
        nhlGameId:    String(g.id),
        homeTeamCode: g.homeTeam.abbrev,
        awayTeamCode: g.awayTeam.abbrev,
        homeScore:    g.homeTeam.score ?? 0,
        awayScore:    g.awayTeam.score ?? 0,
        gameState:    g.gameState,
        isLive:       g.gameState === 'LIVE',
        isFinal:      g.gameState === 'OFF',
      }))
  } catch {
    return []
  }
}

export async function getWeekendResults(
  saturdayDate: Date,
  sundayDate:   Date
): Promise<NHLGameResult[]> {
  const [satResults, sunResults] = await Promise.all([
    getResultsForDate(saturdayDate),
    getResultsForDate(sundayDate),
  ])
  return [...satResults, ...sunResults]
}

// ─────────────────────────────────────────────
// Fetch standings
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
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────
// Team logo URL
// ─────────────────────────────────────────────

export function getTeamLogoUrl(teamCode: string): string {
  return `https://assets.nhle.com/logos/nhl/svg/${teamCode}_dark.svg`
}

// ─────────────────────────────────────────────
// Game label for tiebreaker/suicide display
// e.g. "Sat @ TOR"
// ─────────────────────────────────────────────

export function getGameLabel(game: NHLGameFromAPI, pickedTeam: string): string {
  if (typeof window === 'undefined') return pickedTeam

  const day = new Date(game.startTimeUTC).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: EASTERN_TZ,
  })

  const opponent = game.awayTeam.abbrev === pickedTeam
    ? game.homeTeam.abbrev
    : game.awayTeam.abbrev

  const isHome = game.homeTeam.abbrev === pickedTeam

  return `${day} ${isHome ? 'vs' : '@'} ${opponent}`
}

export function getLast10Record(standing: TeamStanding): string {
  const { l10Wins, l10Losses, l10OtLosses } = standing
  return `${l10Wins}-${l10Losses}-${l10OtLosses}`
}

export function getStreakString(standing: TeamStanding): string {
  return `${standing.streakCode}${standing.streakCount}`
}