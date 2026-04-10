import { prisma } from '@/lib/db/prisma'
import { getUpcomingWeekend, getWeekendGames } from '@/lib/api/nhl'

export async function getOrCreateCurrentWeek() {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
  })
  if (!season) return null

  const { saturday, sunday } = getUpcomingWeekend()

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

  const deadline   = getPicksDeadline(saturday, settings?.picksRevealTime ?? '14:00')
  const weekCount  = await prisma.week.count({ where: { seasonId: season.id } })

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
  const { saturday: satGames, sunday: sunGames } = await getWeekendGames()

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
    
  }
}

  return prisma.week.findUnique({
    where:   { id: week.id },
    include: { games: true },
  })
}

function getPicksDeadline(saturday: Date, timeEST: string): Date {
  const friday = new Date(saturday)
  friday.setDate(saturday.getDate() - 1)
  const [hours, minutes] = timeEST.split(':').map(Number)
  friday.setUTCHours(hours + 5, minutes, 0, 0)
  return friday
}

export function isPicksWindowOpen(week: { picksDeadline: Date }): boolean {
  return new Date() < new Date(week.picksDeadline)
}

export function isPastDeadline(week: { picksDeadline: Date }): boolean {
  return new Date() > new Date(week.picksDeadline)
}