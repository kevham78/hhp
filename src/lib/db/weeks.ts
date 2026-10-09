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

type WeekendGame = Awaited<ReturnType<typeof getWeekendGames>>['saturday'][number]

function gameData(weekId: string, game: WeekendGame, gameDay: 'SATURDAY' | 'SUNDAY') {
  return {
    weekId,
    nhlGameId:    String(game.id),
    homeTeam:     game.homeTeam.abbrev,
    awayTeam:     game.awayTeam.abbrev,
    homeTeamCode: game.homeTeam.abbrev,
    awayTeamCode: game.awayTeam.abbrev,
    gameTime:     new Date(game.startTimeUTC),
    gameDay,
    status:       'SCHEDULED' as const,
  }
}

// ─────────────────────────────────────────────
// A week's games are saved when the week is first created, but the
// picks page lists whatever the NHL schedule shows now. If the NHL adds
// a game after that, picks for it would be silently dropped on save.
// While picks are open, add any scheduled games we don't have yet.
// Existing games are never removed or changed — picks point at them.
// Returns true if anything was added.
// ─────────────────────────────────────────────

export async function addMissingGames(
  week:     { id: string; picksDeadline: Date; games: { nhlGameId: string }[] },
  satGames: WeekendGame[],
  sunGames: WeekendGame[],
): Promise<boolean> {
  if (!isPicksWindowOpen(week)) return false

  const scheduled = [
    ...satGames.map(game => ({ game, day: 'SATURDAY' as const })),
    ...sunGames.map(game => ({ game, day: 'SUNDAY' as const })),
  ]
  const cached = new Set(week.games.map(g => g.nhlGameId))
  if (scheduled.every(({ game }) => cached.has(String(game.id)))) return false

  // Two players loading the page at once could both see the game as
  // missing; a per-week lock plus a fresh re-check stops duplicates.
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${week.id}))`
    const existing = await tx.game.findMany({
      where:  { weekId: week.id },
      select: { nhlGameId: true },
    })
    const known = new Set(existing.map(g => g.nhlGameId))
    let added = false
    for (const { game, day } of scheduled) {
      if (known.has(String(game.id))) continue
      console.log(`[Weeks] Adding game ${game.id} (${game.awayTeam.abbrev} @ ${game.homeTeam.abbrev}) missing from week ${week.id}`)
      await tx.game.createMany({ data: [gameData(week.id, game, day)], skipDuplicates: true })
      added = true
    }
    return added
  })
}

export async function getOrCreateCurrentWeek() {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
  })
  if (!season) return null

  // Don't advance to a new week while a past week's results haven't
  // been approved yet — keep showing the oldest unresolved one
  // (locked/view-only via its own picksDeadline) until the
  // commissioner confirms results or the Monday auto-approve cron
  // does it for them.
  const pending = await prisma.week.findFirst({
    where: {
      seasonId:   season.id,
      status:     { not: 'COMPLETED' },
      sundayDate: { lt: new Date() },
    },
    orderBy: { weekNumber: 'asc' },
    include: { games: true },
  })
  if (pending) return pending

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
  const deadline = getPicksDeadline(saturday, settings?.picksRevealTime ?? '14:00')

  // Fetch games from NHL API (before the transaction, to keep it short)
  const { saturday: satGames, sunday: sunGames } = await getWeekendGames(saturday, sunday)

  // Create the week and all its games in one transaction. Previously the
  // week was saved first and its games inserted one by one; a player
  // opening My Picks in that window saw the games as "missing" and added
  // them too, so week 2 ended up with every game twice. Inside the
  // transaction nobody can see a half-built week, the lock stops two
  // simultaneous first visits from both creating it, and the
  // (weekId, nhlGameId) unique index is the last line of defence.
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'create-week:' + season.id}))`

    const created = await tx.week.findFirst({
      where: {
        seasonId:     season.id,
        saturdayDate: { gte: satStart, lte: satEnd },
      },
      include: { games: true },
    })
    if (created) return created

    const weekCount = await tx.week.count({ where: { seasonId: season.id } })
    const week = await tx.week.create({
      data: {
        seasonId:      season.id,
        weekNumber:    weekCount + 1,
        saturdayDate:  satStart,
        sundayDate:    new Date(new Date(sunday).setUTCHours(0, 0, 0, 0)),
        picksDeadline: deadline,
        status:        'OPEN',
      },
    })

    await tx.game.createMany({
      data: [
        ...satGames.map(game => gameData(week.id, game, 'SATURDAY')),
        ...sunGames.map(game => gameData(week.id, game, 'SUNDAY')),
      ],
      skipDuplicates: true,
    })

    return tx.week.findUniqueOrThrow({
      where:   { id: week.id },
      include: { games: true },
    })
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

export function getPicksDeadline(saturday: Date, timeEastern: string): Date {
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