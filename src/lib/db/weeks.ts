import { prisma } from '@/lib/db/prisma'
import { getUpcomingWeekend, getWeekendGames, easternOffsetHours } from '@/lib/api/nhl'

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

function getPicksDeadline(saturday: Date, timeEastern: string): Date {
  // saturday is a UTC-midnight-normalized calendar date — use UTC
  // arithmetic to get "the day before" without shifting timezones.
  const friday = new Date(Date.UTC(
    saturday.getUTCFullYear(),
    saturday.getUTCMonth(),
    saturday.getUTCDate() - 1,
  ))
  const [hours, minutes] = timeEastern.split(':').map(Number)
  // Convert the Eastern wall-clock time to UTC, accounting for DST —
  // a hardcoded EST (+5) offset made the Friday 2pm deadline show up
  // as 3pm during EDT.
  friday.setUTCHours(hours + easternOffsetHours(friday), minutes, 0, 0)
  return friday
}

export function isPicksWindowOpen(week: { picksDeadline: Date }): boolean {
  return new Date() < new Date(week.picksDeadline)
}

export function isPastDeadline(week: { picksDeadline: Date }): boolean {
  return new Date() > new Date(week.picksDeadline)
}