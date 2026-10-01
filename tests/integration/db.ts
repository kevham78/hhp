import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'

// ─────────────────────────────────────────────
// Test-data helpers for integration tests.
// Every test starts from an empty database (see setup.ts).
// ─────────────────────────────────────────────

export { prisma }

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map(t => `"${t.tablename}"`).join(', ')} CASCADE`)
  }
}

// Low bcrypt cost keeps tests fast; the app verifies any cost.
export const PASSWORD      = 'hockey'
const PASSWORD_HASH        = bcrypt.hashSync(PASSWORD, 4)

let seq = 0
const next = () => ++seq

// ── Session ────────────────────────────────

type SessionUser = { id: string; role: string; mustChangePassword?: boolean }

export function asUser(user: SessionUser | null) {
  ;(globalThis as any).__testSession = user
    ? { user: { id: user.id, role: user.role, mustChangePassword: user.mustChangePassword ?? false } }
    : null
}

export const sentEmails = (): { to: string | string[]; subject: string }[] =>
  (globalThis as any).__sentEmails

// ── NHL schedule (what the fake NHL API returns) ──

export type NhlGame = {
  id:     string
  home:   string
  away:   string
  start:  string                       // ISO UTC
  state?: 'FUT' | 'LIVE' | 'FINAL' | 'OFF'
  homeScore?: number
  awayScore?: number
}

export function setNhlSchedule(date: string, games: NhlGame[]) {
  ;(globalThis as any).__nhlSchedule[date] = games.map(g => ({
    id:           Number(g.id),
    gameType:     2,
    startTimeUTC: g.start,
    gameState:    g.state ?? 'FUT',
    homeTeam:     { abbrev: g.home, score: g.homeScore },
    awayTeam:     { abbrev: g.away, score: g.awayScore },
  }))
}

// ── Factories ──────────────────────────────

export async function createSettings(overrides: Record<string, unknown> = {}) {
  return prisma.settings.create({
    data: {
      id: 'default', weeklyDues: 5, weeklyPrize: 30, monthlyPrize: 5,
      suicideWinnerPrize: 5, suicideLoserPrize: 5, ...overrides,
    },
  })
}

export async function createSeason(opts: { active?: boolean; start?: string; name?: string } = {}) {
  const n = next()
  return prisma.season.create({
    data: {
      id:        `season-${n}`,
      name:      opts.name ?? `Season ${n}`,
      startDate: new Date(opts.start ?? '2026-09-29T00:00:00Z'),
      endDate:   new Date('2027-04-10T00:00:00Z'),
      isActive:  opts.active ?? true,
    },
  })
}

export async function createUser(opts: {
  name?: string; email?: string; role?: 'PLAYER' | 'ADMIN'
  isActive?: boolean; mustChangePassword?: boolean; seasonId?: string
} = {}) {
  const n = next()
  const user = await prisma.user.create({
    data: {
      name:               opts.name ?? `Player ${n}`,
      email:              opts.email ?? `player${n}@test.invalid`,
      password:           PASSWORD_HASH,
      role:               opts.role ?? 'PLAYER',
      isActive:           opts.isActive ?? true,
      mustChangePassword: opts.mustChangePassword ?? false,
      notifyByEmail:      true,
    },
  })
  if (opts.seasonId) await joinSeason(user.id, opts.seasonId)
  return user
}

// Per-season rows a player needs (normally created by register / start season)
export async function joinSeason(userId: string, seasonId: string) {
  await prisma.seasonStat.create({ data: { userId, seasonId } })
  await prisma.suicideStatus.create({
    data: { userId, seasonId, winnerTeamsUsed: [], loserTeamsUsed: [] },
  })
}

export async function createPools(seasonId: string, pot = 0) {
  for (const poolType of ['WINNER', 'LOSER'] as const) {
    await prisma.suicidePoolState.create({ data: { poolType, seasonId, currentPot: pot, isActive: true } })
  }
}

export type GameSpec = { home: string; away: string; day?: 'SATURDAY' | 'SUNDAY'; nhlId?: string }

export async function createWeek(opts: {
  seasonId:  string
  number?:   number
  saturday?: string                    // YYYY-MM-DD
  status?:   'UPCOMING' | 'OPEN' | 'LOCKED' | 'COMPLETED'
  published?: boolean
  deadline?: Date
  games?:    GameSpec[]
}) {
  const sat = new Date(`${opts.saturday ?? '2026-10-03'}T00:00:00Z`)
  const sun = new Date(sat); sun.setUTCDate(sat.getUTCDate() + 1)
  const deadline = opts.deadline ?? new Date(sat.getTime() - 6 * 3600_000)   // Fri 2pm EDT
  const week = await prisma.week.create({
    data: {
      seasonId:       opts.seasonId,
      weekNumber:     opts.number ?? 1,
      saturdayDate:   sat,
      sundayDate:     sun,
      picksDeadline:  deadline,
      status:         opts.status ?? 'OPEN',
      picksPublished: opts.published ?? false,
    },
  })
  for (const [i, g] of (opts.games ?? []).entries()) {
    const day  = g.day ?? 'SATURDAY'
    const date = day === 'SATURDAY' ? sat : sun
    await prisma.game.create({
      data: {
        weekId:       week.id,
        nhlGameId:    g.nhlId ?? `${week.weekNumber}0${i + 1}`,
        homeTeam:     g.home, awayTeam: g.away,
        homeTeamCode: g.home, awayTeamCode: g.away,
        gameTime:     new Date(date.getTime() + 23 * 3600_000),   // 7pm ET
        gameDay:      day,
      },
    })
  }
  return prisma.week.findUniqueOrThrow({ where: { id: week.id }, include: { games: true } })
}

type WeekWithGames = Awaited<ReturnType<typeof createWeek>>

// Mirror a stored week into the fake NHL API, optionally with final scores
export function publishWeekToNhl(week: WeekWithGames, finals?: Record<string, [number, number]>) {
  const byDate: Record<string, NhlGame[]> = {}
  for (const g of week.games) {
    const date  = g.gameTime.toISOString().slice(0, 10)
    const score = finals?.[g.homeTeamCode]
    ;(byDate[date] ??= []).push({
      id: g.nhlGameId, home: g.homeTeamCode, away: g.awayTeamCode,
      start: g.gameTime.toISOString(),
      ...(score ? { state: 'OFF', homeScore: score[0], awayScore: score[1] } : {}),
    })
  }
  for (const [date, games] of Object.entries(byDate)) setNhlSchedule(date, games)
}

// Submitted picks: { HOME_CODE_OF_GAME: pickedTeam }, tiebreakers by game home code
export async function submitPicks(userId: string, week: WeekWithGames, picks: Record<string, string>,
  tiebreakers: Record<string, number> = {}) {
  for (const [home, team] of Object.entries(picks)) {
    const game = week.games.find(g => g.homeTeamCode === home)!
    await prisma.pick.create({
      data: {
        userId, weekId: week.id, gameId: game.id, pickedTeam: team,
        tiebreakerRank: tiebreakers[home] ?? null, isDraft: false, submittedAt: new Date(),
      },
    })
  }
}

export async function suicidePick(userId: string, weekId: string, poolType: 'WINNER' | 'LOSER', team: string) {
  return prisma.suicidePick.create({
    data: { userId, weekId, poolType, pickedTeam: team, isDraft: false, submittedAt: new Date() },
  })
}

export const status = (userId: string, seasonId: string) =>
  prisma.suicideStatus.findUniqueOrThrow({ where: { userId_seasonId: { userId, seasonId } } })

// ── Route handler requests ─────────────────

export function post(body: unknown, url = 'http://test.local/api') {
  return new Request(url, {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  })
}
