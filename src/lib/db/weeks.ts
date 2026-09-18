import { prisma } from '@/lib/db/prisma'
import { getUpcomingWeekend, getWeekendGames } from '@/lib/api/nhl'
import { fromZonedTime } from 'date-fns-tz'

const EASTERN_TZ = 'America/New_York'

// ─────────────────────────────────────────────
// Get the target weekend — either the upcoming
// one or the first weekend of the season if
// we're before the season start date
// ─────────────────────────────────────────────

function getTargetWeekend(seasonStartDate: Date): { saturday: Date; sunday: Date } {
  const now = new Date()

  if (now < seasonStartDate) {
    // Before season starts — find first Saturday on or after season start.
    // Uses UTC getters/setters throughout (never local ones) since
    // seasonStartDate is a UTC-midnight-normalized calendar date.
    const firstSat = new Date(seasonStartDate)
    firstSat.setUTCHours(0, 0, 0, 0)
    while (firstSat.getUTCDay() !== 6) {
      firstSat.setUTCDate(firstSat.getUTCDate() + 1)
    }
    const firstSun = new Date(firstSat)
    firstSun.setUTCDate(firstSat.getUTCDate() + 1)
    return { saturday: firstSat, sunday: firstSun }
  }

  // During the season — use upcoming weekend
  return getUpcomingWeekend()
}

export async function getOrCreateCurrentWeek() {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
  })
  if (!season) return null

  const { saturday, sunday } = getTargetWeekend(new Date(season.startDate))

  const satStart = new Date(saturday)
  satStart.setUTCHours(0, 0, 0, 0)
  const satEnd = new Date(saturday)
  satEnd.setUTCHours(23, 59, 59, 999)

  // Check if week already exists
  const existing = await prisma.week.findFirst({
    where: {
      seasonId:     season.id,
      saturdayDate: { gte: satStart, lte: satEnd },
    },
    include: { games: true },
  })
  if (existing) return existing

  // Get settings for deadline
  const settings = await prisma.settings.findFirst({
    where: { id: 'default' },
  })

  const deadline  = getPicksDeadline(saturday, settings?.picksRevealTime ?? '14:00')
  const weekCount = await prisma.week.count({ where: { seasonId: season.id } })

  // Create the week
  const week = await prisma.week.create({
    data: {
      seasonId:      season.id,
      weekNumber:    weekCount + 1,
      saturdayDate:  satStart,
      sundayDate:    new Date(new Date(sunday).setUTCHours(0, 0, 0, 0)),
      picksDeadline: deadline,
      status:        'OPEN',
    },
  })

  // Fetch games from NHL API and save to DB
  const { saturday: satGames, sunday: sunGames } = await getWeekendGames(saturday, sunday)

  for (const game of satGames) {
    try {
      await prisma.game.create({
        data: {
          weekId:       week.id,
          nhlGameId:    String(game.id),
          homeTeam:     game.homeTeam.abbrev,
          awayTeam:     game.awayTeam.abbrev,
          homeTeamCode: game.homeTeam.abbrev,
          awayTeamCode: game.awayTeam.abbrev,
          gameTime:     new Date(game.startTimeUTC),
          gameDay:      'SATURDAY',
          status:       'SCHEDULED',
        },
      })
    } catch (err) {
      console.error('Failed to save Saturday game:', game.id, err)
    }
  }

  for (const game of sunGames) {
    try {
      await prisma.game.create({
        data: {
          weekId:       week.id,
          nhlGameId:    String(game.id),
          homeTeam:     game.homeTeam.abbrev,
          awayTeam:     game.awayTeam.abbrev,
          homeTeamCode: game.homeTeam.abbrev,
          awayTeamCode: game.awayTeam.abbrev,
          gameTime:     new Date(game.startTimeUTC),
          gameDay:      'SUNDAY',
          status:       'SCHEDULED',
        },
      })
    } catch (err) {
      console.error('Failed to save Sunday game:', game.id, err)
    }
  }

  return prisma.week.findUnique({
    where:   { id: week.id },
    include: { games: true },
  })
}

// Convert a Friday-of-the-week + Eastern wall-clock time into its
// correct UTC instant. `saturday` is a UTC-midnight-normalized
// calendar date, so UTC arithmetic gets "the day before" without
// shifting timezones; date-fns-tz then handles the DST-aware
// Eastern -> UTC conversion for the time itself.
function fridayAtEasternTime(saturday: Date, timeEastern: string): Date {
  const friday = new Date(Date.UTC(
    saturday.getUTCFullYear(),
    saturday.getUTCMonth(),
    saturday.getUTCDate() - 1,
  ))
  const y = friday.getUTCFullYear()
  const m = String(friday.getUTCMonth() + 1).padStart(2, '0')
  const d = String(friday.getUTCDate()).padStart(2, '0')

  return fromZonedTime(`${y}-${m}-${d}T${timeEastern}:00`, EASTERN_TZ)
}

function getPicksDeadline(saturday: Date, timeEastern: string): Date {
  return fridayAtEasternTime(saturday, timeEastern)
}

// Dues for a week start accruing Friday morning of that week —
// separate from the picks deadline (which is Friday afternoon).
export function getDuesOwedTime(saturday: Date): Date {
  return fridayAtEasternTime(saturday, '08:00')
}

export function isPicksWindowOpen(week: { picksDeadline: Date }): boolean {
  return new Date() < new Date(week.picksDeadline)
}

export function isPastDeadline(week: { picksDeadline: Date }): boolean {
  return new Date() > new Date(week.picksDeadline)
}